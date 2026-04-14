import { useEffect, useCallback, useState, useRef } from 'react';
import TabBar from './components/TabBar';
import TerminalComponent from './components/Terminal';
import Sidebar from './components/Sidebar';
import SettingsPanel from './components/SettingsPanel';
import SftpPanel from './components/SftpPanel';
import PortForwardingPanel from './components/PortForwardingPanel';
import TmuxPanel from './components/TmuxPanel';
import WslTmuxPanel from './components/WslTmuxPanel';
import DockerPanel from './components/DockerPanel';
import WslDockerPanel from './components/WslDockerPanel';
import DbTab from './components/DbTab';
import CommandPalette from './components/CommandPalette';
import ProfileDialog from './components/ProfileDialog';
import DbProfileDialog from './components/DbProfileDialog';
import { useTabs } from './hooks/useTabs';
import { useProfiles } from './hooks/useProfiles';
import { useDbProfiles } from './hooks/useDbProfiles';
import { useSettings } from './hooks/useSettings';

function App() {
  const {
    tabs,
    activeTabId,
    addTab,
    addSshTab,
    addWslTab,
    addDbTab,
    closeTab,
    switchTab,
    renameTab,
    setPtyId,
    setSshSessionId,
    reorderTabs,
    nextTab,
    prevTab,
  } = useTabs();

  const {
    profiles,
    createProfile,
    updateProfile,
    deleteProfile,
  } = useProfiles();

  const {
    dbProfiles,
    createDbProfile,
    updateDbProfile,
    deleteDbProfile,
  } = useDbProfiles();

  const {
    settings,
    theme,
    themeNames,
    loaded: settingsLoaded,
    updateSettings,
  } = useSettings();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  const [profileDialog, setProfileDialog] = useState<{ open: boolean; editing: SshProfile | null }>({ open: false, editing: null });
  const [dbProfileDialog, setDbProfileDialog] = useState<{ open: boolean; editing: DbProfile | null }>({ open: false, editing: null });
  const [zenMode, setZenMode] = useState(false);
  const [sftpOpenTabs, setSftpOpenTabs] = useState<Set<string>>(new Set());
  const [pfOpenTabs, setPfOpenTabs] = useState<Set<string>>(new Set());
  const [tmuxOpenTabs, setTmuxOpenTabs] = useState<Set<string>>(new Set());
  const [dockerOpenTabs, setDockerOpenTabs] = useState<Set<string>>(new Set());
  /** SFTP 패널이 차지하는 비율 (0.2 ~ 0.8) */
  const [sftpRatio, setSftpRatio] = useState(0.5);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const toggleSftp = useCallback((tabId: string) => {
    setSftpOpenTabs(prev => {
      const next = new Set(prev);
      if (next.has(tabId)) next.delete(tabId);
      else next.add(tabId);
      return next;
    });
  }, []);

  /**
   * 포트포워딩 / tmux / docker 는 동일한 우측 사이드 패널을 공유하므로
   * 한 번에 하나만 열리도록 서로 배타적으로 토글한다.
   * 해당 탭에서 이미 열려 있으면 닫고, 아니면 다른 두 패널을 닫고 해당 패널을 연다.
   */
  const togglePortForwarding = useCallback((tabId: string) => {
    setPfOpenTabs(prev => {
      const next = new Set(prev);
      if (next.has(tabId)) { next.delete(tabId); return next; }
      next.add(tabId);
      return next;
    });
    setTmuxOpenTabs(prev => {
      if (!prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
    setDockerOpenTabs(prev => {
      if (!prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
  }, []);

  const toggleTmux = useCallback((tabId: string) => {
    setTmuxOpenTabs(prev => {
      const next = new Set(prev);
      if (next.has(tabId)) { next.delete(tabId); return next; }
      next.add(tabId);
      return next;
    });
    setPfOpenTabs(prev => {
      if (!prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
    setDockerOpenTabs(prev => {
      if (!prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
  }, []);

  const toggleDocker = useCallback((tabId: string) => {
    setDockerOpenTabs(prev => {
      const next = new Set(prev);
      if (next.has(tabId)) { next.delete(tabId); return next; }
      next.add(tabId);
      return next;
    });
    setPfOpenTabs(prev => {
      if (!prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
    setTmuxOpenTabs(prev => {
      if (!prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.delete(tabId);
      return next;
    });
  }, []);

  // 리사이즈 드래그 핸들러
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current || !splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      const y = moveEvent.clientY - rect.top;
      const ratio = 1 - y / rect.height;
      setSftpRatio(Math.max(0.15, Math.min(0.8, ratio)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const handlePtySpawned = useCallback(
    (tabId: string, ptyId: string) => setPtyId(tabId, ptyId),
    [setPtyId],
  );

  const handleSshConnected = useCallback(
    (tabId: string, sessionId: string) => setSshSessionId(tabId, sessionId),
    [setSshSessionId],
  );

  const handleTerminalExit = useCallback(
    (tabId: string) => closeTab(tabId),
    [closeTab],
  );

  const handleConnect = useCallback(
    (profile: SshProfile) => {
      if (profile.type === 'wsl') {
        addWslTab(profile.name, profile.distro || 'Ubuntu');
      } else {
        addSshTab(profile.name, profile.id);
      }
    },
    [addSshTab, addWslTab],
  );

  const handleOpenDb = useCallback(
    (profile: DbProfile) => {
      addDbTab(profile.name, profile.id);
    },
    [addDbTab],
  );

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Zen Mode 토글 (F11)
      if (e.key === 'F11') {
        e.preventDefault();
        setZenMode(prev => !prev);
      }
      
      // Command Palette 토글 (Ctrl+P)
      if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setCmdPaletteOpen(true);
      }

      if (!e.ctrlKey) return;
      if (e.key === 't') { e.preventDefault(); addTab(); }
      if (e.key === 'w') { e.preventDefault(); closeTab(activeTabId); }
      if (e.key === 'b') { e.preventDefault(); setSidebarOpen(prev => !prev); }
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        if (idx < tabs.length) switchTab(tabs[idx].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, addTab, closeTab, switchTab]);

  useEffect(() => {
    const removeListener = window.electronAPI.onTabSwitch((direction) => {
      if (direction === 'next') nextTab();
      else prevTab();
    });
    return removeListener;
  }, [nextTab, prevTab]);

  // Ctrl+, (설정 토글) — 메인 프로세스에서 IPC로 전달받는다
  useEffect(() => {
    const removeListener = window.electronAPI.onToggleSettings(() => {
      setSettingsOpen(prev => !prev);
    });
    return removeListener;
  }, []);

  // Ctrl++/-/0 (폰트 크기 조절) — 메인 프로세스에서 IPC로 전달받는다
  useEffect(() => {
    const DEFAULT_FONT_SIZE = 14;
    const removeListener = window.electronAPI.onFontSizeChange((action) => {
      if (action === 'increase') {
        updateSettings({ fontSize: Math.min(settings.fontSize + 1, 32) });
      } else if (action === 'decrease') {
        updateSettings({ fontSize: Math.max(settings.fontSize - 1, 8) });
      } else {
        updateSettings({ fontSize: DEFAULT_FONT_SIZE });
      }
    });
    return removeListener;
  }, [settings.fontSize, updateSettings]);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // 설정 로드 전에는 빈 화면
  if (!settingsLoaded) return null;

  // 테마 배경색 (이전에는 앱 전체 백그라운드로 썼으나 지금은 그라데이션 사용)
  // const bgColor = theme?.background || '#1e1e2e';

  // 터미널 블러(Acrylic) 가 켜져 있으면 루트를 완전 투명으로 두고 OS 데스크톱을 그대로 드러냄.
  // 꺼져 있으면 기존 gradient 배경 사용.
  const acrylicOn = settings.terminalBlur > 0;

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden ${
        acrylicOn ? 'bg-transparent' : 'bg-gradient-to-br from-[#0b0b14] to-[#1e1e2e]'
      }`}
      style={{ color: '#cdd6f4' }}
    >
      {/* 화면 상단(호버) 시 젠 모드 탈출 버튼 힌트를 보여주기 위함 (선택적) */}
      {zenMode && (
        <div className="absolute top-0 left-0 right-0 h-4 z-50 animate-pulse hover:bg-[#181825]/50 transition-colors flex justify-center items-center cursor-pointer" onClick={() => setZenMode(false)}>
           <span className="text-[10px] text-[#9399b2] opacity-0 hover:opacity-100">Click or press F11 to exit Zen Mode</span>
        </div>
      )}

      {!zenMode && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSwitch={switchTab}
          onClose={closeTab}
          onAdd={() => addTab()}
          onRename={renameTab}
          onReorder={reorderTabs}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        />
      )}

      <div className="flex-1 min-h-0 flex flex-row relative z-10">
        {!zenMode && sidebarOpen && (
          <Sidebar
            profiles={profiles}
            onConnect={handleConnect}
            onCreateProfile={() => setProfileDialog({ open: true, editing: null })}
            onEditProfile={p => setProfileDialog({ open: true, editing: p })}
            onDeleteProfile={deleteProfile}
            dbProfiles={dbProfiles}
            onOpenDb={handleOpenDb}
            onCreateDbProfile={() => setDbProfileDialog({ open: true, editing: null })}
            onEditDbProfile={p => setDbProfileDialog({ open: true, editing: p })}
            onDeleteDbProfile={deleteDbProfile}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        )}

        {/* 터미널 + SFTP 수직 분할 영역 */}
        <div ref={splitContainerRef} className="flex-1 min-w-0 flex flex-col">
          {/* 터미널 영역 */}
          <div
            className="relative min-h-0"
            style={{
              flex: activeTab?.type === 'ssh' && sftpOpenTabs.has(activeTabId)
                ? `0 0 ${(1 - sftpRatio) * 100}%`
                : '1 1 0%',
            }}
          >
            {/* 터미널은 생성 순서(id)로 렌더링 — 탭 드래그 시 DOM 재배치로 xterm이 깨지는 것을 방지 */}
            {[...tabs].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map(tab => {
              if (tab.type === 'db') {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    className="absolute inset-0"
                    style={{ visibility: isActive ? 'visible' : 'hidden' }}
                  >
                    <DbTab
                      tabId={tab.id}
                      active={isActive}
                      dbProfileId={tab.dbProfileId!}
                      profileName={tab.title}
                    />
                  </div>
                );
              }
              const common = {
                key: tab.id,
                tabId: tab.id,
                active: tab.id === activeTabId,
                theme,
                settings,
                onExit: handleTerminalExit,
              };
              if (tab.type === 'ssh') {
                return <TerminalComponent {...common} type="ssh" profileId={tab.profileId!} onSshConnected={handleSshConnected} />;
              }
              if (tab.type === 'wsl') {
                return <TerminalComponent {...common} type="wsl" distro={tab.distro!} onPtySpawned={handlePtySpawned} />;
              }
              return <TerminalComponent {...common} type="local" onPtySpawned={handlePtySpawned} />;
            })}

            {/* SSH/WSL 탭일 때 토글 버튼 (Zen mode 아닐 때만) */}
            {!zenMode && (activeTab?.type === 'ssh' || activeTab?.type === 'wsl') && (
              <div className="absolute bottom-2 right-2 z-10 flex gap-1">
                {activeTab.type === 'ssh' && (
                  <>
                    <button
                      onClick={() => toggleSftp(activeTabId)}
                      className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                        sftpOpenTabs.has(activeTabId)
                          ? 'bg-[#3ddc97] text-[#1e1e2e]'
                          : 'bg-[#313244] text-[#bac2de] hover:bg-[#45475a]'
                      }`}
                      title="SFTP 파일 매니저 토글"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 3C2 2.45 2.45 2 3 2h2l1 1h3.5c.55 0 1 .45 1 1v4.5c0 .55-.45 1-1 1H3c-.55 0-1-.45-1-1V3z" stroke="currentColor" strokeWidth="1.2" fill="none" />
                      </svg>
                      SFTP
                    </button>
                    <button
                      onClick={() => togglePortForwarding(activeTabId)}
                      className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                        pfOpenTabs.has(activeTabId)
                          ? 'bg-[#f9e2af] text-[#1e1e2e]'
                          : 'bg-[#313244] text-[#bac2de] hover:bg-[#45475a]'
                      }`}
                      title="포트 포워딩 토글"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        <circle cx="2" cy="6" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
                        <circle cx="10" cy="6" r="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
                      </svg>
                      포워딩
                    </button>
                  </>
                )}
                <button
                  onClick={() => toggleTmux(activeTabId)}
                  className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                    tmuxOpenTabs.has(activeTabId)
                      ? 'bg-[#3ddc97] text-[#1e1e2e]'
                      : 'bg-[#313244] text-[#bac2de] hover:bg-[#45475a]'
                  }`}
                  title="tmux 세션 관리"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="2" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                    <line x1="5" y1="2" x2="5" y2="10" stroke="currentColor" strokeWidth="1" />
                    <line x1="1" y1="6" x2="5" y2="6" stroke="currentColor" strokeWidth="1" />
                  </svg>
                  tmux
                </button>
                <button
                  onClick={() => toggleDocker(activeTabId)}
                  className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${
                    dockerOpenTabs.has(activeTabId)
                      ? 'bg-[#74c7ec] text-[#1e1e2e]'
                      : 'bg-[#313244] text-[#bac2de] hover:bg-[#45475a]'
                  }`}
                  title="Docker 컨테이너/이미지 관리"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <rect x="1" y="5" width="2" height="2" stroke="currentColor" strokeWidth="0.8" fill="none" />
                    <rect x="3.5" y="5" width="2" height="2" stroke="currentColor" strokeWidth="0.8" fill="none" />
                    <rect x="6" y="5" width="2" height="2" stroke="currentColor" strokeWidth="0.8" fill="none" />
                    <rect x="3.5" y="2.5" width="2" height="2" stroke="currentColor" strokeWidth="0.8" fill="none" />
                    <path d="M1 8c1 1.5 3 2 5 2s4-0.5 5.5-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" fill="none" />
                  </svg>
                  docker
                </button>
              </div>
            )}
          </div>

          {/* 리사이즈 핸들 + SFTP 패널 */}
          {!zenMode && tabs.map(tab => {
            if (tab.type !== 'ssh' || !tab.sshSessionId || !sftpOpenTabs.has(tab.id)) return null;
            const isVisible = tab.id === activeTabId;
            return (
              <div
                key={`sftp-${tab.id}`}
                className="min-h-0 flex flex-col"
                style={{
                  flex: isVisible ? `0 0 ${sftpRatio * 100}%` : undefined,
                  height: isVisible ? undefined : 0,
                  overflow: 'hidden',
                  visibility: isVisible ? 'visible' : 'hidden',
                  position: isVisible ? 'relative' : 'absolute',
                }}
              >
                {/* 드래그 핸들 */}
                <div
                  className="h-1 bg-white/5 hover:bg-[#3ddc97]/50 cursor-row-resize shrink-0 transition-colors"
                  onMouseDown={handleResizeStart}
                />
                <div className="flex-1 min-h-0">
                  <SftpPanel sshSessionId={tab.sshSessionId} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 포트 포워딩 패널 — 우측 사이드 패널 */}
        {!zenMode && tabs.map(tab => {
          if (tab.type !== 'ssh' || !tab.sshSessionId || !pfOpenTabs.has(tab.id)) return null;
          const isVisible = tab.id === activeTabId;
          return (
            <div
              key={`pf-${tab.id}`}
              style={{
                width: isVisible ? undefined : 0,
                overflow: 'hidden',
                visibility: isVisible ? 'visible' : 'hidden',
                position: isVisible ? 'relative' : 'absolute',
              }}
            >
              <PortForwardingPanel sshSessionId={tab.sshSessionId} />
            </div>
          );
        })}

        {/* tmux 패널 — 우측 사이드 패널 (SSH + WSL) */}
        {tabs.map(tab => {
          if (!tmuxOpenTabs.has(tab.id)) return null;
          if (tab.type === 'ssh' && !tab.sshSessionId) return null;
          if (tab.type === 'wsl' && !tab.distro) return null;
          if (tab.type !== 'ssh' && tab.type !== 'wsl') return null;
          const isVisible = tab.id === activeTabId;
          return (
            <div
              key={`tmux-${tab.id}`}
              style={{
                width: isVisible ? undefined : 0,
                overflow: 'hidden',
                visibility: isVisible ? 'visible' : 'hidden',
                position: isVisible ? 'relative' : 'absolute',
              }}
            >
              {tab.type === 'ssh' ? (
                <TmuxPanel sshSessionId={tab.sshSessionId!} />
              ) : (
                <WslTmuxPanel distro={tab.distro!} ptyId={tab.ptyId} />
              )}
            </div>
          );
        })}

        {/* Docker 패널 — 우측 사이드 패널 (SSH + WSL) */}
        {tabs.map(tab => {
          if (!dockerOpenTabs.has(tab.id)) return null;
          if (tab.type === 'ssh' && !tab.sshSessionId) return null;
          if (tab.type === 'wsl' && !tab.distro) return null;
          if (tab.type !== 'ssh' && tab.type !== 'wsl') return null;
          const isVisible = tab.id === activeTabId;
          return (
            <div
              key={`docker-${tab.id}`}
              style={{
                width: isVisible ? undefined : 0,
                overflow: 'hidden',
                visibility: isVisible ? 'visible' : 'hidden',
                position: isVisible ? 'relative' : 'absolute',
              }}
            >
              {tab.type === 'ssh' ? (
                <DockerPanel sshSessionId={tab.sshSessionId!} />
              ) : (
                <WslDockerPanel distro={tab.distro!} ptyId={tab.ptyId} />
              )}
            </div>
          );
        })}
      </div>

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          themeNames={themeNames}
          onUpdate={updateSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      <CommandPalette
        isOpen={cmdPaletteOpen}
        onClose={() => setCmdPaletteOpen(false)}
        profiles={profiles}
        onConnect={handleConnect}
      />

      {profileDialog.open && (
        <ProfileDialog
          editProfile={profileDialog.editing}
          onSave={async input => {
            if (profileDialog.editing) await updateProfile(profileDialog.editing.id, input);
            else await createProfile(input);
            setProfileDialog({ open: false, editing: null });
          }}
          onCancel={() => setProfileDialog({ open: false, editing: null })}
        />
      )}

      {dbProfileDialog.open && (
        <DbProfileDialog
          editProfile={dbProfileDialog.editing}
          sshProfiles={profiles}
          onSave={async input => {
            if (dbProfileDialog.editing) await updateDbProfile(dbProfileDialog.editing.id, input);
            else await createDbProfile(input);
            setDbProfileDialog({ open: false, editing: null });
          }}
          onCancel={() => setDbProfileDialog({ open: false, editing: null })}
        />
      )}
    </div>
  );
}

export default App;
