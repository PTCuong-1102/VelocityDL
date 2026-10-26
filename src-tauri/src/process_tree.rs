//! Kill an OS process *and its entire subtree* (the Deno sidecar spawns
//! yt-dlp / spotDL / gallery-dl / instaloader as grandchildren, and killing
//! only the sidecar leaves those runners alive — orphaned downloads keep
//! writing to disk and can race a resumed job on the same `.part` file).
//!
//! Strategy per platform:
//! - Windows: `taskkill /PID <pid> /T /F` (native tree kill).
//! - Linux:   walk `/proc/<pid>/task/<tid>/children` recursively and SIGKILL
//!            every descendant, then the root itself.
//! - macOS:   recursive `pgrep -P <child>` discovery + `kill -9`.
//!
//! Falls back to `kill -9 <pid>` for the root when discovery partially fails,
//! so callers are always at least as effective as the old single-kill.

use std::process::Command;

/// Kill the whole process tree rooted at `pid` (best effort; must not panic).
pub fn kill_tree(pid: u32) {
    if pid == 0 {
        return;
    }
    // Match arms can not be cfg-gated, so dispatch through cfg'd locals.
    #[cfg(target_os = "windows")]
    let result = kill_tree_windows(pid);
    #[cfg(target_os = "linux")]
    let result = kill_tree_linux(pid);
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    let result = kill_tree_unix_generic(pid);

    if let Err(err) = result {
        eprintln!("[process_tree] kill tree of {pid}: non-fatal error {err}");
    }
}

#[cfg(target_os = "windows")]
fn kill_tree_windows(pid: u32) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| e.to_string())
        .and_then(|out| {
            if out.status.success() {
                Ok(())
            } else {
                Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
            }
        })
}

#[cfg(target_os = "linux")]
fn kill_tree_linux(pid: u32) -> Result<(), String> {
    let mut victims: Vec<String> = Vec::new();
    collect_children_linux(pid, &mut victims);
    victims.push(pid.to_string());
    // One `kill -9` invocation per victim; each must not fail the whole tree.
    let args = ["-9"].iter().copied()
        .chain(victims.iter().map(|s| s.as_str()))
        .collect::<Vec<&str>>();
    let _ = Command::new("kill").args(&args).output();
    Ok(())
}

/// Recursively append descendants of `pid` (children first, pre-order) by
/// parsing `/proc/<pid>/task/<tid>/children` (space-separated pid list).
#[cfg(target_os = "linux")]
fn collect_children_linux(pid: u32, out: &mut Vec<String>) {
    let tasks = match std::fs::read_dir(format!("/proc/{pid}/task")) {
        Ok(d) => d,
        Err(_) => return, // already gone
    };
    for task in tasks.flatten() {
        let children_path = task.path().join("children");
        let children = match std::fs::read_to_string(&children_path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        for child in children.split_whitespace() {
            let child_pid = match child.parse::<u32>() {
                Ok(p) => p,
                Err(_) => continue,
            };
            collect_children_linux(child_pid, out);
            out.push(child_pid.to_string());
        }
    }
}

/// macOS (and any other unix): discover descendants with pgrep, then kill.
#[cfg_attr(any(windows, target_os = "linux"), allow(dead_code))]
fn kill_tree_unix_generic(pid: u32) -> Result<(), String> {
    let mut victims: Vec<String> = Vec::new();
    collect_children_pgrep(pid, &mut victims);
    victims.push(pid.to_string());
    let _ = Command::new("kill").args(["-9"]).args(&victims).output();
    Ok(())
}

#[cfg_attr(any(windows, target_os = "linux"), allow(dead_code))]
fn collect_children_pgrep(pid: u32, out: &mut Vec<String>) {
    // Depth cap guards against pathological/cyclic input (pgrep output is
    // trusted to be pids, but a broken pgrep could loop forever otherwise).
    let mut next = vec![pid];
    let mut depth = 0;
    while !next.is_empty() && depth < 32 {
        let mut found = Vec::new();
        for p in next.drain(..) {
            if let Ok(o) = Command::new("pgrep").args(["-P", &p.to_string()]).output() {
                for pid_str in String::from_utf8_lossy(&o.stdout).split_whitespace() {
                    if let Ok(child) = pid_str.parse::<u32>() {
                        found.push(child);
                    }
                }
            }
        }
        depth += 1;
        for child in found {
            out.push(child.to_string());
            next.push(child);
        }
    }
    // Dedup (pgrep can repeat pids on multi-depth walks).
    out.sort();
    out.dedup();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kill_tree_zero_is_noop() {
        // Must not panic and must not try to kill pid 0.
        kill_tree(0);
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn collect_children_does_not_panic_on_live_pid() {
        // Walk /proc for our own process (likely no children) and for pid 1.
        let mut out = Vec::new();
        collect_children_linux(std::process::id(), &mut out);
        let mut out2 = Vec::new();
        collect_children_linux(1, &mut out2);
        // Nothing to assert beyond "no panic" — output contents are
        // environment-dependent.
    }

    #[test]
    fn kill_tree_current_process_survives_targeting_absent_pid() {
        // Kill a pid that almost certainly doesn't exist; must be silent.
        kill_tree(4_000_000);
    }
}
