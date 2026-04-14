import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Terminal, Laptop } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: SshProfile[];
  onConnect: (profile: SshProfile) => void;
}

export default function CommandPalette({ isOpen, onClose, profiles, onConnect }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredProfiles = profiles.filter(p => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) ||
      p.host?.toLowerCase().includes(q) ||
      p.distro?.toLowerCase().includes(q);
  });

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(filteredProfiles.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredProfiles.length) % Math.max(filteredProfiles.length, 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredProfiles.length > 0) {
          onConnect(filteredProfiles[selectedIndex]);
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredProfiles, selectedIndex, onClose, onConnect]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-start justify-center pt-[15vh] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-lg bg-[#181825]/90 backdrop-blur-xl border border-[#313244]/50 rounded-xl shadow-2xl overflow-hidden pointer-events-auto flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center px-4 py-3 border-b border-[#313244]/50">
                <Search className="w-5 h-5 text-[#89b4fa] mr-3 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="서버 검색 후 연결 (이름 또는 호스트)..."
                  className="flex-1 bg-transparent text-[#cdd6f4] outline-none text-base font-medium placeholder:text-[#9399b2]"
                />
              </div>

              <div className="max-h-[60vh] overflow-y-auto py-2">
                {filteredProfiles.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[#9399b2]">
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  filteredProfiles.map((profile, i) => (
                    <div
                      key={profile.id}
                      className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                        i === selectedIndex ? 'bg-[#89b4fa]/10' : 'hover:bg-[#313244]/30'
                      }`}
                      onClick={() => {
                        onConnect(profile);
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(i)}
                    >
                      <div className={`p-2 rounded-lg ${
                        i === selectedIndex
                          ? profile.type === 'wsl' ? 'bg-[#fab387]/20 text-[#fab387]' : 'bg-[#89b4fa]/20 text-[#89b4fa]'
                          : 'bg-[#313244]/50 text-[#bac2de]'
                      }`}>
                        <Terminal className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${
                          i === selectedIndex
                            ? profile.type === 'wsl' ? 'text-[#fab387]' : 'text-[#89b4fa]'
                            : 'text-[#cdd6f4]'
                        }`}>
                          {profile.name}
                        </div>
                        <div className="text-xs text-[#bac2de] truncate flex items-center gap-1 mt-0.5">
                          <Laptop className="w-3 h-3" />
                          {profile.type === 'wsl'
                            ? `WSL · ${profile.distro || 'default'}`
                            : `${profile.username}@${profile.host}:${profile.port}`
                          }
                        </div>
                      </div>
                      {i === selectedIndex && (
                         <span className="text-xs font-semibold text-[#89b4fa]">Enter</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
