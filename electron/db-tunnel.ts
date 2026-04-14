import net from 'node:net';
import fs from 'node:fs';
import { Client } from 'ssh2';
import { getProfile, getStoredPassword, getStoredPassphrase } from './profile-store';

/** DB 접속 전용 SSH 터널. 기존 SSH 탭 세션과 독립적으로 동작한다. */
export interface DbTunnel {
  client: Client;
  server: net.Server;
  localPort: number;
  close: () => void;
}

export async function openDbTunnel(
  sshProfileId: string,
  remoteHost: string,
  remotePort: number,
): Promise<DbTunnel> {
  const sshProfile = getProfile(sshProfileId);
  if (!sshProfile) throw new Error(`SSH 프로필을 찾을 수 없습니다: ${sshProfileId}`);

  // 자격증명 로드 (keytar)
  let password: string | undefined;
  let passphrase: string | undefined;
  if (sshProfile.authMethod === 'password') {
    password = (await getStoredPassword(sshProfileId)) ?? undefined;
    if (!password) throw new Error('SSH 비밀번호가 저장되어 있지 않습니다');
  } else {
    passphrase = (await getStoredPassphrase(sshProfileId)) ?? undefined;
  }

  const connectConfig: Record<string, unknown> = {
    host: sshProfile.host,
    port: sshProfile.port,
    username: sshProfile.username,
    readyTimeout: 10000,
  };

  if (sshProfile.authMethod === 'password') {
    connectConfig.password = password;
  } else {
    if (!sshProfile.privateKeyPath) throw new Error('개인키 경로가 설정되지 않았습니다');
    try {
      connectConfig.privateKey = fs.readFileSync(sshProfile.privateKeyPath);
    } catch {
      throw new Error(`개인키 파일을 읽을 수 없습니다: ${sshProfile.privateKeyPath}`);
    }
    if (passphrase) connectConfig.passphrase = passphrase;
  }

  const client = new Client();

  await new Promise<void>((resolve, reject) => {
    client.on('ready', () => resolve());
    client.on('error', err => reject(new Error(`SSH 터널 연결 실패: ${err.message}`)));
    client.connect(connectConfig);
  });

  const server = net.createServer((socket) => {
    client.forwardOut(
      '127.0.0.1',
      0,
      remoteHost,
      remotePort,
      (err, stream) => {
        if (err) {
          socket.destroy();
          return;
        }
        stream.pipe(socket);
        socket.pipe(stream);

        const cleanup = () => {
          stream.destroy();
          socket.destroy();
        };
        stream.on('close', cleanup);
        stream.on('error', cleanup);
        socket.on('close', cleanup);
        socket.on('error', cleanup);
      },
    );
  });

  const localPort = await new Promise<number>((resolve, reject) => {
    server.on('error', err => reject(new Error(`로컬 터널 포트 바인드 실패: ${err.message}`)));
    // port=0 → OS가 할당
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') resolve(addr.port);
      else reject(new Error('로컬 포트를 얻을 수 없습니다'));
    });
  });

  const close = () => {
    try { server.close(); } catch { /* ignore */ }
    try { client.end(); } catch { /* ignore */ }
  };

  return { client, server, localPort, close };
}
