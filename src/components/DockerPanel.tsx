import { useDocker } from '../hooks/useDocker';
import DockerPanelView from './DockerPanelView';

interface DockerPanelProps {
  sshSessionId: string;
}

function DockerPanel({ sshSessionId }: DockerPanelProps) {
  const controller = useDocker({ sshSessionId });
  return <DockerPanelView controller={controller} />;
}

export default DockerPanel;
