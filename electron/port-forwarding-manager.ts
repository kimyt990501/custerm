import net from 'node:net';
import type { Duplex } from 'node:stream';
import type { WebContents } from 'electron';
import { getSshSession } from './ssh-manager';
import type { PortForwardingConfig, PortForwardingTunnel } from './port-forwarding-types';

interface TunnelSession {
  tunnelId: string;
  sshSessionId: string;
  config: PortForwardingConfig;
  status: 'active' | 'error' | 'closed';
  connections: number;
  error?: string;
  server?: net.Server;
  sender?: WebContents;
}

const tunnels = new Map<string, TunnelSession>();
let nextTunnelId = 0;

// --- 터널 생성 ---

export async function createTunnel(
  sshSessionId: string,
  config: PortForwardingConfig,
  sender: WebContents,
): Promise<{ tunnelId: string }> {
  const sshSession = getSshSession(sshSessionId);
  if (!sshSession) {
    throw new Error(`SSH 세션을 찾을 수 없습니다: ${sshSessionId}`);
  }

  const tunnelId = String(++nextTunnelId);

  switch (config.type) {
    case 'local':
      await createLocalForwarding(tunnelId, sshSessionId, config, sender);
      break;
    case 'remote':
      await createRemoteForwarding(tunnelId, sshSessionId, config, sender);
      break;
    case 'dynamic':
      await createDynamicForwarding(tunnelId, sshSessionId, config, sender);
      break;
  }

  return { tunnelId };
}

// --- Local Forwarding (-L) ---

function createLocalForwarding(
  tunnelId: string,
  sshSessionId: string,
  config: PortForwardingConfig,
  sender: WebContents,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sshSession = getSshSession(sshSessionId);
    if (!sshSession) {
      reject(new Error('SSH 세션이 종료되었습니다'));
      return;
    }

    const server = net.createServer((socket) => {
      const tunnel = tunnels.get(tunnelId);
      if (!tunnel || tunnel.status !== 'active') {
        socket.destroy();
        return;
      }

      sshSession.client.forwardOut(
        config.localAddr,
        config.localPort,
        config.remoteAddr || '127.0.0.1',
        config.remotePort || 0,
        (err, stream) => {
          if (err) {
            socket.destroy();
            sendError(sender, tunnelId, `포워딩 연결 실패: ${err.message}`);
            return;
          }

          tunnel.connections++;
          sendStatusUpdate(sender, tunnelId, tunnel);

          stream.pipe(socket);
          socket.pipe(stream);

          const cleanup = () => {
            stream.destroy();
            socket.destroy();
            if (tunnel.connections > 0) {
              tunnel.connections--;
              sendStatusUpdate(sender, tunnelId, tunnel);
            }
          };

          stream.on('close', cleanup);
          stream.on('error', cleanup);
          socket.on('close', cleanup);
          socket.on('error', cleanup);
        },
      );
    });

    server.on('error', (err) => {
      const tunnel = tunnels.get(tunnelId);
      if (tunnel) {
        tunnel.status = 'error';
        tunnel.error = err.message;
        sendStatusUpdate(sender, tunnelId, tunnel);
      }
      reject(new Error(`로컬 포트 ${config.localPort} 바인드 실패: ${err.message}`));
    });

    server.listen(config.localPort, config.localAddr, () => {
      const tunnel: TunnelSession = {
        tunnelId,
        sshSessionId,
        config,
        status: 'active',
        connections: 0,
        server,
        sender,
      };
      tunnels.set(tunnelId, tunnel);
      sendStatusUpdate(sender, tunnelId, tunnel);
      resolve();
    });
  });
}

// --- Remote Forwarding (-R) ---

function createRemoteForwarding(
  tunnelId: string,
  sshSessionId: string,
  config: PortForwardingConfig,
  sender: WebContents,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sshSession = getSshSession(sshSessionId);
    if (!sshSession) {
      reject(new Error('SSH 세션이 종료되었습니다'));
      return;
    }

    const remoteAddr = config.remoteAddr || '127.0.0.1';
    const remotePort = config.remotePort || 0;

    sshSession.client.forwardIn(remoteAddr, remotePort, (err, bindPort) => {
      if (err) {
        reject(new Error(`원격 포워딩 실패: ${err.message}`));
        return;
      }

      const actualRemotePort = bindPort || remotePort;
      const actualConfig = { ...config, remotePort: actualRemotePort };

      const tunnel: TunnelSession = {
        tunnelId,
        sshSessionId,
        config: actualConfig,
        status: 'active',
        connections: 0,
        sender,
      };
      tunnels.set(tunnelId, tunnel);

      // tcp connection 이벤트 핸들러 등록
      const onTcpConnection = (
        info: { destIP: string; destPort: number; srcIP: string; srcPort: number },
        accept: () => NodeJS.ReadWriteStream,
      ) => {
        // 이 터널의 포트인지 확인
        if (info.destPort !== actualRemotePort) return;

        const stream = accept() as Duplex;
        const localSocket = net.connect(config.localPort, config.localAddr, () => {
          tunnel.connections++;
          sendStatusUpdate(sender, tunnelId, tunnel);

          stream.pipe(localSocket);
          localSocket.pipe(stream);
        });

        const cleanup = () => {
          stream.destroy();
          localSocket.destroy();
          if (tunnel.connections > 0) {
            tunnel.connections--;
            sendStatusUpdate(sender, tunnelId, tunnel);
          }
        };

        stream.on('close', cleanup);
        stream.on('error', cleanup);
        localSocket.on('close', cleanup);
        localSocket.on('error', cleanup);
      };

      sshSession.client.on('tcp connection', onTcpConnection);

      // 터널 닫힐 때 리스너 제거를 위해 저장
      const origClose = tunnel.server;
      if (!origClose) {
        // server 필드를 리스너 정리용 더미로 사용
        const dummyServer = new net.Server();
        dummyServer.on('close', () => {
          sshSession.client.removeListener('tcp connection', onTcpConnection);
          sshSession.client.unforwardIn(remoteAddr, actualRemotePort, () => {
            // 무시
          });
        });
        tunnel.server = dummyServer;
      }

      sendStatusUpdate(sender, tunnelId, tunnel);
      resolve();
    });
  });
}

// --- Dynamic Forwarding (-D) SOCKS5 ---

function createDynamicForwarding(
  tunnelId: string,
  sshSessionId: string,
  config: PortForwardingConfig,
  sender: WebContents,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const sshSession = getSshSession(sshSessionId);
    if (!sshSession) {
      reject(new Error('SSH 세션이 종료되었습니다'));
      return;
    }

    const server = net.createServer((socket) => {
      const tunnel = tunnels.get(tunnelId);
      if (!tunnel || tunnel.status !== 'active') {
        socket.destroy();
        return;
      }

      handleSocks5Connection(socket, sshSession.client, tunnel, sender, tunnelId);
    });

    server.on('error', (err) => {
      const tunnel = tunnels.get(tunnelId);
      if (tunnel) {
        tunnel.status = 'error';
        tunnel.error = err.message;
        sendStatusUpdate(sender, tunnelId, tunnel);
      }
      reject(new Error(`SOCKS5 포트 ${config.localPort} 바인드 실패: ${err.message}`));
    });

    server.listen(config.localPort, config.localAddr, () => {
      const tunnel: TunnelSession = {
        tunnelId,
        sshSessionId,
        config,
        status: 'active',
        connections: 0,
        server,
        sender,
      };
      tunnels.set(tunnelId, tunnel);
      sendStatusUpdate(sender, tunnelId, tunnel);
      resolve();
    });
  });
}

// SOCKS5 프로토콜 핸들러
function handleSocks5Connection(
  socket: net.Socket,
  client: import('ssh2').Client,
  tunnel: TunnelSession,
  sender: WebContents,
  tunnelId: string,
): void {
  let phase: 'greeting' | 'request' | 'connected' = 'greeting';

  socket.once('data', (data) => {
    if (phase !== 'greeting') return;

    // SOCKS5 인사: [VER, NMETHODS, METHODS...]
    if (data[0] !== 0x05) {
      socket.destroy();
      return;
    }

    // 인증 불필요 응답
    socket.write(Buffer.from([0x05, 0x00]));
    phase = 'request';

    socket.once('data', (reqData) => {
      if (phase !== 'request') return;

      // SOCKS5 요청: [VER, CMD, RSV, ATYP, DST.ADDR, DST.PORT]
      if (reqData[0] !== 0x05 || reqData[1] !== 0x01) {
        // CONNECT 명령만 지원
        socket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        socket.destroy();
        return;
      }

      let targetHost: string;
      let targetPort: number;
      let addrEnd: number;

      const atyp = reqData[3];
      if (atyp === 0x01) {
        // IPv4
        targetHost = `${reqData[4]}.${reqData[5]}.${reqData[6]}.${reqData[7]}`;
        addrEnd = 8;
      } else if (atyp === 0x03) {
        // 도메인 이름
        const domainLen = reqData[4];
        targetHost = reqData.subarray(5, 5 + domainLen).toString('ascii');
        addrEnd = 5 + domainLen;
      } else if (atyp === 0x04) {
        // IPv6
        const parts: string[] = [];
        for (let i = 0; i < 8; i++) {
          parts.push(reqData.readUInt16BE(4 + i * 2).toString(16));
        }
        targetHost = parts.join(':');
        addrEnd = 20;
      } else {
        socket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        socket.destroy();
        return;
      }

      targetPort = reqData.readUInt16BE(addrEnd);
      phase = 'connected';

      client.forwardOut(
        '127.0.0.1',
        0,
        targetHost,
        targetPort,
        (err, stream) => {
          if (err) {
            // 연결 실패 응답
            socket.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            socket.destroy();
            return;
          }

          // 성공 응답
          socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));

          tunnel.connections++;
          sendStatusUpdate(sender, tunnelId, tunnel);

          stream.pipe(socket);
          socket.pipe(stream);

          const cleanup = () => {
            stream.destroy();
            socket.destroy();
            if (tunnel.connections > 0) {
              tunnel.connections--;
              sendStatusUpdate(sender, tunnelId, tunnel);
            }
          };

          stream.on('close', cleanup);
          stream.on('error', cleanup);
          socket.on('close', cleanup);
          socket.on('error', cleanup);
        },
      );
    });
  });
}

// --- 터널 관리 ---

export function closeTunnel(tunnelId: string): void {
  const tunnel = tunnels.get(tunnelId);
  if (!tunnel) return;

  tunnel.status = 'closed';

  if (tunnel.server) {
    tunnel.server.close();
  }

  if (tunnel.sender && !tunnel.sender.isDestroyed()) {
    sendStatusUpdate(tunnel.sender, tunnelId, tunnel);
  }

  tunnels.delete(tunnelId);
}

export function closeForSession(sshSessionId: string): void {
  for (const [tunnelId, tunnel] of tunnels) {
    if (tunnel.sshSessionId === sshSessionId) {
      if (tunnel.server) tunnel.server.close();
      tunnels.delete(tunnelId);
    }
  }
}

export function closeAll(): void {
  for (const [, tunnel] of tunnels) {
    if (tunnel.server) tunnel.server.close();
  }
  tunnels.clear();
}

export function listTunnels(sshSessionId: string): PortForwardingTunnel[] {
  const result: PortForwardingTunnel[] = [];
  for (const [, tunnel] of tunnels) {
    if (tunnel.sshSessionId === sshSessionId) {
      result.push({
        tunnelId: tunnel.tunnelId,
        sshSessionId: tunnel.sshSessionId,
        config: tunnel.config,
        status: tunnel.status,
        connections: tunnel.connections,
        error: tunnel.error,
      });
    }
  }
  return result;
}

// --- IPC 헬퍼 ---

function sendStatusUpdate(sender: WebContents, tunnelId: string, tunnel: TunnelSession): void {
  if (sender.isDestroyed()) return;
  sender.send('portforward:status-update', tunnelId, {
    tunnelId: tunnel.tunnelId,
    sshSessionId: tunnel.sshSessionId,
    config: tunnel.config,
    status: tunnel.status,
    connections: tunnel.connections,
    error: tunnel.error,
  });
}

function sendError(sender: WebContents, tunnelId: string, error: string): void {
  if (sender.isDestroyed()) return;
  sender.send('portforward:error', tunnelId, error);
}
