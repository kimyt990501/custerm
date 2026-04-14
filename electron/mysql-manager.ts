import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';
import crypto from 'node:crypto';
import { getDbProfile, getStoredDbPassword } from './db-profile-store';
import { openDbTunnel, type DbTunnel } from './db-tunnel';
import type {
  DbColumn,
  DbConnectParams,
  DbConnectResult,
  DbTableInfo,
  QueryResult,
  TableDataParams,
  TableDataResult,
  RowMutation,
} from './db-types';

interface MysqlConnection {
  pool: Pool;
  tunnel?: DbTunnel;
  host: string;
  port: number;
  user: string;
  password: string;
  /** queryId → threadId (활성 쿼리 추적, 취소용) */
  queries: Map<string, number>;
}

const connections = new Map<string, MysqlConnection>();

/** 컬럼 값을 IPC로 안전하게 직렬화 */
function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) {
    return { __blob: true, byteLength: v.byteLength };
  }
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'object') {
    // JSON 컬럼: 이미 파싱된 객체
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return v;
}

function serializeRow(row: Record<string, unknown>, columnNames: string[]): unknown[] {
  return columnNames.map(c => serializeValue(row[c]));
}

/** MySQL 접속 + (선택) SSH 터널 수립 */
export async function connectMysql(params: DbConnectParams): Promise<DbConnectResult> {
  const profile = getDbProfile(params.profileId);
  if (!profile) throw new Error(`DB 프로필을 찾을 수 없습니다: ${params.profileId}`);

  const password = params.password ?? (await getStoredDbPassword(params.profileId)) ?? '';

  let tunnel: DbTunnel | undefined;
  let host = profile.host;
  let port = profile.port;

  if (profile.useSshTunnel) {
    if (!profile.sshProfileId) throw new Error('SSH 터널 프로필이 지정되지 않았습니다');
    tunnel = await openDbTunnel(profile.sshProfileId, profile.host, profile.port);
    host = '127.0.0.1';
    port = tunnel.localPort;
  }

  let pool: Pool;
  try {
    pool = mysql.createPool({
      host,
      port,
      user: profile.username,
      password,
      database: profile.database || undefined,
      waitForConnections: true,
      connectionLimit: 3,            // 쿼리용 + 취소용 + 여유분
      queueLimit: 0,
      multipleStatements: false,
      dateStrings: false,
      supportBigNumbers: true,
      bigNumberStrings: true,
    });

    // 연결 검증 + 서버 버전
    const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT VERSION() AS v');
    const serverVersion = String(rows[0]?.v ?? 'unknown');

    const connId = crypto.randomUUID();
    connections.set(connId, {
      pool,
      tunnel,
      host,
      port,
      user: profile.username,
      password,
      queries: new Map(),
    });

    return { connId, serverVersion };
  } catch (err) {
    // 실패 시 터널 정리
    if (tunnel) tunnel.close();
    throw err;
  }
}

export async function disconnectMysql(connId: string): Promise<void> {
  const conn = connections.get(connId);
  if (!conn) return;
  try { await conn.pool.end(); } catch { /* ignore */ }
  if (conn.tunnel) conn.tunnel.close();
  connections.delete(connId);
}

export async function disconnectAllMysql(): Promise<void> {
  for (const connId of Array.from(connections.keys())) {
    await disconnectMysql(connId);
  }
}

function getConn(connId: string): MysqlConnection {
  const conn = connections.get(connId);
  if (!conn) throw new Error(`DB 연결이 존재하지 않습니다: ${connId}`);
  return conn;
}

export async function listDatabases(connId: string): Promise<string[]> {
  const conn = getConn(connId);
  const [rows] = await conn.pool.query<mysql.RowDataPacket[]>('SHOW DATABASES');
  const key = Object.keys(rows[0] || {})[0] || 'Database';
  return rows.map(r => String(r[key]));
}

export async function listTables(connId: string, dbName: string): Promise<DbTableInfo[]> {
  const conn = getConn(connId);
  const [rows] = await conn.pool.query<mysql.RowDataPacket[]>(
    `SELECT TABLE_NAME AS tbl_name, TABLE_TYPE AS tbl_type, TABLE_ROWS AS tbl_rows
     FROM information_schema.tables
     WHERE table_schema = ?
     ORDER BY TABLE_NAME`,
    [dbName],
  );
  return rows.map(r => {
    const rawRows = r.tbl_rows;
    let rowsVal: number | null = null;
    if (rawRows !== null && rawRows !== undefined) {
      const n = Number(rawRows);
      rowsVal = Number.isFinite(n) ? n : null;
    }
    return {
      name: String(r.tbl_name),
      type: String(r.tbl_type),
      rows: rowsVal,
    };
  });
}

export async function describeTable(
  connId: string,
  dbName: string,
  tableName: string,
): Promise<DbColumn[]> {
  const conn = getConn(connId);
  // 식별자에 백틱이 포함되면 이스케이프
  const db = dbName.replace(/`/g, '``');
  const tb = tableName.replace(/`/g, '``');
  const [rows] = await conn.pool.query<mysql.RowDataPacket[]>(
    `SHOW FULL COLUMNS FROM \`${db}\`.\`${tb}\``,
  );
  return rows.map(r => ({
    name: String(r.Field),
    type: String(r.Type),
    nullable: String(r.Null).toUpperCase() === 'YES',
    key: (String(r.Key) as DbColumn['key']) || '',
    default: r.Default === null ? null : String(r.Default),
    extra: String(r.Extra || ''),
  }));
}

/** 쿼리 실행. 결과(rows) 또는 OK(affectedRows) 반환 */
export async function runQuery(
  connId: string,
  queryId: string,
  sql: string,
  dbContext?: string,
): Promise<QueryResult> {
  const conn = getConn(connId);
  let poolConn: PoolConnection | null = null;

  const started = Date.now();
  try {
    poolConn = await conn.pool.getConnection();

    // threadId 등록 (취소용)
    const [thrRows] = await poolConn.query<mysql.RowDataPacket[]>('SELECT CONNECTION_ID() AS id');
    const threadId = Number(thrRows[0]?.id);
    if (Number.isFinite(threadId)) conn.queries.set(queryId, threadId);

    if (dbContext) {
      const safe = dbContext.replace(/`/g, '``');
      await poolConn.query(`USE \`${safe}\``);
    }

    const [result, fieldsAny] = await poolConn.query(sql);

    const durationMs = Date.now() - started;

    // ResultSetHeader (OK 결과: INSERT/UPDATE/DELETE/DDL)
    if (result && typeof result === 'object' && !Array.isArray(result) && 'affectedRows' in result) {
      const r = result as mysql.ResultSetHeader;
      return {
        kind: 'ok',
        affectedRows: r.affectedRows ?? 0,
        insertId: Number(r.insertId ?? 0),
        durationMs,
        warningCount: r.warningStatus ?? 0,
      };
    }

    // rows 결과 (SELECT/SHOW/DESCRIBE ...)
    const fields = (fieldsAny as mysql.FieldPacket[] | undefined) || [];
    const columnNames = fields.map(f => f.name);
    const columns = fields.map(f => ({ name: f.name, type: f.type ?? 0 }));
    const rowsArr = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
    const rows = rowsArr.map(r => serializeRow(r, columnNames));

    return {
      kind: 'rows',
      columns,
      rows,
      rowCount: rows.length,
      durationMs,
    };
  } finally {
    conn.queries.delete(queryId);
    if (poolConn) poolConn.release();
  }
}

function escapeIdent(s: string): string {
  return '`' + s.replace(/`/g, '``') + '`';
}

/** 테이블 데이터 페이지 조회 (WHERE/ORDER BY/LIMIT/OFFSET). PK도 함께 반환 */
export async function fetchTableData(
  connId: string,
  params: TableDataParams,
): Promise<TableDataResult> {
  const conn = getConn(connId);
  const db = escapeIdent(params.dbName);
  const tb = escapeIdent(params.tableName);

  // PK 컬럼 조회
  const [pkRows] = await conn.pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME AS col
     FROM information_schema.key_column_usage
     WHERE table_schema = ? AND table_name = ? AND constraint_name = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    [params.dbName, params.tableName],
  );
  const primaryKey = pkRows.map(r => String(r.col));

  const where = params.where?.trim();
  const orderBy = params.orderBy?.trim();
  const whereClause = where ? `WHERE ${where}` : '';
  const orderClause = orderBy ? `ORDER BY ${orderBy}` : '';

  // COUNT(*) 별도 실행 (페이지네이션용)
  let totalRows: number | null = null;
  try {
    const [cntRows] = await conn.pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM ${db}.${tb} ${whereClause}`,
    );
    totalRows = Number(cntRows[0]?.c ?? 0);
  } catch {
    totalRows = null;
  }

  // LIMIT/OFFSET은 바인딩 대신 정수 삽입 (prepared에서 LIMIT ? 이슈 회피)
  const limit = Math.max(1, Math.floor(params.limit));
  const offset = Math.max(0, Math.floor(params.offset));
  const sql = `SELECT * FROM ${db}.${tb} ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`;

  const started = Date.now();
  const [result, fieldsAny] = await conn.pool.query(sql);
  const durationMs = Date.now() - started;

  const fields = (fieldsAny as mysql.FieldPacket[] | undefined) || [];
  const columnNames = fields.map(f => f.name);
  const columns = fields.map(f => ({ name: f.name, type: f.type ?? 0 }));
  const rowsArr = Array.isArray(result) ? (result as Record<string, unknown>[]) : [];
  const rows = rowsArr.map(r => serializeRow(r, columnNames));

  return { columns, rows, totalRows, durationMs, primaryKey };
}

/** 행 업데이트: PK 조건으로 SET 수행 */
export async function updateRow(
  connId: string,
  dbName: string,
  tableName: string,
  mutation: RowMutation,
): Promise<number> {
  const conn = getConn(connId);
  const db = escapeIdent(dbName);
  const tb = escapeIdent(tableName);
  const setCols = Object.keys(mutation.values);
  const pkCols = Object.keys(mutation.pk);
  if (setCols.length === 0) return 0;
  if (pkCols.length === 0) throw new Error('PK가 없어 행을 업데이트할 수 없습니다');

  const setClause = setCols.map(c => `${escapeIdent(c)} = ?`).join(', ');
  const whereClause = pkCols.map(c => `${escapeIdent(c)} = ?`).join(' AND ');
  const sql = `UPDATE ${db}.${tb} SET ${setClause} WHERE ${whereClause} LIMIT 1`;
  const values = [...setCols.map(c => mutation.values[c]), ...pkCols.map(c => mutation.pk[c])];
  const [res] = await conn.pool.query<mysql.ResultSetHeader>(sql, values);
  return res.affectedRows ?? 0;
}

/** 행 삽입 — values는 컬럼명→값 맵 */
export async function insertRow(
  connId: string,
  dbName: string,
  tableName: string,
  values: Record<string, unknown>,
): Promise<{ affectedRows: number; insertId: number }> {
  const conn = getConn(connId);
  const db = escapeIdent(dbName);
  const tb = escapeIdent(tableName);
  const cols = Object.keys(values);
  if (cols.length === 0) {
    const [res] = await conn.pool.query<mysql.ResultSetHeader>(
      `INSERT INTO ${db}.${tb} () VALUES ()`,
    );
    return { affectedRows: res.affectedRows ?? 0, insertId: Number(res.insertId ?? 0) };
  }
  const colClause = cols.map(c => escapeIdent(c)).join(', ');
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${db}.${tb} (${colClause}) VALUES (${placeholders})`;
  const [res] = await conn.pool.query<mysql.ResultSetHeader>(sql, cols.map(c => values[c]));
  return { affectedRows: res.affectedRows ?? 0, insertId: Number(res.insertId ?? 0) };
}

/** 행 삭제 — PK 기준 */
export async function deleteRow(
  connId: string,
  dbName: string,
  tableName: string,
  pk: Record<string, unknown>,
): Promise<number> {
  const conn = getConn(connId);
  const db = escapeIdent(dbName);
  const tb = escapeIdent(tableName);
  const pkCols = Object.keys(pk);
  if (pkCols.length === 0) throw new Error('PK가 없어 행을 삭제할 수 없습니다');
  const whereClause = pkCols.map(c => `${escapeIdent(c)} = ?`).join(' AND ');
  const sql = `DELETE FROM ${db}.${tb} WHERE ${whereClause} LIMIT 1`;
  const [res] = await conn.pool.query<mysql.ResultSetHeader>(sql, pkCols.map(c => pk[c]));
  return res.affectedRows ?? 0;
}

/** 실행 중 쿼리 취소 (별도 커넥션에서 KILL QUERY 전송) */
export async function cancelQuery(connId: string, queryId: string): Promise<void> {
  const conn = getConn(connId);
  const threadId = conn.queries.get(queryId);
  if (!threadId) return;

  // 별도 커넥션에서 KILL QUERY 발행
  const poolConn = await conn.pool.getConnection();
  try {
    await poolConn.query(`KILL QUERY ${threadId}`);
  } finally {
    poolConn.release();
  }
}
