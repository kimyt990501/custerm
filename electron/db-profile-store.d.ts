import type { DbProfile, DbProfileInput } from './db-types';
export declare function listDbProfiles(): DbProfile[];
export declare function getDbProfile(id: string): DbProfile | null;
export declare function createDbProfile(input: DbProfileInput): Promise<DbProfile>;
export declare function updateDbProfile(id: string, input: Partial<DbProfileInput>): Promise<DbProfile>;
export declare function deleteDbProfile(id: string): Promise<void>;
export declare function getStoredDbPassword(profileId: string): Promise<string | null>;
