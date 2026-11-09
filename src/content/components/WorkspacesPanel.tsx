/**
 * WorkspacesPanel Component (S3-1 + S4-1)
 *
 * Panel for saving and restoring tab workspaces.
 * S4-1: Enhanced with Project Workspaces (named projects with emoji + color).
 * Pro feature - requires isPro check.
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Plus, Trash2, RotateCcw, X, Crown, Edit2, Check, Briefcase, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { useBTab, useSettings, useTabs, useIsPro, isDarkTheme } from '../BTabContext';
import type { Workspace, WorkspaceTab } from '@/lib/db';
import { getWorkspaces, saveWorkspace, deleteWorkspace, updateWorkspace } from '@/lib/db';
import { ext } from '@/lib/browsers';
import { cn } from '../ui/cn';

// ============================================================================
// Types
// ============================================================================

interface WorkspacesPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

// S4-1: Project color options
const PROJECT_COLORS = [
  { id: 'teal', color: '#1dd9b4', label: 'Teal' },
  { id: 'red', color: '#f7768e', label: 'Red' },
  { id: 'orange', color: '#ff9e64', label: 'Orange' },
  { id: 'gold', color: '#f9e2af', label: 'Gold' },
  { id: 'green', color: '#9ece6a', label: 'Green' },
  { id: 'blue', color: '#7aa2f7', label: 'Blue' },
  { id: 'purple', color: '#bb9af7', label: 'Purple' },
  { id: 'pink', color: '#f5c2e7', label: 'Pink' },
] as const;

// S4-1: Project emoji options
const PROJECT_EMOJIS = ['📁', '🚀', '💼', '🔧', '🎨', '📊', '🔬', '📱', '🌐', '⚡', '🎯', '📝'];

// ============================================================================
// Helpers
// ============================================================================

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}

// ============================================================================
// Component
// ============================================================================

export const WorkspacesPanel = memo(function WorkspacesPanel({
  isOpen,
  onClose,
}: WorkspacesPanelProps): React.JSX.Element {
  const { actions } = useBTab();
  const settings = useSettings();
  const tabs = useTabs();
  const isPro = useIsPro();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // S4-1: Project creation state
  const [showProjectMode, setShowProjectMode] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState('📁');
  const [selectedColor, setSelectedColor] = useState<string>('#1dd9b4');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'default' | 'project'>('all');
  
  // Refs for dropdown positioning
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const colorButtonRef = useRef<HTMLButtonElement>(null);
  
  // Expanded workspace to show/edit tabs
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isDark = isDarkTheme(settings.theme);

  // Load workspaces
  useEffect(() => {
    if (!isOpen) return;

    const loadWorkspaces = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const ws = await getWorkspaces();
        // Sort by updatedAt descending
        ws.sort((a, b) => b.updatedAt - a.updatedAt);
        setWorkspaces(ws);
      } catch (e) {
        console.warn('[bTab] Failed to load workspaces:', e);
      } finally {
        setIsLoading(false);
      }
    };

    void loadWorkspaces();
  }, [isOpen]);

  // Filter workspaces by type
  const filteredWorkspaces = workspaces.filter((ws) => {
    if (filterType === 'all') return true;
    return ws.type === filterType;
  });

  // Save current tabs as workspace
  const handleSave = useCallback(async () => {
    if (!newName.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const wsTabs: WorkspaceTab[] = tabs.map((t) => ({
        url: t.url,
        title: t.title,
        favIconUrl: t.favIconUrl,
        pinned: t.pinned,
      }));

      const ws = await saveWorkspace({
        name: newName.trim(),
        type: showProjectMode ? 'project' : 'default',
        emoji: showProjectMode ? selectedEmoji : undefined,
        color: showProjectMode ? selectedColor : undefined,
        tabs: wsTabs,
      });

      setWorkspaces((prev) => [ws, ...prev]);
      setNewName('');
      setShowProjectMode(false);
      setShowEmojiPicker(false);
      setShowColorPicker(false);
      setToastMessage(`Saved "${ws.name}" (${ws.tabs.length} tabs)`);
      setTimeout(() => setToastMessage(null), 2000);
    } catch (e) {
      console.warn('[bTab] Failed to save workspace:', e);
    } finally {
      setIsSaving(false);
    }
  }, [newName, tabs, isSaving, showProjectMode, selectedEmoji, selectedColor]);

  // Restore workspace - send messages to background script
  const handleRestore = useCallback(async (workspace: Workspace) => {
    try {
      let successCount = 0;
      for (const tab of workspace.tabs) {
        const response = await ext.runtime.sendMessage({
          action: 'createTab',
          url: tab.url,
          pinned: tab.pinned,
          active: false,
        }) as { success: boolean };
        if (response?.success) successCount++;
      }

      setToastMessage(`Restored "${workspace.name}" (${successCount} tabs)`);
      setTimeout(() => setToastMessage(null), 2000);
    } catch (e) {
      console.warn('[bTab] Failed to restore workspace:', e);
      setToastMessage('Failed to restore workspace');
      setTimeout(() => setToastMessage(null), 2000);
    }
  }, []);

  // Delete workspace
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteWorkspace(id);
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      setToastMessage('Workspace deleted');
      setTimeout(() => setToastMessage(null), 2000);
    } catch (e) {
      console.warn('[bTab] Failed to delete workspace:', e);
    }
  }, []);

  // Start editing
  const handleStartEdit = useCallback((workspace: Workspace) => {
    setEditingId(workspace.id);
    setEditingName(workspace.name);
  }, []);

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      const updated = await updateWorkspace(editingId, { name: editingName.trim() });
      if (updated) {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === editingId ? updated : w))
        );
      }
      setEditingId(null);
      setEditingName('');
    } catch (e) {
      console.warn('[bTab] Failed to update workspace:', e);
    }
  }, [editingId, editingName]);

  // Remove a single tab from workspace
  const handleRemoveTab = useCallback(async (workspaceId: string, tabIndex: number) => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (!ws) return;
    
    const newTabs = ws.tabs.filter((_, i) => i !== tabIndex);
    if (newTabs.length === 0) {
      // If no tabs left, delete the workspace
      await handleDelete(workspaceId);
      return;
    }
    
    try {
      const updated = await updateWorkspace(workspaceId, { tabs: newTabs });
      if (updated) {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === workspaceId ? updated : w))
        );
        setToastMessage('Tab removed');
        setTimeout(() => setToastMessage(null), 2000);
      }
    } catch (e) {
      console.warn('[bTab] Failed to remove tab:', e);
    }
  }, [workspaces, handleDelete]);

  // Add current tabs to existing workspace
  const handleAddCurrentTabs = useCallback(async (workspaceId: string) => {
    const ws = workspaces.find((w) => w.id === workspaceId);
    if (!ws) return;
    
    const newTabs: WorkspaceTab[] = tabs.map((t) => ({
      url: t.url,
      title: t.title,
      favIconUrl: t.favIconUrl,
      pinned: t.pinned,
    }));
    
    // Merge, avoiding exact URL duplicates
    const existingUrls = new Set(ws.tabs.map((t) => t.url));
    const tabsToAdd = newTabs.filter((t) => !existingUrls.has(t.url));
    
    if (tabsToAdd.length === 0) {
      setToastMessage('All tabs already in workspace');
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }
    
    try {
      const updated = await updateWorkspace(workspaceId, { 
        tabs: [...ws.tabs, ...tabsToAdd] 
      });
      if (updated) {
        setWorkspaces((prev) =>
          prev.map((w) => (w.id === workspaceId ? updated : w))
        );
        setToastMessage(`Added ${tabsToAdd.length} tabs`);
        setTimeout(() => setToastMessage(null), 2000);
      }
    } catch (e) {
      console.warn('[bTab] Failed to add tabs:', e);
    }
  }, [workspaces, tabs]);

  // Restore single tab
  const handleRestoreSingleTab = useCallback(async (tab: WorkspaceTab) => {
    try {
      const response = await ext.runtime.sendMessage({
        action: 'createTab',
        url: tab.url,
        pinned: tab.pinned,
        active: true,
      }) as { success: boolean };
      
      if (response?.success) {
        setToastMessage('Tab opened');
        setTimeout(() => setToastMessage(null), 2000);
      }
    } catch (e) {
      console.warn('[bTab] Failed to open tab:', e);
    }
  }, []);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingId) {
          setEditingId(null);
          setEditingName('');
        } else if (showEmojiPicker || showColorPicker) {
          setShowEmojiPicker(false);
          setShowColorPicker(false);
        } else if (isOpen) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, editingId, showEmojiPicker, showColorPicker]);

  // Click-outside handler for dropdowns
  useEffect(() => {
    if (!showEmojiPicker && !showColorPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      
      // Check if click is inside emoji button or dropdown
      if (showEmojiPicker && emojiButtonRef.current) {
        const emojiDropdown = emojiButtonRef.current.nextElementSibling;
        if (
          !emojiButtonRef.current.contains(target) &&
          (!emojiDropdown || !emojiDropdown.contains(target))
        ) {
          setShowEmojiPicker(false);
        }
      }
      
      // Check if click is inside color button or dropdown
      if (showColorPicker && colorButtonRef.current) {
        const colorDropdown = colorButtonRef.current.nextElementSibling;
        if (
          !colorButtonRef.current.contains(target) &&
          (!colorDropdown || !colorDropdown.contains(target))
        ) {
          setShowColorPicker(false);
        }
      }
    };

    // Use setTimeout to avoid immediate trigger from the opening click
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [showEmojiPicker, showColorPicker]);

  if (!isOpen) return <></>;

  // Pro feature gate
  if (!isPro) {
    return (
      <motion.div
        className={cn(
          'flex flex-col gap-2 p-2.5 shrink-0 border-b',
          isDark
            ? 'bg-[rgba(16,20,36,0.95)] border-white/[0.07]'
            : 'bg-[rgba(248,250,252,1)] border-black/[0.06]'
        )}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <FolderOpen
              className={cn('w-3.5 h-3.5', isDark ? 'text-[#9ece6a]' : 'text-[#40a030]')}
              strokeWidth={2}
            />
            <span className={cn('text-xs font-semibold', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
              Workspaces
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-5 h-5 rounded p-0',
              isDark
                ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
            )}
            onClick={onClose}
          >
            <X className="w-3 h-3" strokeWidth={2} />
          </Button>
        </div>

        <div
          className={cn(
            'flex flex-col items-center gap-2 p-4 rounded-lg border',
            isDark
              ? 'bg-[rgba(249,226,175,0.06)] border-[rgba(249,226,175,0.15)]'
              : 'bg-[rgba(249,226,175,0.1)] border-[rgba(249,226,175,0.2)]'
          )}
        >
          <Crown className="w-6 h-6 text-[#f9e2af]" strokeWidth={2} />
          <div className={cn('text-xs font-medium text-center', isDark ? 'text-[#f9e2af]' : 'text-[#a08020]')}>
            Workspaces is a Pro feature
          </div>
          <div className={cn('text-[10px] text-center', isDark ? 'text-[#8b94b2]' : 'text-[#666]')}>
            Save and restore tab sessions anytime
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        'flex flex-col shrink-0 border-b max-h-[340px]',
        isDark
          ? 'bg-[rgba(16,20,36,0.95)] border-white/[0.07]'
          : 'bg-[rgba(248,250,252,1)] border-black/[0.06]'
      )}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Non-scrollable top section with dropdowns */}
      <div className="flex flex-col gap-2 p-2.5 pb-0 overflow-visible">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <FolderOpen
            className={cn('w-3.5 h-3.5', isDark ? 'text-[#9ece6a]' : 'text-[#40a030]')}
            strokeWidth={2}
          />
          <span className={cn('text-xs font-semibold', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
            Workspaces
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* S4-1: Filter tabs */}
          <div className="flex gap-0.5">
            {(['all', 'default', 'project'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  'px-1.5 py-0.5 text-[9px] rounded font-medium transition-colors',
                  filterType === type
                    ? 'bg-[rgba(29,217,180,0.12)] text-[#1dd9b4]'
                    : isDark
                      ? 'text-[#4e5578] hover:text-[#8b94b2]'
                      : 'text-[#8890ab] hover:text-[#444d6e]'
                )}
              >
                {type === 'all' ? 'All' : type === 'default' ? 'Quick' : 'Projects'}
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-5 h-5 rounded p-0',
              isDark
                ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
            )}
            onClick={onClose}
          >
            <X className="w-3 h-3" strokeWidth={2} />
          </Button>
        </div>
      </div>

      {/* S4-1: Mode Toggle (Quick Save vs Project) */}
      <div className="flex gap-1">
        <button
          onClick={() => setShowProjectMode(false)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
            !showProjectMode
              ? 'bg-[rgba(29,217,180,0.12)] border-[rgba(29,217,180,0.28)] text-[#1dd9b4]'
              : isDark
                ? 'border-white/[0.07] text-[#4e5578] hover:border-white/[0.12]'
                : 'border-black/[0.06] text-[#8890ab] hover:border-black/[0.1]'
          )}
        >
          <Plus className="w-3 h-3" />
          Quick Save
        </button>
        <button
          onClick={() => setShowProjectMode(true)}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
            showProjectMode
              ? 'bg-[rgba(122,162,247,0.12)] border-[rgba(122,162,247,0.28)] text-[#7aa2f7]'
              : isDark
                ? 'border-white/[0.07] text-[#4e5578] hover:border-white/[0.12]'
                : 'border-black/[0.06] text-[#8890ab] hover:border-black/[0.1]'
          )}
        >
          <Briefcase className="w-3 h-3" />
          New Project
        </button>
      </div>

      {/* Save Form - overflow visible for dropdowns */}
      <div className="flex flex-col gap-2 overflow-visible">
        <div className="flex gap-2 overflow-visible">
          {/* S4-1: Emoji picker button (only for projects) */}
          {showProjectMode && (
            <div className="relative">
              <button
                ref={emojiButtonRef}
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker);
                  setShowColorPicker(false);
                }}
                className={cn(
                  'w-9 h-9 rounded-lg border flex items-center justify-center text-lg',
                  isDark
                    ? 'bg-white/[0.02] border-white/[0.12] hover:border-white/[0.2]'
                    : 'bg-black/[0.02] border-black/[0.1] hover:border-black/[0.15]'
                )}
              >
                {selectedEmoji}
              </button>
              
              {/* Emoji Picker Dropdown */}
              {showEmojiPicker && (
                <div
                  className={cn(
                    'absolute top-full left-0 mt-1 z-[9999] p-1.5 rounded-lg border shadow-lg',
                    isDark
                      ? 'bg-[rgba(16,20,36,0.98)] border-white/[0.12]'
                      : 'bg-white border-black/[0.1]'
                  )}
                >
                  <div className="grid grid-cols-6 gap-0.5">
                    {PROJECT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setSelectedEmoji(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className={cn(
                          'w-7 h-7 rounded flex items-center justify-center text-base',
                          'hover:bg-[rgba(29,217,180,0.12)]',
                          selectedEmoji === emoji && 'bg-[rgba(29,217,180,0.2)]'
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Name Input */}
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={showProjectMode ? 'Project name...' : 'Workspace name...'}
            className={cn(
              'flex-1 px-3 py-2 rounded-lg border text-xs outline-none transition-colors',
              isDark
                ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff] placeholder:text-[#4e5578]'
                : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226] placeholder:text-[#8890ab]',
              'focus:border-[rgba(29,217,180,0.28)]'
            )}
          />

          {/* S4-1: Color picker button (only for projects) */}
          {showProjectMode && (
            <div className="relative">
              <button
                ref={colorButtonRef}
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowEmojiPicker(false);
                }}
                className={cn(
                  'w-9 h-9 rounded-lg border flex items-center justify-center',
                  isDark
                    ? 'bg-white/[0.02] border-white/[0.12] hover:border-white/[0.2]'
                    : 'bg-black/[0.02] border-black/[0.1] hover:border-black/[0.15]'
                )}
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedColor }}
                />
              </button>
              
              {/* Color Picker Dropdown */}
              {showColorPicker && (
                <div
                  className={cn(
                    'absolute top-full right-0 mt-1 z-[9999] p-2 rounded-lg border shadow-lg w-[152px]',
                    isDark
                      ? 'bg-[rgba(16,20,36,0.98)] border-white/[0.12]'
                      : 'bg-white border-black/[0.1]'
                  )}
                >
                  <div className="grid grid-cols-4 gap-1.5">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedColor(c.color);
                          setShowColorPicker(false);
                        }}
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center',
                          'hover:bg-white/[0.1] transition-colors',
                          selectedColor === c.color && 'ring-2 ring-[#1dd9b4] ring-offset-1 ring-offset-transparent'
                        )}
                        title={c.label}
                      >
                        <div
                          className="w-5 h-5 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!newName.trim() || isSaving}
            className={cn(
              'px-3 py-2 rounded-lg text-xs font-medium',
              showProjectMode
                ? 'bg-[rgba(122,162,247,0.12)] border border-[rgba(122,162,247,0.28)] text-[#7aa2f7] hover:bg-[rgba(122,162,247,0.2)]'
                : 'bg-[rgba(29,217,180,0.12)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4] hover:bg-[rgba(29,217,180,0.2)]',
              'disabled:opacity-50'
            )}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Save ({tabs.length})
          </Button>
        </div>
      </div>
      </div>
      {/* End non-scrollable section */}

      {/* Scrollable Workspaces List */}
      <div className="flex-1 overflow-y-auto p-2.5 pt-2 flex flex-col gap-2">
      {isLoading ? (
        <div className={cn('text-xs text-center py-4', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
          Loading...
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className={cn('text-xs text-center py-4', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
          {filterType === 'all' ? 'No saved workspaces' : `No ${filterType === 'project' ? 'projects' : 'quick saves'}`}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {filteredWorkspaces.map((ws) => (
            <div
              key={ws.id}
              className={cn(
                'flex flex-col rounded-lg border',
                isDark
                  ? 'bg-white/[0.02] border-white/[0.07]'
                  : 'bg-black/[0.02] border-black/[0.06]'
              )}
              style={ws.type === 'project' && ws.color ? {
                borderLeftWidth: 3,
                borderLeftColor: ws.color,
              } : undefined}
            >
              {/* Workspace Header Row */}
              <div className="flex items-center gap-2 p-2">
                {/* Expand/Collapse Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'w-5 h-5 p-0 rounded shrink-0',
                    isDark
                      ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                      : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
                  )}
                  onClick={() => setExpandedId(expandedId === ws.id ? null : ws.id)}
                  title={expandedId === ws.id ? 'Collapse' : 'Expand to see tabs'}
                >
                  {expandedId === ws.id ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </Button>
                
                {/* S4-1: Emoji for projects */}
                {ws.type === 'project' && ws.emoji && (
                  <span className="text-base">{ws.emoji}</span>
                )}
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {editingId === ws.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                        className={cn(
                          'flex-1 px-2 py-1 rounded border text-xs outline-none',
                          isDark
                            ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff]'
                            : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226]'
                        )}
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-5 h-5 p-0 text-[#1dd9b4]"
                        onClick={handleSaveEdit}
                      >
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <span
                          className={cn(
                            'text-xs font-medium truncate',
                            isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
                          )}
                        >
                          {ws.name}
                        </span>
                        {/* S4-1: Project badge */}
                        {ws.type === 'project' && (
                          <span
                            className={cn(
                              'text-[8px] font-bold px-1 py-0.5 rounded uppercase',
                              'bg-[rgba(122,162,247,0.12)] text-[#7aa2f7]'
                            )}
                          >
                            PROJECT
                          </span>
                        )}
                      </div>
                      <div className={cn('text-[10px]', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
                        {ws.tabs.length} tabs · {formatDate(ws.updatedAt)}
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                {editingId !== ws.id && (
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'w-6 h-6 p-0 rounded',
                        isDark
                          ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                          : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
                      )}
                      onClick={() => handleStartEdit(ws)}
                      title="Rename"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'w-6 h-6 p-0 rounded',
                        'text-[#9ece6a] hover:bg-[rgba(158,206,106,0.12)]'
                      )}
                      onClick={() => handleAddCurrentTabs(ws.id)}
                      title="Add current tabs to workspace"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'w-6 h-6 p-0 rounded',
                        'text-[#1dd9b4] hover:bg-[rgba(29,217,180,0.12)]'
                      )}
                      onClick={() => handleRestore(ws)}
                      title="Restore all tabs"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'w-6 h-6 p-0 rounded',
                        'text-[#f7768e] hover:bg-[rgba(247,118,142,0.12)]'
                      )}
                      onClick={() => handleDelete(ws.id)}
                      title="Delete workspace"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Expanded Tab List */}
              <AnimatePresence>
                {expandedId === ws.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div 
                      className={cn(
                        'border-t mx-2 mb-2 pt-2 flex flex-col gap-1 max-h-[150px] overflow-y-auto',
                        isDark ? 'border-white/[0.05]' : 'border-black/[0.04]'
                      )}
                    >
                      {ws.tabs.map((tab, idx) => (
                        <div
                          key={`${ws.id}-tab-${idx}`}
                          className={cn(
                            'flex items-center gap-2 px-2 py-1.5 rounded-md group/tab',
                            isDark 
                              ? 'hover:bg-white/[0.03]' 
                              : 'hover:bg-black/[0.02]'
                          )}
                        >
                          {/* Favicon */}
                          {tab.favIconUrl ? (
                            <img 
                              src={tab.favIconUrl} 
                              alt="" 
                              className="w-4 h-4 rounded shrink-0"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className={cn(
                              'w-4 h-4 rounded shrink-0 flex items-center justify-center text-[8px] font-bold',
                              isDark ? 'bg-white/[0.1] text-white/50' : 'bg-black/[0.1] text-black/50'
                            )}>
                              {tab.title?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          
                          {/* Title */}
                          <span 
                            className={cn(
                              'flex-1 text-[10px] truncate',
                              isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]'
                            )}
                            title={tab.url}
                          >
                            {tab.title || tab.url}
                          </span>
                          
                          {/* Tab Actions */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/tab:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'w-5 h-5 p-0 rounded',
                                'text-[#1dd9b4] hover:bg-[rgba(29,217,180,0.12)]'
                              )}
                              onClick={() => handleRestoreSingleTab(tab)}
                              title="Open this tab"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                'w-5 h-5 p-0 rounded',
                                'text-[#f7768e] hover:bg-[rgba(247,118,142,0.12)]'
                              )}
                              onClick={() => handleRemoveTab(ws.id, idx)}
                              title="Remove from workspace"
                            >
                              <X className="w-2.5 h-2.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
      </div>
      {/* End scrollable section */}

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            className={cn(
              'fixed bottom-20 left-1/2 -translate-x-1/2 z-[2147483647]',
              'px-4 py-2 rounded-full whitespace-nowrap pointer-events-none',
              'text-xs font-semibold',
              'bg-[rgba(29,217,180,0.95)] text-white shadow-lg',
              'border border-[rgba(255,255,255,0.2)]'
            )}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default WorkspacesPanel;
