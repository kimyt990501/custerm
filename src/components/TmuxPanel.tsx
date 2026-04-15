import { useTmux } from '../hooks/useTmux';
import TmuxPanelCore from './TmuxPanelCore';

interface TmuxPanelProps {
  sshSessionId: string;
}

function TmuxPanel({ sshSessionId }: TmuxPanelProps) {
  const t = useTmux({ sshSessionId });
  return (
    <TmuxPanelCore
      titleLabel="tmux 세션"
      unavailableMessage="이 서버에 tmux가 설치되어 있지 않습니다"
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

export default TmuxPanel;
