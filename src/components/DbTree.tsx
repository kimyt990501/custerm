import { useState, useCallback } from 'react';

interface DbTreeProps {
  databases: string[];
  listTables: (db: string) => Promise<DbTableInfo[]>;
  describeTable: (db: string, table: string) => Promise<DbColumn[]>;
  onSelectTable: (db: string, table: string) => void;
  onRefresh: () => void;
}

interface DbNodeState {
  tables?: DbTableInfo[];
  expandedTables: Set<string>;
  tableColumns: Map<string, DbColumn[]>;
  loading: boolean;
  error?: string;
}

function DbTree({ databases, listTables, describeTable, onSelectTable, onRefresh }: DbTreeProps) {
  const [nodes, setNodes] = useState<Map<string, DbNodeState>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadTables = useCallback(async (db: string) => {
    setNodes(prev => {
      const copy = new Map(prev);
      const cur = copy.get(db) || { expandedTables: new Set(), tableColumns: new Map(), loading: false };
      copy.set(db, { ...cur, loading: true, error: undefined });
      return copy;
    });
    try {
      const tables = await listTables(db);
      setNodes(prev => {
        const copy = new Map(prev);
        const cur = copy.get(db) || { expandedTables: new Set(), tableColumns: new Map(), loading: false };
        copy.set(db, { ...cur, tables, loading: false, error: undefined });
        return copy;
      });
    } catch (e) {
      setNodes(prev => {
        const copy = new Map(prev);
        const cur = copy.get(db) || { expandedTables: new Set(), tableColumns: new Map(), loading: false };
        copy.set(db, { ...cur, tables: [], loading: false, error: (e as Error).message || String(e) });
        return copy;
      });
    }
  }, [listTables]);

  const toggleDb = useCallback(async (db: string) => {
    const isOpen = expanded.has(db);
    const next = new Set(expanded);
    if (isOpen) {
      next.delete(db);
      setExpanded(next);
      return;
    }
    next.add(db);
    setExpanded(next);

    const existing = nodes.get(db);
    if (!existing || !existing.tables) {
      await loadTables(db);
    }
  }, [expanded, nodes, loadTables]);

  const toggleTable = useCallback(async (db: string, table: string) => {
    const node = nodes.get(db);
    if (!node) return;
    const isOpen = node.expandedTables.has(table);
    const newExpanded = new Set(node.expandedTables);
    if (isOpen) {
      newExpanded.delete(table);
    } else {
      newExpanded.add(table);
    }
    setNodes(prev => {
      const copy = new Map(prev);
      const cur = copy.get(db);
      if (!cur) return prev;
      copy.set(db, { ...cur, expandedTables: newExpanded });
      return copy;
    });

    if (!isOpen && !node.tableColumns.has(table)) {
      try {
        const cols = await describeTable(db, table);
        setNodes(prev => {
          const copy = new Map(prev);
          const cur = copy.get(db);
          if (!cur) return prev;
          const newCols = new Map(cur.tableColumns);
          newCols.set(table, cols);
          copy.set(db, { ...cur, tableColumns: newCols });
          return copy;
        });
      } catch {
        // ignore
      }
    }
  }, [nodes, describeTable]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#11111b] to-[#0b0b14]">
      <div className="h-10 flex items-center justify-between px-3 border-b border-white/5 bg-black/10">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#f38ba8]">
            <ellipse cx="7" cy="3" rx="5" ry="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2 3v8c0 .83 2.24 1.5 5 1.5s5-.67 5-1.5V3" stroke="currentColor" strokeWidth="1.2" />
            <path d="M2 7c0 .83 2.24 1.5 5 1.5S12 7.83 12 7" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          <span className="text-[11px] font-semibold text-[#cdd6f4] tracking-wide">스키마</span>
          {databases.length > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-white/[0.06] text-[#bac2de] font-mono tabular-nums">
              {databases.length}
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="w-6 h-6 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5 transition-colors"
          title="새로고침"
        >
          <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
            <path d="M8.5 5a3.5 3.5 0 1 1-1-2.5M8.5 1v1.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto text-[11px] py-1.5">
        {databases.length === 0 && (
          <div className="px-4 py-6 text-center text-[11px] text-[#9399b2]">데이터베이스 없음</div>
        )}
        {databases.map(db => {
          const node = nodes.get(db);
          const isOpen = expanded.has(db);
          return (
            <div key={db}>
              <div
                className={`mx-1 my-0.5 px-2 py-1.5 flex items-center gap-1.5 cursor-pointer rounded-md transition-colors ${
                  isOpen ? 'bg-white/[0.04]' : 'hover:bg-white/[0.03]'
                }`}
                onClick={() => toggleDb(db)}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`text-[#9399b2] transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                  <path d="M2 1l4 3-4 3z" fill="currentColor" />
                </svg>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-[#3ddc97] shrink-0">
                  <ellipse cx="7" cy="3" rx="5" ry="1.5" stroke="currentColor" strokeWidth="1.1" />
                  <path d="M2 3v8c0 .83 2.24 1.5 5 1.5s5-.67 5-1.5V3" stroke="currentColor" strokeWidth="1.1" />
                </svg>
                <span className="truncate text-[#cdd6f4] font-medium">{db}</span>
              </div>
              {isOpen && (
                <div>
                  {node?.loading && <div className="px-6 py-1 text-[#9399b2]">로딩...</div>}
                  {node?.error && (
                    <div className="px-6 py-1 text-[#f38ba8] text-[10px]" title={node.error}>
                      ✗ {node.error}
                    </div>
                  )}
                  {!node?.loading && node?.tables && node.tables.length === 0 && !node.error && (
                    <div className="pl-6 pr-2 py-1 text-[#9399b2]">테이블 없음</div>
                  )}
                  {node?.tables?.map(t => {
                    const tblOpen = node.expandedTables.has(t.name);
                    const cols = node.tableColumns.get(t.name);
                    const isView = t.type === 'VIEW';
                    return (
                      <div key={t.name}>
                        <div
                          className="mx-1 my-0.5 pl-6 pr-2 py-1 flex items-center gap-1.5 cursor-pointer hover:bg-white/[0.03] rounded-md text-[#bac2de] group transition-colors"
                          onClick={() => toggleTable(db, t.name)}
                          onDoubleClick={e => { e.stopPropagation(); onSelectTable(db, t.name); }}
                          title={`${t.type}${t.rows !== null ? ` · 약 ${t.rows}행` : ''} — 더블클릭: SELECT 실행`}
                        >
                          <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className={`text-[#9399b2] transition-transform shrink-0 ${tblOpen ? 'rotate-90' : ''}`}>
                            <path d="M2 1l4 3-4 3z" fill="currentColor" />
                          </svg>
                          {isView ? (
                            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" className="text-[#cba6f7] shrink-0">
                              <rect x="1.5" y="3" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.1" />
                              <circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.1" />
                              <path d="M1.5 7c1.5-2 3.5-3 5.5-3s4 1 5.5 3c-1.5 2-3.5 3-5.5 3s-4-1-5.5-3z" stroke="currentColor" strokeWidth="0.9" opacity="0.5" />
                            </svg>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" className="text-[#f9e2af] shrink-0">
                              <rect x="1.5" y="2" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
                              <path d="M1.5 5.5h11M1.5 9h11M5 5.5v6.5" stroke="currentColor" strokeWidth="1.1" />
                            </svg>
                          )}
                          <span className="truncate flex-1 text-[11px]">{t.name}</span>
                          {t.rows !== null && (
                            <span className="text-[9px] text-[#9399b2] font-mono tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                              {t.rows}
                            </span>
                          )}
                        </div>
                        {tblOpen && cols && (
                          <div className="mb-1">
                            {cols.map(col => (
                              <div
                                key={col.name}
                                className="pl-11 pr-2 py-0.5 flex items-center gap-1.5 text-[10px] group/col hover:bg-white/[0.02]"
                                title={`${col.type}${col.nullable ? ' NULL' : ' NOT NULL'}${col.key === 'PRI' ? ' PK' : ''}`}
                              >
                                {col.key === 'PRI' ? (
                                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="text-[#f9e2af] shrink-0">
                                    <circle cx="3" cy="5" r="2" stroke="currentColor" strokeWidth="1.1" />
                                    <path d="M5 5h4M7 5v2M8.5 5v1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                                  </svg>
                                ) : col.key === 'MUL' || col.key === 'UNI' ? (
                                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="text-[#3ddc97] shrink-0 opacity-70">
                                    <path d="M3 2v6M3 8l-1.5-1.5M3 8l1.5-1.5M7 8V2M7 2l-1.5 1.5M7 2l1.5 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                                  </svg>
                                ) : (
                                  <span className="w-[9px] shrink-0" />
                                )}
                                <span className={col.key === 'PRI' ? 'text-[#cdd6f4] font-medium' : 'text-[#bac2de]'}>{col.name}</span>
                                <span className="text-[#7f849c] font-mono text-[9px] ml-auto truncate">{col.type}</span>
                                {!col.nullable && (
                                  <span className="text-[8px] text-[#f38ba8]/60 shrink-0">NN</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DbTree;
