/**
 * SortBar Component
 *
 * Sort dropdown and view toggle for tab list.
 * Supports sorting by recent, name, memory, and idle time.
 */

import { memo, useCallback } from 'react';
import { useSettings, isDarkTheme } from '../BTabContext';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

type SortMode = 'recent' | 'name' | 'memory' | 'idle';

interface SortBarProps {
  readonly sortMode: SortMode;
  readonly sortAscending: boolean;
  readonly onSortChange: (mode: SortMode, ascending: boolean) => void;
}

interface SortButtonConfig {
  readonly mode: SortMode;
  readonly label: string;
}

// ============================================================================
// Constants
// ============================================================================

const SORT_OPTIONS: readonly SortButtonConfig[] = [
  { mode: 'recent', label: 'Recent' },
  { mode: 'name', label: 'Name' },
  { mode: 'memory', label: 'Memory' },
  { mode: 'idle', label: 'Idle' },
] as const;

// ============================================================================
// Component
// ============================================================================

export const SortBar = memo(function SortBar({
  sortMode,
  sortAscending,
  onSortChange,
}: SortBarProps): React.JSX.Element {
  const settings = useSettings();

  const isDark = isDarkTheme(settings.theme);

  const handleSortClick = useCallback(
    (mode: SortMode): void => {
      if (mode === sortMode) {
        // Toggle direction if same mode
        onSortChange(mode, !sortAscending);
      } else {
        // Switch mode with ascending default
        onSortChange(mode, true);
      }
    },
    [sortMode, sortAscending, onSortChange]
  );

  return (
    <div
      className={cn(
        'flex items-center px-3 shrink-0 border-b',
        isDark
          ? 'bg-[rgba(16,20,36,0.95)] border-white/[0.07]'
          : 'bg-[rgba(248,250,252,1)] border-black/[0.06]'
      )}
    >
      {/* Sort Label */}
      <span
        className={cn(
          'text-[10px] font-medium mr-1.5 tracking-wide',
          isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
        )}
      >
        Sort:
      </span>

      {/* Sort Buttons */}
      {SORT_OPTIONS.map(({ mode, label }) => {
        const isActive = mode === sortMode;
        const arrow = isActive ? (sortAscending ? ' ↑' : ' ↓') : '';

        return (
          <button
            key={mode}
            type="button"
            className={cn(
              'px-2.5 py-1.5 border-none border-b-2 border-transparent',
              'bg-transparent font-sans text-[11px] font-medium',
              'cursor-pointer transition-all duration-150 whitespace-nowrap',
              isActive
                ? 'text-[#1dd9b4] border-b-[#1dd9b4]'
                : isDark
                  ? 'text-[#4e5578] hover:text-[#8b94b2]'
                  : 'text-[#8890ab] hover:text-[#444d6e]'
            )}
            onClick={() => handleSortClick(mode)}
            aria-pressed={isActive}
            aria-label={`Sort by ${label}${isActive ? (sortAscending ? ' ascending' : ' descending') : ''}`}
          >
            {label}{arrow}
          </button>
        );
      })}
    </div>
  );
});

export default SortBar;
