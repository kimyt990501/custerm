import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface TableDataViewProps {
  dbName: string;
  tableName: string;
  fetchTableData: (params: TableDataParams) => Promise<TableDataResult | { error: string }>;
  updateRow: (dbName: string, tableName: string, mutation: RowMutation) => Promise<number>;
  insertRow: (dbName: string, tableName: string, values: Record<string, unknown>) => Promise<{ affectedRows: number; insertId: number }>;
  deleteRow: (dbName: string, tableName: string, pk: Record<string, unknown>) => Promise<number>;
}

const PAGE_SIZE = 500;
const COL_WIDTH = 140;
const COL_MAX = 400;
const ROW_NUM_WIDTH = 56;

interface PendingEdit {
  rowIdx: number;
  col: string;
  newValue: string;
  isNull: boolean;
}

interface PendingNewRow {
  tempId: string;
  values: Record<string, string>;
  nulls: Set<string>;
}

function formatCell(value: unknown): { display: string; isNull: boolean; isBlob: boolean } {
  if (value === null || value === undefined) return { display: 'NULL', isNull: true, isBlob: false };
  if (typeof value === 'object') {
    const asObj = value as { __blob?: boolean; byteLength?: number };
    if (asObj.__blob) {
      const bytes = asObj.byteLength || 0;
      const kb = bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`;
      return { display: `<BLOB ${kb}>`, isNull: false, isBlob: true };
    }
    return { display: JSON.stringify(value), isNull: false, isBlob: false };
  }
  return { display: String(value), isNull: false, isBlob: false };
}

function TableDataView({
  dbName,
  tableName,
  fetchTableData,
  updateRow,
  insertRow,
  deleteRow,
}: TableDataViewProps) {
  const [where, setWhere] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<TableDataResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [pendingEdits, setPendingEdits] = useState<Map<string, PendingEdit>>(new Map()); // key: `${rowIdx}|${col}`
  const [pendingDeletes, setPendingDeletes] = useState<Set<number>>(new Set());
  const [pendingInserts, setPendingInserts] = useState<PendingNewRow[]>([]);
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null);
  const [committing, setCommitting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const hasPending =
    pendingEdits.size > 0 || pendingDeletes.size > 0 || pendingInserts.length > 0;

  const reload = useCallback(async (opts?: { where?: string; orderBy?: string; page?: number }) => {
    if (hasPending && !opts) {
      if (!window.confirm('저장되지 않은 변경사항이 있습니다. 새로고침하면 폐기됩니다. 계속할까요?')) return;
    }
    setLoading(true);
    setError(null);
    const nextWhere = opts?.where ?? where;
    const nextOrderBy = opts?.orderBy ?? orderBy;
    const nextPage = opts?.page ?? page;
    const res = await fetchTableData({
      dbName,
      tableName,
      where: nextWhere || undefined,
      orderBy: nextOrderBy || undefined,
      limit: PAGE_SIZE,
      offset: nextPage * PAGE_SIZE,
    });
    setLoading(false);
    if ('error' in res) {
      setError(res.error);
      setData(null);
    } else {
      setData(res);
      setError(null);
    }
    // 새로고침 후 pending 초기화
    setPendingEdits(new Map());
    setPendingDeletes(new Set());
    setPendingInserts([]);
    setSelectedRows(new Set());
    setEditingCell(null);
  }, [dbName, tableName, where, orderBy, page, fetchTableData, hasPending]);

  // 테이블이 바뀔 때 상태 초기화 후 재조회
  useEffect(() => {
    setWhere('');
    setOrderBy('');
    setPage(0);
    setPendingEdits(new Map());
    setPendingDeletes(new Set());
    setPendingInserts([]);
    setSelectedRows(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbName, tableName]);

  // 최초 로드 / 페이지 변경 시
  useEffect(() => {
    void reload({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbName, tableName, page]);

  const applyFilter = () => {
    setPage(0);
    void reload({ page: 0 });
  };

  const totalPages = useMemo(() => {
    if (!data || data.totalRows === null) return null;
    return Math.max(1, Math.ceil(data.totalRows / PAGE_SIZE));
  }, [data]);

  const rows = data?.rows ?? [];
  const columns = data?.columns ?? [];
  const totalWidth = ROW_NUM_WIDTH + 28 /*체크박스*/ + columns.length * COL_WIDTH;

  const rowVirtualizer = useVirtualizer({
    count: rows.length + pendingInserts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 26,
    overscan: 10,
  });

  const getPk = useCallback((rowIdx: number): Record<string, unknown> | null => {
    if (!data) return null;
    if (data.primaryKey.length === 0) return null;
    const row = data.rows[rowIdx];
    const colIdx = new Map(columns.map((c, i) => [c.name, i]));
    const pk: Record<string, unknown> = {};
    for (const pkc of data.primaryKey) {
      const ci = colIdx.get(pkc);
      if (ci === undefined) return null;
      pk[pkc] = row[ci];
    }
    return pk;
  }, [data, columns]);

  const toggleRowSelect = (idx: number) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const startEdit = (rowIdx: number, col: string) => {
    if (!data || data.primaryKey.length === 0) {
      alert('PK가 없는 테이블은 편집할 수 없습니다');
      return;
    }
    setEditingCell({ rowIdx, col });
  };

  const commitEdit = (rowIdx: number, col: string, newValue: string, isNull: boolean) => {
    const key = `${rowIdx}|${col}`;
    setPendingEdits(prev => {
      const next = new Map(prev);
      next.set(key, { rowIdx, col, newValue, isNull });
      return next;
    });
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const addNewRow = () => {
    const tempId = `new-${Date.now()}-${Math.random()}`;
    setPendingInserts(prev => [...prev, { tempId, values: {}, nulls: new Set(columns.map(c => c.name)) }]);
  };

  const updateNewRowCell = (tempId: string, col: string, value: string, isNull: boolean) => {
    setPendingInserts(prev => prev.map(r => {
      if (r.tempId !== tempId) return r;
      const values = { ...r.values };
      const nulls = new Set(r.nulls);
      if (isNull) {
        delete values[col];
        nulls.add(col);
      } else {
        values[col] = value;
        nulls.delete(col);
      }
      return { ...r, values, nulls };
    }));
  };

  const removeNewRow = (tempId: string) => {
    setPendingInserts(prev => prev.filter(r => r.tempId !== tempId));
  };

  const markSelectedForDelete = () => {
    if (selectedRows.size === 0) return;
    if (!data || data.primaryKey.length === 0) {
      alert('PK가 없는 테이블은 삭제할 수 없습니다');
      return;
    }
    setPendingDeletes(prev => {
      const next = new Set(prev);
      for (const idx of selectedRows) next.add(idx);
      return next;
    });
    setSelectedRows(new Set());
  };

  const unmarkDelete = (rowIdx: number) => {
    setPendingDeletes(prev => {
      const next = new Set(prev);
      next.delete(rowIdx);
      return next;
    });
  };

  const discardChanges = () => {
    if (!hasPending) return;
    if (!window.confirm('변경사항을 폐기할까요?')) return;
    setPendingEdits(new Map());
    setPendingDeletes(new Set());
    setPendingInserts([]);
  };

  const commitChanges = async () => {
    if (!data || !hasPending || committing) return;
    setCommitting(true);
    setError(null);
    try {
      // 1) 삭제
      for (const rowIdx of pendingDeletes) {
        const pk = getPk(rowIdx);
        if (!pk) continue;
        await deleteRow(dbName, tableName, pk);
      }
      // 2) 업데이트 — rowIdx 별로 합치기
      const editsByRow = new Map<number, Record<string, unknown>>();
      for (const e of pendingEdits.values()) {
        if (pendingDeletes.has(e.rowIdx)) continue; // 삭제 대상은 스킵
        const cur = editsByRow.get(e.rowIdx) || {};
        cur[e.col] = e.isNull ? null : e.newValue;
        editsByRow.set(e.rowIdx, cur);
      }
      for (const [rowIdx, values] of editsByRow) {
        const pk = getPk(rowIdx);
        if (!pk) continue;
        await updateRow(dbName, tableName, { pk, values });
      }
      // 3) 삽입
      for (const ins of pendingInserts) {
        const values: Record<string, unknown> = {};
        for (const col of Object.keys(ins.values)) {
          values[col] = ins.values[col];
        }
        await insertRow(dbName, tableName, values);
      }
      // 성공 → 재조회
      await reload({ page });
    } catch (e) {
      setError((e as Error).message || String(e));
    } finally {
      setCommitting(false);
    }
  };

  const totalRowsLabel = data?.totalRows !== null && data?.totalRows !== undefined
    ? `${data.totalRows}행`
    : '—';

  return (
    <div className="h-full flex flex-col bg-[#0b0b14] min-h-0">
      {/* 상단 툴바 */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5 bg-[#11111b]/70 shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/5">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none" className="text-[#f9e2af]">
            <rect x="1.5" y="2" width="11" height="10" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <path d="M1.5 5.5h11M1.5 9h11M5 5.5v6.5" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          <span className="text-[11px] font-mono">
            <span className="text-[#9399b2]">{dbName}.</span>
            <span className="text-[#cdd6f4] font-medium">{tableName}</span>
          </span>
        </div>
        <div className="h-5 w-px bg-white/5 mx-1" />

        {/* WHERE */}
        <label className="text-[10px] text-[#9399b2] font-semibold uppercase tracking-wider">WHERE</label>
        <input
          value={where}
          onChange={e => setWhere(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyFilter(); }}
          placeholder="id > 100"
          className="bg-[#0b0b14] text-[#cdd6f4] text-[11px] px-2 py-1 rounded-md border border-white/5 outline-none focus:border-[#89b4fa]/60 font-mono transition-colors"
          style={{ width: 200 }}
        />

        {/* ORDER BY */}
        <label className="text-[10px] text-[#9399b2] font-semibold uppercase tracking-wider">ORDER BY</label>
        <input
          value={orderBy}
          onChange={e => setOrderBy(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyFilter(); }}
          placeholder="id DESC"
          className="bg-[#0b0b14] text-[#cdd6f4] text-[11px] px-2 py-1 rounded-md border border-white/5 outline-none focus:border-[#89b4fa]/60 font-mono transition-colors"
          style={{ width: 130 }}
        />

        <button
          onClick={applyFilter}
          className="px-2.5 py-1 text-[11px] rounded-md bg-[#89b4fa] text-[#1e1e2e] hover:bg-[#74c7ec] font-medium shadow-sm shadow-[#89b4fa]/20 transition-colors"
        >
          적용
        </button>

        <div className="h-5 w-px bg-white/5 mx-1" />

        {/* 페이지 네비게이션 */}
        <div className="flex items-center gap-0.5 bg-white/[0.03] rounded-md p-0.5 border border-white/5">
          <button
            onClick={() => setPage(0)}
            disabled={page === 0 || loading}
            className="w-6 h-6 flex items-center justify-center rounded text-[#bac2de] hover:text-[#cdd6f4] hover:bg-white/5 disabled:opacity-30 transition-colors"
            title="첫 페이지"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M7 2L4 5l3 3M3 2v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="w-6 h-6 flex items-center justify-center rounded text-[#bac2de] hover:text-[#cdd6f4] hover:bg-white/5 disabled:opacity-30 transition-colors"
            title="이전 페이지"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M6.5 2L3.5 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-[11px] text-[#cdd6f4] font-mono tabular-nums px-2">
            {page + 1}{totalPages !== null ? ` / ${totalPages}` : ''}
          </span>
          <button
            onClick={() => setPage(p => (totalPages !== null ? Math.min(totalPages - 1, p + 1) : p + 1))}
            disabled={loading || (totalPages !== null && page + 1 >= totalPages)}
            className="w-6 h-6 flex items-center justify-center rounded text-[#bac2de] hover:text-[#cdd6f4] hover:bg-white/5 disabled:opacity-30 transition-colors"
            title="다음 페이지"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => { if (totalPages !== null) setPage(totalPages - 1); }}
            disabled={loading || totalPages === null || page + 1 >= totalPages}
            className="w-6 h-6 flex items-center justify-center rounded text-[#bac2de] hover:text-[#cdd6f4] hover:bg-white/5 disabled:opacity-30 transition-colors"
            title="마지막 페이지"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2l3 3-3 3M7 2v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <span className="text-[10px] text-[#9399b2]">총 <span className="text-[#bac2de] font-mono tabular-nums">{totalRowsLabel}</span></span>

        {/* 로딩 스피너 */}
        {loading && (
          <span className="flex items-center gap-1 text-[10px] text-[#89b4fa] ml-1" title="로딩 중">
            <svg className="animate-spin" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
              <path d="M10.5 6a4.5 4.5 0 0 0-4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        )}

        <button
          onClick={() => reload({ page })}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5 disabled:opacity-30 transition-colors"
          title="새로고침"
        >
          <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
            <path d="M9 5.5a3.5 3.5 0 1 1-1-2.5M9 1.5v2.5H6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex-1" />

        {/* 행 조작 */}
        <button
          onClick={addNewRow}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-[#a6e3a1]/10 text-[#a6e3a1] hover:bg-[#a6e3a1]/20 border border-[#a6e3a1]/20 font-medium transition-colors"
          title="행 추가"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          행 추가
        </button>
        <button
          onClick={markSelectedForDelete}
          disabled={selectedRows.size === 0}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-md bg-[#f38ba8]/10 text-[#f38ba8] hover:bg-[#f38ba8]/20 border border-[#f38ba8]/20 disabled:opacity-30 disabled:cursor-not-allowed font-medium transition-colors"
          title="선택 행 제거 표시"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          제거 {selectedRows.size > 0 && <span className="font-mono tabular-nums">({selectedRows.size})</span>}
        </button>

        <div className="h-5 w-px bg-white/5 mx-1" />

        <button
          onClick={commitChanges}
          disabled={!hasPending || committing}
          className="flex items-center gap-1.5 px-3 py-1 text-[11px] rounded-md bg-[#cba6f7] text-[#1e1e2e] hover:bg-[#b895eb] disabled:opacity-30 disabled:cursor-not-allowed font-semibold shadow-sm shadow-[#cba6f7]/20 transition-colors"
          title="변경사항 저장"
        >
          {committing ? (
            <>
              <svg className="animate-spin" width="10" height="10" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
                <path d="M10.5 6a4.5 4.5 0 0 0-4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              저장 중
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              커밋{hasPending && <span className="font-mono tabular-nums">({pendingEdits.size + pendingDeletes.size + pendingInserts.length})</span>}
            </>
          )}
        </button>
        <button
          onClick={discardChanges}
          disabled={!hasPending || committing}
          className="px-2.5 py-1 text-[11px] rounded-md bg-white/5 text-[#bac2de] hover:bg-white/10 hover:text-[#cdd6f4] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="변경사항 폐기"
        >
          되돌리기
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="mx-2 my-1.5 p-2.5 bg-[#f38ba8]/10 border border-[#f38ba8]/20 rounded-lg text-[11px] text-[#f38ba8] font-mono whitespace-pre-wrap shrink-0 flex gap-2">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <div className="flex-1">{error}</div>
        </div>
      )}

      {/* 데이터 그리드 */}
      {loading && !data && (
        <div className="flex-1 flex items-center justify-center text-[#9399b2] text-xs gap-2">
          <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
            <path d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          로딩 중...
        </div>
      )}
      {data && (
        <div className="flex-1 min-h-0 relative">
          {/* 페이지 이동 등 기존 데이터 위에 로딩 오버레이 */}
          {loading && (
            <div className="absolute inset-0 z-20 bg-[#0b0b14]/60 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e1e2e]/90 border border-[#313244] text-[11px] text-[#89b4fa] shadow-lg">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
                  <path d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                로딩 중...
              </div>
            </div>
          )}
          <div ref={scrollRef} className="h-full overflow-auto font-mono text-[11px]">
          <div style={{ width: totalWidth, minWidth: '100%' }}>
            {/* 헤더 */}
            <div
              className="flex bg-gradient-to-b from-[#181825] to-[#11111b] border-b border-white/10 text-[#cdd6f4] sticky top-0 z-10"
              style={{ width: totalWidth }}
            >
              <div className="w-7 shrink-0 border-r border-white/5" />
              <div
                className="px-2 py-1.5 text-[#7f849c] border-r border-white/5 shrink-0 text-right text-[10px] font-medium"
                style={{ width: ROW_NUM_WIDTH }}
              >
                #
              </div>
              {columns.map((col, i) => {
                const isPk = data.primaryKey.includes(col.name);
                return (
                  <div
                    key={i}
                    className={`px-2 py-1.5 border-r border-white/5 shrink-0 select-none font-medium flex items-center gap-1.5 ${
                      isPk ? 'bg-[#f9e2af]/5' : ''
                    }`}
                    style={{ width: COL_WIDTH }}
                    title={isPk ? 'PRIMARY KEY' : undefined}
                  >
                    {isPk && (
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="text-[#f9e2af] shrink-0">
                        <circle cx="3" cy="5" r="2" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M5 5h4M7 5v2M8.5 5v1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    )}
                    <span className={`truncate ${isPk ? 'text-[#f9e2af]' : ''}`}>{col.name}</span>
                  </div>
                );
              })}
            </div>

            {/* 본문 — 기존 행 (virtualized) */}
            <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: totalWidth }}>
              {rowVirtualizer.getVirtualItems().map(vi => {
                const idx = vi.index;
                // 기존 행 or 신규 행?
                if (idx < rows.length) {
                  const row = rows[idx];
                  const isDeleted = pendingDeletes.has(idx);
                  const isSelected = selectedRows.has(idx);
                  const even = idx % 2 === 0;
                  return (
                    <div
                      key={vi.key}
                      className={`flex absolute left-0 border-b border-white/[0.03] transition-colors ${
                        isDeleted ? 'bg-[#f38ba8]/15 line-through' : isSelected ? 'bg-[#89b4fa]/10' : `hover:bg-[#89b4fa]/5 ${even ? '' : 'bg-white/[0.015]'}`
                      }`}
                      style={{
                        top: 0,
                        transform: `translateY(${vi.start}px)`,
                        height: vi.size,
                        width: totalWidth,
                      }}
                    >
                      <div className="w-7 shrink-0 border-r border-white/5 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRowSelect(idx)}
                          className="accent-[#89b4fa]"
                        />
                      </div>
                      <div
                        className="px-2 py-1 text-[#7f849c] border-r border-white/5 shrink-0 text-right cursor-pointer tabular-nums text-[10px]"
                        style={{ width: ROW_NUM_WIDTH }}
                        onClick={() => isDeleted ? unmarkDelete(idx) : toggleRowSelect(idx)}
                        title={isDeleted ? '삭제 표시됨 — 클릭해 해제' : undefined}
                      >
                        {page * PAGE_SIZE + idx + 1}
                      </div>
                      {columns.map((col, ci) => {
                        const raw = row[ci];
                        const editKey = `${idx}|${col.name}`;
                        const edit = pendingEdits.get(editKey);
                        const isEditing = editingCell?.rowIdx === idx && editingCell.col === col.name;
                        const displayValue = edit
                          ? (edit.isNull ? { display: 'NULL', isNull: true, isBlob: false } : { display: edit.newValue, isNull: false, isBlob: false })
                          : formatCell(raw);

                        return (
                          <Cell
                            key={ci}
                            value={displayValue}
                            isEditing={isEditing}
                            isDirty={!!edit}
                            onStartEdit={() => startEdit(idx, col.name)}
                            onCommit={(v, isNull) => commitEdit(idx, col.name, v, isNull)}
                            onCancel={cancelEdit}
                          />
                        );
                      })}
                    </div>
                  );
                }
                // 신규 행
                const insIdx = idx - rows.length;
                const ins = pendingInserts[insIdx];
                return (
                  <div
                    key={vi.key}
                    className="flex absolute left-0 border-b border-[#a6e3a1]/20 bg-[#a6e3a1]/10"
                    style={{
                      top: 0,
                      transform: `translateY(${vi.start}px)`,
                      height: vi.size,
                      width: totalWidth,
                    }}
                  >
                    <div className="w-7 shrink-0 border-r border-white/5 flex items-center justify-center">
                      <button
                        onClick={() => removeNewRow(ins.tempId)}
                        className="w-4 h-4 flex items-center justify-center rounded text-[#f38ba8]/70 hover:text-[#f38ba8] hover:bg-[#f38ba8]/10"
                        title="신규 행 취소"
                      >
                        <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 1.5l5 5M6.5 1.5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                    <div
                      className="px-2 py-1 text-[#a6e3a1] border-r border-white/5 shrink-0 text-right font-semibold text-[10px]"
                      style={{ width: ROW_NUM_WIDTH }}
                    >
                      NEW
                    </div>
                    {columns.map((col, ci) => {
                      const isNull = ins.nulls.has(col.name);
                      const value = ins.values[col.name] ?? '';
                      const display = isNull
                        ? { display: 'NULL', isNull: true, isBlob: false }
                        : { display: value, isNull: false, isBlob: false };
                      const isEditing = editingCell?.rowIdx === -1 - insIdx && editingCell.col === col.name;
                      return (
                        <Cell
                          key={ci}
                          value={display}
                          isEditing={isEditing}
                          isDirty={!isNull || !!ins.values[col.name]}
                          onStartEdit={() => setEditingCell({ rowIdx: -1 - insIdx, col: col.name })}
                          onCommit={(v, isNullCommit) => {
                            updateNewRowCell(ins.tempId, col.name, v, isNullCommit);
                            setEditingCell(null);
                          }}
                          onCancel={cancelEdit}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 개별 셀 — 편집 모드면 input, 아니면 표시 */
function Cell({
  value,
  isEditing,
  isDirty,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  value: { display: string; isNull: boolean; isBlob: boolean };
  isEditing: boolean;
  isDirty: boolean;
  onStartEdit: () => void;
  onCommit: (v: string, isNull: boolean) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(value.isNull ? '' : value.display);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isEditing) {
    return (
      <div
        className="px-1 py-0.5 border-r border-white/5 shrink-0 bg-[#89b4fa]/10"
        style={{ width: COL_WIDTH }}
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={() => onCommit(draft, false)}
          onKeyDown={e => {
            if (e.key === 'Enter') onCommit(draft, false);
            else if (e.key === 'Escape') onCancel();
            else if (e.ctrlKey && (e.key === ' ' || e.key === '0')) {
              e.preventDefault();
              onCommit('', true); // Ctrl+Space → NULL
            }
          }}
          className="w-full bg-[#0b0b14] text-[#cdd6f4] text-[11px] px-1.5 py-0.5 rounded border border-[#89b4fa] outline-none font-mono ring-2 ring-[#89b4fa]/30"
        />
      </div>
    );
  }

  const textClass = value.isNull
    ? 'text-[#7f849c] italic'
    : value.isBlob
      ? 'text-[#f9e2af]'
      : 'text-[#cdd6f4]';

  return (
    <div
      className={`px-2 py-1 border-r border-white/5 shrink-0 truncate cursor-pointer ${textClass} ${
        isDirty ? 'bg-[#f9e2af]/15 font-semibold ring-1 ring-[#f9e2af]/20 ring-inset' : ''
      }`}
      style={{ width: COL_WIDTH, maxWidth: COL_MAX }}
      onDoubleClick={onStartEdit}
      title={value.display}
    >
      {value.display}
    </div>
  );
}

export default TableDataView;
