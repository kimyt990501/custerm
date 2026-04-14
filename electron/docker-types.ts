/** Docker 컨테이너/이미지 관리용 공통 타입 및 파서 */

export type DockerContainerState =
  | 'running'
  | 'exited'
  | 'paused'
  | 'created'
  | 'restarting'
  | 'dead';

export interface DockerContainer {
  id: string;            // short id
  name: string;          // 첫 번째 이름
  image: string;
  status: string;        // "Up 3 hours"
  state: DockerContainerState;
  ports: string;         // "0.0.0.0:8080->80/tcp" 원본
  createdAt: string;
}

export interface DockerImage {
  id: string;
  repository: string;
  tag: string;
  size: string;
  createdSince: string;
}

export interface DockerListResult {
  dockerAvailable: boolean;
  containers: DockerContainer[];
  images: DockerImage[];
}

/** `docker ps -a --format '{{json .}}'` 결과 파싱 */
export function parseDockerPs(stdout: string): DockerContainer[] {
  const containers: DockerContainer[] = [];
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(/\r/g, '').trim();
    if (!line || !line.startsWith('{')) continue;
    try {
      const row = JSON.parse(line);
      const id = String(row.ID ?? '').slice(0, 12);
      const name = String(row.Names ?? '').split(',')[0] || id;
      const image = String(row.Image ?? '');
      const status = String(row.Status ?? '');
      const ports = String(row.Ports ?? '');
      const createdAt = String(row.CreatedAt ?? row.RunningFor ?? '');
      const stateRaw = String(row.State ?? '').toLowerCase();
      const state: DockerContainerState =
        stateRaw === 'running' ? 'running' :
        stateRaw === 'paused' ? 'paused' :
        stateRaw === 'restarting' ? 'restarting' :
        stateRaw === 'created' ? 'created' :
        stateRaw === 'dead' ? 'dead' :
        'exited';
      containers.push({ id, name, image, status, state, ports, createdAt });
    } catch {
      // JSON 파싱 실패 라인은 건너뜀
    }
  }
  return containers;
}

/** `docker images --format '{{json .}}'` 결과 파싱 */
export function parseDockerImages(stdout: string): DockerImage[] {
  const images: DockerImage[] = [];
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(/\r/g, '').trim();
    if (!line || !line.startsWith('{')) continue;
    try {
      const row = JSON.parse(line);
      const id = String(row.ID ?? '').replace(/^sha256:/, '').slice(0, 12);
      const repository = String(row.Repository ?? '<none>');
      const tag = String(row.Tag ?? '<none>');
      const size = String(row.Size ?? '');
      const createdSince = String(row.CreatedSince ?? '');
      images.push({ id, repository, tag, size, createdSince });
    } catch {
      // skip
    }
  }
  return images;
}

/** 컨테이너 id/name 유효성 검사 (셸 인젝션 방지) */
export function isValidContainerRef(ref: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(ref);
}

/** 이미지 ref 유효성 검사 (repo:tag, sha, digest 허용) */
export function isValidImageRef(ref: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._:/@-]*$/.test(ref);
}
