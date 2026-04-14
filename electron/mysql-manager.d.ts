import type { DbColumn, DbConnectParams, DbConnectResult, DbTableInfo, QueryResult, TableDataParams, TableDataResult, RowMutation } from './db-types';
/** MySQL 접속 + (선택) SSH 터널 수립 */
export declare function connectMysql(params: DbConnectParams): Promise<DbConnectResult>;
export declare function disconnectMysql(connId: string): Promise<void>;
export declare function disconnectAllMysql(): Promise<void>;
export declare function listDatabases(connId: string): Promise<string[]>;
export declare function listTables(connId: string, dbName: string): Promise<DbTableInfo[]>;
export declare function describeTable(connId: string, dbName: string, tableName: string): Promise<DbColumn[]>;
/** 쿼리 실행. 결과(rows) 또는 OK(affectedRows) 반환 */
export declare function runQuery(connId: string, queryId: string, sql: string, dbContext?: string): Promise<QueryResult>;
/** 테이블 데이터 페이지 조회 (WHERE/ORDER BY/LIMIT/OFFSET). PK도 함께 반환 */
export declare function fetchTableData(connId: string, params: TableDataParams): Promise<TableDataResult>;
/** 행 업데이트: PK 조건으로 SET 수행 */
export declare function updateRow(connId: string, dbName: string, tableName: string, mutation: RowMutation): Promise<number>;
/** 행 삽입 — values는 컬럼명→값 맵 */
export declare function insertRow(connId: string, dbName: string, tableName: string, values: Record<string, unknown>): Promise<{
    affectedRows: number;
    insertId: number;
}>;
/** 행 삭제 — PK 기준 */
export declare function deleteRow(connId: string, dbName: string, tableName: string, pk: Record<string, unknown>): Promise<number>;
/** 실행 중 쿼리 취소 (별도 커넥션에서 KILL QUERY 전송) */
export declare function cancelQuery(connId: string, queryId: string): Promise<void>;
