import type { SshProfile, SshProfileInput } from './ssh-types';
export declare function listProfiles(): SshProfile[];
export declare function getProfile(id: string): SshProfile | null;
export declare function createProfile(input: SshProfileInput): Promise<SshProfile>;
export declare function updateProfile(id: string, input: Partial<SshProfileInput>): Promise<SshProfile>;
export declare function deleteProfile(id: string): Promise<void>;
/** keytar에서 저장된 비밀번호를 조회한다 */
export declare function getStoredPassword(profileId: string): Promise<string | null>;
/** keytar에서 저장된 패스프레이즈를 조회한다 */
export declare function getStoredPassphrase(profileId: string): Promise<string | null>;
