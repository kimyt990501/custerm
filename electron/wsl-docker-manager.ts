import { spawn } from 'node:child_process';
import { writePty } from './pty-manager';
import {
  parseDockerPs,
  parseDockerImages,
  isValidContainerRef,
  isValidImageRef,
  type DockerListResult,
} from './docker-types';

/** WSL에서 명령 실행 — PTY가 아닌 child_process로 실행하여 ANSI 없는 순수 stdout을 받는다. */
function execWslCommand(
  distro: string,
  command: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn('wsl.exe', ['-d', distro, '--', 'bash', '-lc', command], {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString('utf-8'); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString('utf-8'); });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });

    proc.on('error', () => {
      resolve({ stdout, stderr, code: 1 });
    });
  });
}

function isCommandNotFound(combined: string, code: number): boolean {
  return code === 127 ||
    combined.includes('command not found') ||
    combined.includes('docker: not found') ||
    combined.includes('not found');
}

export async function listWslDocker(distro: string): Promise<DockerListResult> {
  try {
    const { stdout: psOut, stderr: psErr, code: psCode } = await execWslCommand(
      distro,
      `docker ps -a --format '{{json .}}' --no-trunc`,
    );

    if (isCommandNotFound(psOut + psErr, psCode)) {
      return { dockerAvailable: false, containers: [], images: [] };
    }

    if (psCode !== 0) {
      return { dockerAvailable: true, containers: [], images: [] };
    }

    const containers = parseDockerPs(psOut);

    const { stdout: imgOut } = await execWslCommand(
      distro,
      `docker images --format '{{json .}}'`,
    );
    const images = parseDockerImages(imgOut);

    return { dockerAvailable: true, containers, images };
  } catch {
    return { dockerAvailable: false, containers: [], images: [] };
  }
}

async function runOrThrow(distro: string, command: string, label: string): Promise<string> {
  const { stdout, stderr, code } = await execWslCommand(distro, command);
  if (code !== 0) {
    throw new Error(`${label} 실패: ${(stderr || stdout).trim() || '알 수 없는 오류'}`);
  }
  return stdout;
}

export async function startWslContainer(distro: string, id: string): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  await runOrThrow(distro, `docker start ${id}`, 'start');
}

export async function stopWslContainer(distro: string, id: string): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  await runOrThrow(distro, `docker stop ${id}`, 'stop');
}

export async function restartWslContainer(distro: string, id: string): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  await runOrThrow(distro, `docker restart ${id}`, 'restart');
}

export async function removeWslContainer(distro: string, id: string, force: boolean): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  const flag = force ? '-f ' : '';
  await runOrThrow(distro, `docker rm ${flag}${id}`, 'remove');
}

export async function removeWslImage(distro: string, id: string, force: boolean): Promise<void> {
  if (!isValidImageRef(id)) throw new Error('잘못된 이미지 ID');
  const flag = force ? '-f ' : '';
  await runOrThrow(distro, `docker rmi ${flag}${id}`, 'remove image');
}

export async function pullWslImage(distro: string, ref: string): Promise<string> {
  if (!isValidImageRef(ref)) throw new Error('잘못된 이미지 ref');
  return runOrThrow(distro, `docker pull ${ref}`, 'pull');
}

/** 기존 PTY 스트림에 `docker exec -it` 주입 */
export function execIntoWslContainer(ptyId: string, name: string, shell: string): void {
  if (!isValidContainerRef(name)) return;
  const safeShell = /^[a-zA-Z0-9/_-]+$/.test(shell) ? shell : 'sh';
  writePty(ptyId, `docker exec -it ${name} ${safeShell}\n`);
}

/** 기존 PTY 스트림에 `docker logs -f` 주입 */
export function logsWslContainer(ptyId: string, name: string): void {
  if (!isValidContainerRef(name)) return;
  writePty(ptyId, `docker logs -f --tail=200 ${name}\n`);
}
