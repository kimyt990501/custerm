import Store from 'electron-store';
import keytar from 'keytar';
import crypto from 'node:crypto';
import type { SshProfile, SshProfileInput } from './ssh-types';

// 보안: electron-store에는 프로필 메타데이터만 저장한다.
// 비밀번호와 패스프레이즈는 OS 키체인(keytar)에 저장한다.
const KEYTAR_SERVICE = 'custerm';

interface StoreSchema {
  profiles: SshProfile[];
}

const store = new Store<StoreSchema>({
  name: 'profiles',
  defaults: {
    profiles: [],
  },
});

export function listProfiles(): SshProfile[] {
  return store.get('profiles');
}

export function getProfile(id: string): SshProfile | null {
  const profiles = store.get('profiles');
  return profiles.find(p => p.id === id) ?? null;
}

export async function createProfile(input: SshProfileInput): Promise<SshProfile> {
  const id = crypto.randomUUID();
  const now = Date.now();

  const profile: SshProfile = {
    id,
    name: input.name,
    type: input.type || 'ssh',
    host: input.host,
    port: input.port,
    username: input.username,
    authMethod: input.authMethod,
    privateKeyPath: input.privateKeyPath,
    distro: input.distro,
    createdAt: now,
    updatedAt: now,
  };

  // 보안: 비밀번호/패스프레이즈를 OS 키체인에 저장한다.
  // electron-store(JSON 파일)에는 절대 저장하지 않는다.
  if (input.password) {
    await keytar.setPassword(KEYTAR_SERVICE, `ssh-password:${id}`, input.password);
  }
  if (input.passphrase) {
    await keytar.setPassword(KEYTAR_SERVICE, `ssh-passphrase:${id}`, input.passphrase);
  }

  const profiles = store.get('profiles');
  profiles.push(profile);
  store.set('profiles', profiles);

  return profile;
}

export async function updateProfile(
  id: string,
  input: Partial<SshProfileInput>,
): Promise<SshProfile> {
  const profiles = store.get('profiles');
  const idx = profiles.findIndex(p => p.id === id);
  if (idx === -1) {
    throw new Error(`Profile not found: ${id}`);
  }

  const existing = profiles[idx];
  const updated: SshProfile = {
    ...existing,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.type !== undefined && { type: input.type }),
    ...(input.host !== undefined && { host: input.host }),
    ...(input.port !== undefined && { port: input.port }),
    ...(input.username !== undefined && { username: input.username }),
    ...(input.authMethod !== undefined && { authMethod: input.authMethod }),
    ...(input.privateKeyPath !== undefined && { privateKeyPath: input.privateKeyPath }),
    ...(input.distro !== undefined && { distro: input.distro }),
    updatedAt: Date.now(),
  };

  if (input.password !== undefined) {
    if (input.password) {
      await keytar.setPassword(KEYTAR_SERVICE, `ssh-password:${id}`, input.password);
    } else {
      await keytar.deletePassword(KEYTAR_SERVICE, `ssh-password:${id}`);
    }
  }
  if (input.passphrase !== undefined) {
    if (input.passphrase) {
      await keytar.setPassword(KEYTAR_SERVICE, `ssh-passphrase:${id}`, input.passphrase);
    } else {
      await keytar.deletePassword(KEYTAR_SERVICE, `ssh-passphrase:${id}`);
    }
  }

  profiles[idx] = updated;
  store.set('profiles', profiles);

  return updated;
}

export async function deleteProfile(id: string): Promise<void> {
  const profiles = store.get('profiles');
  const filtered = profiles.filter(p => p.id !== id);
  store.set('profiles', filtered);

  // 보안: 프로필 삭제 시 키체인에서 자격증명도 함께 삭제한다.
  await keytar.deletePassword(KEYTAR_SERVICE, `ssh-password:${id}`);
  await keytar.deletePassword(KEYTAR_SERVICE, `ssh-passphrase:${id}`);
}

/** keytar에서 저장된 비밀번호를 조회한다 */
export async function getStoredPassword(profileId: string): Promise<string | null> {
  return keytar.getPassword(KEYTAR_SERVICE, `ssh-password:${profileId}`);
}

/** keytar에서 저장된 패스프레이즈를 조회한다 */
export async function getStoredPassphrase(profileId: string): Promise<string | null> {
  return keytar.getPassword(KEYTAR_SERVICE, `ssh-passphrase:${profileId}`);
}
