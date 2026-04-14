import type { TmuxListResult } from './tmux-types';
/** 원격 서버의 tmux 세션 목록 조회 */
export declare function listTmuxSessions(sshSessionId: string): Promise<TmuxListResult>;
/** 기존 tmux 세션에 attach (기존 셸 스트림에 명령 입력) */
export declare function attachTmuxSession(sshSessionId: string, sessionName: string): void;
/** 새 tmux 세션 생성 (기존 셸 스트림에 명령 입력) */
export declare function createTmuxSession(sshSessionId: string, sessionName?: string): void;
/** tmux 세션 분리 — Ctrl+b d 키 시퀀스 전송 */
export declare function detachTmux(sshSessionId: string): void;
/** tmux 세션 종료 (exec 채널로 실행) */
export declare function killTmuxSession(sshSessionId: string, sessionName: string): Promise<void>;
