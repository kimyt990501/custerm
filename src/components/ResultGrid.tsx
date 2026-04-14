import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface ResultGridProps {
  result: QueryResult | null;
  error: string | null;
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

const COL_MIN_WIDTH = 120;
const COL_MAX_WIDTH = 400;
const ROW_NUM_WIDTH = 48;

function ResultGrid({ result, error }: ResultGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [popupCell, setPopupCell] = useState<string | null>(null);

  const sortedRows = useMemo(() => {
    if (!result || result.kind !== 'rows') return [];
    if (sortCol === null) return result.rows;
    const copy = [...result.rows];
    copy.sort((a, b) => {
      const av = a[sortCol];
      const bv = b[sortCol];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [result, sortCol, sortDir]);

  const rowVirtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 24,
    overscan: 10,
  });

  const copyCsv = () => {
    if (!result || result.kind !== 'rows') return;
    const header = result.columns.map(c => c.name).join(',');
    const body = sortedRows.map(row =>
      row.map(v => {
        const { display, isNull } = formatCell(v);
        if (isNull) return '';
        if (/[",\n]/.test(display)) return `"${display.replace(/"/g, '""')}"`;
        return display;
      }).join(','),
    ).join('\n');
    navigator.clipboard.writeText(`${header}\n${body}`);
  };

  if (error) {
    return (
      <div className="h-full flex flex-col bg-[#0b0b14]">
        <div className="m-3 p-3 bg-[#f38ba8]/10 border border-[#f38ba8]/20 rounded-lg text-[12px] text-[#f38ba8] font-mono whitespace-pre-wrap flex gap-2.5">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <div className="flex-1">{error}</div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#9399b2] gap-2 bg-[#0b0b14]">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="text-[#313244]">
          <rect x="3" y="5" width="22" height="18" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M3 10h22M9 10v13M16 10v13" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <div className="text-[11px]">쿼리를 실행하면 결과가 여기에 표시됩니다</div>
        <div className="text-[10px] text-[#7f849c]">Ctrl+Enter — 현재 문 실행 / Ctrl+Shift+Enter — 전체 실행</div>
      </div>
    );
  }

  if (result.kind === 'ok') {
    return (
      <div className="h-full flex items-center justify-center bg-[#0b0b14] p-4">
        <div className="max-w-md w-full bg-[#11111b]/60 border border-[#3ddc97]/20 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-[#3ddc97]/15 flex items-center justify-center text-[#3ddc97]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7.5l2.5 2.5L11 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-[13px] text-[#3ddc97] font-semibold">쿼리 성공</span>
          </div>
          <div className="space-y-1.5 text-[12px] text-[#cdd6f4]">
            <div className="flex justify-between"><span className="text-[#9399b2]">영향받은 행</span><span className="font-mono tabular-nums">{result.affectedRows}</span></div>
            {result.insertId > 0 && (
              <div className="flex justify-between"><span className="text-[#9399b2]">insertId</span><span className="font-mono tabular-nums">{result.insertId}</span></div>
            )}
            <div className="flex justify-between"><span className="text-[#9399b2]">소요 시간</span><span className="font-mono tabular-nums">{result.durationMs}ms</span></div>
            {result.warningCount ? <div className="flex justify-between text-[#f9e2af]"><span className="text-[#9399b2]">경고</span><span className="font-mono">{result.warningCount}</span></div> : null}
          </div>
        </div>
      </div>
    );
  }

  const toggleSort = (i: number) => {
    if (sortCol === i) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(i);
      setSortDir('asc');
    }
  };

  const totalWidth = ROW_NUM_WIDTH + result.columns.length * COL_MIN_WIDTH;

  return (
    <div className="h-full flex flex-col bg-[#0b0b14] min-h-0">
      {/* 상단 메타 바 */}
      <div className="h-8 flex items-center justify-between px-3 border-b border-white/5 bg-[#11111b]/70 text-[11px] text-[#bac2de] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono tabular-nums text-[#cdd6f4]">{result.rowCount}</span>
          <span className="text-[#9399b2]">행</span>
          {result.truncated && (
            <span className="px-1.5 py-0.5 rounded bg-[#f9e2af]/10 text-[#f9e2af] text-[9px] font-medium">TRUNCATED</span>
          )}
          <span className="h-3 w-px bg-white/5" />
          <span className="font-mono tabular-nums text-[#3ddc97]">{result.durationMs}</span>
          <span className="text-[#9399b2]">ms</span>
          {result.warningCount ? (
            <>
              <span className="h-3 w-px bg-white/5" />
              <span className="text-[#f9e2af]">경고 {result.warningCount}</span>
            </>
          ) : null}
        </div>
        <button
          onClick={copyCsv}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 text-[#bac2de] hover:bg-white/10 hover:text-[#cdd6f4] text-[10px] font-medium transition-colors"
          title="CSV로 복사"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <rect x="3" y="3" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8 3V2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1" stroke="currentColor" strokeWidth="1.2" />
          </svg>
          CSV 복사
        </button>
      </div>

      {/* 헤더 + 본문을 같은 스크롤 컨테이너에 넣어 가로 스크롤 동기화 */}
      <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[11px] min-h-0">
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          {/* 헤더 — sticky top-0 으로 세로 스크롤 시 고정, 가로는 같이 이동 */}
          <div
            className="flex bg-gradient-to-b from-[#181825] to-[#11111b] border-b border-white/10 text-[#cdd6f4] sticky top-0 z-10"
            style={{ width: totalWidth }}
          >
            <div
              className="px-2 py-1.5 text-[#7f849c] border-r border-white/5 shrink-0 text-right text-[10px] font-medium"
              style={{ width: ROW_NUM_WIDTH }}
            >
              #
            </div>
            {result.columns.map((col, i) => {
              const active = sortCol === i;
              return (
                <div
                  key={i}
                  className={`px-2 py-1.5 border-r border-white/5 cursor-pointer shrink-0 select-none font-medium flex items-center gap-1 group transition-colors ${
                    active ? 'bg-[#f38ba8]/5 text-[#f38ba8]' : 'hover:bg-white/[0.04] text-[#cdd6f4]'
                  }`}
                  style={{ width: COL_MIN_WIDTH }}
                  onClick={() => toggleSort(i)}
                  title={`타입 코드: ${col.type}`}
                >
                  <span className="truncate flex-1">{col.name}</span>
                  {active ? (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={sortDir === 'asc' ? '' : 'rotate-180'}>
                      <path d="M4 1.5L1.5 5h5z" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-[#7f849c] opacity-0 group-hover:opacity-100">
                      <path d="M4 1.5L1.5 4h5zM4 6.5L1.5 4h5z" fill="currentColor" opacity="0.5" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>

          {/* 가상 스크롤 본문 */}
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: totalWidth }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const row = sortedRows[virtualRow.index];
              const even = virtualRow.index % 2 === 0;
              return (
                <div
                  key={virtualRow.key}
                  className={`flex absolute left-0 hover:bg-[#3ddc97]/5 border-b border-white/[0.03] transition-colors ${
                    even ? '' : 'bg-white/[0.015]'
                  }`}
                  style={{
                    top: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    height: virtualRow.size,
                    width: totalWidth,
                  }}
                >
                  <div
                    className="px-2 py-1 text-[#7f849c] border-r border-white/5 shrink-0 text-right tabular-nums text-[10px]"
                    style={{ width: ROW_NUM_WIDTH }}
                  >
                    {virtualRow.index + 1}
                  </div>
                  {row.map((cell, ci) => {
                    const { display, isNull, isBlob } = formatCell(cell);
                    return (
                      <div
                        key={ci}
                        className={`px-2 py-1 border-r border-white/5 shrink-0 truncate cursor-pointer ${
                          isNull
                            ? 'text-[#7f849c] italic'
                            : isBlob
                              ? 'text-[#f9e2af]'
                              : 'text-[#cdd6f4]'
                        }`}
                        style={{ width: COL_MIN_WIDTH, maxWidth: COL_MAX_WIDTH }}
                        onDoubleClick={() => setPopupCell(display)}
                        title={display}
                      >
                        {display}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 셀 값 팝업 */}
      {popupCell !== null && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setPopupCell(null)}
        >
          <div
            className="bg-[#1e1e2e] border border-white/10 rounded-xl shadow-2xl w-[640px] max-h-[70vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 bg-black/20">
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="text-[#3ddc97]">
                  <rect x="1.5" y="1.5" width="11" height="11" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4 5h6M4 7h6M4 9h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                <span className="text-[12px] text-[#cdd6f4] font-medium">셀 값</span>
              </div>
              <button
                onClick={() => setPopupCell(null)}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5"
                title="닫기"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <pre className="flex-1 overflow-auto text-[11px] text-[#cdd6f4] bg-[#0b0b14] p-3 font-mono whitespace-pre-wrap break-all">
              {popupCell}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResultGrid;
