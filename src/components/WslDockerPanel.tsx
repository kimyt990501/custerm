import { useWslDocker } from '../hooks/useWslDocker';
import DockerPanelView from './DockerPanelView';

interface WslDockerPanelProps {
  distro: string;
  ptyId: string | null;
}

function WslDockerPanel({ distro, ptyId }: WslDockerPanelProps) {
  const controller = useWslDocker({ distro, ptyId });
  return <DockerPanelView controller={controller} />;
}

export default WslDockerPanel;
