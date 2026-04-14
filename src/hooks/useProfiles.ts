import { useState, useCallback, useEffect } from 'react';

export function useProfiles() {
  const [profiles, setProfiles] = useState<SshProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    const list = await window.electronAPI.profile.list();
    setProfiles(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const createProfile = useCallback(async (input: SshProfileInput): Promise<SshProfile> => {
    const profile = await window.electronAPI.profile.create(input);
    setProfiles(prev => [...prev, profile]);
    return profile;
  }, []);

  const updateProfile = useCallback(async (id: string, input: Partial<SshProfileInput>): Promise<SshProfile> => {
    const updated = await window.electronAPI.profile.update(id, input);
    setProfiles(prev => prev.map(p => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const deleteProfile = useCallback(async (id: string): Promise<void> => {
    await window.electronAPI.profile.delete(id);
    setProfiles(prev => prev.filter(p => p.id !== id));
  }, []);

  return {
    profiles,
    loading,
    loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
  };
}
