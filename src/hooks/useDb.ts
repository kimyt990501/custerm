import { useState, useCallback, useEffect, useRef } from 'react';

interface UseDbState {
  connId: string | null;
  serverVersion: string | null;
  connecting: boolean;
  error: string | null;
  databases: string[];
  needsPassword: boolean;
}

export function useDb(profileId: string) {
  const [state, setState] = useState<UseDbState>({
    connId: null,
    serverVersion: null,
    connecting: false,
    error: null,
    databases: [],
    needsPassword: false,
  });
  const queryCounterRef = useRef(0);
  const connIdRef = useRef<string | null>(null);

  const connect = useCallback(async (password?: string) => {
    setState(s => ({ ...s, connecting: true, error: null, needsPassword: false }));
    try {
      const { connId, serverVersion } = await window.electronAPI.db.connect({ profileId, password });
      connIdRef.current = connId;
      const dbs = await window.electronAPI.db.listDatabases(connId);
      setState(s => ({ ...s, connId, serverVersion, connecting: false, databases: dbs }));
    } catch (e) {
      const msg = (e as Error).message || String(e);
      const needsPassword = /access denied|password/i.test(msg) && !password;
      setState(s => ({ ...s, connecting: false, error: msg, needsPassword }));
    }
  }, [profileId]);

  useEffect(() => {
    connect();
    return () => {
      if (connIdRef.current) {
        window.electronAPI.db.disconnect(connIdRef.current);
        connIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  const listTables = useCallback(async (dbName: string): Promise<DbTableInfo[]> => {
    const cid = connIdRef.current;
    if (!cid) return [];
    return window.electronAPI.db.listTables(cid, dbName);
  }, []);

  const describeTable = useCallback(async (dbName: string, tableName: string): Promise<DbColumn[]> => {
    const cid = connIdRef.current;
    if (!cid) return [];
    return window.electronAPI.db.describeTable(cid, dbName, tableName);
  }, []);

  const runQuery = useCallback(async (
    sql: string,
    dbContext?: string,
  ): Promise<{ queryId: string; result?: QueryResult; error?: string }> => {
    const cid = connIdRef.current;
    if (!cid) return { queryId: '', error: '연결되지 않음' };
    const queryId = `q-${++queryCounterRef.current}`;
    try {
      const result = await window.electronAPI.db.query(cid, queryId, sql, dbContext);
      return { queryId, result };
    } catch (e) {
      return { queryId, error: (e as Error).message || String(e) };
    }
  }, []);

  const cancelQuery = useCallback(async (queryId: string) => {
    const cid = connIdRef.current;
    if (!cid) return;
    await window.electronAPI.db.cancel(cid, queryId);
  }, []);

  const fetchTableData = useCallback(async (params: TableDataParams): Promise<TableDataResult | { error: string }> => {
    const cid = connIdRef.current;
    if (!cid) return { error: '연결되지 않음' };
    try {
      return await window.electronAPI.db.fetchTableData(cid, params);
    } catch (e) {
      return { error: (e as Error).message || String(e) };
    }
  }, []);

  const updateRow = useCallback(async (dbName: string, tableName: string, mutation: RowMutation) => {
    const cid = connIdRef.current;
    if (!cid) throw new Error('연결되지 않음');
    return window.electronAPI.db.updateRow(cid, dbName, tableName, mutation);
  }, []);

  const insertRow = useCallback(async (dbName: string, tableName: string, values: Record<string, unknown>) => {
    const cid = connIdRef.current;
    if (!cid) throw new Error('연결되지 않음');
    return window.electronAPI.db.insertRow(cid, dbName, tableName, values);
  }, []);

  const deleteRow = useCallback(async (dbName: string, tableName: string, pk: Record<string, unknown>) => {
    const cid = connIdRef.current;
    if (!cid) throw new Error('연결되지 않음');
    return window.electronAPI.db.deleteRow(cid, dbName, tableName, pk);
  }, []);

  const refreshDatabases = useCallback(async () => {
    const cid = connIdRef.current;
    if (!cid) return;
    const dbs = await window.electronAPI.db.listDatabases(cid);
    setState(s => ({ ...s, databases: dbs }));
  }, []);

  return {
    ...state,
    connect,
    listTables,
    describeTable,
    runQuery,
    cancelQuery,
    refreshDatabases,
    fetchTableData,
    updateRow,
    insertRow,
    deleteRow,
  };
}
