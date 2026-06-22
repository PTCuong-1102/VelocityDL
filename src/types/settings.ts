export interface AppSettings {
  engine: {
    concurrentThreads: number;
    proxyType: 'HTTP' | 'SOCKS5';
    proxyAddress: string;
    autoUpdateYtdlp: boolean;
    cookieSource: 'none' | 'chrome' | 'firefox' | 'edge' | 'safari' | 'opera' | 'file';
    cookieFilePath: string;
  };
  storage: {
    defaultDownloadPath: string;
    createSubfolders: boolean;
  };
  general: {
    theme: 'deep-space' | 'system-sync';
    launchOnBoot: boolean;
    desktopNotifications: boolean;
  };
}
