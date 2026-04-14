/** 데이터베이스 탭 공용 타입 */
export type DbKind = 'mysql';
export interface DbProfile {
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
export interface DbProfileInput {
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
export interface DbConnectParams {
    profileId: string;
    password?: string;
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
    columns: {
        name: string;
        type: number;
    }[];
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
    where?: string;
    orderBy?: string;
    limit: number;
    offset: number;
}
export interface TableDataResult {
    columns: {
        name: string;
        type: number;
    }[];
    rows: unknown[][];
    totalRows: number | null;
    durationMs: number;
    primaryKey: string[];
}
export interface RowMutation {
    /** PK 식별자: { colName: value } */
    pk: Record<string, unknown>;
    /** 업데이트할 컬럼 값 */
    values: Record<string, unknown>;
}
