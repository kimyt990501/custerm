/** 데이터베이스 탭 공용 타입 */

export type DbKind = 'mysql';

export interface DbProfile {
  id: string;
  name: string;
  kind: DbKind;
  host: string;                   // 직접 접속 시 실제 호스트 / 터널 시엔 대상 MySQL 서버 호스트
  port: number;
  username: string;
  database?: string;              // 기본 DB
  useSshTunnel: boolean;
  sshProfileId?: string;          // 참조: SshProfile.id
  createdAt: number;
  updatedAt: number;
}

export interface DbProfileInput {
  name: string;
  kind: DbKind;
  host: string;
  port: number;
  username: string;
  password?: string;              // keytar 저장
  database?: string;
  useSshTunnel: boolean;
  sshProfileId?: string;
}

export interface DbConnectParams {
  profileId: string;
  password?: string;              // 키체인 미저장 시 UI 전달
}

export interface DbConnectResult {
  connId: string;
  serverVersion: string;
}

export interface DbColumn {
  name: string;
  type: string;
  nullable: boolean;
  key: '' | 'PRI' | 'UNI' | 'MUL';
  default: string | null;
  extra: string;
}

export interface DbTableInfo {
  name: string;
  type: 'BASE TABLE' | 'VIEW' | string;
  rows: number | null;
}

export interface QueryResultRows {
  kind: 'rows';
  columns: { name: string; type: number }[];
  rows: unknown[][];
  rowCount: number;
  durationMs: number;
  warningCount?: number;
  truncated?: boolean;
}

export interface QueryResultOk {
  kind: 'ok';
  affectedRows: number;
  insertId: number;
  durationMs: number;
  warningCount?: number;
}

export type QueryResult = QueryResultRows | QueryResultOk;

export interface QueryError {
  message: string;
  sqlState?: string;
  code?: string;
}

/** 테이블 데이터 브라우징용 */
export interface TableDataParams {
  dbName: string;
  tableName: string;
  where?: string;          // WHERE 절 내용 (사용자 입력)
  orderBy?: string;        // ORDER BY 절 내용
  limit: number;
  offset: number;
}

export interface TableDataResult {
  columns: { name: string; type: number }[];
  rows: unknown[][];
  totalRows: number | null;    // COUNT(*) 결과 (null이면 미집계)
  durationMs: number;
  primaryKey: string[];        // PK 컬럼명 배열 (편집용)
}

export interface RowMutation {
  /** PK 식별자: { colName: value } */
  pk: Record<string, unknown>;
  /** 업데이트할 컬럼 값 */
  values: Record<string, unknown>;
}
