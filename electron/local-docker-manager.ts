import { spawn } from 'node:child_process';
import { writePty } from './pty-manager';
import {
  parseDockerPs,
  parseDockerImages,
  isValidContainerRef,
  isValidImageRef,
  type DockerListResult,
} from './docker-types';

function execLocalCommand(
  command: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const shell = process.env.SHELL || '/bin/bash';
    const proc = spawn(shell, ['-lc', command]);

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

export async function listLocalDocker(): Promise<DockerListResult> {
  try {
    const { stdout: psOut, stderr: psErr, code: psCode } = await execLocalCommand(
      `docker ps -a --format '{{json .}}' --no-trunc`,
    );

    if (isCommandNotFound(psOut + psErr, psCode)) {
      return { dockerAvailable: false, containers: [], images: [] };
    }

    if (psCode !== 0) {
      return { dockerAvailable: true, containers: [], images: [] };
    }

    const containers = parseDockerPs(psOut);

    const { stdout: imgOut } = await execLocalCommand(`docker images --format '{{json .}}'`);
    const images = parseDockerImages(imgOut);

    return { dockerAvailable: true, containers, images };
  } catch {
    return { dockerAvailable: false, containers: [], images: [] };
  }
}

async function runOrThrow(command: string, label: string): Promise<string> {
  const { stdout, stderr, code } = await execLocalCommand(command);
  if (code !== 0) {
    throw new Error(`${label} 실패: ${(stderr || stdout).trim() || '알 수 없는 오류'}`);
  }
  return stdout;
}

export async function startLocalContainer(id: string): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  await runOrThrow(`docker start ${id}`, 'start');
}

export async function stopLocalContainer(id: string): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  await runOrThrow(`docker stop ${id}`, 'stop');
}

export async function restartLocalContainer(id: string): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  await runOrThrow(`docker restart ${id}`, 'restart');
}

export async function removeLocalContainer(id: string, force: boolean): Promise<void> {
  if (!isValidContainerRef(id)) throw new Error('잘못된 컨테이너 ID');
  const flag = force ? '-f ' : '';
  await runOrThrow(`docker rm ${flag}${id}`, 'remove');
}

export async function removeLocalImage(id: string, force: boolean): Promise<void> {
  if (!isValidImageRef(id)) throw new Error('잘못된 이미지 ID');
  const flag = force ? '-f ' : '';
  await runOrThrow(`docker rmi ${flag}${id}`, 'remove image');
}

export async function pullLocalImage(ref: string): Promise<string> {
  if (!isValidImageRef(ref)) throw new Error('잘못된 이미지 ref');
  return runOrThrow(`docker pull ${ref}`, 'pull');
}

export function execIntoLocalContainer(ptyId: string, name: string, shell: string): void {
  if (!isValidContainerRef(name)) return;
  const safeShell = /^[a-zA-Z0-9/_-]+$/.test(shell) ? shell : 'sh';
  writePty(ptyId, `docker exec -it ${name} ${safeShell}\n`);
}

export function logsLocalContainer(ptyId: string, name: string): void {
  if (!isValidContainerRef(name)) return;
  writePty(ptyId, `docker logs -f --tail=200 ${name}\n`);
}
