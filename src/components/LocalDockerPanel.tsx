import { useLocalDocker } from '../hooks/useLocalDocker';
import DockerPanelView from './DockerPanelView';

interface LocalDockerPanelProps {
  ptyId: string | null;
}

function LocalDockerPanel({ ptyId }: LocalDockerPanelProps) {
  const controller = useLocalDocker({ ptyId });
  return <DockerPanelView controller={controller} />;
}

export default LocalDockerPanel;
