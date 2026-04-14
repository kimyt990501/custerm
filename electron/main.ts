import { app, BrowserWindow, dialog, globalShortcut, ipcMain, session } from 'electron';
import path from 'node:path';
import { spawnPty, getPty, writePty, resizePty, killPty, killAllPtys } from './pty-manager';
import {
  listProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
} from './profile-store';
import {
  connectSsh,
  getSshSession,
  writeSsh,
  resizeSsh,
  disconnectSsh,
  disconnectAllSsh,
} from './ssh-manager';
import type { SshProfileInput, SshConnectParams } from './ssh-types';
import {
  openSftp,
  closeSftp,
  closeAllSftp,
  sftpReaddir,
  sftpMkdir,
  sftpDelete,
  sftpRmdir,
  sftpRename,
  sftpStat,
  startUpload,
  startDownload,
  cancelTransfer,
  localReaddir,
  localHomedir,
} from './sftp-manager';
import {
  createTunnel,
  closeTunnel,
  closeAll as closeAllPortForwarding,
  listTunnels,
} from './port-forwarding-manager';
import type { PortForwardingConfig } from './port-forwarding-types';
import {
  listTmuxSessions,
  attachTmuxSession,
  createTmuxSession,
  detachTmux,
  killTmuxSession,
} from './tmux-manager';
import { listWslDistros } from './wsl-manager';
import {
  listWslTmuxSessions,
  attachWslTmuxSession,
  createWslTmuxSession,
  detachWslTmux,
  killWslTmuxSession,
} from './wsl-tmux-manager';
import { pasteFromClipboard } from './clipboard-manager';
import {
  listDocker,
  startContainer,
  stopContainer,
  restartContainer,
  removeContainer,
  removeImage,
  pullImage,
  execIntoContainer,
  logsContainer,
} from './docker-manager';
import {
  listWslDocker,
  startWslContainer,
  stopWslContainer,
  restartWslContainer,
  removeWslContainer,
  removeWslImage,
  pullWslImage,
  execIntoWslContainer,
  logsWslContainer,
} from './wsl-docker-manager';
import {
  listDbProfiles,
  createDbProfile,
  updateDbProfile,
  deleteDbProfile,
} from './db-profile-store';
import {
  connectMysql,
  disconnectMysql,
  disconnectAllMysql,
  listDatabases,
  listTables,
  describeTable,
  runQuery,
  cancelQuery,
  fetchTableData,
  updateRow,
  insertRow,
  deleteRow,
} from './mysql-manager';
import type { DbProfileInput, DbConnectParams, TableDataParams, RowMutation } from './db-types';
import {
  getSettings,
  updateSettings,
  getThemeByName,
  getThemeNames,
  BUILTIN_THEMES,
} from './settings-store';
import type { AppSettings } from './settings-store';

const ELECTRON_DIST = path.join(__dirname);
const RENDERER_DIST = path.join(ELECTRON_DIST, '..', 'dist');

let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const settings = getSettings();

  // 터미널 블러가 켜져 있으면 Windows 11 Acrylic/Mica 를 적용한다.
  // 이 재질은 창을 완전히 만들 때 한 번 지정해야 하며, 런타임에 ON/OFF 도 가능.
  // backgroundMaterial 을 쓰려면 backgroundColor 가 투명(#00000000) 이어야 한다.
  const useAcrylic = settings.terminalBlur > 0;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Custerm',
    icon: path.join(ELECTRON_DIST, '..', 'icon', 'custerm.ico'),
    frame: false,
    opacity: settings.opacity,
    backgroundColor: useAcrylic ? '#00000000' : undefined,
    backgroundMaterial: useAcrylic ? 'acrylic' : 'none',
    webPreferences: {
      // 보안: nodeIntegration 비활성화, contextIsolation 활성화
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(ELECTRON_DIST, 'preload.js'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  if (!process.env.VITE_DEV_SERVER_URL) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:",
          ],
        },
      });
    });
  }

  // 메인 프로세스에서 키보드 단축키를 처리 — xterm.js가 가로채는 것을 우회
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (!input.control || input.type !== 'keyDown') return;

    // Ctrl+, → 설정 토글
    if (input.key === ',') {
      _event.preventDefault();
      mainWindow?.webContents.send('shortcut:toggle-settings');
    }
    // Ctrl++ (또는 Ctrl+=) → 폰트 크기 증가
    if (input.key === '+' || input.key === '=') {
      _event.preventDefault();
      mainWindow?.webContents.send('shortcut:font-size', 'increase');
    }
    // Ctrl+- → 폰트 크기 감소
    if (input.key === '-') {
      _event.preventDefault();
      mainWindow?.webContents.send('shortcut:font-size', 'decrease');
    }
    // Ctrl+0 → 폰트 크기 초기화
    if (input.key === '0') {
      _event.preventDefault();
      mainWindow?.webContents.send('shortcut:font-size', 'reset');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- 창 컨트롤 IPC 핸들러 ---

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

// --- PTY IPC 핸들러 ---

ipcMain.handle('pty:spawn', (_event, shell?: string) => {
  return spawnPty(shell);
});

ipcMain.on('pty:write', (_event, id: string, data: string) => {
  writePty(id, data);
});

ipcMain.on('pty:resize', (_event, id: string, cols: number, rows: number) => {
  resizePty(id, cols, rows);
});

ipcMain.on('pty:kill', (_event, id: string) => {
  killPty(id);
});

ipcMain.on('pty:start-listening', (event, id: string) => {
  const instance = getPty(id);
  if (!instance) return;

  const sender = event.sender;

  instance.process.onData((data: string) => {
    if (!sender.isDestroyed()) {
      sender.send('pty:data', id, data);
    }
  });

  instance.process.onExit(({ exitCode }) => {
    if (!sender.isDestroyed()) {
      sender.send('pty:exit', id, exitCode);
    }
  });
});

// --- 프로필 IPC 핸들러 ---

ipcMain.handle('profile:list', () => {
  return listProfiles();
});

ipcMain.handle('profile:create', async (_event, input: SshProfileInput) => {
  return createProfile(input);
});

ipcMain.handle('profile:update', async (_event, id: string, input: Partial<SshProfileInput>) => {
  return updateProfile(id, input);
});

ipcMain.handle('profile:delete', async (_event, id: string) => {
  return deleteProfile(id);
});

ipcMain.handle('profile:select-key-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'SSH 개인키 파일 선택',
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'PEM Files', extensions: ['pem'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// --- SSH IPC 핸들러 ---

ipcMain.handle('ssh:connect', async (_event, params: SshConnectParams) => {
  return connectSsh(params);
});

ipcMain.on('ssh:write', (_event, sessionId: string, data: string) => {
  writeSsh(sessionId, data);
});

ipcMain.on('ssh:resize', (_event, sessionId: string, cols: number, rows: number) => {
  resizeSsh(sessionId, cols, rows);
});

ipcMain.on('ssh:disconnect', (_event, sessionId: string) => {
  disconnectSsh(sessionId);
});

ipcMain.on('ssh:start-listening', (event, sessionId: string) => {
  const sshSession = getSshSession(sessionId);
  if (!sshSession) return;

  const sender = event.sender;

  sshSession.stream.on('data', (data: Buffer) => {
    if (!sender.isDestroyed()) {
      sender.send('ssh:data', sessionId, data.toString('utf-8'));
    }
  });

  sshSession.stream.on('close', () => {
    if (!sender.isDestroyed()) {
      sender.send('ssh:exit', sessionId, 0);
    }
    disconnectSsh(sessionId);
  });

  sshSession.client.on('error', (err: Error) => {
    if (!sender.isDestroyed()) {
      sender.send('ssh:error', sessionId, err.message);
    }
  });

  sshSession.client.on('end', () => {
    if (!sender.isDestroyed()) {
      sender.send('ssh:exit', sessionId, 0);
    }
  });
});

// --- SFTP IPC 핸들러 ---

ipcMain.handle('sftp:open', async (_event, sshSessionId: string) => {
  return openSftp(sshSessionId);
});

ipcMain.on('sftp:close', (_event, sftpId: string) => {
  closeSftp(sftpId);
});

ipcMain.handle('sftp:readdir', async (_event, sftpId: string, remotePath: string) => {
  return sftpReaddir(sftpId, remotePath);
});

ipcMain.handle('sftp:mkdir', async (_event, sftpId: string, remotePath: string) => {
  return sftpMkdir(sftpId, remotePath);
});

ipcMain.handle('sftp:delete', async (_event, sftpId: string, remotePath: string) => {
  return sftpDelete(sftpId, remotePath);
});

ipcMain.handle('sftp:rmdir', async (_event, sftpId: string, remotePath: string) => {
  return sftpRmdir(sftpId, remotePath);
});

ipcMain.handle('sftp:rename', async (_event, sftpId: string, oldPath: string, newPath: string) => {
  return sftpRename(sftpId, oldPath, newPath);
});

ipcMain.handle('sftp:stat', async (_event, sftpId: string, remotePath: string) => {
  return sftpStat(sftpId, remotePath);
});

ipcMain.handle('sftp:upload', (event, sftpId: string, localPath: string, remotePath: string) => {
  const transferId = startUpload(sftpId, localPath, remotePath, event.sender);
  return { transferId };
});

ipcMain.handle('sftp:download', (event, sftpId: string, remotePath: string, localPath: string) => {
  const transferId = startDownload(sftpId, remotePath, localPath, event.sender);
  return { transferId };
});

ipcMain.on('sftp:cancel-transfer', (_event, transferId: string) => {
  cancelTransfer(transferId);
});

// --- 로컬 파일시스템 IPC 핸들러 ---

ipcMain.handle('local:readdir', async (_event, localPath: string) => {
  return localReaddir(localPath);
});

ipcMain.handle('local:homedir', () => {
  return localHomedir();
});

// --- 포트 포워딩 IPC 핸들러 ---

ipcMain.handle('portforward:create', async (event, sshSessionId: string, config: PortForwardingConfig) => {
  return createTunnel(sshSessionId, config, event.sender);
});

ipcMain.on('portforward:close', (_event, tunnelId: string) => {
  closeTunnel(tunnelId);
});

ipcMain.handle('portforward:list', async (_event, sshSessionId: string) => {
  return listTunnels(sshSessionId);
});

// --- tmux IPC 핸들러 ---

ipcMain.handle('tmux:list', async (_event, sshSessionId: string) => {
  return listTmuxSessions(sshSessionId);
});

ipcMain.on('tmux:attach', (_event, sshSessionId: string, sessionName: string) => {
  attachTmuxSession(sshSessionId, sessionName);
});

ipcMain.on('tmux:new', (_event, sshSessionId: string, sessionName?: string) => {
  createTmuxSession(sshSessionId, sessionName);
});

ipcMain.on('tmux:detach', (_event, sshSessionId: string) => {
  detachTmux(sshSessionId);
});

ipcMain.handle('tmux:kill', async (_event, sshSessionId: string, sessionName: string) => {
  return killTmuxSession(sshSessionId, sessionName);
});

// --- WSL IPC 핸들러 ---

ipcMain.handle('wsl:list-distros', () => {
  return listWslDistros();
});

ipcMain.handle('wsl-tmux:list', async (_event, distro: string) => {
  return listWslTmuxSessions(distro);
});

ipcMain.on('wsl-tmux:attach', (_event, ptyId: string, sessionName: string) => {
  attachWslTmuxSession(ptyId, sessionName);
});

ipcMain.on('wsl-tmux:new', (_event, ptyId: string, sessionName?: string) => {
  createWslTmuxSession(ptyId, sessionName);
});

ipcMain.on('wsl-tmux:detach', (_event, ptyId: string) => {
  detachWslTmux(ptyId);
});

ipcMain.handle('wsl-tmux:kill', async (_event, distro: string, sessionName: string) => {
  return killWslTmuxSession(distro, sessionName);
});

// --- Docker IPC 핸들러 (SSH) ---

ipcMain.handle('docker:list', async (_event, sshSessionId: string) => {
  return listDocker(sshSessionId);
});

ipcMain.handle('docker:start', async (_event, sshSessionId: string, id: string) => {
  return startContainer(sshSessionId, id);
});

ipcMain.handle('docker:stop', async (_event, sshSessionId: string, id: string) => {
  return stopContainer(sshSessionId, id);
});

ipcMain.handle('docker:restart', async (_event, sshSessionId: string, id: string) => {
  return restartContainer(sshSessionId, id);
});

ipcMain.handle('docker:remove', async (_event, sshSessionId: string, id: string, force: boolean) => {
  return removeContainer(sshSessionId, id, force);
});

ipcMain.handle('docker:removeImage', async (_event, sshSessionId: string, id: string, force: boolean) => {
  return removeImage(sshSessionId, id, force);
});

ipcMain.handle('docker:pullImage', async (_event, sshSessionId: string, ref: string) => {
  return pullImage(sshSessionId, ref);
});

ipcMain.on('docker:exec', (_event, sshSessionId: string, name: string, shell: string) => {
  execIntoContainer(sshSessionId, name, shell);
});

ipcMain.on('docker:logs', (_event, sshSessionId: string, name: string) => {
  logsContainer(sshSessionId, name);
});

// --- Docker IPC 핸들러 (WSL) ---

ipcMain.handle('wsl-docker:list', async (_event, distro: string) => {
  return listWslDocker(distro);
});

ipcMain.handle('wsl-docker:start', async (_event, distro: string, id: string) => {
  return startWslContainer(distro, id);
});

ipcMain.handle('wsl-docker:stop', async (_event, distro: string, id: string) => {
  return stopWslContainer(distro, id);
});

ipcMain.handle('wsl-docker:restart', async (_event, distro: string, id: string) => {
  return restartWslContainer(distro, id);
});

ipcMain.handle('wsl-docker:remove', async (_event, distro: string, id: string, force: boolean) => {
  return removeWslContainer(distro, id, force);
});

ipcMain.handle('wsl-docker:removeImage', async (_event, distro: string, id: string, force: boolean) => {
  return removeWslImage(distro, id, force);
});

ipcMain.handle('wsl-docker:pullImage', async (_event, distro: string, ref: string) => {
  return pullWslImage(distro, ref);
});

ipcMain.on('wsl-docker:exec', (_event, ptyId: string, name: string, shell: string) => {
  execIntoWslContainer(ptyId, name, shell);
});

ipcMain.on('wsl-docker:logs', (_event, ptyId: string, name: string) => {
  logsWslContainer(ptyId, name);
});

// --- DB 프로필 IPC 핸들러 ---

ipcMain.handle('db-profile:list', () => listDbProfiles());

ipcMain.handle('db-profile:create', async (_e, input: DbProfileInput) => {
  return createDbProfile(input);
});

ipcMain.handle('db-profile:update', async (_e, id: string, input: Partial<DbProfileInput>) => {
  return updateDbProfile(id, input);
});

ipcMain.handle('db-profile:delete', async (_e, id: string) => {
  return deleteDbProfile(id);
});

// --- DB (MySQL) IPC 핸들러 ---

ipcMain.handle('db:connect', async (_e, params: DbConnectParams) => {
  return connectMysql(params);
});

ipcMain.on('db:disconnect', async (_e, connId: string) => {
  await disconnectMysql(connId);
});

ipcMain.handle('db:list-databases', async (_e, connId: string) => {
  return listDatabases(connId);
});

ipcMain.handle('db:list-tables', async (_e, connId: string, dbName: string) => {
  return listTables(connId, dbName);
});

ipcMain.handle('db:describe-table', async (_e, connId: string, dbName: string, tableName: string) => {
  return describeTable(connId, dbName, tableName);
});

ipcMain.handle('db:query', async (_e, connId: string, queryId: string, sql: string, dbContext?: string) => {
  return runQuery(connId, queryId, sql, dbContext);
});

ipcMain.handle('db:cancel', async (_e, connId: string, queryId: string) => {
  return cancelQuery(connId, queryId);
});

ipcMain.handle('db:fetch-table-data', async (_e, connId: string, params: TableDataParams) => {
  return fetchTableData(connId, params);
});

ipcMain.handle('db:update-row', async (_e, connId: string, dbName: string, tableName: string, mutation: RowMutation) => {
  return updateRow(connId, dbName, tableName, mutation);
});

ipcMain.handle('db:insert-row', async (_e, connId: string, dbName: string, tableName: string, values: Record<string, unknown>) => {
  return insertRow(connId, dbName, tableName, values);
});

ipcMain.handle('db:delete-row', async (_e, connId: string, dbName: string, tableName: string, pk: Record<string, unknown>) => {
  return deleteRow(connId, dbName, tableName, pk);
});

// --- 클립보드 IPC 핸들러 ---

ipcMain.handle('clipboard:paste', () => {
  return pasteFromClipboard();
});

// --- 설정 IPC 핸들러 ---

ipcMain.handle('settings:get', () => {
  return getSettings();
});

ipcMain.handle('settings:update', (_event, partial: Partial<AppSettings>) => {
  const updated = updateSettings(partial);

  // 투명도 변경 시 윈도우에 즉시 적용
  if (partial.opacity !== undefined && mainWindow) {
    mainWindow.setOpacity(partial.opacity);
  }

  // 터미널 블러 변경 시 Windows Acrylic 재질 토글
  if (partial.terminalBlur !== undefined && mainWindow) {
    try {
      mainWindow.setBackgroundMaterial(partial.terminalBlur > 0 ? 'acrylic' : 'none');
    } catch {
      // 지원되지 않는 플랫폼(구형 Windows, Linux 등) 은 무시
    }
  }

  return updated;
});

ipcMain.handle('settings:get-themes', () => {
  return BUILTIN_THEMES;
});

ipcMain.handle('settings:get-theme-names', () => {
  return getThemeNames();
});

ipcMain.handle('settings:get-theme', (_event, name: string) => {
  return getThemeByName(name);
});

// --- 앱 라이프사이클 ---

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('Ctrl+Tab', () => {
    mainWindow?.webContents.send('shortcut:tab-switch', 'next');
  });
  globalShortcut.register('Ctrl+Shift+Tab', () => {
    mainWindow?.webContents.send('shortcut:tab-switch', 'prev');
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  killAllPtys();
  closeAllSftp();
  closeAllPortForwarding();
  disconnectAllSsh();
  void disconnectAllMysql();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
