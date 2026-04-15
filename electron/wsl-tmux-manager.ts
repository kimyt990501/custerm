import { spawn } from 'node:child_process';
import { writePty } from './pty-manager';
import type { TmuxSession, TmuxListResult, TmuxWindow, TmuxPane } from './tmux-types';

/**
 * WSL에서 명령을 실행한다. PTY가 아닌 일반 child_process로 실행하여
 * ANSI 이스케이프나 터미널 제어 문자 없는 순수 stdout을 받는다.
 */
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

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8');
    });
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8');
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code: code ?? 0 });
    });

    proc.on('error', () => {
      resolve({ stdout, stderr, code: 1 });
    });
  });
}

function parseTmuxSessions(stdout: string): TmuxSession[] {
  const sessions: TmuxSession[] = [];
  for (const line of stdout.trim().split('\n')) {
    const cleaned = line.replace(/\r/g, '').trim();
    if (!cleaned) continue;
    const parts = cleaned.split('|');
    if (parts.length < 4) continue;
    sessions.push({
      name: parts[0],
      windowCount: parseInt(parts[1], 10) || 0,
      created: parts[2],
      attached: parts[3] === '1',
      size: parts[4] || undefined,
    });
  }
  return sessions;
}

/** WSL에서 tmux 세션 목록 조회 */
export async function listWslTmuxSessions(distro: string): Promise<TmuxListResult> {
  const format = '#{session_name}|#{session_windows}|#{session_created_string}|#{session_attached}|#{session_width}x#{session_height}';
  try {
    const { stdout, code } = await execWslCommand(
      distro,
      `tmux list-sessions -F "${format}" 2>&1`,
    );

    if (code === 127 || stdout.includes('command not found') || stdout.includes('not found')) {
      return { tmuxAvailable: false, sessions: [] };
    }

    if (code !== 0) {
      if (stdout.includes('no server running') || stdout.includes('no sessions') ||
          stdout.includes('error connecting')) {
        return { tmuxAvailable: true, sessions: [] };
      }
      return { tmuxAvailable: true, sessions: [] };
    }

    const sessions = parseTmuxSessions(stdout);
    return { tmuxAvailable: true, sessions };
  } catch {
    return { tmuxAvailable: false, sessions: [] };
  }
}

/** WSL에서 기존 tmux 세션에 attach (기존 PTY 스트림에 명령 입력) */
export function attachWslTmuxSession(ptyId: string, sessionName: string): void {
  writePty(ptyId, `tmux attach -d -t '${sessionName.replace(/'/g, "'\\''")}'\n`);
}

/** WSL에서 새 tmux 세션 생성 */
export function createWslTmuxSession(ptyId: string, sessionName?: string): void {
  if (sessionName) {
    writePty(ptyId, `tmux new-session -s '${sessionName.replace(/'/g, "'\\''")}'\n`);
  } else {
    writePty(ptyId, 'tmux\n');
  }
}

/** WSL에서 tmux 세션 분리 — Ctrl+b d */
export function detachWslTmux(ptyId: string): void {
  writePty(ptyId, '\x02d');
}

export function sendWslTmuxKeys(ptyId: string, keys: string): void {
  writePty(ptyId, keys);
}

export function setWslTmuxMouse(ptyId: string, on: boolean): void {
  writePty(ptyId, `\x02:set -g mouse ${on ? 'on' : 'off'}\n`);
}

export async function listWslTmuxWindows(distro: string, sessionName: string): Promise<TmuxWindow[]> {
  const safe = `'${sessionName.replace(/'/g, "'\\''")}'`;
  const format = '#{window_index}|#{window_name}|#{window_active}|#{window_panes}';
  const { stdout, code } = await execWslCommand(
    distro,
    `tmux list-windows -t ${safe} -F "${format}"`,
  );
  if (code !== 0) return [];
  const result: TmuxWindow[] = [];
  for (const line of stdout.trim().split('\n')) {
    const cleaned = line.replace(/\r/g, '').trim();
    if (!cleaned) continue;
    const parts = cleaned.split('|');
    if (parts.length < 4) continue;
    result.push({
      index: parseInt(parts[0], 10) || 0,
      name: parts[1],
      active: parts[2] === '1',
      paneCount: parseInt(parts[3], 10) || 0,
    });
  }
  return result;
}

export async function listWslTmuxPanes(
  distro: string,
  sessionName: string,
  windowIndex: number,
): Promise<TmuxPane[]> {
  const safe = `'${sessionName.replace(/'/g, "'\\''")}'`;
  const format = '#{pane_index}|#{pane_title}|#{pane_active}|#{pane_current_command}|#{pane_width}x#{pane_height}';
  const { stdout, code } = await execWslCommand(
    distro,
    `tmux list-panes -t ${safe}:${windowIndex} -F "${format}"`,
  );
  if (code !== 0) return [];
  const result: TmuxPane[] = [];
  for (const line of stdout.trim().split('\n')) {
    const cleaned = line.replace(/\r/g, '').trim();
    if (!cleaned) continue;
    const parts = cleaned.split('|');
    if (parts.length < 5) continue;
    result.push({
      index: parseInt(parts[0], 10) || 0,
      title: parts[1],
      active: parts[2] === '1',
      command: parts[3],
      size: parts[4],
    });
  }
  return result;
}

/** WSL에서 tmux 세션 종료 */
export async function killWslTmuxSession(distro: string, sessionName: string): Promise<void> {
  const safeName = `'${sessionName.replace(/'/g, "'\\''")}'`;
  const { code, stdout } = await execWslCommand(distro, `tmux kill-session -t ${safeName} 2>&1`);
  if (code !== 0) {
    throw new Error(`tmux 세션 종료 실패: ${stdout.trim() || '알 수 없는 오류'}`);
  }
}
