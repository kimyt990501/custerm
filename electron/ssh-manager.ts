import { Client, type ClientChannel } from 'ssh2';
import fs from 'node:fs';
import { getProfile, getStoredPassword, getStoredPassphrase } from './profile-store';
import type { SshConnectParams } from './ssh-types';
import { closeSftpForSession } from './sftp-manager';
import { closeForSession as closePortForwardingForSession } from './port-forwarding-manager';

interface SshSession {
  client: Client;
  stream: ClientChannel;
  profileId: string;
}

const sessions = new Map<string, SshSession>();
let nextId = 0;

export function getSshSession(id: string): SshSession | undefined {
  return sessions.get(id);
}

export async function connectSsh(params: SshConnectParams): Promise<{ sessionId: string }> {
  const profile = getProfile(params.profileId);
  if (!profile) {
    throw new Error(`프로필을 찾을 수 없습니다: ${params.profileId}`);
  }

  // 보안: 비밀번호/패스프레이즈 우선순위
  // 1. IPC로 전달된 일회성 값 (저장하지 않는 경우)
  // 2. keytar(OS 키체인)에 저장된 값
  let password: string | undefined;
  let passphrase: string | undefined;

  if (profile.authMethod === 'password') {
    password = params.password ?? (await getStoredPassword(params.profileId)) ?? undefined;
    if (!password) {
      throw new Error('비밀번호가 설정되지 않았습니다');
    }
  } else {
    passphrase = params.passphrase ?? (await getStoredPassphrase(params.profileId)) ?? undefined;
    // 패스프레이즈 없는 키도 허용 (passphrase가 null/undefined일 수 있음)
  }

  const sessionId = String(++nextId);

  return new Promise((resolve, reject) => {
    const client = new Client();

    const connectConfig: Record<string, unknown> = {
      host: profile.host,
      port: profile.port,
      username: profile.username,
      readyTimeout: 10000,
      // 보안: 호스트 키 검증을 건너뛴다.
      // TODO: 향후 known_hosts 파일 기반 검증을 구현해야 한다.
      // 현재는 편의를 위해 모든 호스트 키를 수락하지만,
      // MITM 공격에 취약하므로 프로덕션에서는 반드시 수정해야 한다.
    };

    if (profile.authMethod === 'password') {
      connectConfig.password = password;
    } else {
      // 보안: 개인키 파일은 접속 시에만 읽고, 메모리에 장기 보관하지 않는다.
      if (!profile.privateKeyPath) {
        reject(new Error('개인키 파일 경로가 설정되지 않았습니다'));
        return;
      }
      try {
        connectConfig.privateKey = fs.readFileSync(profile.privateKeyPath);
      } catch {
        reject(new Error(`개인키 파일을 읽을 수 없습니다: ${profile.privateKeyPath}`));
        return;
      }
      if (passphrase) {
        connectConfig.passphrase = passphrase;
      }
    }

    client.on('ready', () => {
      client.shell(
        { term: 'xterm-256color' },
        (err, stream) => {
          if (err) {
            client.end();
            reject(new Error(`셸을 열 수 없습니다: ${err.message}`));
            return;
          }

          sessions.set(sessionId, { client, stream, profileId: params.profileId });
          resolve({ sessionId });
        },
      );
    });

    client.on('error', (err) => {
      sessions.delete(sessionId);
      reject(new Error(`SSH 연결 실패: ${err.message}`));
    });

    client.connect(connectConfig);
  });
}

export function writeSsh(id: string, data: string): void {
  const session = sessions.get(id);
  if (session) {
    session.stream.write(data);
  }
}

export function resizeSsh(id: string, cols: number, rows: number): void {
  const session = sessions.get(id);
  if (session) {
    session.stream.setWindow(rows, cols, rows * 16, cols * 8);
  }
}

export function disconnectSsh(id: string): void {
  const session = sessions.get(id);
  if (session) {
    closeSftpForSession(id);
    closePortForwardingForSession(id);
    session.stream.close();
    session.client.end();
    sessions.delete(id);
  }
}

export function disconnectAllSsh(): void {
  for (const [id, session] of sessions) {
    session.stream.close();
    session.client.end();
    sessions.delete(id);
  }
}
