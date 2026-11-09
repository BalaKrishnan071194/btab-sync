/**
 * SettingsPanel Component (S2-2, S2-4, S5-2)
 *
 * Settings panel with tabs for General, Exceptions, Automation, and License.
 * Pro feature - requires isPro check.
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Shield, Zap, X, Plus, Trash2, ArrowLeft, Key, Crown, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { useSettings, useIsPro, isDarkTheme } from '../BTabContext';
import { ext } from '@/lib/browsers';
import { cn } from '../ui/cn';
import { 
  activateLicense, 
  deactivateLicense, 
  getLicenseInfo, 
  formatLicenseKey,
  formatExpiryDate,
  type LicenseInfo 
} from '@/lib/license';

// ============================================================================
// Types
// ============================================================================

interface SettingsPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

type SettingsTab = 'general' | 'exceptions' | 'automation' | 'license';

interface AutomationRule {
  id: string;
  condition: 'memory_gt' | 'idle_gt' | 'domain_is';
  value: string;
  action: 'sleep' | 'close' | 'notify';
  enabled: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const SettingsPanel = memo(function SettingsPanel({
  isOpen,
  onClose,
}: SettingsPanelProps): React.JSX.Element {
  const settings = useSettings();
  const isPro = useIsPro();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // General settings
  const [autoSuspendEnabled, setAutoSuspendEnabled] = useState(false);
  const [autoSuspendIdleMinutes, setAutoSuspendIdleMinutes] = useState(30);

  // Exceptions
  const [exceptions, setExceptions] = useState<string[]>([]);
  const [newException, setNewException] = useState('');

  // Automation rules
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [newRule, setNewRule] = useState<Omit<AutomationRule, 'id' | 'enabled'>>({
    condition: 'idle_gt',
    value: '60',
    action: 'sleep',
  });

  const isDark = isDarkTheme(settings.theme);

  // Load settings on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadSettings = async (): Promise<void> => {
      try {
        const stored = await ext.storage.local.get([
          'autoSuspendEnabled',
          'autoSuspendIdleMinutes',
          'autoSuspendExceptions',
          'automationRules',
        ]);

        setAutoSuspendEnabled(stored['autoSuspendEnabled'] === true);
        setAutoSuspendIdleMinutes((stored['autoSuspendIdleMinutes'] as number) || 30);
        setExceptions((stored['autoSuspendExceptions'] as string[]) || []);
        setRules((stored['automationRules'] as AutomationRule[]) || []);
      } catch (e) {
        console.warn('[bTab] Failed to load settings:', e);
      }
    };

    void loadSettings();
  }, [isOpen]);

  // Save auto-suspend settings
  const saveAutoSuspendSettings = useCallback(async (enabled: boolean, minutes: number) => {
    try {
      await ext.storage.local.set({
        autoSuspendEnabled: enabled,
        autoSuspendIdleMinutes: minutes,
      });
    } catch (e) {
      console.warn('[bTab] Failed to save auto-suspend settings:', e);
    }
  }, []);

  // Handle auto-suspend toggle
  const handleAutoSuspendToggle = useCallback((enabled: boolean) => {
    setAutoSuspendEnabled(enabled);
    void saveAutoSuspendSettings(enabled, autoSuspendIdleMinutes);
  }, [autoSuspendIdleMinutes, saveAutoSuspendSettings]);

  // Handle idle minutes change
  const handleIdleMinutesChange = useCallback((minutes: number) => {
    setAutoSuspendIdleMinutes(minutes);
    void saveAutoSuspendSettings(autoSuspendEnabled, minutes);
  }, [autoSuspendEnabled, saveAutoSuspendSettings]);

  // Add exception
  const handleAddException = useCallback(async () => {
    if (!newException.trim()) return;

    const domain = newException.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (exceptions.includes(domain)) return;

    const newList = [...exceptions, domain];
    setExceptions(newList);
    setNewException('');

    try {
      await ext.storage.local.set({ autoSuspendExceptions: newList });
    } catch (e) {
      console.warn('[bTab] Failed to save exceptions:', e);
    }
  }, [newException, exceptions]);

  // Remove exception
  const handleRemoveException = useCallback(async (domain: string) => {
    const newList = exceptions.filter((e) => e !== domain);
    setExceptions(newList);

    try {
      await ext.storage.local.set({ autoSuspendExceptions: newList });
    } catch (e) {
      console.warn('[bTab] Failed to save exceptions:', e);
    }
  }, [exceptions]);

  // Add automation rule
  const handleAddRule = useCallback(async () => {
    if (rules.length >= 10) return;

    const rule: AutomationRule = {
      id: Date.now().toString(),
      ...newRule,
      enabled: true,
    };

    const newList = [...rules, rule];
    setRules(newList);

    try {
      await ext.storage.local.set({ automationRules: newList });
    } catch (e) {
      console.warn('[bTab] Failed to save rules:', e);
    }
  }, [newRule, rules]);

  // Remove automation rule
  const handleRemoveRule = useCallback(async (id: string) => {
    const newList = rules.filter((r) => r.id !== id);
    setRules(newList);

    try {
      await ext.storage.local.set({ automationRules: newList });
    } catch (e) {
      console.warn('[bTab] Failed to save rules:', e);
    }
  }, [rules]);

  // Toggle rule enabled
  const handleToggleRule = useCallback(async (id: string) => {
    const newList = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    setRules(newList);

    try {
      await ext.storage.local.set({ automationRules: newList });
    } catch (e) {
      console.warn('[bTab] Failed to save rules:', e);
    }
  }, [rules]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return <></>;

  const tabs: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'exceptions', label: 'Exceptions', icon: Shield },
    { id: 'automation', label: 'Automation', icon: Zap },
    { id: 'license', label: 'License', icon: Key },
  ];

  return (
    <motion.div
      className={cn(
        'absolute inset-0 flex flex-col z-50 rounded-2xl overflow-hidden',
        isDark
          ? 'bg-[rgba(8,10,22,0.98)]'
          : 'bg-[rgba(255,255,255,0.98)]'
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b',
          isDark ? 'border-white/[0.07]' : 'border-black/[0.06]'
        )}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'w-7 h-7 rounded-lg',
              isDark
                ? 'text-[#8b94b2] hover:text-[#edf0ff] hover:bg-white/[0.05]'
                : 'text-[#444d6e] hover:text-[#0e1226] hover:bg-black/[0.03]'
            )}
            onClick={onClose}
            title="Back to tabs"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span
            className={cn(
              'text-sm font-semibold',
              isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
            )}
          >
            Settings
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'w-6 h-6 rounded',
            isDark
              ? 'text-[#4e5578] hover:text-[#edf0ff] hover:bg-white/[0.05]'
              : 'text-[#8890ab] hover:text-[#0e1226] hover:bg-black/[0.03]'
          )}
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div
        className={cn(
          'flex border-b px-2',
          isDark ? 'border-white/[0.07]' : 'border-black/[0.06]'
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
              'border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-[#1dd9b4] text-[#1dd9b4]'
                : cn(
                    'border-transparent',
                    isDark
                      ? 'text-[#8b94b2] hover:text-[#edf0ff]'
                      : 'text-[#444d6e] hover:text-[#0e1226]'
                  )
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'general' && (
            <motion.div
              key="general"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              {/* Auto-Suspend Toggle */}
              <div
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  isDark
                    ? 'bg-white/[0.02] border-white/[0.07]'
                    : 'bg-black/[0.02] border-black/[0.06]'
                )}
              >
                <div>
                  <div
                    className={cn(
                      'text-xs font-medium',
                      isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
                    )}
                  >
                    Auto-Suspend Tabs
                  </div>
                  <div
                    className={cn(
                      'text-[10.5px] mt-0.5',
                      isDark ? 'text-[#4e5578]' : 'text-[#8890ab]'
                    )}
                  >
                    Automatically freeze idle tabs to save memory
                  </div>
                </div>
                <Switch
                  checked={autoSuspendEnabled}
                  onCheckedChange={handleAutoSuspendToggle}
                  disabled={!isPro}
                />
              </div>

              {/* Idle Minutes Slider */}
              <div
                className={cn(
                  'p-3 rounded-lg border',
                  isDark
                    ? 'bg-white/[0.02] border-white/[0.07]'
                    : 'bg-black/[0.02] border-black/[0.06]'
                )}
              >
                <div
                  className={cn(
                    'text-xs font-medium mb-2',
                    isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
                  )}
                >
                  Idle Threshold: {autoSuspendIdleMinutes} minutes
                </div>
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={autoSuspendIdleMinutes}
                  onChange={(e) => handleIdleMinutesChange(Number(e.target.value))}
                  disabled={!isPro || !autoSuspendEnabled}
                  className="w-full accent-[#1dd9b4]"
                />
                <div className="flex justify-between text-[10px] text-[#4e5578] mt-1">
                  <span>5 min</span>
                  <span>120 min</span>
                </div>
              </div>

              {!isPro && (
                <div className="text-center text-[11px] text-[#ff9e64] p-2">
                  Auto-suspend requires Pro
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'exceptions' && (
            <motion.div
              key="exceptions"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-3"
            >
              <div
                className={cn(
                  'text-[10.5px]',
                  isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]'
                )}
              >
                Tabs from these domains will never be auto-suspended.
              </div>

              {/* Add Exception */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newException}
                  onChange={(e) => setNewException(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddException()}
                  placeholder="example.com"
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg border text-xs',
                    'outline-none transition-colors',
                    isDark
                      ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff] placeholder:text-[#4e5578]'
                      : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226] placeholder:text-[#8890ab]',
                    'focus:border-[rgba(29,217,180,0.28)]'
                  )}
                />
                <Button
                  onClick={handleAddException}
                  disabled={!newException.trim() || !isPro}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-medium',
                    'bg-[rgba(29,217,180,0.12)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4]',
                    'hover:bg-[rgba(29,217,180,0.2)]',
                    'disabled:opacity-50'
                  )}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Exception Chips */}
              <div className="flex flex-wrap gap-2">
                {exceptions.map((domain) => (
                  <span
                    key={domain}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]',
                      isDark
                        ? 'bg-white/[0.05] text-[#edf0ff]'
                        : 'bg-black/[0.05] text-[#0e1226]'
                    )}
                  >
                    {domain}
                    <button
                      type="button"
                      onClick={() => handleRemoveException(domain)}
                      className="text-[#f7768e] hover:text-[#f7768e]/80"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {exceptions.length === 0 && (
                  <span className={cn('text-xs', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
                    No exceptions added
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'automation' && (
            <motion.div
              key="automation"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-3"
            >
              <div
                className={cn(
                  'text-[10.5px]',
                  isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]'
                )}
              >
                Create rules to automatically manage tabs (max 10 rules).
              </div>

              {/* Add Rule */}
              <div
                className={cn(
                  'p-3 rounded-lg border space-y-2',
                  isDark
                    ? 'bg-white/[0.02] border-white/[0.07]'
                    : 'bg-black/[0.02] border-black/[0.06]'
                )}
              >
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={newRule.condition}
                    onChange={(e) => setNewRule({ ...newRule, condition: e.target.value as AutomationRule['condition'] })}
                    className={cn(
                      'px-2 py-1.5 rounded text-[11px] border outline-none',
                      isDark
                        ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff]'
                        : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226]'
                    )}
                  >
                    <option value="idle_gt">Idle &gt;</option>
                    <option value="memory_gt">Memory &gt;</option>
                    <option value="domain_is">Domain contains</option>
                  </select>
                  <input
                    type="text"
                    value={newRule.value}
                    onChange={(e) => setNewRule({ ...newRule, value: e.target.value })}
                    placeholder={newRule.condition === 'domain_is' ? 'domain' : 'minutes'}
                    className={cn(
                      'w-20 px-2 py-1.5 rounded text-[11px] border outline-none',
                      isDark
                        ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff] placeholder:text-[#4e5578]'
                        : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226] placeholder:text-[#8890ab]'
                    )}
                  />
                  <span className={cn('text-[11px] py-1.5', isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]')}>
                    then
                  </span>
                  <select
                    value={newRule.action}
                    onChange={(e) => setNewRule({ ...newRule, action: e.target.value as AutomationRule['action'] })}
                    className={cn(
                      'px-2 py-1.5 rounded text-[11px] border outline-none',
                      isDark
                        ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff]'
                        : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226]'
                    )}
                  >
                    <option value="sleep">Sleep</option>
                    <option value="close">Close</option>
                    <option value="notify">Notify</option>
                  </select>
                  <Button
                    onClick={handleAddRule}
                    disabled={!newRule.value || rules.length >= 10 || !isPro}
                    className={cn(
                      'px-2 py-1.5 rounded text-[11px] font-medium',
                      'bg-[rgba(29,217,180,0.12)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4]',
                      'hover:bg-[rgba(29,217,180,0.2)]',
                      'disabled:opacity-50'
                    )}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Rules List */}
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg border',
                      isDark
                        ? 'bg-white/[0.02] border-white/[0.07]'
                        : 'bg-black/[0.02] border-black/[0.06]',
                      !rule.enabled && 'opacity-50'
                    )}
                  >
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggleRule(rule.id)}
                      className="scale-75"
                    />
                    <span
                      className={cn(
                        'flex-1 text-[11px]',
                        isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]'
                      )}
                    >
                      If{' '}
                      <span className="font-medium text-[#1dd9b4]">
                        {rule.condition === 'idle_gt'
                          ? `idle > ${rule.value} min`
                          : rule.condition === 'memory_gt'
                          ? `memory > ${rule.value} MB`
                          : `domain contains "${rule.value}"`}
                      </span>{' '}
                      then{' '}
                      <span className="font-medium text-[#ff9e64]">{rule.action}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(rule.id)}
                      className="text-[#f7768e] hover:text-[#f7768e]/80"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {rules.length === 0 && (
                  <span className={cn('text-xs', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
                    No rules created
                  </span>
                )}
              </div>

              {!isPro && (
                <div className="text-center text-[11px] text-[#ff9e64] p-2">
                  Automation rules require Pro
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'license' && (
            <LicenseTab isDark={isDark} isPro={isPro} />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});

// ============================================================================
// License Tab Component
// ============================================================================

interface LicenseTabProps {
  readonly isDark: boolean;
  readonly isPro: boolean;
}

function LicenseTab({ isDark, isPro }: LicenseTabProps): React.JSX.Element {
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load license info on mount
  useEffect(() => {
    const loadLicense = async () => {
      const info = await getLicenseInfo();
      setLicenseInfo(info);
    };
    void loadLicense();
  }, []);

  // Handle license activation
  const handleActivate = useCallback(async () => {
    if (!licenseKey.trim()) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const result = await activateLicense(licenseKey);

    if (result.success && result.license) {
      setLicenseInfo(result.license);
      setLicenseKey('');
      setSuccessMessage('License activated successfully!');
      // Reload to update isPro state
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setError(result.error || 'Failed to activate license');
    }

    setIsLoading(false);
  }, [licenseKey]);

  // Handle license deactivation
  const handleDeactivate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const success = await deactivateLicense();

    if (success) {
      setLicenseInfo(null);
      setSuccessMessage('License deactivated');
      // Reload to update isPro state
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setError('Failed to deactivate license');
    }

    setIsLoading(false);
  }, []);

  return (
    <motion.div
      key="license"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      className="space-y-4"
    >
      {/* Current Status */}
      <div
        className={cn(
          'p-4 rounded-lg border',
          isPro
            ? 'bg-[rgba(29,217,180,0.08)] border-[rgba(29,217,180,0.2)]'
            : isDark
              ? 'bg-white/[0.02] border-white/[0.07]'
              : 'bg-black/[0.02] border-black/[0.06]'
        )}
      >
        <div className="flex items-center gap-3">
          {isPro ? (
            <>
              <div className="w-10 h-10 rounded-full bg-[rgba(29,217,180,0.15)] flex items-center justify-center">
                <Crown className="w-5 h-5 text-[#1dd9b4]" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[#1dd9b4]">
                  Pro Active
                </div>
                <div className={cn('text-[11px]', isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]')}>
                  {licenseInfo?.expiresAt 
                    ? formatExpiryDate(licenseInfo.expiresAt)
                    : 'Lifetime license'
                  }
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                isDark ? 'bg-white/[0.05]' : 'bg-black/[0.05]'
              )}>
                <Key className={cn('w-5 h-5', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')} />
              </div>
              <div className="flex-1">
                <div className={cn('text-sm font-medium', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
                  Free Version
                </div>
                <div className={cn('text-[11px]', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
                  Enter a license key to unlock Pro features
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* License Info (when activated) */}
      {licenseInfo && (
        <div
          className={cn(
            'p-3 rounded-lg border space-y-2',
            isDark
              ? 'bg-white/[0.02] border-white/[0.07]'
              : 'bg-black/[0.02] border-black/[0.06]'
          )}
        >
          <div className="flex items-center justify-between">
            <span className={cn('text-[11px]', isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]')}>
              License Key
            </span>
            <span className={cn('text-[11px] font-mono', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
              {formatLicenseKey(licenseInfo.key)}
            </span>
          </div>
          {licenseInfo.email && (
            <div className="flex items-center justify-between">
              <span className={cn('text-[11px]', isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]')}>
                Email
              </span>
              <span className={cn('text-[11px]', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
                {licenseInfo.email}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className={cn('text-[11px]', isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]')}>
              Device
            </span>
            <span className={cn('text-[11px]', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
              {licenseInfo.deviceName}
            </span>
          </div>
          
          {/* Deactivate Button */}
          <Button
            onClick={handleDeactivate}
            disabled={isLoading}
            className={cn(
              'w-full mt-2 px-3 py-2 rounded-lg text-xs font-medium',
              'bg-[rgba(247,118,142,0.08)] border border-[rgba(247,118,142,0.2)] text-[#f7768e]',
              'hover:bg-[rgba(247,118,142,0.15)]',
              'disabled:opacity-50'
            )}
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            {isLoading ? 'Deactivating...' : 'Deactivate License'}
          </Button>
        </div>
      )}

      {/* Activate License (when not activated) */}
      {!licenseInfo && (
        <div
          className={cn(
            'p-3 rounded-lg border space-y-3',
            isDark
              ? 'bg-white/[0.02] border-white/[0.07]'
              : 'bg-black/[0.02] border-black/[0.06]'
          )}
        >
          <div>
            <label className={cn('text-[11px] font-medium block mb-1.5', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
              License Key
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
              placeholder="BTAB-XXXX-XXXX-XXXX"
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border text-xs font-mono',
                'outline-none transition-colors',
                isDark
                  ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff] placeholder:text-[#4e5578]'
                  : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226] placeholder:text-[#8890ab]',
                'focus:border-[rgba(29,217,180,0.28)]'
              )}
            />
          </div>

          <Button
            onClick={handleActivate}
            disabled={!licenseKey.trim() || isLoading}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg text-xs font-semibold',
              'bg-[rgba(29,217,180,0.12)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4]',
              'hover:bg-[rgba(29,217,180,0.2)]',
              'disabled:opacity-50'
            )}
          >
            {isLoading ? 'Activating...' : 'Activate License'}
          </Button>

          <div className={cn('text-center text-[10px]', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
            <a 
              href="https://btabsync.lemonsqueezy.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#1dd9b4] hover:underline"
            >
              Get a license key →
            </a>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[rgba(247,118,142,0.08)] border border-[rgba(247,118,142,0.2)]">
          <AlertCircle className="w-4 h-4 text-[#f7768e] shrink-0" />
          <span className="text-[11px] text-[#f7768e]">{error}</span>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[rgba(29,217,180,0.08)] border border-[rgba(29,217,180,0.2)]">
          <CheckCircle className="w-4 h-4 text-[#1dd9b4] shrink-0" />
          <span className="text-[11px] text-[#1dd9b4]">{successMessage}</span>
        </div>
      )}

      {/* Pro Features List */}
      <div
        className={cn(
          'p-3 rounded-lg border',
          isDark
            ? 'bg-white/[0.02] border-white/[0.07]'
            : 'bg-black/[0.02] border-black/[0.06]'
        )}
      >
        <div className={cn('text-[11px] font-medium mb-2', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
          Pro Features Include:
        </div>
        <ul className={cn('text-[10.5px] space-y-1.5', isDark ? 'text-[#8b94b2]' : 'text-[#444d6e]')}>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-[#1dd9b4]" />
            Smart duplicate detection (tracking params)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-[#1dd9b4]" />
            Auto-suspend idle tabs
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-[#1dd9b4]" />
            Memory dashboard
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-[#1dd9b4]" />
            Tab workspaces
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-[#1dd9b4]" />
            Time machine (30-day history)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle className="w-3 h-3 text-[#1dd9b4]" />
            Automation rules
          </li>
        </ul>
      </div>
    </motion.div>
  );
}

export default SettingsPanel;
