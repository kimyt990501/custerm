import type { WebContents } from 'electron';
import type { PortForwardingConfig, PortForwardingTunnel } from './port-forwarding-types';
export declare function createTunnel(sshSessionId: string, config: PortForwardingConfig, sender: WebContents): Promise<{
    tunnelId: string;
}>;
export declare function closeTunnel(tunnelId: string): void;
export declare function closeForSession(sshSessionId: string): void;
export declare function closeAll(): void;
export declare function listTunnels(sshSessionId: string): PortForwardingTunnel[];
