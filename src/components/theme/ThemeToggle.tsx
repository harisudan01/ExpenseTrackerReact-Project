import { Monitor, Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { useTheme, type ThemeMode } from './ThemeContext';

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Day (light theme)', icon: Sun },
  { mode: 'dark', label: 'Night (dark theme)', icon: Moon },
  { mode: 'system', label: 'Match device setting', icon: Monitor },
];

/** Day / Night / System switch */
export default function ThemeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  return (
    <div
      role="group"
      aria-label="Theme"
      className={clsx('flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-1', className)}
    >
      {OPTIONS.map(({ mode: m, label, icon: Icon }) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-label={label}
            aria-pressed={active}
            title={label}
            className={clsx(
              'grid size-8 cursor-pointer place-items-center rounded-lg transition-all',
              active
                ? clsx(
                    'bg-surface-raised shadow-sm',
                    m === 'light' ? 'text-amber-600' : m === 'dark' ? 'text-violet-600' : 'text-brand-600',
                  )
                : 'text-slate-400 hover:text-slate-600',
            )}
          >
            <Icon size={16} strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}
