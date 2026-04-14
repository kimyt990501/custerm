import { useState, useCallback, useEffect } from 'react';

export function useDbProfiles() {
  const [dbProfiles, setDbProfiles] = useState<DbProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDbProfiles = useCallback(async () => {
    setLoading(true);
    const list = await window.electronAPI.dbProfile.list();
    setDbProfiles(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDbProfiles();
  }, [loadDbProfiles]);

  const createDbProfile = useCallback(async (input: DbProfileInput): Promise<DbProfile> => {
    const profile = await window.electronAPI.dbProfile.create(input);
    setDbProfiles(prev => [...prev, profile]);
    return profile;
  }, []);

  const updateDbProfile = useCallback(async (id: string, input: Partial<DbProfileInput>): Promise<DbProfile> => {
    const updated = await window.electronAPI.dbProfile.update(id, input);
    setDbProfiles(prev => prev.map(p => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const deleteDbProfile = useCallback(async (id: string): Promise<void> => {
    await window.electronAPI.dbProfile.delete(id);
    setDbProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  return {
    dbProfiles,
    loading,
    loadDbProfiles,
    createDbProfile,
    updateDbProfile,
    deleteDbProfile,
  };
}
