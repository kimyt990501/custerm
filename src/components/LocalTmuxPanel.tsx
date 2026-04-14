import { useState, useCallback } from 'react';
import { useLocalTmux } from '../hooks/useLocalTmux';

interface LocalTmuxPanelProps {
  ptyId: string | null;
}

function LocalTmuxPanel({ ptyId }: LocalTmuxPanelProps) {
  const {
    sessions,
    tmuxAvailable,
    loading,
    error,
    setError,
    refresh,
    attach,
    createSession,
    detach,
    killSession,
  } = useLocalTmux({ ptyId });

  const [newSessionName, setNewSessionName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(() => {
    const name = newSessionName.trim();
    setCreating(true);
    createSession(name || undefined);
    setNewSessionName('');
    setTimeout(() => {
      refresh();
      setCreating(false);
    }, 500);
  }, [newSessionName, createSession, refresh]);

  const handleAttach = useCallback((name: string) => {
    attach(name);
  }, [attach]);

  const handleKill = useCallback(async (name: string) => {
    await killSession(name);
  }, [killSession]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#181825]/80 to-[#11111b]/70 backdrop-blur-xl border-l border-white/5 w-[300px] shrink-0 select-none">
      <div className="h-11 flex items-center gap-2.5 px-4 border-b border-white/5 bg-black/10">
        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-[#3ddc97]/15 text-[#3ddc97]">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1.5" y="2" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1.5 5h11M5 5v7" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[#cdd6f4]">tmux 세션</div>
          <div className="text-[10px] text-[#9399b2]">{tmuxAvailable === false ? '미설치' : `활성 ${sessions.length}개`}</div>
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

      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f38ba8]/10 border-b border-[#f38ba8]/10">
          <span className="text-[10px] text-[#f38ba8] flex-1 truncate">{error}</span>
          <button onClick={() => setError(null)} className="text-[#f38ba8]/60 hover:text-[#f38ba8] transition-colors">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {tmuxAvailable === false && (
        <div className="px-3 py-2.5 bg-[#f9e2af]/5 border-b border-[#f9e2af]/10">
          <span className="text-[10px] text-[#f9e2af]">
            로컬 환경에 tmux가 설치되어 있지 않습니다
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1">
        {tmuxAvailable === null ? (
          <div className="px-3 py-8 text-center text-[11px] text-[#9399b2]">확인 중...</div>
        ) : tmuxAvailable && sessions.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11px] text-[#9399b2]">활성 세션 없음</div>
        ) : (
          sessions.map(session => (
            <div
              key={session.name}
              className="flex items-center gap-2.5 mx-2 my-1 px-2.5 py-2 rounded-lg bg-[#0b0b14]/40 border border-white/5 hover:border-white/10 hover:bg-[#0b0b14]/60 group transition-all"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                style={{
                  backgroundColor: session.attached ? '#3ddc97' : '#6c7086',
                  boxShadow: session.attached ? '0 0 6px rgba(61,220,151,0.4)' : 'none',
                }}
                title={session.attached ? '연결됨' : '분리됨'}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-[#cdd6f4] truncate font-medium">{session.name}</div>
                <div className="flex items-center gap-2 text-[10px] text-[#9399b2] mt-0.5">
                  <span>{session.windowCount}개 창</span>
                  {session.size && <span className="font-mono">{session.size}</span>}
                </div>
              </div>
              <button
                onClick={() => handleAttach(session.name)}
                className="px-2 py-0.5 text-[9px] font-medium rounded-md bg-[#3ddc97]/10 text-[#3ddc97] hover:bg-[#3ddc97]/25 opacity-0 group-hover:opacity-100 shrink-0 transition-all"
                title="세션 연결"
              >
                연결
              </button>
              <button
                onClick={() => handleKill(session.name)}
                className="w-5 h-5 flex items-center justify-center text-[#9399b2] hover:text-[#f38ba8] opacity-0 group-hover:opacity-100 shrink-0 transition-all"
                title="세션 종료"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {tmuxAvailable !== false && (
        <div className="border-t border-white/5 p-3 space-y-2.5">
          <div className="text-[10px] text-[#9399b2] font-medium uppercase tracking-wider">새 세션</div>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="세션 이름 (선택)"
              value={newSessionName}
              onChange={e => setNewSessionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              className="flex-1 bg-[#0b0b14]/50 text-[#cdd6f4] text-[11px] px-2 py-1.5 rounded-lg border border-white/5 outline-none focus:border-[#3ddc97]/50 transition-colors"
            />
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-3 py-1.5 text-[11px] font-medium rounded-lg bg-[#3ddc97] text-[#1e1e2e] hover:bg-[#74c7ec] disabled:opacity-50 transition-colors shadow-sm shadow-[#3ddc97]/20"
            >
              {creating ? '...' : '생성'}
            </button>
          </div>
          <button
            onClick={detach}
            className="w-full py-1.5 text-[11px] font-medium rounded-lg bg-white/[0.04] text-[#bac2de] hover:bg-white/[0.08] border border-white/5 transition-colors"
          >
            현재 세션 분리 (Ctrl+b d)
          </button>
        </div>
      )}
    </div>
  );
}

export default LocalTmuxPanel;
