import { spawn } from 'node:child_process';
import { writePty } from './pty-manager';
import type { TmuxSession, TmuxListResult } from './tmux-types';

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

export async function listLocalTmuxSessions(): Promise<TmuxListResult> {
  const format = '#{session_name}|#{session_windows}|#{session_created_string}|#{session_attached}|#{session_width}x#{session_height}';
  try {
    const { stdout, code } = await execLocalCommand(
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

export function attachLocalTmuxSession(ptyId: string, sessionName: string): void {
  writePty(ptyId, `tmux attach -d -t '${sessionName.replace(/'/g, "'\\''")}'\n`);
}

export function createLocalTmuxSession(ptyId: string, sessionName?: string): void {
  if (sessionName) {
    writePty(ptyId, `tmux new-session -s '${sessionName.replace(/'/g, "'\\''")}'\n`);
  } else {
    writePty(ptyId, 'tmux\n');
  }
}

export function detachLocalTmux(ptyId: string): void {
  writePty(ptyId, '\x02d');
}

export async function killLocalTmuxSession(sessionName: string): Promise<void> {
  const safeName = `'${sessionName.replace(/'/g, "'\\''")}'`;
  const { code, stdout } = await execLocalCommand(`tmux kill-session -t ${safeName} 2>&1`);
  if (code !== 0) {
    throw new Error(`tmux 세션 종료 실패: ${stdout.trim() || '알 수 없는 오류'}`);
  }
}
