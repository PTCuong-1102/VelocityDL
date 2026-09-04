import type { AnyDownloadItem } from '../types/download';

export interface SidecarDownloadOptions {
  maxHeight: number;
  extractSubs: boolean;
  audioOnly: boolean;
  audioFormat?: string;
  audioQuality?: string;
  selectedSubtitles?: string[];
  embedSubs?: boolean;
}

/**
 * Parse a UI quality label into a yt-dlp max height.
 * Handles "1080p", "1920x1080", "4K"/"8K", falls back otherwise.
 */
export function parseMaxHeight(quality: string | undefined, fallback = 1080): number {
  if (!quality) return fallback;
  const q = quality.trim().toLowerCase();
  if (q === 'playlist' || q === 'auto' || q === 'unknown') return fallback;

  const pMatch = q.match(/(\d+)\s*p(?:$|[^a-z])/);
  if (pMatch) return parseInt(pMatch[1], 10);

  const kMatch = q.match(/(\d+)\s*k\b/);
  if (kMatch) {
    const n = parseInt(kMatch[1], 10);
    if (n === 8) return 4320;
    if (n === 4) return 2160;
    return fallback;
  }

  const xMatch = q.match(/x(\d+)\s*$/);
  if (xMatch) return parseInt(xMatch[1], 10);

  return fallback;
}

/**
 * Bound persisted history so localStorage can't grow without limit.
 * Drops the oldest finished items beyond the cap.
 */
export const MAX_FINISHED_ITEMS = 200;

export function trimFinished(downloads: AnyDownloadItem[]): AnyDownloadItem[] {
  const finishedIdx = downloads
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.status === 'finished')
    .sort(
      (a, b) =>
        (a.d.completedAt ?? a.d.createdAt) - (b.d.completedAt ?? b.d.createdAt)
    );
  if (finishedIdx.length <= MAX_FINISHED_ITEMS) return downloads;
  const drop = new Set(
    finishedIdx.slice(0, finishedIdx.length - MAX_FINISHED_ITEMS).map(({ i }) => i)
  );
  return downloads.filter((_, i) => !drop.has(i));
}

/**
 * Build the exact options object forwarded to the Rust/Deno backend.
 * Prefers per-item persisted options (set at creation from the download
 * form — incl. subtitles); falls back to legacy reconstruction from
 * quality/format strings for items persisted before the options were stored.
 */
export function buildSidecarOptions(item: AnyDownloadItem): SidecarDownloadOptions {
  const isAudio = item.mediaType === 'audio';
  const audioFormat = item.audioFormat ?? (isAudio ? item.format.toLowerCase() : undefined);
  const audioQuality =
    item.audioQuality ??
    (isAudio
      ? item.quality.includes('kbps')
        ? item.quality.replace('kbps', 'k')
        : '320k'
      : undefined);

  // Explicit subtitle opt-in wins; legacy items without stored options
  // keep the old default (no subtitles).
  const extractSubs =
    item.extractSubs ?? (item.selectedSubtitles?.length ? true : false);

  return {
    maxHeight: item.maxHeight ?? (isAudio ? 0 : parseMaxHeight(item.quality)),
    extractSubs,
    audioOnly: isAudio,
    ...(audioFormat ? { audioFormat } : {}),
    ...(audioQuality ? { audioQuality } : {}),
    ...(item.selectedSubtitles?.length ? { selectedSubtitles: item.selectedSubtitles } : {}),
    ...(item.embedSubs !== undefined ? { embedSubs: item.embedSubs } : {}),
  };
}
