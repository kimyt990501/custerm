import { getSshSession, writeSsh } from './ssh-manager';
import type { TmuxSession, TmuxListResult, TmuxWindow, TmuxPane } from './tmux-types';

/** 세션 이름에서 셸 인젝션을 방지하기 위한 이스케이프 */
function sanitizeSessionName(name: string): string {
  // 작은따옴표로 감싸서 셸 해석 차단, 이름 내 작은따옴표는 이스케이프
  return `'${name.replace(/'/g, "'\\''")}'`;
}

/**
 * exec 채널로 명령 실행 후 stdout/stderr/exitCode 반환.
 * 기존 셸 스트림과 독립적으로 동작한다.
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

      stream.on('data', (data: Buffer) => {
        stdout += data.toString('utf-8');
      });

      stream.stderr.on('data', (data: Buffer) => {
        stderr += data.toString('utf-8');
      });

      // exit 이벤트에서 코드를 받아야 한다 — close 이벤트는 리눅스 서버에서
      // exit code를 전달하지 않는 경우가 있다.
      stream.on('exit', (code: number | null) => {
        exitCode = code ?? 0;
      });

      stream.on('close', () => {
        resolve({ stdout, stderr, code: exitCode });
      });
    });
  });
}

/**
 * tmux list-sessions 파싱.
 * 포맷: "name|windowCount|created|attached|widthxheight"
 */
function parseTmuxSessions(stdout: string): TmuxSession[] {
  const sessions: TmuxSession[] = [];

  for (const line of stdout.trim().split('\n')) {
    if (!line.trim()) continue;

    const parts = line.split('|');
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

/**
 * exec 채널은 non-login/non-interactive 셸로 실행되어 PATH가 제한적일 수 있다.
 * 일반적인 tmux 설치 경로들을 포함하여 PATH를 보강한 뒤 명령을 실행한다.
 */
const PATH_PREFIX = 'export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH";';

/** 원격 서버의 tmux 세션 목록 조회 */
export async function listTmuxSessions(sshSessionId: string): Promise<TmuxListResult> {
  const format = '#{session_name}|#{session_windows}|#{session_created_string}|#{session_attached}|#{session_width}x#{session_height}';

  try {
    const { stdout, stderr, code } = await execCommand(
      sshSessionId,
      `${PATH_PREFIX} tmux list-sessions -F "${format}"`,
    );

    const combined = stdout + stderr;

    // tmux 미설치
    if (code === 127 || combined.includes('command not found') || combined.includes('not found')) {
      return { tmuxAvailable: false, sessions: [] };
    }

    // tmux 설치되어 있지만 서버가 실행 중이지 않거나 세션 없음
    if (code !== 0) {
      if (combined.includes('no server running') || combined.includes('no sessions') ||
          combined.includes('no current client') || combined.includes('error connecting')) {
        return { tmuxAvailable: true, sessions: [] };
      }
      return { tmuxAvailable: true, sessions: [] };
    }

    // 정상 응답
    const sessions = parseTmuxSessions(stdout);
    return { tmuxAvailable: true, sessions };
  } catch {
    return { tmuxAvailable: false, sessions: [] };
  }
}

/** 기존 tmux 세션에 attach (기존 셸 스트림에 명령 입력) */
export function attachTmuxSession(sshSessionId: string, sessionName: string): void {
  // -d: 다른 클라이언트가 attach 중이면 detach시킨 후 연결
  writeSsh(sshSessionId, `tmux attach -d -t ${sanitizeSessionName(sessionName)}\n`);
}

/** 새 tmux 세션 생성 (기존 셸 스트림에 명령 입력) */
export function createTmuxSession(sshSessionId: string, sessionName?: string): void {
  if (sessionName) {
    writeSsh(sshSessionId, `tmux new-session -s ${sanitizeSessionName(sessionName)}\n`);
  } else {
    writeSsh(sshSessionId, 'tmux\n');
  }
}

/** tmux 세션 분리 — Ctrl+b d 키 시퀀스 전송 */
export function detachTmux(sshSessionId: string): void {
  writeSsh(sshSessionId, '\x02d');
}

/** 현재 attach 된 셸 스트림에 tmux 키 시퀀스 전송 */
export function sendTmuxKeys(sshSessionId: string, keys: string): void {
  writeSsh(sshSessionId, keys);
}

/** 현재 세션에만 마우스 모드 토글 (tmux 명령 프롬프트 경유) */
export function setTmuxMouse(sshSessionId: string, on: boolean): void {
  writeSsh(sshSessionId, `\x02:set -g mouse ${on ? 'on' : 'off'}\n`);
}

/** 세션의 창 목록 */
export async function listTmuxWindows(sshSessionId: string, sessionName: string): Promise<TmuxWindow[]> {
  const format = '#{window_index}|#{window_name}|#{window_active}|#{window_panes}';
  const { stdout, code } = await execCommand(
    sshSessionId,
    `${PATH_PREFIX} tmux list-windows -t ${sanitizeSessionName(sessionName)} -F "${format}"`,
  );
  if (code !== 0) return [];
  const result: TmuxWindow[] = [];
  for (const line of stdout.trim().split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('|');
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

/** 창의 pane 목록 */
export async function listTmuxPanes(
  sshSessionId: string,
  sessionName: string,
  windowIndex: number,
): Promise<TmuxPane[]> {
  const format = '#{pane_index}|#{pane_title}|#{pane_active}|#{pane_current_command}|#{pane_width}x#{pane_height}';
  const target = `${sanitizeSessionName(sessionName)}:${windowIndex}`;
  const { stdout, code } = await execCommand(
    sshSessionId,
    `${PATH_PREFIX} tmux list-panes -t ${target} -F "${format}"`,
  );
  if (code !== 0) return [];
  const result: TmuxPane[] = [];
  for (const line of stdout.trim().split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('|');
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

/** tmux 세션 종료 (exec 채널로 실행) */
export async function killTmuxSession(sshSessionId: string, sessionName: string): Promise<void> {
  const { code, stderr } = await execCommand(
    sshSessionId,
    `${PATH_PREFIX} tmux kill-session -t ${sanitizeSessionName(sessionName)}`,
  );

  if (code !== 0) {
    throw new Error(`tmux 세션 종료 실패: ${stderr.trim() || '알 수 없는 오류'}`);
  }
}
