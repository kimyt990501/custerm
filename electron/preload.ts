import { contextBridge, ipcRenderer } from 'electron';

// 보안: contextBridge를 통해 렌더러에 안전한 API만 노출한다.
// ipcRenderer를 직접 노출하지 않고, 허용된 채널만 래핑한다.

contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: (): string => process.versions.electron,

  // --- 창 컨트롤 API ---
  windowMinimize: (): void => ipcRenderer.send('window:minimize'),
  windowMaximize: (): void => ipcRenderer.send('window:maximize'),
  windowClose: (): void => ipcRenderer.send('window:close'),

  onTabSwitch: (callback: (direction: 'next' | 'prev') => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, direction: 'next' | 'prev') => {
      callback(direction);
    };
    ipcRenderer.on('shortcut:tab-switch', handler);
    return () => {
      ipcRenderer.removeListener('shortcut:tab-switch', handler);
    };
  },

  onToggleSettings: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('shortcut:toggle-settings', handler);
    return () => ipcRenderer.removeListener('shortcut:toggle-settings', handler);
  },

  onFontSizeChange: (callback: (action: 'increase' | 'decrease' | 'reset') => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: 'increase' | 'decrease' | 'reset') => {
      callback(action);
    };
    ipcRenderer.on('shortcut:font-size', handler);
    return () => ipcRenderer.removeListener('shortcut:font-size', handler);
  },

  // --- PTY API ---
  pty: {
    spawn: (shell?: string): Promise<{ id: string; shell: string }> =>
      ipcRenderer.invoke('pty:spawn', shell),

    write: (id: string, data: string): void =>
      ipcRenderer.send('pty:write', id, data),

    resize: (id: string, cols: number, rows: number): void =>
      ipcRenderer.send('pty:resize', id, cols, rows),

    kill: (id: string): void =>
      ipcRenderer.send('pty:kill', id),

    startListening: (id: string): void =>
      ipcRenderer.send('pty:start-listening', id),

    onData: (callback: (id: string, data: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, data: string) => {
        callback(id, data);
      };
      ipcRenderer.on('pty:data', handler);
      return () => ipcRenderer.removeListener('pty:data', handler);
    },

    onExit: (callback: (id: string, exitCode: number) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, id: string, exitCode: number) => {
        callback(id, exitCode);
      };
      ipcRenderer.on('pty:exit', handler);
      return () => ipcRenderer.removeListener('pty:exit', handler);
    },
  },

  // --- SSH API ---
  ssh: {
    connect: (params: { profileId: string; password?: string; passphrase?: string }): Promise<{ sessionId: string }> =>
      ipcRenderer.invoke('ssh:connect', params),

    write: (sessionId: string, data: string): void =>
      ipcRenderer.send('ssh:write', sessionId, data),

    resize: (sessionId: string, cols: number, rows: number): void =>
      ipcRenderer.send('ssh:resize', sessionId, cols, rows),

    disconnect: (sessionId: string): void =>
      ipcRenderer.send('ssh:disconnect', sessionId),

    startListening: (sessionId: string): void =>
      ipcRenderer.send('ssh:start-listening', sessionId),

    onData: (callback: (sessionId: string, data: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, data: string) => {
        callback(sessionId, data);
      };
      ipcRenderer.on('ssh:data', handler);
      return () => ipcRenderer.removeListener('ssh:data', handler);
    },

    onExit: (callback: (sessionId: string, exitCode: number) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, exitCode: number) => {
        callback(sessionId, exitCode);
      };
      ipcRenderer.on('ssh:exit', handler);
      return () => ipcRenderer.removeListener('ssh:exit', handler);
    },

    onError: (callback: (sessionId: string, error: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, sessionId: string, error: string) => {
        callback(sessionId, error);
      };
      ipcRenderer.on('ssh:error', handler);
      return () => ipcRenderer.removeListener('ssh:error', handler);
    },
  },

  // --- 프로필 API ---
  profile: {
    list: (): Promise<unknown[]> =>
      ipcRenderer.invoke('profile:list'),

    create: (input: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke('profile:create', input),

    update: (id: string, input: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke('profile:update', id, input),

    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('profile:delete', id),

    selectKeyFile: (): Promise<string | null> =>
      ipcRenderer.invoke('profile:select-key-file'),
  },

  // --- SFTP API ---
  sftp: {
    open: (sshSessionId: string): Promise<{ sftpId: string }> =>
      ipcRenderer.invoke('sftp:open', sshSessionId),

    close: (sftpId: string): void =>
      ipcRenderer.send('sftp:close', sftpId),

    readdir: (sftpId: string, remotePath: string): Promise<unknown[]> =>
      ipcRenderer.invoke('sftp:readdir', sftpId, remotePath),

    mkdir: (sftpId: string, remotePath: string): Promise<void> =>
      ipcRenderer.invoke('sftp:mkdir', sftpId, remotePath),

    delete: (sftpId: string, remotePath: string): Promise<void> =>
      ipcRenderer.invoke('sftp:delete', sftpId, remotePath),

    rmdir: (sftpId: string, remotePath: string): Promise<void> =>
      ipcRenderer.invoke('sftp:rmdir', sftpId, remotePath),

    rename: (sftpId: string, oldPath: string, newPath: string): Promise<void> =>
      ipcRenderer.invoke('sftp:rename', sftpId, oldPath, newPath),

    stat: (sftpId: string, remotePath: string): Promise<unknown> =>
      ipcRenderer.invoke('sftp:stat', sftpId, remotePath),

    upload: (sftpId: string, localPath: string, remotePath: string): Promise<{ transferId: string }> =>
      ipcRenderer.invoke('sftp:upload', sftpId, localPath, remotePath),

    download: (sftpId: string, remotePath: string, localPath: string): Promise<{ transferId: string }> =>
      ipcRenderer.invoke('sftp:download', sftpId, remotePath, localPath),

    cancelTransfer: (transferId: string): void =>
      ipcRenderer.send('sftp:cancel-transfer', transferId),

    onTransferProgress: (callback: (transferId: string, transferred: number, total: number) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, transferId: string, transferred: number, total: number) => {
        callback(transferId, transferred, total);
      };
      ipcRenderer.on('sftp:transfer-progress', handler);
      return () => ipcRenderer.removeListener('sftp:transfer-progress', handler);
    },

    onTransferComplete: (callback: (transferId: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, transferId: string) => {
        callback(transferId);
      };
      ipcRenderer.on('sftp:transfer-complete', handler);
      return () => ipcRenderer.removeListener('sftp:transfer-complete', handler);
    },

    onTransferError: (callback: (transferId: string, error: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, transferId: string, error: string) => {
        callback(transferId, error);
      };
      ipcRenderer.on('sftp:transfer-error', handler);
      return () => ipcRenderer.removeListener('sftp:transfer-error', handler);
    },
  },

  // --- 로컬 파일시스템 API ---
  local: {
    readdir: (localPath: string): Promise<unknown[]> =>
      ipcRenderer.invoke('local:readdir', localPath),

    homedir: (): Promise<string> =>
      ipcRenderer.invoke('local:homedir'),

    tmux: {
      list: (): Promise<{ tmuxAvailable: boolean; sessions: unknown[] }> =>
        ipcRenderer.invoke('local-tmux:list'),

      attach: (ptyId: string, sessionName: string): void =>
        ipcRenderer.send('local-tmux:attach', ptyId, sessionName),

      new: (ptyId: string, sessionName?: string): void =>
        ipcRenderer.send('local-tmux:new', ptyId, sessionName),

      detach: (ptyId: string): void =>
        ipcRenderer.send('local-tmux:detach', ptyId),

      kill: (sessionName: string): Promise<void> =>
        ipcRenderer.invoke('local-tmux:kill', sessionName),

      listWindows: (sessionName: string): Promise<unknown[]> =>
        ipcRenderer.invoke('local-tmux:list-windows', sessionName),

      listPanes: (sessionName: string, windowIndex: number): Promise<unknown[]> =>
        ipcRenderer.invoke('local-tmux:list-panes', sessionName, windowIndex),

      sendKeys: (ptyId: string, keys: string): void =>
        ipcRenderer.send('local-tmux:send-keys', ptyId, keys),

      setMouse: (ptyId: string, on: boolean): void =>
        ipcRenderer.send('local-tmux:set-mouse', ptyId, on),
    },

    docker: {
      list: (): Promise<unknown> =>
        ipcRenderer.invoke('local-docker:list'),
      start: (id: string): Promise<void> =>
        ipcRenderer.invoke('local-docker:start', id),
      stop: (id: string): Promise<void> =>
        ipcRenderer.invoke('local-docker:stop', id),
      restart: (id: string): Promise<void> =>
        ipcRenderer.invoke('local-docker:restart', id),
      remove: (id: string, force: boolean): Promise<void> =>
        ipcRenderer.invoke('local-docker:remove', id, force),
      removeImage: (id: string, force: boolean): Promise<void> =>
        ipcRenderer.invoke('local-docker:removeImage', id, force),
      pullImage: (ref: string): Promise<string> =>
        ipcRenderer.invoke('local-docker:pullImage', ref),
      exec: (ptyId: string, name: string, shell: string): void =>
        ipcRenderer.send('local-docker:exec', ptyId, name, shell),
      logs: (ptyId: string, name: string): void =>
        ipcRenderer.send('local-docker:logs', ptyId, name),
    },
  },

  // --- 포트 포워딩 API ---
  portforward: {
    create: (sshSessionId: string, config: Record<string, unknown>): Promise<{ tunnelId: string }> =>
      ipcRenderer.invoke('portforward:create', sshSessionId, config),

    close: (tunnelId: string): void =>
      ipcRenderer.send('portforward:close', tunnelId),

    list: (sshSessionId: string): Promise<unknown[]> =>
      ipcRenderer.invoke('portforward:list', sshSessionId),

    onStatusUpdate: (callback: (tunnelId: string, tunnel: unknown) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, tunnelId: string, tunnel: unknown) => {
        callback(tunnelId, tunnel);
      };
      ipcRenderer.on('portforward:status-update', handler);
      return () => ipcRenderer.removeListener('portforward:status-update', handler);
    },

    onError: (callback: (tunnelId: string, error: string) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, tunnelId: string, error: string) => {
        callback(tunnelId, error);
      };
      ipcRenderer.on('portforward:error', handler);
      return () => ipcRenderer.removeListener('portforward:error', handler);
    },
  },

  // --- tmux API ---
  tmux: {
    list: (sshSessionId: string): Promise<{ tmuxAvailable: boolean; sessions: unknown[] }> =>
      ipcRenderer.invoke('tmux:list', sshSessionId),

    attach: (sshSessionId: string, sessionName: string): void =>
      ipcRenderer.send('tmux:attach', sshSessionId, sessionName),

    new: (sshSessionId: string, sessionName?: string): void =>
      ipcRenderer.send('tmux:new', sshSessionId, sessionName),

    detach: (sshSessionId: string): void =>
      ipcRenderer.send('tmux:detach', sshSessionId),

    kill: (sshSessionId: string, sessionName: string): Promise<void> =>
      ipcRenderer.invoke('tmux:kill', sshSessionId, sessionName),

    listWindows: (sshSessionId: string, sessionName: string): Promise<unknown[]> =>
      ipcRenderer.invoke('tmux:list-windows', sshSessionId, sessionName),

    listPanes: (sshSessionId: string, sessionName: string, windowIndex: number): Promise<unknown[]> =>
      ipcRenderer.invoke('tmux:list-panes', sshSessionId, sessionName, windowIndex),

    sendKeys: (sshSessionId: string, keys: string): void =>
      ipcRenderer.send('tmux:send-keys', sshSessionId, keys),

    setMouse: (sshSessionId: string, on: boolean): void =>
      ipcRenderer.send('tmux:set-mouse', sshSessionId, on),
  },

  // --- Docker API (SSH) ---
  docker: {
    list: (sshSessionId: string): Promise<unknown> =>
      ipcRenderer.invoke('docker:list', sshSessionId),
    start: (sshSessionId: string, id: string): Promise<void> =>
      ipcRenderer.invoke('docker:start', sshSessionId, id),
    stop: (sshSessionId: string, id: string): Promise<void> =>
      ipcRenderer.invoke('docker:stop', sshSessionId, id),
    restart: (sshSessionId: string, id: string): Promise<void> =>
      ipcRenderer.invoke('docker:restart', sshSessionId, id),
    remove: (sshSessionId: string, id: string, force: boolean): Promise<void> =>
      ipcRenderer.invoke('docker:remove', sshSessionId, id, force),
    removeImage: (sshSessionId: string, id: string, force: boolean): Promise<void> =>
      ipcRenderer.invoke('docker:removeImage', sshSessionId, id, force),
    pullImage: (sshSessionId: string, ref: string): Promise<string> =>
      ipcRenderer.invoke('docker:pullImage', sshSessionId, ref),
    exec: (sshSessionId: string, name: string, shell: string): void =>
      ipcRenderer.send('docker:exec', sshSessionId, name, shell),
    logs: (sshSessionId: string, name: string): void =>
      ipcRenderer.send('docker:logs', sshSessionId, name),
  },

  // --- WSL API ---
  wsl: {
    listDistros: (): Promise<string[]> =>
      ipcRenderer.invoke('wsl:list-distros'),

    tmux: {
      list: (distro: string): Promise<{ tmuxAvailable: boolean; sessions: unknown[] }> =>
        ipcRenderer.invoke('wsl-tmux:list', distro),

      attach: (ptyId: string, sessionName: string): void =>
        ipcRenderer.send('wsl-tmux:attach', ptyId, sessionName),

      new: (ptyId: string, sessionName?: string): void =>
        ipcRenderer.send('wsl-tmux:new', ptyId, sessionName),

      detach: (ptyId: string): void =>
        ipcRenderer.send('wsl-tmux:detach', ptyId),

      kill: (distro: string, sessionName: string): Promise<void> =>
        ipcRenderer.invoke('wsl-tmux:kill', distro, sessionName),

      listWindows: (distro: string, sessionName: string): Promise<unknown[]> =>
        ipcRenderer.invoke('wsl-tmux:list-windows', distro, sessionName),

      listPanes: (distro: string, sessionName: string, windowIndex: number): Promise<unknown[]> =>
        ipcRenderer.invoke('wsl-tmux:list-panes', distro, sessionName, windowIndex),

      sendKeys: (ptyId: string, keys: string): void =>
        ipcRenderer.send('wsl-tmux:send-keys', ptyId, keys),

      setMouse: (ptyId: string, on: boolean): void =>
        ipcRenderer.send('wsl-tmux:set-mouse', ptyId, on),
    },

    docker: {
      list: (distro: string): Promise<unknown> =>
        ipcRenderer.invoke('wsl-docker:list', distro),
      start: (distro: string, id: string): Promise<void> =>
        ipcRenderer.invoke('wsl-docker:start', distro, id),
      stop: (distro: string, id: string): Promise<void> =>
        ipcRenderer.invoke('wsl-docker:stop', distro, id),
      restart: (distro: string, id: string): Promise<void> =>
        ipcRenderer.invoke('wsl-docker:restart', distro, id),
      remove: (distro: string, id: string, force: boolean): Promise<void> =>
        ipcRenderer.invoke('wsl-docker:remove', distro, id, force),
      removeImage: (distro: string, id: string, force: boolean): Promise<void> =>
        ipcRenderer.invoke('wsl-docker:removeImage', distro, id, force),
      pullImage: (distro: string, ref: string): Promise<string> =>
        ipcRenderer.invoke('wsl-docker:pullImage', distro, ref),
      exec: (ptyId: string, name: string, shell: string): void =>
        ipcRenderer.send('wsl-docker:exec', ptyId, name, shell),
      logs: (ptyId: string, name: string): void =>
        ipcRenderer.send('wsl-docker:logs', ptyId, name),
    },
  },

  // --- DB 프로필 API ---
  dbProfile: {
    list: (): Promise<unknown[]> =>
      ipcRenderer.invoke('db-profile:list'),
    create: (input: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke('db-profile:create', input),
    update: (id: string, input: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke('db-profile:update', id, input),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('db-profile:delete', id),
  },

  // --- DB (MySQL) API ---
  db: {
    connect: (params: { profileId: string; password?: string }): Promise<{ connId: string; serverVersion: string }> =>
      ipcRenderer.invoke('db:connect', params),
    disconnect: (connId: string): void =>
      ipcRenderer.send('db:disconnect', connId),
    listDatabases: (connId: string): Promise<string[]> =>
      ipcRenderer.invoke('db:list-databases', connId),
    listTables: (connId: string, dbName: string): Promise<unknown[]> =>
      ipcRenderer.invoke('db:list-tables', connId, dbName),
    describeTable: (connId: string, dbName: string, tableName: string): Promise<unknown[]> =>
      ipcRenderer.invoke('db:describe-table', connId, dbName, tableName),
    query: (connId: string, queryId: string, sql: string, dbContext?: string): Promise<unknown> =>
      ipcRenderer.invoke('db:query', connId, queryId, sql, dbContext),
    cancel: (connId: string, queryId: string): Promise<void> =>
      ipcRenderer.invoke('db:cancel', connId, queryId),
    fetchTableData: (connId: string, params: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke('db:fetch-table-data', connId, params),
    updateRow: (connId: string, dbName: string, tableName: string, mutation: Record<string, unknown>): Promise<number> =>
      ipcRenderer.invoke('db:update-row', connId, dbName, tableName, mutation),
    insertRow: (connId: string, dbName: string, tableName: string, values: Record<string, unknown>): Promise<{ affectedRows: number; insertId: number }> =>
      ipcRenderer.invoke('db:insert-row', connId, dbName, tableName, values),
    deleteRow: (connId: string, dbName: string, tableName: string, pk: Record<string, unknown>): Promise<number> =>
      ipcRenderer.invoke('db:delete-row', connId, dbName, tableName, pk),
  },

  // --- 클립보드 API ---
  clipboard: {
    paste: (): Promise<{ type: 'image'; path: string } | { type: 'text'; text: string } | { type: 'empty' }> =>
      ipcRenderer.invoke('clipboard:paste'),
  },

  // --- 설정 API ---
  settings: {
    get: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke('settings:get'),

    update: (partial: Record<string, unknown>): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke('settings:update', partial),

    getThemes: (): Promise<unknown[]> =>
      ipcRenderer.invoke('settings:get-themes'),

    getThemeNames: (): Promise<string[]> =>
      ipcRenderer.invoke('settings:get-theme-names'),

    getTheme: (name: string): Promise<unknown> =>
      ipcRenderer.invoke('settings:get-theme', name),
  },
});
