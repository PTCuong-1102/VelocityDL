import { describe, expect, it } from 'vitest';
import { mergeWithDefaults } from './settingsStore';
import { AppSettings } from '../types/settings';

const DEFAULTS: AppSettings = {
  engine: {
    concurrentThreads: 3,
    proxyType: 'HTTP',
    proxyAddress: '',
    autoUpdateYtdlp: true,
    cookieSource: 'default',
    cookieFilePath: '',
    speedLimit: 0,
  },
  storage: { defaultDownloadPath: '', createSubfolders: false },
  general: { theme: 'deep-space', launchOnBoot: false, desktopNotifications: true },
};

describe('mergeWithDefaults (settings upgrade crash guard)', () => {
  it('fills every key when the saved file came from an older version with missing sections', () => {
    const old = {
      engine: { concurrentThreads: 2, proxyAddress: '127.0.0.1:8080' },
      storage: { defaultDownloadPath: '/tmp/dl' },
    };
    const out = mergeWithDefaults(old, DEFAULTS);
    expect(out.engine.concurrentThreads).toBe(2);
    expect(out.engine.proxyAddress).toBe('127.0.0.1:8080');
    expect(out.storage.defaultDownloadPath).toBe('/tmp/dl');
    expect(out.general).toEqual(DEFAULTS.general);
    expect(out.engine.speedLimit).toBe(0);
    expect(out.engine.proxyType).toBe('HTTP');
    expect(out.storage.createSubfolders).toBe(false);
  });

  it('keeps saved values even when falsy (0, false, empty string)', () => {
    const saved = {
      engine: { concurrentThreads: 0, speedLimit: 0, proxyAddress: '' },
      storage: { createSubfolders: false },
      general: { launchOnBoot: true },
    };
    const out = mergeWithDefaults(saved, DEFAULTS);
    expect(out.storage.createSubfolders).toBe(false);
    expect(out.general.launchOnBoot).toBe(true);
    expect(out.general.desktopNotifications).toBe(true);
  });

  it('rejects type-mismatched values and falls back to the default (theme typo)', () => {
    const saved = { general: { theme: 123 }, engine: { concurrentThreads: 'five' } };
    const out = mergeWithDefaults(saved, DEFAULTS);
    expect(out.general.theme).toBe('deep-space');
    expect(out.engine.concurrentThreads).toBe(3);
  });

  it('returns full defaults for null / non-object input', () => {
    expect(mergeWithDefaults(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(mergeWithDefaults('garbage', DEFAULTS)).toEqual(DEFAULTS);
  });
});
