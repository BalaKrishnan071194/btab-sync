/**
 * DetailPanel Component
 *
 * Expandable tab details sidebar showing memory graph and quick actions.
 * Displayed when a tab row is clicked.
 * S3-3: Includes Quick Notes functionality.
 * S3-4: Includes Tab Reminders functionality.
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, Bookmark, BookmarkCheck, Copy, Check, StickyNote, Bell, Clock, X, Save, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettings, useIsPro, isDarkTheme } from '../BTabContext';
import type { TabInfo } from '../BTabContext';
import { cn } from '../ui/cn';
import { getNoteByUrl, saveNote, deleteNote, createReminder, type QuickNote } from '@/lib/db';
import { ext } from '@/lib/browsers';

// ============================================================================
// Types
// ============================================================================

interface DetailPanelProps {
  readonly tab: TabInfo | null;
  readonly isOpen: boolean;
  readonly totalMemoryMB: number;
  readonly onClose: () => void;
  readonly onSwitch: () => void;
  readonly onBookmark?: () => void;
  /** S3-3: Callback when note is saved/deleted */
  readonly onNoteChange?: (url: string, hasNote: boolean) => void;
  /** S3-4: Callback when reminder is set */
  readonly onReminderSet?: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

function getMemoryTier(mb: number): 'lo' | 'md' | 'hi' {
  if (mb < 100) return 'lo';
  if (mb < 300) return 'md';
  return 'hi';
}

function getTierColor(tier: 'lo' | 'md' | 'hi'): string {
  switch (tier) {
    case 'lo':
      return '#9ece6a';
    case 'md':
      return '#ff9e64';
    case 'hi':
      return '#f7768e';
  }
}

function getBorderClass(tab: TabInfo): string {
  if (tab.active) return 'border-l-[#1dd9b4]';
  if (tab.isStale) return 'border-l-[#f7768e]';
  if (tab.discarded) return 'border-l-[#7aa2f7]';
  return 'border-l-transparent';
}

/** Reminder time options */
const REMINDER_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '3 hours', minutes: 180 },
  { label: 'Tomorrow', minutes: 24 * 60 },
] as const;

// ============================================================================
// Component
// ============================================================================

export const DetailPanel = memo(function DetailPanel({
  tab,
  isOpen,
  totalMemoryMB,
  onClose,
  onSwitch,
  onBookmark,
  onNoteChange,
  onReminderSet,
}: DetailPanelProps): React.JSX.Element {
  const settings = useSettings();
  const isPro = useIsPro();
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  
  // S3-3: Quick Notes state
  const [noteContent, setNoteContent] = useState('');
  const [showNoteEditor, setShowNoteEditor] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [existingNote, setExistingNote] = useState<QuickNote | null>(null);
  
  // S3-4: Reminders state
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);

  const isDark = isDarkTheme(settings.theme);

  const mb = tab?.estimatedMemoryMB ?? 0;
  const tier = getMemoryTier(mb);
  const color = getTierColor(tier);
  const pct = totalMemoryMB > 0 ? Math.max(1, Math.round((mb / totalMemoryMB) * 100)) : 0;
  const totalLabel = totalMemoryMB >= 1024
    ? `${(totalMemoryMB / 1024).toFixed(1)} GB`
    : `${Math.round(totalMemoryMB)} MB`;

  // S3-3: Load existing note when tab changes
  useEffect(() => {
    if (!tab?.url || !isOpen) {
      setExistingNote(null);
      setNoteContent('');
      setShowNoteEditor(false);
      return;
    }

    const loadNote = async () => {
      try {
        const note = await getNoteByUrl(tab.url);
        setExistingNote(note ?? null);
        setNoteContent(note?.content ?? '');
      } catch (e) {
        console.warn('[bTab] Failed to load note:', e);
      }
    };

    void loadNote();
  }, [tab?.url, isOpen]);

  // Animate bar fill on open
  useEffect(() => {
    if (isOpen && barRef.current) {
      barRef.current.style.width = '0%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (barRef.current) {
            barRef.current.style.width = `${pct}%`;
          }
        });
      });
    }
  }, [isOpen, pct]);

  // Focus note input when editor opens
  useEffect(() => {
    if (showNoteEditor && noteInputRef.current) {
      noteInputRef.current.focus();
    }
  }, [showNoteEditor]);

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!tab) return;
    try {
      await navigator.clipboard.writeText(tab.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard write failed
    }
  }, [tab]);

  const handleBookmark = useCallback((): void => {
    setBookmarked(!bookmarked);
    onBookmark?.();
  }, [bookmarked, onBookmark]);

  // S3-3: Handle note toggle
  const handleNoteToggle = useCallback((): void => {
    if (!isPro) {
      // Show Pro gate message
      return;
    }
    setShowNoteEditor(prev => !prev);
    setShowReminderPicker(false);
  }, [isPro]);

  // S3-3: Handle note save
  const handleNoteSave = useCallback(async (): Promise<void> => {
    if (!tab?.url) return;
    
    setNoteSaving(true);
    try {
      if (noteContent.trim()) {
        const saved = await saveNote(tab.url, noteContent.trim());
        setExistingNote(saved);
        onNoteChange?.(tab.url, true);
      } else if (existingNote) {
        await deleteNote(existingNote.id);
        setExistingNote(null);
        onNoteChange?.(tab.url, false);
      }
      setShowNoteEditor(false);
    } catch (e) {
      console.warn('[bTab] Failed to save note:', e);
    } finally {
      setNoteSaving(false);
    }
  }, [tab?.url, noteContent, existingNote, onNoteChange]);

  // S3-3: Handle note delete
  const handleNoteDelete = useCallback(async (): Promise<void> => {
    if (!existingNote || !tab?.url) return;
    
    try {
      await deleteNote(existingNote.id);
      setExistingNote(null);
      setNoteContent('');
      setShowNoteEditor(false);
      onNoteChange?.(tab.url, false);
    } catch (e) {
      console.warn('[bTab] Failed to delete note:', e);
    }
  }, [existingNote, tab?.url, onNoteChange]);

  // S3-4: Handle reminder toggle
  const handleReminderToggle = useCallback((): void => {
    if (!isPro) {
      return;
    }
    setShowReminderPicker(prev => !prev);
    setShowNoteEditor(false);
  }, [isPro]);

  // S3-4: Handle reminder set
  const handleSetReminder = useCallback(async (minutes: number): Promise<void> => {
    if (!tab) return;

    try {
      const remindAt = Date.now() + minutes * 60 * 1000;
      await createReminder({
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
        remindAt,
      });
      
      // Send message to background to register alarm
      await ext.runtime.sendMessage({
        action: 'registerReminder',
        remindAt,
        tabId: tab.id,
        title: tab.title,
        url: tab.url,
      });

      setReminderSet(true);
      setShowReminderPicker(false);
      setTimeout(() => setReminderSet(false), 2000);
      onReminderSet?.();
    } catch (e) {
      console.warn('[bTab] Failed to set reminder:', e);
    }
  }, [tab, onReminderSet]);

  if (!tab) return <></>;

  // Calculate max height based on whether note editor is shown
  const maxHeight = showNoteEditor || showReminderPicker ? 180 : 110;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          className={cn(
            'rounded-b-[9px] -mt-0.5 mb-1 border-l-[3px]',
            isDark ? 'bg-[rgba(16,20,36,0.95)]' : 'bg-[rgba(248,250,252,1)]',
            getBorderClass(tab)
          )}
          initial={{ maxHeight: 0, opacity: 0 }}
          animate={{ maxHeight, opacity: 1 }}
          exit={{ maxHeight: 0, opacity: 0 }}
          transition={{
            maxHeight: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
            opacity: { duration: 0.22 },
          }}
        >
          <div className="flex items-center gap-2.5 px-3 py-2">
            {/* Memory Graph */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {/* Top label */}
              <div className="flex items-baseline gap-1">
                <span
                  className="text-[13px] font-medium tracking-tight tabular-nums"
                  style={{ color }}
                >
                  {mb} MB
                </span>
                <span
                  className={cn(
                    'text-[8.5px] font-medium tracking-wide',
                    isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
                  )}
                >
                  of {totalLabel} total
                </span>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-1">
                <div
                  className={cn(
                    'flex-1 min-w-0 h-1 rounded-sm overflow-hidden',
                    isDark ? 'bg-white/[0.08]' : 'bg-black/[0.1]'
                  )}
                >
                  <div
                    ref={barRef}
                    className="h-full rounded-sm transition-[width] duration-500"
                    style={{
                      width: '0%',
                      background: color,
                      transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-medium tabular-nums min-w-[28px] text-right"
                  style={{ color }}
                >
                  {pct}%
                </span>
              </div>

              {/* Sub label */}
              <span
                className={cn(
                  'text-[8px]',
                  isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
                )}
              >
                This tab vs total browser RAM
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-1 shrink-0">
              {/* Open/Go Button */}
              <DetailActionButton
                icon={<ExternalLink className="w-3 h-3" strokeWidth={1.8} />}
                label="OPEN"
                onClick={onSwitch}
                variant="go"
                isDark={isDark}
              />

              {/* S3-3: Note Button */}
              <DetailActionButton
                icon={<StickyNote className="w-3 h-3" strokeWidth={1.8} />}
                label="NOTE"
                onClick={handleNoteToggle}
                variant="note"
                isActive={showNoteEditor || !!existingNote}
                isDark={isDark}
                disabled={!isPro}
              />

              {/* S3-4: Reminder Button */}
              <DetailActionButton
                icon={
                  reminderSet 
                    ? <Check className="w-3 h-3" strokeWidth={1.8} />
                    : <Bell className="w-3 h-3" strokeWidth={1.8} />
                }
                label="REMIND"
                onClick={handleReminderToggle}
                variant="reminder"
                isActive={showReminderPicker || reminderSet}
                isDark={isDark}
                disabled={!isPro}
              />

              {/* Copy URL Button */}
              <DetailActionButton
                icon={
                  copied
                    ? <Check className="w-3 h-3" strokeWidth={1.8} />
                    : <Copy className="w-3 h-3" strokeWidth={1.8} />
                }
                label="COPY"
                onClick={handleCopy}
                variant="copy"
                isActive={copied}
                isDark={isDark}
              />
            </div>
          </div>

          {/* S3-3: Note Editor */}
          <AnimatePresence>
            {showNoteEditor && (
              <motion.div
                className="px-3 pb-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className={cn(
                  'flex gap-2 items-end rounded-lg p-2',
                  isDark ? 'bg-white/[0.03]' : 'bg-black/[0.02]'
                )}>
                  <textarea
                    ref={noteInputRef}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Add a note for this tab..."
                    className={cn(
                      'flex-1 text-[11px] resize-none rounded-md px-2 py-1.5 h-[52px]',
                      'border transition-colors focus:outline-none focus:ring-1',
                      isDark 
                        ? 'bg-white/[0.05] border-white/[0.1] text-[#edf0ff] placeholder:text-[#4e5578] focus:ring-[#1dd9b4] focus:border-[#1dd9b4]'
                        : 'bg-white border-black/[0.1] text-[#0e1226] placeholder:text-[#8890ab] focus:ring-[#14b896] focus:border-[#14b896]'
                    )}
                    maxLength={500}
                  />
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'w-6 h-6 rounded-md',
                        isDark
                          ? 'text-[#1dd9b4] hover:bg-[rgba(29,217,180,0.12)]'
                          : 'text-[#14b896] hover:bg-[rgba(20,184,150,0.1)]'
                      )}
                      onClick={handleNoteSave}
                      disabled={noteSaving}
                      title="Save note"
                    >
                      <Save className="w-3 h-3" strokeWidth={2} />
                    </Button>
                    {existingNote && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'w-6 h-6 rounded-md',
                          isDark
                            ? 'text-[#f7768e] hover:bg-[rgba(247,118,142,0.12)]'
                            : 'text-[#c02040] hover:bg-[rgba(192,32,64,0.1)]'
                        )}
                        onClick={handleNoteDelete}
                        title="Delete note"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={2} />
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* S3-4: Reminder Picker */}
          <AnimatePresence>
            {showReminderPicker && (
              <motion.div
                className="px-3 pb-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className={cn(
                  'flex flex-wrap gap-1.5 rounded-lg p-2',
                  isDark ? 'bg-white/[0.03]' : 'bg-black/[0.02]'
                )}>
                  {REMINDER_OPTIONS.map((option) => (
                    <button
                      key={option.minutes}
                      type="button"
                      onClick={() => handleSetReminder(option.minutes)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium',
                        'border transition-all',
                        isDark
                          ? 'border-white/[0.1] text-[#8b94b2] hover:border-[rgba(29,217,180,0.28)] hover:text-[#1dd9b4] hover:bg-[rgba(29,217,180,0.08)]'
                          : 'border-black/[0.08] text-[#444d6e] hover:border-[rgba(20,184,150,0.25)] hover:text-[#14b896] hover:bg-[rgba(20,184,150,0.06)]'
                      )}
                    >
                      <Clock className="w-2.5 h-2.5" strokeWidth={2} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// ============================================================================
// Detail Action Button
// ============================================================================

interface DetailActionButtonProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly variant: 'go' | 'star' | 'copy' | 'note' | 'reminder';
  readonly isActive?: boolean;
  readonly isDark: boolean;
  readonly disabled?: boolean;
}

const DetailActionButton = memo(function DetailActionButton({
  icon,
  label,
  onClick,
  variant,
  isActive = false,
  isDark,
  disabled = false,
}: DetailActionButtonProps): React.JSX.Element {
  const getVariantClasses = (): string => {
    if (disabled) {
      return isDark ? 'opacity-40 cursor-not-allowed' : 'opacity-40 cursor-not-allowed';
    }
    
    switch (variant) {
      case 'go':
        return isDark
          ? 'hover:bg-[rgba(29,217,180,0.12)] hover:border-[rgba(29,217,180,0.28)] hover:text-[#1dd9b4]'
          : 'hover:bg-[rgba(20,184,150,0.1)] hover:border-[rgba(20,184,150,0.25)] hover:text-[#14b896]';
      case 'star':
        return isActive
          ? 'bg-[rgba(249,226,175,0.12)] border-[rgba(249,226,175,0.3)] text-[#f9e2af]'
          : isDark
            ? 'hover:bg-[rgba(249,226,175,0.12)] hover:border-[rgba(249,226,175,0.3)] hover:text-[#f9e2af]'
            : 'hover:bg-[rgba(124,85,0,0.1)] hover:border-[rgba(124,85,0,0.25)] hover:text-[#7c5500]';
      case 'copy':
        return isActive
          ? 'bg-[rgba(29,217,180,0.12)] border-[rgba(29,217,180,0.28)] text-[#1dd9b4]'
          : isDark
            ? 'hover:bg-[rgba(29,217,180,0.12)] hover:border-[rgba(29,217,180,0.28)] hover:text-[#1dd9b4]'
            : 'hover:bg-[rgba(20,184,150,0.1)] hover:border-[rgba(20,184,150,0.25)] hover:text-[#14b896]';
      case 'note':
        return isActive
          ? 'bg-[rgba(122,162,247,0.12)] border-[rgba(122,162,247,0.3)] text-[#7aa2f7]'
          : isDark
            ? 'hover:bg-[rgba(122,162,247,0.12)] hover:border-[rgba(122,162,247,0.3)] hover:text-[#7aa2f7]'
            : 'hover:bg-[rgba(49,101,192,0.1)] hover:border-[rgba(49,101,192,0.25)] hover:text-[#3165c0]';
      case 'reminder':
        return isActive
          ? 'bg-[rgba(255,158,100,0.12)] border-[rgba(255,158,100,0.3)] text-[#ff9e64]'
          : isDark
            ? 'hover:bg-[rgba(255,158,100,0.12)] hover:border-[rgba(255,158,100,0.3)] hover:text-[#ff9e64]'
            : 'hover:bg-[rgba(192,64,0,0.1)] hover:border-[rgba(192,64,0,0.25)] hover:text-[#c04000]';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'w-[26px] h-[26px] rounded-[7px] border transition-all duration-150',
          isDark
            ? 'border-white/[0.07] text-[#4e5578]'
            : 'border-black/[0.06] text-[#8890ab]',
          getVariantClasses()
        )}
        onClick={onClick}
        title={disabled ? `${label} (Pro)` : label}
        disabled={disabled}
      >
        {icon}
      </Button>
      <span
        className={cn(
          'text-[7px] font-medium tracking-wide uppercase',
          isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
        )}
      >
        {label}
      </span>
    </div>
  );
});

export default DetailPanel;
