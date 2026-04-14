import * as pty from 'node-pty';
import os from 'node:os';

interface PtyInstance {
  process: pty.IPty;
  shell: string;
}

/** 활성 PTY 인스턴스를 ID로 관리한다. Phase 3에서 멀티탭을 위해 Map 구조 사용. */
const ptys = new Map<string, PtyInstance>();

let nextId = 0;

function getDefaultShell(): string {
  if (process.platform === 'win32') {
    return 'powershell.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

export function spawnPty(shell?: string): { id: string; shell: string } {
  const id = String(++nextId);
  const selectedShell = shell || getDefaultShell();

  // Windows PowerShell은 기본적으로 CP949(한국어) 또는 시스템 코드페이지를 사용한다.
  // UTF-8 출력을 강제하기 위해 환경변수를 설정하고,
  // PowerShell의 경우 -NoExit -Command로 콘솔 인코딩을 UTF-8로 전환한다.
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    LANG: 'ko_KR.UTF-8',
    PYTHONIOENCODING: 'utf-8',
  };

  // shell 문자열에 args가 포함된 경우 분리 (e.g. "wsl.exe -d Ubuntu")
  const parts = selectedShell.split(/\s+/);
  const executable = parts[0];
  const isPowerShell = executable.toLowerCase().includes('powershell');
  const isWsl = executable.toLowerCase().includes('wsl');

  let args: string[];
  if (isPowerShell) {
    args = ['-NoExit', '-Command', '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; chcp 65001 > $null'];
  } else if (parts.length > 1) {
    args = parts.slice(1);
  } else {
    args = [];
  }

  const ptyProcess = pty.spawn(executable, args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: isWsl ? undefined : os.homedir(),
    env,
  });

  ptys.set(id, { process: ptyProcess, shell: selectedShell });
  return { id, shell: selectedShell };
}

export function getPty(id: string): PtyInstance | undefined {
  return ptys.get(id);
}

export function writePty(id: string, data: string): void {
  const instance = ptys.get(id);
  if (instance) {
    instance.process.write(data);
  }
}

export function resizePty(id: string, cols: number, rows: number): void {
  const instance = ptys.get(id);
  if (instance) {
    instance.process.resize(cols, rows);
  }
}

export function killPty(id: string): void {
  const instance = ptys.get(id);
  if (instance) {
    instance.process.kill();
    ptys.delete(id);
  }
}

export function killAllPtys(): void {
  for (const [id, instance] of ptys) {
    instance.process.kill();
    ptys.delete(id);
  }
}
