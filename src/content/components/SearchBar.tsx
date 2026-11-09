/**
 * SearchBar Component
 *
 * Search input with icon for filtering tabs.
 * Supports command mode with / prefix.
 */

import { useRef, useEffect, memo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useSettings, useSearch, isDarkTheme } from '../BTabContext';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

interface SearchBarProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const SearchBar = memo(function SearchBar({
  value,
  onChange,
  placeholder = 'Search tabs... (/ for commands)',
  autoFocus = true,
}: SearchBarProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const settings = useSettings();
  const { query } = useSearch();

  const isDark = isDarkTheme(settings.theme);

  const isCommandMode = value.startsWith('/');

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleClear = useCallback((): void => {
    onChange('');
    inputRef.current?.focus();
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      // Prevent default for navigation keys to let parent handle them
      if (['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
        e.stopPropagation();
      }
    },
    []
  );

  return (
    <div
      className={cn(
        'flex items-center px-3 py-2 shrink-0 border-b',
        isDark
          ? 'bg-[rgba(8,10,22,0.92)] border-white/[0.07]'
          : 'bg-[rgba(255,255,255,0.97)] border-black/[0.06]'
      )}
    >
      <div
        className={cn(
          'flex-1 flex items-center gap-2 px-3 py-2 rounded-[9px] border transition-all duration-150',
          isDark
            ? 'bg-[rgba(16,20,36,0.95)] border-white/[0.12]'
            : 'bg-[rgba(248,250,252,1)] border-black/[0.1]',
          'focus-within:border-[rgba(29,217,180,0.28)] focus-within:shadow-[0_0_0_3px_rgba(29,217,180,0.07)]'
        )}
      >
        {/* Search Icon */}
        <div
          className={cn(
            'flex items-center shrink-0',
            isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
          )}
        >
          <Search className="w-3.5 h-3.5" strokeWidth={1.8} />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'flex-1 bg-transparent border-none outline-none',
            'font-sans text-[12.5px] min-w-0',
            isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]',
            isDark ? 'placeholder:text-[#4e5578]' : 'placeholder:text-[#8890ab]',
            isCommandMode && 'text-[#1dd9b4]'
          )}
          aria-label="Search tabs"
          autoComplete="off"
          spellCheck={false}
        />

        {/* Clear Button */}
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-5 h-5 rounded p-0 shrink-0',
              'transition-all duration-150',
              isDark
                ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
            )}
            onClick={handleClear}
            title="Clear search"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
});

export default SearchBar;
