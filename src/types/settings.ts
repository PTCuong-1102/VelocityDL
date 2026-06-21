export interface AppSettings {
  engine: {
    concurrentThreads: number;
    proxyType: 'HTTP' | 'SOCKS5';
    proxyAddress: string;
    autoUpdateYtdlp: boolean;
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
