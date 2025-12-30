/**
 * Command Palette (Ctrl+K)
 * Accès rapide aux scripts et actions
 */

import { useEffect, useState, useCallback } from 'react';
import { Command } from 'cmdk';
import type { LocalScript } from '../services/localDb';

interface CommandPaletteProps {
  scripts: LocalScript[];
  onRunScript: (script: LocalScript) => void;
  onNavigate: (page: string) => void;
  onAction: (action: string) => void;
}

export function CommandPalette({ scripts, onRunScript, onNavigate, onAction }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Toggle on Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback((value: string) => {
    setOpen(false);
    setSearch('');

    if (value.startsWith('nav:')) {
      onNavigate(value.replace('nav:', ''));
    } else if (value.startsWith('action:')) {
      onAction(value.replace('action:', ''));
    } else if (value.startsWith('script:')) {
      const slug = value.replace('script:', '');
      const script = scripts.find(s => s.slug === slug);
      if (script) onRunScript(script);
    }
  }, [scripts, onRunScript, onNavigate, onAction]);

  if (!open) return null;

  // Group scripts by category
  const categories = [...new Set(scripts.map(s => s.category))];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh]">
      <Command
        className="w-full max-w-xl bg-zinc-900 rounded-xl border border-zinc-700 shadow-2xl overflow-hidden"
        loop
      >
        <div className="flex items-center border-b border-zinc-700 px-4">
          <svg className="w-5 h-5 text-zinc-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Rechercher une action, un script..."
            className="flex-1 bg-transparent py-4 text-white placeholder-zinc-500 outline-none text-lg"
            autoFocus
          />
          <kbd className="px-2 py-1 text-xs bg-zinc-800 text-zinc-400 rounded border border-zinc-700">ESC</kbd>
        </div>

        <Command.List className="max-h-[400px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-zinc-500">
            Aucun résultat pour "{search}"
          </Command.Empty>

          {/* Navigation */}
          <Command.Group heading="Navigation" className="text-xs text-zinc-500 px-2 py-1">
            <CommandItem value="nav:dashboard" onSelect={handleSelect} icon="📊">
              Dashboard
            </CommandItem>
            <CommandItem value="nav:tools" onSelect={handleSelect} icon="🔧">
              Boîte à outils
            </CommandItem>
            <CommandItem value="nav:scan" onSelect={handleSelect} icon="🛡️">
              Analyse sécurité
            </CommandItem>
            <CommandItem value="nav:chat" onSelect={handleSelect} icon="💬">
              Assistant IA
            </CommandItem>
            <CommandItem value="nav:settings" onSelect={handleSelect} icon="⚙️">
              Paramètres
            </CommandItem>
          </Command.Group>

          {/* Actions rapides */}
          <Command.Group heading="Actions rapides" className="text-xs text-zinc-500 px-2 py-1">
            <CommandItem value="action:refresh" onSelect={handleSelect} icon="🔄">
              Actualiser les données
            </CommandItem>
            <CommandItem value="action:scan" onSelect={handleSelect} icon="🔍">
              Lancer scan complet
            </CommandItem>
            <CommandItem value="action:sync" onSelect={handleSelect} icon="☁️">
              Synchroniser scripts
            </CommandItem>
            <CommandItem value="action:urgency" onSelect={handleSelect} icon="🚨">
              Signaler un problème urgent
            </CommandItem>
          </Command.Group>

          {/* Scripts par catégorie */}
          {categories.map(category => {
            const categoryScripts = scripts.filter(s => s.category === category);
            if (categoryScripts.length === 0) return null;

            return (
              <Command.Group
                key={category}
                heading={getCategoryLabel(category)}
                className="text-xs text-zinc-500 px-2 py-1"
              >
                {categoryScripts.slice(0, 5).map(script => (
                  <CommandItem
                    key={script.slug}
                    value={`script:${script.slug}`}
                    onSelect={handleSelect}
                    icon={script.icon || getCategoryIcon(category)}
                  >
                    {script.name}
                    {script.estimated_time && (
                      <span className="ml-2 text-xs text-zinc-500">~{script.estimated_time}</span>
                    )}
                  </CommandItem>
                ))}
              </Command.Group>
            );
          })}
        </Command.List>

        <div className="border-t border-zinc-700 px-4 py-2 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↑↓</kbd> naviguer</span>
            <span><kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↵</kbd> sélectionner</span>
          </div>
          <span>{scripts.length} scripts disponibles</span>
        </div>
      </Command>
    </div>
  );
}

// Helper component for command items
function CommandItem({
  children,
  value,
  onSelect,
  icon,
}: {
  children: React.ReactNode;
  value: string;
  onSelect: (value: string) => void;
  icon?: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={() => onSelect(value)}
      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-zinc-300 hover:bg-zinc-800 aria-selected:bg-orange-500/20 aria-selected:text-orange-400"
    >
      {icon && <span className="text-lg">{icon}</span>}
      <span>{children}</span>
    </Command.Item>
  );
}

// Helper functions
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    maintenance: '🔧 Maintenance',
    security: '🛡️ Sécurité',
    network: '🌐 Réseau',
    performance: '⚡ Performance',
    cleanup: '🧹 Nettoyage',
    diagnostic: '🔍 Diagnostic',
    repair: '🔨 Réparation',
  };
  return labels[category] || `📁 ${category}`;
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    maintenance: '🔧',
    security: '🛡️',
    network: '🌐',
    performance: '⚡',
    cleanup: '🧹',
    diagnostic: '🔍',
    repair: '🔨',
  };
  return icons[category] || '📄';
}

export default CommandPalette;
