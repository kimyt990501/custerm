import { useState, useCallback } from 'react';

export interface TmuxPanelCoreProps {
  titleLabel: string;
  unavailableMessage: string;
  sessions: TmuxSession[];
  tmuxAvailable: boolean | null;
  loading: boolean;
  error: string | null;
  activeSessionName: string | null;
  onSetError: (e: string | null) => void;
  onRefresh: () => void;
  onAttach: (name: string) => void;
  onCreateSession: (name?: string) => void;
  onDetach: () => void;
  onKillSession: (name: string) => Promise<void>;
  onListWindows: (session: string) => Promise<TmuxWindow[]>;
  onListPanes: (session: string, window: number) => Promise<TmuxPane[]>;
  onSendKeys: (keys: string) => void;
  onSetMouse: (on: boolean) => void;
}

interface WindowTreeState {
  windows: TmuxWindow[];
  loading: boolean;
  error: string | null;
  expandedWindows: Set<number>;
  panes: Record<number, { panes: TmuxPane[]; loading: boolean; error: string | null }>;
}

type SessionsTree = Record<string, WindowTreeState | undefined>;

function TmuxPanelCore(props: TmuxPanelCoreProps) {
  const {
    titleLabel,
    unavailableMessage,
    sessions,
    tmuxAvailable,
    loading,
    error,
    activeSessionName,
    onSetError,
    onRefresh,
    onAttach,
    onCreateSession,
    onDetach,
    onKillSession,
    onListWindows,
    onListPanes,
    onSendKeys,
    onSetMouse,
  } = props;

  const [newSessionName, setNewSessionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [tree, setTree] = useState<SessionsTree>({});
  const [mouseOn, setMouseOn] = useState(false);
  const [mouseHintSeen, setMouseHintSeen] = useState(false);

  const hasActive = !!activeSessionName;

  const handleCreate = useCallback(() => {
    const name = newSessionName.trim();
    setCreating(true);
    onCreateSession(name || undefined);
    setNewSessionName('');
    setTimeout(() => {
      onRefresh();
      setCreating(false);
    }, 500);
  }, [newSessionName, onCreateSession, onRefresh]);

  const loadWindows = useCallback(async (sessionName: string) => {
    setTree(t => ({
      ...t,
      [sessionName]: {
        windows: t[sessionName]?.windows ?? [],
        loading: true,
        error: null,
        expandedWindows: t[sessionName]?.expandedWindows ?? new Set(),
        panes: t[sessionName]?.panes ?? {},
      },
    }));
    try {
      const wins = await onListWindows(sessionName);
      setTree(t => ({
        ...t,
        [sessionName]: {
          windows: wins,
          loading: false,
          error: null,
          expandedWindows: t[sessionName]?.expandedWindows ?? new Set(),
          panes: t[sessionName]?.panes ?? {},
        },
      }));
    } catch (err) {
      setTree(t => ({
        ...t,
        [sessionName]: {
          windows: t[sessionName]?.windows ?? [],
          loading: false,
          error: (err as Error).message,
          expandedWindows: t[sessionName]?.expandedWindows ?? new Set(),
          panes: t[sessionName]?.panes ?? {},
        },
      }));
    }
  }, [onListWindows]);

  const loadPanes = useCallback(async (sessionName: string, windowIndex: number) => {
    setTree(t => {
      const s = t[sessionName];
      if (!s) return t;
      return {
        ...t,
        [sessionName]: {
          ...s,
          panes: { ...s.panes, [windowIndex]: { panes: s.panes[windowIndex]?.panes ?? [], loading: true, error: null } },
        },
      };
    });
    try {
      const panes = await onListPanes(sessionName, windowIndex);
      setTree(t => {
        const s = t[sessionName];
        if (!s) return t;
        return {
          ...t,
          [sessionName]: {
            ...s,
            panes: { ...s.panes, [windowIndex]: { panes, loading: false, error: null } },
          },
        };
      });
    } catch (err) {
      setTree(t => {
        const s = t[sessionName];
        if (!s) return t;
        return {
          ...t,
          [sessionName]: {
            ...s,
            panes: { ...s.panes, [windowIndex]: { panes: s.panes[windowIndex]?.panes ?? [], loading: false, error: (err as Error).message } },
          },
        };
      });
    }
  }, [onListPanes]);

  const toggleSession = useCallback((sessionName: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionName)) {
        next.delete(sessionName);
      } else {
        next.add(sessionName);
        if (!tree[sessionName]) {
          void loadWindows(sessionName);
        }
      }
      return next;
    });
  }, [tree, loadWindows]);

  const toggleWindow = useCallback((sessionName: string, windowIndex: number) => {
    setTree(t => {
      const s = t[sessionName];
      if (!s) return t;
      const nextExpanded = new Set(s.expandedWindows);
      const isOpening = !nextExpanded.has(windowIndex);
      if (isOpening) {
        nextExpanded.add(windowIndex);
        if (!s.panes[windowIndex]) {
          void loadPanes(sessionName, windowIndex);
        }
      } else {
        nextExpanded.delete(windowIndex);
      }
      return { ...t, [sessionName]: { ...s, expandedWindows: nextExpanded } };
    });
  }, [loadPanes]);

  // 구조 변경 후 현재 펼쳐진 노드들 재조회
  const refreshExpandedTree = useCallback(() => {
    setTimeout(() => {
      for (const sessionName of expandedSessions) {
        void loadWindows(sessionName);
        const s = tree[sessionName];
        if (s) {
          for (const w of s.expandedWindows) {
            void loadPanes(sessionName, w);
          }
        }
      }
    }, 300);
  }, [expandedSessions, tree, loadWindows, loadPanes]);

  const send = useCallback((keys: string) => {
    if (!hasActive) return;
    onSendKeys(keys);
    refreshExpandedTree();
  }, [hasActive, onSendKeys, refreshExpandedTree]);

  const handleRefresh = useCallback(() => {
    onRefresh();
    refreshExpandedTree();
  }, [onRefresh, refreshExpandedTree]);

  const handleToggleMouse = useCallback((next: boolean) => {
    if (!hasActive) return;
    setMouseOn(next);
    onSetMouse(next);
    if (next) setMouseHintSeen(true);
  }, [hasActive, onSetMouse]);

  const btnBase = 'px-2 py-1 text-[10px] font-medium rounded-md border transition-colors';
  const btnEnabled = 'bg-white/[0.04] text-[#bac2de] hover:bg-white/[0.08] border-white/5';
  const btnDisabled = 'bg-white/[0.02] text-[#6c7086] border-white/5 cursor-not-allowed';
  const btnClass = hasActive ? `${btnBase} ${btnEnabled}` : `${btnBase} ${btnDisabled}`;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#181825]/80 to-[#11111b]/70 backdrop-blur-xl border-l border-white/5 w-[300px] shrink-0 select-none">
      {/* 헤더 */}
      <div className="h-11 flex items-center gap-2.5 px-4 border-b border-white/5 bg-black/10">
        <div className="w-6 h-6 rounded-md flex items-center justify-center bg-[#3ddc97]/15 text-[#3ddc97]">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1.5" y="2" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M1.5 5h11M5 5v7" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-[#cdd6f4]">{titleLabel}</div>
          <div className="text-[10px] text-[#9399b2]">{tmuxAvailable === false ? '미설치' : `활성 ${sessions.length}개`}</div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#9399b2] hover:text-[#cdd6f4] hover:bg-white/5 disabled:opacity-40 transition-colors"
          title="새로고침"
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" className={loading ? 'animate-spin' : ''}>
            <path d="M8.5 5a3.5 3.5 0 1 1-1-2.5M8.5 1v1.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* 에러 배너 */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f38ba8]/10 border-b border-[#f38ba8]/10">
          <span className="text-[10px] text-[#f38ba8] flex-1 truncate">{error}</span>
          <button onClick={() => onSetError(null)} className="text-[#f38ba8]/60 hover:text-[#f38ba8] transition-colors">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {tmuxAvailable === false && (
        <div className="px-3 py-2.5 bg-[#f9e2af]/5 border-b border-[#f9e2af]/10">
          <span className="text-[10px] text-[#f9e2af]">{unavailableMessage}</span>
        </div>
      )}

      {/* Pane/Window 툴바 */}
      {tmuxAvailable !== false && (
        <div className="px-3 py-2 border-b border-white/5 bg-black/10 space-y-1.5">
          <div className="text-[9px] text-[#9399b2] uppercase tracking-wider">
            Pane {hasActive ? `(${activeSessionName})` : '(연결된 세션 없음)'}
          </div>
          <div className="flex flex-wrap gap-1">
            <button disabled={!hasActive} onClick={() => send('\x02%')} className={btnClass} title="Ctrl+b %">⬌ 가로분할</button>
            <button disabled={!hasActive} onClick={() => send('\x02"')} className={btnClass} title='Ctrl+b "'>⬍ 세로분할</button>
            <button
              disabled={!hasActive}
              onClick={() => {
                if (!hasActive) return;
                onSendKeys('\x02x');
                setTimeout(() => onSendKeys('y\n'), 150);
                refreshExpandedTree();
              }}
              className={btnClass}
              title="Ctrl+b x"
            >✕ Pane 닫기</button>
            <button disabled={!hasActive} onClick={() => send('\x02o')} className={btnClass} title="Ctrl+b o">↻ 다음 pane</button>
            <button disabled={!hasActive} onClick={() => send('\x02z')} className={btnClass} title="Ctrl+b z">⛶ Zoom</button>
          </div>
          <div className="text-[9px] text-[#9399b2] uppercase tracking-wider pt-1">Window</div>
          <div className="flex flex-wrap gap-1">
            <button disabled={!hasActive} onClick={() => send('\x02c')} className={btnClass} title="Ctrl+b c">🪟 새 창</button>
            <button disabled={!hasActive} onClick={() => send('\x02n')} className={btnClass} title="Ctrl+b n">➡ 다음 창</button>
            <button
              disabled={!hasActive}
              onClick={() => {
                if (!hasActive) return;
                onSendKeys('\x02&');
                setTimeout(() => onSendKeys('y\n'), 150);
                refreshExpandedTree();
              }}
              className={btnClass}
              title="Ctrl+b &"
            >✕ 창 닫기</button>
          </div>
        </div>
      )}

      {/* 세션 트리 */}
      <div className="flex-1 overflow-y-auto py-1">
        {tmuxAvailable === null ? (
          <div className="px-3 py-8 text-center text-[11px] text-[#9399b2]">확인 중...</div>
        ) : tmuxAvailable && sessions.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11px] text-[#9399b2]">활성 세션 없음</div>
        ) : (
          sessions.map(session => {
            const expanded = expandedSessions.has(session.name);
            const node = tree[session.name];
            return (
              <div key={session.name} className="mx-2 my-1">
                <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-[#0b0b14]/40 border border-white/5 hover:border-white/10 hover:bg-[#0b0b14]/60 group transition-all">
                  <button
                    onClick={() => toggleSession(session.name)}
                    className="w-4 h-4 flex items-center justify-center text-[#9399b2] hover:text-[#cdd6f4]"
                    title={expanded ? '접기' : '펼치기'}
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                      <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
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
                    onClick={() => onAttach(session.name)}
                    className="px-2 py-0.5 text-[9px] font-medium rounded-md bg-[#3ddc97]/10 text-[#3ddc97] hover:bg-[#3ddc97]/25 opacity-0 group-hover:opacity-100 shrink-0 transition-all"
                    title="세션 연결"
                  >연결</button>
                  <button
                    onClick={() => onKillSession(session.name)}
                    className="w-5 h-5 flex items-center justify-center text-[#9399b2] hover:text-[#f38ba8] opacity-0 group-hover:opacity-100 shrink-0 transition-all"
                    title="세션 종료"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {expanded && (
                  <div className="ml-5 mt-1 mb-1.5 border-l border-white/5 pl-2">
                    {node?.loading && <div className="py-1 text-[10px] text-[#9399b2]">창 목록 로딩 중...</div>}
                    {node?.error && <div className="py-1 text-[10px] text-[#f38ba8]">{node.error}</div>}
                    {node?.windows.map(win => {
                      const winExpanded = node.expandedWindows.has(win.index);
                      const paneState = node.panes[win.index];
                      return (
                        <div key={win.index}>
                          <div className="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white/5">
                            <button
                              onClick={() => toggleWindow(session.name, win.index)}
                              className="w-4 h-4 flex items-center justify-center text-[#9399b2] hover:text-[#cdd6f4]"
                            >
                              <svg width="7" height="7" viewBox="0 0 8 8" fill="none" style={{ transform: winExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                                <path d="M2 1l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                            {win.active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc97]" title="active window" />
                            )}
                            <span className="text-[10px] text-[#cdd6f4]">#{win.index} {win.name}</span>
                            <span className="text-[9px] text-[#9399b2] ml-auto">{win.paneCount} pane</span>
                          </div>
                          {winExpanded && (
                            <div className="ml-5 border-l border-white/5 pl-2">
                              {paneState?.loading && <div className="py-0.5 text-[10px] text-[#9399b2]">pane 로딩...</div>}
                              {paneState?.error && <div className="py-0.5 text-[10px] text-[#f38ba8]">{paneState.error}</div>}
                              {paneState?.panes.map(pane => (
                                <div key={pane.index} className="flex items-center gap-1.5 px-1.5 py-0.5">
                                  {pane.active ? (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#3ddc97] shadow-[0_0_4px_rgba(61,220,151,0.6)]" title="active pane" />
                                  ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#6c7086]" />
                                  )}
                                  <span className="text-[10px] text-[#cdd6f4]">%{pane.index}</span>
                                  <span className="text-[10px] text-[#bac2de] truncate">{pane.command}</span>
                                  <span className="text-[9px] text-[#9399b2] font-mono ml-auto">{pane.size}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {node && !node.loading && node.windows.length === 0 && !node.error && (
                      <div className="py-1 text-[10px] text-[#9399b2]">창 없음</div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 하단 컨트롤 영역 */}
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

          <label
            className={`flex items-center gap-2 text-[11px] ${hasActive ? 'text-[#bac2de] cursor-pointer' : 'text-[#6c7086] cursor-not-allowed'}`}
            title="현재 세션에만 적용 (.tmux.conf 는 건드리지 않음). 켜면 Shift+드래그 로 선택/복사 가능."
          >
            <input
              type="checkbox"
              checked={mouseOn}
              disabled={!hasActive}
              onChange={e => handleToggleMouse(e.target.checked)}
              className="accent-[#3ddc97]"
            />
            <span>마우스 모드 (pane 드래그 리사이즈)</span>
          </label>
          {mouseOn && mouseHintSeen && (
            <div className="text-[9px] text-[#9399b2] leading-tight pl-5 -mt-1">
              Shift+드래그 로 선택/복사가 가능합니다. pane 경계를 드래그하면 크기 조절.
            </div>
          )}

          <button
            onClick={onDetach}
            disabled={!hasActive}
            className={`w-full py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${hasActive ? 'bg-white/[0.04] text-[#bac2de] hover:bg-white/[0.08] border-white/5' : 'bg-white/[0.02] text-[#6c7086] border-white/5 cursor-not-allowed'}`}
          >
            현재 세션 분리 (Ctrl+b d)
          </button>
        </div>
      )}
    </div>
  );
}

export default TmuxPanelCore;
