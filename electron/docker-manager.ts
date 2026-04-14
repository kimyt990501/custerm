import { getSshSession, writeSsh } from './ssh-manager';
import {
  parseDockerPs,
  parseDockerImages,
  isValidContainerRef,
  isValidImageRef,
  type DockerListResult,
} from './docker-types';

/**
 * ssh2 exec 채널로 명령 실행.
 * exit 이벤트에서 code를 받고, close 이벤트에서 resolve.
 */
function execCommand(
  sshSessionId: string,
  command: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const session = getSshSession(sshSessionId);
    if (!session) {
      reject(new Error('SSH 세션을 찾을 수 없습니다'));
      return;
    }

    session.client.exec(command, (err, stream) => {
      if (err) {
        reject(new Error(`명령 실행 실패: ${err.message}`));
        return;
      }

      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      stream.on('data', (data: Buffer) => { stdout += data.toString('utf-8'); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8'); });
      stream.on('exit', (code: number | null) => { exitCode = code ?? 0; });
      stream.on('close', () => { resolve({ stdout, stderr, code: exitCode }); });
    });
  });
}

/** exec 채널의 제한된 PATH를 보강 (tmux-manager와 동일) */
const PATH_PREFIX = 'export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH";';

/** docker 미설치 여부 판정 */
function isCommandNotFound(combined: string, code: number): boolean {
  return code === 127 ||
    combined.includes('command not found') ||
    combined.includes('docker: not found') ||
    combined.includes('not found');
}

/** 원격 서버의 docker 컨테이너 + 이미지 목록 조회 */
export async function listDocker(sshSessionId: string): Promise<DockerListResult> {
  try {
    const { stdout: psOut, stderr: psErr, code: psCode } = await execCommand(
      sshSessionId,
      `${PATH_PREFIX} docker ps -a --format '{{json .}}' --no-trunc`,
    );

    if (isCommandNotFound(psOut + psErr, psCode)) {
      return { dockerAvailable: false, containers: [], images: [] };
    }

    // 권한 오류(Cannot connect to Docker daemon 등)라도 dockerAvailable=true, 빈 목록
    if (psCode !== 0) {
      return { dockerAvailable: true, containers: [], images: [] };
    }

    const containers = parseDockerPs(psOut);

    const { stdout: imgOut } = await execCommand(
      sshSessionId,
      `${PATH_PREFIX} docker images --format '{{json .}}'`,
    );
    const images = parseDockerImages(imgOut);

    return { dockerAvailable: true, containers, images };
  } catch {
    return { dockerAvailable: false, containers: [], images: [] };
  }
}

/** 공용 실행 헬퍼 — 비정상 종료 시 throw */
async function runOrThrow(sshSessionId: string, command: string, label: string): Promise<string> {
  const { stdout, stderr, code } = await execCommand(sshSessionId, command);
  if (code !== 0) {
    throw new Error(`${label} 실패: ${(stderr || stdout).trim() || '알 수 없는 오류'}`);
  }
  return stdout;
}

export async function startContainer(sshSessionId: string, id: string): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  await runOrThrow(sshSessionId, `${PATH_PREFIX} docker start ${id}`, 'start');
}

export async function stopContainer(sshSessionId: string, id: string): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  await runOrThrow(sshSessionId, `${PATH_PREFIX} docker stop ${id}`, 'stop');
}

export async function restartContainer(sshSessionId: string, id: string): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  await runOrThrow(sshSessionId, `${PATH_PREFIX} docker restart ${id}`, 'restart');
}

export async function removeContainer(sshSessionId: string, id: string, force: boolean): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  const flag = force ? '-f ' : '';
  await runOrThrow(sshSessionId, `${PATH_PREFIX} docker rm ${flag}${id}`, 'remove');
}

export async function removeImage(sshSessionId: string, id: string, force: boolean): Promise<void> {
  if (!isValidImageRef(id)) throw new Error('잘못된 이미지 ID');
  const flag = force ? '-f ' : '';
  await runOrThrow(sshSessionId, `${PATH_PREFIX} docker rmi ${flag}${id}`, 'remove image');
}

export async function pullImage(sshSessionId: string, ref: string): Promise<string> {
  if (!isValidImageRef(ref)) throw new Error('잘못된 이미지 ref');
  return runOrThrow(sshSessionId, `${PATH_PREFIX} docker pull ${ref}`, 'pull');
}

/** 기존 셸 스트림에 `docker exec -it` 주입 */
export function execIntoContainer(sshSessionId: string, name: string, shell: string): void {
  if (!isValidContainerRef(name)) return;
  const safeShell = /^[a-zA-Z0-9/_-]+$/.test(shell) ? shell : 'sh';
  writeSsh(sshSessionId, `docker exec -it ${name} ${safeShell}\n`);
}

/** 기존 셸 스트림에 `docker logs -f` 주입 */
export function logsContainer(sshSessionId: string, name: string): void {
  if (!isValidContainerRef(name)) return;
  writeSsh(sshSessionId, `docker logs -f --tail=200 ${name}\n`);
}
