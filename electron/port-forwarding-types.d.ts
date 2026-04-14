/** 포트 포워딩 유형 */
export type ForwardingType = 'local' | 'remote' | 'dynamic';
/** 포트 포워딩 설정 */
export interface PortForwardingConfig {
    type: ForwardingType;
    /** 바인드 주소 (기본 '127.0.0.1') */
    localAddr: string;
    /** 로컬 포트 (Local/Dynamic에서 리스닝, Remote에서 대상) */
    localPort: number;
    /** 원격 호스트 (Local: 대상, Remote: 바인드) */
    remoteAddr?: string;
    /** 원격 포트 (Local: 대상, Remote: 바인드) */
    remotePort?: number;
}
/** 포트 포워딩 터널 상태 */
export interface PortForwardingTunnel {
    tunnelId: string;
    sshSessionId: string;
    config: PortForwardingConfig;
    status: 'active' | 'error' | 'closed';
    connections: number;
    error?: string;
}
