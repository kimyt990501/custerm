import net from 'node:net';
import { Client } from 'ssh2';
/** DB 접속 전용 SSH 터널. 기존 SSH 탭 세션과 독립적으로 동작한다. */
export interface DbTunnel {
    client: Client;
    server: net.Server;
    localPort: number;
    close: () => void;
}
export declare function openDbTunnel(sshProfileId: string, remoteHost: string, remotePort: number): Promise<DbTunnel>;
