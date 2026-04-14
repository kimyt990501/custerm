import { useState, useMemo, useCallback, type MouseEvent } from 'react';

/** useDocker / useWslDocker 공통 반환 shape */
interface DockerController {
  containers: DockerContainer[];
  images: DockerImage[];
  dockerAvailable: boolean | null;
  loading: boolean;
  error: string | null;
  setError: (err: string | null) => void;
  refresh: () => void;
  start: (id: string) => void;
  stop: (id: string) => void;
  restart: (id: string) => void;
  remove: (id: string, force: boolean) => void;
  removeImage: (id: string, force: boolean) => void;
  pullImage: (ref: string) => void;
  execInto: (name: string, shell?: string) => void;
  showLogs: (name: string) => void;
}

interface DockerPanelViewProps {
  controller: DockerController;
}

const STATE_COLOR: Record<string, string> = {
  running: '#3ddc97',
  paused: '#f9e2af',
  restarting: '#3ddc97',
  created: '#cba6f7',
  exited: '#6c7086',
  dead: '#f38ba8',
};

function DockerPanelView({ controller }: DockerPanelViewProps) {
  const {
    containers, images, dockerAvailable, loading, error, setError,
    refresh, start, stop, restart, remove, removeImage, pullImage, execInto, showLogs,
  } = controller;

  const [tab, setTab] = useState<'containers' | 'images'>('containers');
  const [runningOnly, setRunningOnly] = useState(false);
  const [pullRef, setPullRef] = useState('');
  const [pulling, setPulling] = useState(false);

  const filtered = useMemo(
    () => runningOnly ? containers.filter(c => c.state === 'running') : containers,
    [containers, runningOnly],
  );

  const handlePull = useCallback(async () => {
    const ref = pullRef.trim();
    if (!ref) return;
    setPulling(true);
    try {
      await pullImage(ref);
      setPullRef('');
    } finally {
      setTimeout(() => setPulling(false), 300);
    }
  }, [pullRef, pullImage]);

  const handleRemove = useCallback((e: MouseEvent, id: string) => {
    remove(id, e.shiftKey);
  }, [remove]);

  const handleRemoveImage = useCallback((e: MouseEvent, id: string) => {
    removeImage(id, e.shiftKey);
  }, [removeImage]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#181825]/80 to-[#11111b]/70 backdrop-blur-xl border-l border-white/5 w-[300px] shrink-0 select-none">
      {/* 헤더 */}
      <div className="h-11 flex items-center gap-2.5 px-4 border-b border-white/5 bg-black/10">
        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-[#74c7ec]/15 text-[#74c7ec]">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="5" width="2.5" height="2.5" stroke="currentColor" strokeWidth="1.1" />
            <rect x="4" y="5" width="2.5" height="2.5" stroke="currentColor" strokeWidth="1.1" />
            <rect x="7" y="5" width="2.5" height="2.5" stroke="currentColor" strokeWidth="1.1" />
            <rect x="4" y="2" width="2.5" height="2.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M10.5 6.5c2 0 2.5 1.2 2.5 2.5 0 1.5-1.3 3-3.5 3H2C1.5 12 1 11 1 10" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[#cdd6f4]">Docker</div>
          <div className="text-[10px] text-[#9399b2]">
            {dockerAvailable === false ? '미설치' : `컨테이너 ${containers.length} · 이미지 ${images.length}`}
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5 disabled:opacity-40 transition-colors"
          title="새로고침"
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" className={loading ? 'animate-spin' : ''}>
            <path d="M8.5 5a3.5 3.5 0 1 1-1-2.5M8.5 1v1.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* 탭 스위처 */}
      <div className="flex border-b border-white/5 text-[11px] bg-black/10">
        {(['containers', 'images'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 font-medium transition-all relative ${
              tab === t ? 'text-[#74c7ec]' : 'text-[#9399b2] hover:text-[#bac2de]'
            }`}
          >
            {t === 'containers' ? `컨테이너 ${containers.length}` : `이미지 ${images.length}`}
            {tab === t && <div className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-[#74c7ec] shadow-[0_0_6px_rgba(116,199,236,0.5)]" />}
          </button>
        ))}
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f38ba8]/10 border-b border-[#f38ba8]/10">
          <span className="text-[10px] text-[#f38ba8] flex-1 truncate" title={error}>{error}</span>
          <button onClick={() => setError(null)} className="text-[#f38ba8]/60 hover:text-[#f38ba8] transition-colors">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* docker 미설치 경고 */}
      {dockerAvailable === false && (
        <div className="px-3 py-2.5 bg-[#f9e2af]/5 border-b border-[#f9e2af]/10">
          <span className="text-[10px] text-[#f9e2af]">
            docker가 설치되어 있지 않거나 실행 중이 아닙니다
          </span>
        </div>
      )}

      {/* 컨테이너 탭 */}
      {tab === 'containers' && (
        <>
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/5 text-[10px]">
            <label className="flex items-center gap-1.5 cursor-pointer text-[#bac2de]">
              <input
                type="checkbox"
                checked={runningOnly}
                onChange={e => setRunningOnly(e.target.checked)}
                className="accent-[#74c7ec]"
              />
              실행 중만
            </label>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {dockerAvailable === null ? (
              <div className="px-3 py-8 text-center text-[11px] text-[#9399b2]">확인 중...</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-[11px] text-[#9399b2]">
                {runningOnly ? '실행 중인 컨테이너 없음' : '컨테이너 없음'}
              </div>
            ) : (
              filtered.map(c => (
                <div key={c.id} className="flex items-start gap-2 mx-2 my-1 px-2.5 py-2 rounded-lg bg-[#0b0b14]/40 border border-white/5 hover:border-white/10 hover:bg-[#0b0b14]/60 group transition-all">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-sm mt-1"
                    style={{
                      backgroundColor: STATE_COLOR[c.state] || '#6c7086',
                      boxShadow: c.state === 'running' ? '0 0 6px rgba(61,220,151,0.4)' : 'none',
                    }}
                    title={c.state}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#cdd6f4] truncate font-medium">{c.name}</div>
                    <div className="text-[10px] text-[#9399b2] truncate" title={c.image}>{c.image}</div>
                    <div className="text-[9px] text-[#9399b2] truncate" title={c.status}>{c.status}</div>
                    {c.ports && <div className="text-[9px] text-[#3ddc97]/70 truncate font-mono" title={c.ports}>{c.ports}</div>}
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {c.state === 'running' ? (
                        <button
                          onClick={() => stop(c.id)}
                          className="px-1.5 py-0.5 text-[9px] rounded bg-[#f9e2af]/10 text-[#f9e2af] hover:bg-[#f9e2af]/25"
                          title="중지"
                        >■</button>
                      ) : (
                        <button
                          onClick={() => start(c.id)}
                          className="px-1.5 py-0.5 text-[9px] rounded bg-[#3ddc97]/10 text-[#3ddc97] hover:bg-[#3ddc97]/25"
                          title="시작"
                        >▶</button>
                      )}
                      <button
                        onClick={() => restart(c.id)}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-[#3ddc97]/10 text-[#3ddc97] hover:bg-[#3ddc97]/25"
                        title="재시작"
                      >↻</button>
                      <button
                        onClick={() => execInto(c.name)}
                        disabled={c.state !== 'running'}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-[#74c7ec]/10 text-[#74c7ec] hover:bg-[#74c7ec]/25 disabled:opacity-30 disabled:cursor-not-allowed font-mono"
                        title="exec (셸 진입)"
                      >&gt;_</button>
                      <button
                        onClick={() => showLogs(c.name)}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-white/5 text-[#bac2de] hover:bg-white/10"
                        title="logs -f"
                      >≡</button>
                      <button
                        onClick={e => handleRemove(e, c.id)}
                        className="px-1.5 py-0.5 text-[9px] rounded bg-[#f38ba8]/10 text-[#f38ba8] hover:bg-[#f38ba8]/25 ml-auto"
                        title="삭제 (Shift+클릭: 강제)"
                      >✕</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* 이미지 탭 */}
      {tab === 'images' && (
        <>
          <div className="flex-1 overflow-y-auto py-1">
            {dockerAvailable === null ? (
              <div className="px-3 py-8 text-center text-[11px] text-[#9399b2]">확인 중...</div>
            ) : images.length === 0 ? (
              <div className="px-3 py-8 text-center text-[11px] text-[#9399b2]">이미지 없음</div>
            ) : (
              images.map(img => (
                <div key={img.id + img.repository + img.tag} className="flex items-start gap-2 mx-2 my-1 px-2.5 py-2 rounded-lg bg-[#0b0b14]/40 border border-white/5 hover:border-white/10 hover:bg-[#0b0b14]/60 group transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-[#cdd6f4] truncate font-medium" title={`${img.repository}:${img.tag}`}>
                      {img.repository}:{img.tag}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#9399b2] mt-0.5">
                      <span className="font-mono">{img.id}</span>
                      <span>{img.size}</span>
                    </div>
                    <div className="text-[9px] text-[#9399b2]">{img.createdSince}</div>
                  </div>
                  <button
                    onClick={e => handleRemoveImage(e, img.id)}
                    className="w-5 h-5 flex items-center justify-center text-[#9399b2] hover:text-[#f38ba8] opacity-0 group-hover:opacity-100 shrink-0 transition-all"
                    title="삭제 (Shift+클릭: 강제)"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {dockerAvailable !== false && (
            <div className="border-t border-white/5 p-3 space-y-2">
              <div className="text-[10px] text-[#9399b2] font-medium uppercase tracking-wider">이미지 pull</div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="repo[:tag]"
                  value={pullRef}
                  onChange={e => setPullRef(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePull(); }}
                  className="flex-1 bg-[#0b0b14]/50 text-[#cdd6f4] text-[11px] px-2 py-1.5 rounded-lg border border-white/5 outline-none focus:border-[#74c7ec]/50 transition-colors font-mono"
                />
                <button
                  onClick={handlePull}
                  disabled={pulling || !pullRef.trim()}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-[#74c7ec] text-[#1e1e2e] hover:bg-[#89dceb] disabled:opacity-50 transition-colors shadow-sm shadow-[#74c7ec]/20"
                >
                  {pulling ? '...' : 'pull'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DockerPanelView;
