/** 프로필 타입 — electron/ssh-types.ts와 동일 구조 */
interface SshProfile {
  id: string;
  name: string;
  type?: 'ssh' | 'wsl';
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  privateKeyPath?: string;
  distro?: string;
  createdAt: number;
  updatedAt: number;
}

interface SshProfileInput {
  name: string;
  type?: 'ssh' | 'wsl';
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  privateKeyPath?: string;
  password?: string;
  passphrase?: string;
  distro?: string;
}

interface SshConnectParams {
  profileId: string;
  password?: string;
  passphrase?: string;
}

interface PtyAPI {
  spawn: (shell?: string) => Promise<{ id: string; shell: string }>;
  write: (id: string, data: string) => void;
  resize: (id: string, cols: number, rows: number) => void;
  kill: (id: string) => void;
  startListening: (id: string) => void;
  onData: (callback: (id: string, data: string) => void) => () => void;
  onExit: (callback: (id: string, exitCode: number) => void) => () => void;
}

interface SshAPI {
  connect: (params: SshConnectParams) => Promise<{ sessionId: string }>;
  write: (sessionId: string, data: string) => void;
  resize: (sessionId: string, cols: number, rows: number) => void;
  disconnect: (sessionId: string) => void;
  startListening: (sessionId: string) => void;
  onData: (callback: (sessionId: string, data: string) => void) => () => void;
  onExit: (callback: (sessionId: string, exitCode: number) => void) => () => void;
  onError: (callback: (sessionId: string, error: string) => void) => () => void;
}

interface ProfileAPI {
  list: () => Promise<SshProfile[]>;
  create: (input: SshProfileInput) => Promise<SshProfile>;
  update: (id: string, input: Partial<SshProfileInput>) => Promise<SshProfile>;
  delete: (id: string) => Promise<void>;
  selectKeyFile: () => Promise<string | null>;
}

interface TerminalTheme {
  name: string;
  background: string;
  foreground: string;
  cursor: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

interface AppSettings {
  themeName: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  opacity: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  /** 터미널 배경 투명도 (0.3 ~ 1.0). 1.0이면 완전 불투명. */
  terminalBackgroundOpacity: number;
  /** 터미널 뒤 배경에 적용할 블러 (px). 0이면 블러 없음. */
  terminalBlur: number;
}

interface SftpFileEntry {
  filename: string;
  longname: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  modifyTime: number;
  permissions: number;
}

interface TransferItem {
  transferId: string;
  direction: 'upload' | 'download';
  localPath: string;
  remotePath: string;
  filename: string;
  totalBytes: number;
  transferredBytes: number;
  status: 'queued' | 'active' | 'completed' | 'failed';
  error?: string;
}

interface SftpAPI {
  open: (sshSessionId: string) => Promise<{ sftpId: string }>;
  close: (sftpId: string) => void;
  readdir: (sftpId: string, remotePath: string) => Promise<SftpFileEntry[]>;
  mkdir: (sftpId: string, remotePath: string) => Promise<void>;
  delete: (sftpId: string, remotePath: string) => Promise<void>;
  rmdir: (sftpId: string, remotePath: string) => Promise<void>;
  rename: (sftpId: string, oldPath: string, newPath: string) => Promise<void>;
  stat: (sftpId: string, remotePath: string) => Promise<SftpFileEntry>;
  upload: (sftpId: string, localPath: string, remotePath: string) => Promise<{ transferId: string }>;
  download: (sftpId: string, remotePath: string, localPath: string) => Promise<{ transferId: string }>;
  cancelTransfer: (transferId: string) => void;
  onTransferProgress: (callback: (transferId: string, transferred: number, total: number) => void) => () => void;
  onTransferComplete: (callback: (transferId: string) => void) => () => void;
  onTransferError: (callback: (transferId: string, error: string) => void) => () => void;
}

interface LocalAPI {
  readdir: (localPath: string) => Promise<SftpFileEntry[]>;
  homedir: () => Promise<string>;
}

interface SettingsAPI {
  get: () => Promise<AppSettings>;
  update: (partial: Partial<AppSettings>) => Promise<AppSettings>;
  getThemes: () => Promise<TerminalTheme[]>;
  getThemeNames: () => Promise<string[]>;
  getTheme: (name: string) => Promise<TerminalTheme>;
}

type ForwardingType = 'local' | 'remote' | 'dynamic';

interface PortForwardingConfig {
  type: ForwardingType;
  localAddr: string;
  localPort: number;
  remoteAddr?: string;
  remotePort?: number;
}

interface PortForwardingTunnel {
  tunnelId: string;
  sshSessionId: string;
  config: PortForwardingConfig;
  status: 'active' | 'error' | 'closed';
  connections: number;
  error?: string;
}

interface TmuxSession {
  name: string;
  windowCount: number;
  created: string;
  attached: boolean;
  size?: string;
}

interface TmuxListResult {
  tmuxAvailable: boolean;
  sessions: TmuxSession[];
}

interface TmuxAPI {
  list: (sshSessionId: string) => Promise<TmuxListResult>;
  attach: (sshSessionId: string, sessionName: string) => void;
  new: (sshSessionId: string, sessionName?: string) => void;
  detach: (sshSessionId: string) => void;
  kill: (sshSessionId: string, sessionName: string) => Promise<void>;
}

interface PortForwardingAPI {
  create: (sshSessionId: string, config: PortForwardingConfig) => Promise<{ tunnelId: string }>;
  close: (tunnelId: string) => void;
  list: (sshSessionId: string) => Promise<PortForwardingTunnel[]>;
  onStatusUpdate: (callback: (tunnelId: string, tunnel: PortForwardingTunnel) => void) => () => void;
  onError: (callback: (tunnelId: string, error: string) => void) => () => void;
}

interface WslTmuxAPI {
  list: (distro: string) => Promise<TmuxListResult>;
  attach: (ptyId: string, sessionName: string) => void;
  new: (ptyId: string, sessionName?: string) => void;
  detach: (ptyId: string) => void;
  kill: (distro: string, sessionName: string) => Promise<void>;
}

type DockerContainerState =
  | 'running'
  | 'exited'
  | 'paused'
  | 'created'
  | 'restarting'
  | 'dead';

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  state: DockerContainerState;
  ports: string;
  createdAt: string;
}

interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  createdSince: string;
}

interface DockerListResult {
  dockerAvailable: boolean;
  containers: DockerContainer[];
  images: DockerImage[];
}

interface DockerAPI {
  list: (sshSessionId: string) => Promise<DockerListResult>;
  start: (sshSessionId: string, id: string) => Promise<void>;
  stop: (sshSessionId: string, id: string) => Promise<void>;
  restart: (sshSessionId: string, id: string) => Promise<void>;
  remove: (sshSessionId: string, id: string, force: boolean) => Promise<void>;
  removeImage: (sshSessionId: string, id: string, force: boolean) => Promise<void>;
  pullImage: (sshSessionId: string, ref: string) => Promise<string>;
  exec: (sshSessionId: string, name: string, shell: string) => void;
  logs: (sshSessionId: string, name: string) => void;
}

interface WslDockerAPI {
  list: (distro: string) => Promise<DockerListResult>;
  start: (distro: string, id: string) => Promise<void>;
  stop: (distro: string, id: string) => Promise<void>;
  restart: (distro: string, id: string) => Promise<void>;
  remove: (distro: string, id: string, force: boolean) => Promise<void>;
  removeImage: (distro: string, id: string, force: boolean) => Promise<void>;
  pullImage: (distro: string, ref: string) => Promise<string>;
  exec: (ptyId: string, name: string, shell: string) => void;
  logs: (ptyId: string, name: string) => void;
}

interface WslAPI {
  listDistros: () => Promise<string[]>;
  tmux: WslTmuxAPI;
  docker: WslDockerAPI;
}

// --- DB 관련 타입 ---
type DbKind = 'mysql';

interface DbProfile {
  id: string;
  name: string;
  kind: DbKind;
  host: string;
  port: number;
  username: string;
  database?: string;
  useSshTunnel: boolean;
  sshProfileId?: string;
  createdAt: number;
  updatedAt: number;
}

interface DbProfileInput {
  name: string;
  kind: DbKind;
  host: string;
  port: number;
  username: string;
  password?: string;
  database?: string;
  useSshTunnel: boolean;
  sshProfileId?: string;
}

interface DbColumn {
  name: string;
  type: string;
  nullable: boolean;
  key: '' | 'PRI' | 'UNI' | 'MUL';
  default: string | null;
  extra: string;
}

interface DbTableInfo {
  name: string;
  type: string;
  rows: number | null;
}

interface QueryResultRows {
  kind: 'rows';
  columns: { name: string; type: number }[];
  rows: unknown[][];
  rowCount: number;
  durationMs: number;
  warningCount?: number;
  truncated?: boolean;
}

interface QueryResultOk {
  kind: 'ok';
  affectedRows: number;
  insertId: number;
  durationMs: number;
  warningCount?: number;
}

type QueryResult = QueryResultRows | QueryResultOk;

interface DbProfileAPI {
  list: () => Promise<DbProfile[]>;
  create: (input: DbProfileInput) => Promise<DbProfile>;
  update: (id: string, input: Partial<DbProfileInput>) => Promise<DbProfile>;
  delete: (id: string) => Promise<void>;
}

interface TableDataParams {
  dbName: string;
  tableName: string;
  where?: string;
  orderBy?: string;
  limit: number;
  offset: number;
}

interface TableDataResult {
  columns: { name: string; type: number }[];
  rows: unknown[][];
  totalRows: number | null;
  durationMs: number;
  primaryKey: string[];
}

interface RowMutation {
  pk: Record<string, unknown>;
  values: Record<string, unknown>;
}

interface DbAPI {
  connect: (params: { profileId: string; password?: string }) => Promise<{ connId: string; serverVersion: string }>;
  disconnect: (connId: string) => void;
  listDatabases: (connId: string) => Promise<string[]>;
  listTables: (connId: string, dbName: string) => Promise<DbTableInfo[]>;
  describeTable: (connId: string, dbName: string, tableName: string) => Promise<DbColumn[]>;
  query: (connId: string, queryId: string, sql: string, dbContext?: string) => Promise<QueryResult>;
  cancel: (connId: string, queryId: string) => Promise<void>;
  fetchTableData: (connId: string, params: TableDataParams) => Promise<TableDataResult>;
  updateRow: (connId: string, dbName: string, tableName: string, mutation: RowMutation) => Promise<number>;
  insertRow: (connId: string, dbName: string, tableName: string, values: Record<string, unknown>) => Promise<{ affectedRows: number; insertId: number }>;
  deleteRow: (connId: string, dbName: string, tableName: string, pk: Record<string, unknown>) => Promise<number>;
}

interface ClipboardPasteResult {
  type: 'image' | 'text' | 'empty';
  path?: string;
  text?: string;
}

interface ClipboardAPI {
  paste: () => Promise<ClipboardPasteResult>;
}

interface ElectronAPI {
  getVersion: () => string;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  onTabSwitch: (callback: (direction: 'next' | 'prev') => void) => () => void;
  onToggleSettings: (callback: () => void) => () => void;
  onFontSizeChange: (callback: (action: 'increase' | 'decrease' | 'reset') => void) => () => void;
  pty: PtyAPI;
  ssh: SshAPI;
  sftp: SftpAPI;
  local: LocalAPI;
  portforward: PortForwardingAPI;
  tmux: TmuxAPI;
  docker: DockerAPI;
  wsl: WslAPI;
  clipboard: ClipboardAPI;
  dbProfile: DbProfileAPI;
  db: DbAPI;
  profile: ProfileAPI;
  settings: SettingsAPI;
}

interface Window {
  electronAPI: ElectronAPI;
}
