import { useLocalTmux } from '../hooks/useLocalTmux';
import TmuxPanelCore from './TmuxPanelCore';

interface LocalTmuxPanelProps {
  ptyId: string | null;
}

function LocalTmuxPanel({ ptyId }: LocalTmuxPanelProps) {
  const t = useLocalTmux({ ptyId });
  return (
    <TmuxPanelCore
      titleLabel="tmux 세션"
      unavailableMessage="로컬 환경에 tmux가 설치되어 있지 않습니다"
      sessions={t.sessions}
      tmuxAvailable={t.tmuxAvailable}
      loading={t.loading}
      error={t.error}
      activeSessionName={t.activeSessionName}
      onSetError={t.setError}
      onRefresh={t.refresh}
      onAttach={t.attach}
      onCreateSession={t.createSession}
      onDetach={t.detach}
      onKillSession={t.killSession}
      onListWindows={t.listWindows}
      onListPanes={t.listPanes}
      onSendKeys={t.sendKeys}
      onSetMouse={t.setMouse}
    />
  );
}

export default LocalTmuxPanel;
