import Store from 'electron-store';
import keytar from 'keytar';
import crypto from 'node:crypto';
import type { DbProfile, DbProfileInput } from './db-types';

/**
 * DB 프로필 저장소.
 * SSH 프로필과 동일 패턴: 메타데이터는 electron-store, 비밀번호는 OS 키체인.
 */
const KEYTAR_SERVICE = 'custerm';
const KEYTAR_PREFIX = 'mysql-password:';

interface StoreSchema {
  dbProfiles: DbProfile[];
}

const store = new Store<StoreSchema>({
  name: 'db-profiles',
  defaults: {
    dbProfiles: [],
  },
});

export function listDbProfiles(): DbProfile[] {
  return store.get('dbProfiles');
}

export function getDbProfile(id: string): DbProfile | null {
  return store.get('dbProfiles').find(p => p.id === id) ?? null;
}

export async function createDbProfile(input: DbProfileInput): Promise<DbProfile> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const profile: DbProfile = {
    id,
    name: input.name,
    kind: input.kind,
    host: input.host,
    port: input.port,
    username: input.username,
    database: input.database,
    useSshTunnel: input.useSshTunnel,
    sshProfileId: input.sshProfileId,
    createdAt: now,
    updatedAt: now,
  };

  if (input.password) {
    await keytar.setPassword(KEYTAR_SERVICE, `${KEYTAR_PREFIX}${id}`, input.password);
  }

  const profiles = store.get('dbProfiles');
  profiles.push(profile);
  store.set('dbProfiles', profiles);
  return profile;
}

export async function updateDbProfile(
  id: string,
  input: Partial<DbProfileInput>,
): Promise<DbProfile> {
  const profiles = store.get('dbProfiles');
  const idx = profiles.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`DB 프로필을 찾을 수 없습니다: ${id}`);

  const existing = profiles[idx];
  const updated: DbProfile = {
    ...existing,
    ...(input.name !== undefined && { name: input.name }),
    ...(input.kind !== undefined && { kind: input.kind }),
    ...(input.host !== undefined && { host: input.host }),
    ...(input.port !== undefined && { port: input.port }),
    ...(input.username !== undefined && { username: input.username }),
    ...(input.database !== undefined && { database: input.database }),
    ...(input.useSshTunnel !== undefined && { useSshTunnel: input.useSshTunnel }),
    ...(input.sshProfileId !== undefined && { sshProfileId: input.sshProfileId }),
    updatedAt: Date.now(),
  };

  if (input.password !== undefined) {
    if (input.password) {
      await keytar.setPassword(KEYTAR_SERVICE, `${KEYTAR_PREFIX}${id}`, input.password);
    } else {
      await keytar.deletePassword(KEYTAR_SERVICE, `${KEYTAR_PREFIX}${id}`);
    }
  }

  profiles[idx] = updated;
  store.set('dbProfiles', profiles);
  return updated;
}

export async function deleteDbProfile(id: string): Promise<void> {
  const profiles = store.get('dbProfiles');
  store.set('dbProfiles', profiles.filter(p => p.id !== id));
  await keytar.deletePassword(KEYTAR_SERVICE, `${KEYTAR_PREFIX}${id}`);
}

export async function getStoredDbPassword(profileId: string): Promise<string | null> {
  return keytar.getPassword(KEYTAR_SERVICE, `${KEYTAR_PREFIX}${profileId}`);
}
