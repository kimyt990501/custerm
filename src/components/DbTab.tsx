import { useState, useRef, useCallback } from 'react';
import { useDb } from '../hooks/useDb';
import DbTree from './DbTree';
import SqlEditor from './SqlEditor';
import ResultGrid from './ResultGrid';
import TableDataView from './TableDataView';

interface DbTabProps {
  tabId: string;
  active: boolean;
  dbProfileId: string;
  profileName: string;
}

type ViewMode = 'query' | 'table';

function DbTab({ active, dbProfileId, profileName }: DbTabProps) {
  const db = useDb(dbProfileId);
  const [sql, setSql] = useState('-- SELECT 문을 입력하고 Ctrl+Enter 로 실행\n\n');
  const [dbContext, setDbContext] = useState<string>('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const currentQueryIdRef = useRef<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');

  const [viewMode, setViewMode] = useState<ViewMode>('query');
  const [openedTable, setOpenedTable] = useState<{ db: string; table: string } | null>(null);

  const [treeWidth, setTreeWidth] = useState(240);
  const [editorRatio, setEditorRatio] = useState(0.4);
  const splitRef = useRef<HTMLDivElement>(null);

  const handleRun = useCallback(async (rawSql: string, overrideDbContext?: string) => {
    if (running) return;
    const trimmed = rawSql.trim();
    if (!trimmed) return;
    setRunning(true);
    setError(null);
    const { queryId, result: res, error: err } = await db.runQuery(
      trimmed,
      overrideDbContext ?? (dbContext || undefined),
    );
    currentQueryIdRef.current = queryId;
    if (err) {
      setError(err);
      setResult(null);
    } else if (res) {
      setResult(res);
      setError(null);
    }
    setRunning(false);
    currentQueryIdRef.current = null;
  }, [db, dbContext, running]);

  const handleRunAll = useCallback(() => handleRun(sql), [sql, handleRun]);

  const handleCancel = useCallback(() => {
    if (currentQueryIdRef.current) {
      db.cancelQuery(currentQueryIdRef.current);
    }
  }, [db]);

  /** 테이블 더블클릭 → 테이블 데이터 뷰로 전환 */
  const handleSelectTable = useCallback((dbName: string, tableName: string) => {
    setOpenedTable({ db: dbName, table: tableName });
    setDbContext(dbName);
    setViewMode('table');
  }, []);

  // 수직 리사이즈 (에디터 / 결과)
  const handleEditorResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const y = ev.clientY - rect.top;
      setEditorRatio(Math.max(0.15, Math.min(0.85, y / rect.height)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // 가로 리사이즈 (트리)
  const handleTreeResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = treeWidth;
    const onMove = (ev: MouseEvent) => {
      setTreeWidth(Math.max(160, Math.min(500, startW + (ev.clientX - startX))));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [treeWidth]);

  if (!active) return null;

  // 비밀번호 필요
  if (db.needsPassword) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0b0b14]">
        <form
          onSubmit={e => { e.preventDefault(); db.connect(passwordInput); setPasswordInput(''); }}
          className="bg-[#1e1e2e] border border-[#313244] rounded-lg shadow-xl p-5 w-80 space-y-3"
        >
          <h2 className="text-sm text-[#cdd6f4]">비밀번호 필요: {profileName}</h2>
          <input
            type="password"
            autoFocus
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            className="w-full bg-[#0b0b14]/50 text-[#cdd6f4] text-xs px-2.5 py-1.5 rounded border border-[#313244] outline-none focus:border-[#f38ba8]/60"
            placeholder="••••••••"
          />
          <button
            type="submit"
            disabled={db.connecting}
            className="w-full px-3 py-1.5 text-xs rounded bg-[#f38ba8] text-[#1e1e2e] hover:bg-[#eba0ac] disabled:opacity-50 font-medium"
          >
            {db.connecting ? '접속 중...' : '접속'}
          </button>
        </form>
      </div>
    );
  }

  // 연결 중
  if (db.connecting || !db.connId) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-[#0b0b14] text-[#bac2de]">
        {db.error ? (
          <div className="max-w-md text-center">
            <div className="text-[#f38ba8] text-sm mb-3">{db.error}</div>
            <button
              onClick={() => db.connect()}
              className="px-3 py-1.5 text-xs rounded bg-[#313244] text-[#cdd6f4] hover:bg-[#45475a]"
            >
              재접속
            </button>
          </div>
        ) : (
          <div className="text-xs">MySQL 서버에 접속 중...</div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full flex bg-[#0b0b14]">
      {/* 트리 */}
      <div style={{ width: treeWidth }} className="shrink-0">
        <DbTree
          databases={db.databases}
          listTables={db.listTables}
          describeTable={db.describeTable}
          onSelectTable={handleSelectTable}
          onRefresh={db.refreshDatabases}
        />
      </div>
      <div
        className="w-px bg-white/5 hover:bg-[#89b4fa]/50 cursor-col-resize shrink-0 transition-colors"
        onMouseDown={handleTreeResize}
      />

      {/* 우측: 모드 전환 탭 + 콘텐츠 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 모드 전환 탭 */}
        <div className="h-10 flex items-center px-2 gap-1 border-b border-white/5 bg-gradient-to-b from-[#181825] to-[#11111b] shrink-0">
          <ModeTab
            active={viewMode === 'query'}
            onClick={() => setViewMode('query')}
            icon={
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M1.5 3.5l3 3-3 3M6 10h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="SQL 쿼리"
          />
          <ModeTab
            active={viewMode === 'table'}
            onClick={() => { if (openedTable) setViewMode('table'); }}
            icon={
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <rect x="1.5" y="2" width="11" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M1.5 5.5h11M1.5 9h11M5 5.5v6.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            }
            label={openedTable ? `${openedTable.db}.${openedTable.table}` : '테이블 데이터'}
            disabled={!openedTable}
          />
          <div className="flex-1" />
          {db.serverVersion && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#f38ba8]/10 border border-[#f38ba8]/15 text-[#f38ba8] text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a6e3a1] shadow-[0_0_4px_rgba(166,227,161,0.6)]" />
              MySQL {db.serverVersion}
            </div>
          )}
        </div>

        {/* 쿼리 뷰 */}
        {viewMode === 'query' && (
          <div ref={splitRef} className="flex-1 min-h-0 flex flex-col">
            <div className="h-10 flex items-center gap-2 px-3 border-b border-white/5 bg-[#11111b]/70 shrink-0">
              <button
                onClick={handleRunAll}
                disabled={running}
                className="ui-btn-success"
                title="전체 실행 (Ctrl+Shift+Enter)"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                  <path d="M2 1.5L8.5 5 2 8.5z" />
                </svg>
                실행
              </button>
              <button
                onClick={handleCancel}
                disabled={!running}
                className="ui-btn-accent"
                title="실행 중인 쿼리 취소"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
                  <rect x="2" y="2" width="6" height="6" rx="0.8" />
                </svg>
                취소
              </button>
              <div className="h-5 w-px bg-white/5 mx-1" />
              <label className="text-[11px] text-[#bac2de] font-medium">DB:</label>
              <select
                value={dbContext}
                onChange={e => setDbContext(e.target.value)}
                className="bg-[#0b0b14] text-[#cdd6f4] text-[11px] px-2 py-1 rounded-md border border-white/5 outline-none focus:border-[#89b4fa]/60 transition-colors"
              >
                <option value="">(없음)</option>
                {db.databases.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {running && (
                <div className="ml-auto flex items-center gap-1.5 text-[11px] text-[#89b4fa]">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="animate-spin">
                    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" opacity="0.3" />
                    <path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  실행 중...
                </div>
              )}
            </div>

            <div style={{ flex: `0 0 ${editorRatio * 100}%` }} className="min-h-0">
              <SqlEditor
                value={sql}
                onChange={setSql}
                onRun={handleRun}
                onRunAll={handleRunAll}
              />
            </div>

            <div
              className="h-1 bg-white/5 hover:bg-[#89b4fa]/50 cursor-row-resize shrink-0 transition-colors"
              onMouseDown={handleEditorResize}
            />

            <div className="flex-1 min-h-0">
              <ResultGrid result={result} error={error} />
            </div>
          </div>
        )}

        {/* 테이블 데이터 뷰 */}
        {viewMode === 'table' && openedTable && (
          <TableDataView
            key={`${openedTable.db}.${openedTable.table}`}
            dbName={openedTable.db}
            tableName={openedTable.table}
            fetchTableData={db.fetchTableData}
            updateRow={db.updateRow}
            insertRow={db.insertRow}
            deleteRow={db.deleteRow}
          />
        )}
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  label,
  disabled,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative px-3 h-7 flex items-center gap-2 rounded-md text-[11px] font-medium transition-all ${
        disabled
          ? 'text-[#7f849c] cursor-not-allowed'
          : active
            ? 'bg-[#1e1e2e] text-[#cdd6f4] ring-1 ring-white/5 shadow-inner'
            : 'text-[#9399b2] hover:text-[#bac2de] hover:bg-white/5'
      }`}
    >
      <span className={active ? 'text-[#f38ba8]' : ''}>{icon}</span>
      {label}
    </button>
  );
}

export default DbTab;
