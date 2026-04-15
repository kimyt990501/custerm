import { useWslTmux } from '../hooks/useWslTmux';
import TmuxPanelCore from './TmuxPanelCore';

interface WslTmuxPanelProps {
  distro: string;
  ptyId: string | null;
}

function WslTmuxPanel({ distro, ptyId }: WslTmuxPanelProps) {
  const t = useWslTmux({ distro, ptyId });
  return (
    <TmuxPanelCore
      titleLabel="tmux 세션 (WSL)"
      unavailableMessage="이 WSL 환경에 tmux가 설치되어 있지 않습니다"
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

export default WslTmuxPanel;
