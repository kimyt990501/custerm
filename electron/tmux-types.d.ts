/** tmux 세션 정보 (tmux list-sessions 결과) */
export interface TmuxSession {
    /** 세션 이름 (e.g. "main", "0") */
    name: string;
    /** 창(window) 개수 */
    windowCount: number;
    /** 생성 시각 문자열 */
    created: string;
    /** 다른 클라이언트가 attach 중인지 */
    attached: boolean;
    /** 세션 크기 "cols x rows" (e.g. "204x50") */
    size?: string;
}
/** tmux 목록 조회 결과 */
export interface TmuxListResult {
    /** 원격 서버에 tmux가 설치되어 있는지 */
    tmuxAvailable: boolean;
    /** 현재 tmux 세션 목록 */
    sessions: TmuxSession[];
}
