/**
 * EnvironmentSwitcher Component (S4-2)
 *
 * Shows environment mapping rules for dev/staging/prod URLs.
 * Displayed in detail panel for tabs that match rules.
 * Pro feature.
 */

import { memo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Plus, Trash2, X, Crown, Check, Globe, Server, Rocket } from 'lucide-react';
import { Button } from '../ui/button';
import { useSettings, useIsPro, isDarkTheme } from '../BTabContext';
import { ext } from '@/lib/browsers';
import { cn } from '../ui/cn';
import { validateEnvironmentSwitch } from '@/lib/urlSecurity';
import { TOAST_DURATION_MS } from '@/lib/constants';

// ============================================================================
// Types
// ============================================================================

interface EnvironmentSwitcherProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly currentUrl?: string;
}

interface EnvironmentRule {
  readonly id: string;
  readonly name: string;
  readonly envs: readonly EnvironmentMapping[];
}

interface EnvironmentMapping {
  readonly type: 'dev' | 'staging' | 'prod';
  readonly pattern: string;
  readonly label: string;
}

// ============================================================================
// Constants
// ============================================================================

const ENV_ICONS = {
  dev: Globe,
  staging: Server,
  prod: Rocket,
} as const;

const ENV_COLORS = {
  dev: '#9ece6a',
  staging: '#ff9e64',
  prod: '#f7768e',
} as const;

// ============================================================================
// Component
// ============================================================================

export const EnvironmentSwitcher = memo(function EnvironmentSwitcher({
  isOpen,
  onClose,
  currentUrl = '',
}: EnvironmentSwitcherProps): React.JSX.Element {
  const settings = useSettings();
  const isPro = useIsPro();

  const [rules, setRules] = useState<EnvironmentRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newDevPattern, setNewDevPattern] = useState('');
  const [newStagingPattern, setNewStagingPattern] = useState('');
  const [newProdPattern, setNewProdPattern] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isDark = isDarkTheme(settings.theme);

  // Load rules from storage
  useEffect(() => {
    if (!isOpen) return;

    const loadRules = async () => {
      setIsLoading(true);
      try {
        const stored = await ext.storage.local.get(['environmentRules']);
        const storedRules = (stored['environmentRules'] as EnvironmentRule[]) || [];
        setRules(storedRules);
      } catch (e) {
        console.warn('[bTab] Failed to load environment rules:', e);
      } finally {
        setIsLoading(false);
      }
    };

    void loadRules();
  }, [isOpen]);

  // Save rules to storage
  const saveRules = useCallback(async (newRules: EnvironmentRule[]) => {
    try {
      await ext.storage.local.set({ environmentRules: newRules });
      setRules(newRules);
    } catch (e) {
      console.warn('[bTab] Failed to save environment rules:', e);
    }
  }, []);

  // Add new rule
  const handleAddRule = useCallback(async () => {
    if (!newRuleName.trim()) return;

    const envs: EnvironmentMapping[] = [];
    if (newDevPattern.trim()) {
      envs.push({ type: 'dev', pattern: newDevPattern.trim(), label: 'Dev' });
    }
    if (newStagingPattern.trim()) {
      envs.push({ type: 'staging', pattern: newStagingPattern.trim(), label: 'Staging' });
    }
    if (newProdPattern.trim()) {
      envs.push({ type: 'prod', pattern: newProdPattern.trim(), label: 'Prod' });
    }

    if (envs.length < 2) {
      setToastMessage('Add at least 2 environments');
      setTimeout(() => setToastMessage(null), 2000);
      return;
    }

    const newRule: EnvironmentRule = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: newRuleName.trim(),
      envs,
    };

    await saveRules([...rules, newRule]);
    
    setNewRuleName('');
    setNewDevPattern('');
    setNewStagingPattern('');
    setNewProdPattern('');
    setShowAddRule(false);
    setToastMessage('Rule added');
    setTimeout(() => setToastMessage(null), 2000);
  }, [newRuleName, newDevPattern, newStagingPattern, newProdPattern, rules, saveRules]);

  // Delete rule
  const handleDeleteRule = useCallback(async (id: string) => {
    await saveRules(rules.filter(r => r.id !== id));
    setToastMessage('Rule deleted');
    setTimeout(() => setToastMessage(null), 2000);
  }, [rules, saveRules]);

  // Find matching rule and current environment
  const matchingRule = rules.find(rule => 
    rule.envs.some(env => currentUrl.includes(env.pattern))
  );
  const currentEnv = matchingRule?.envs.find(env => currentUrl.includes(env.pattern));

  // Switch to different environment - SECURITY: Validate URL before opening
  const handleSwitchEnv = useCallback((envMapping: EnvironmentMapping) => {
    if (!currentEnv || !matchingRule) return;

    // Get all allowed patterns from this rule for whitelist validation
    const allowedPatterns = matchingRule.envs.map(env => env.pattern);

    // SECURITY: Validate the URL transformation against whitelist
    const newUrl = validateEnvironmentSwitch(
      currentUrl,
      currentEnv.pattern,
      envMapping.pattern,
      allowedPatterns
    );

    if (!newUrl) {
      setToastMessage('⚠️ Invalid URL blocked');
      setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
      return;
    }

    window.open(newUrl, '_blank', 'noopener,noreferrer');
  }, [currentUrl, currentEnv, matchingRule]);

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
            <GitBranch className={cn('w-3.5 h-3.5', isDark ? 'text-[#ff9e64]' : 'text-[#c04000]')} strokeWidth={2} />
            <span className={cn('text-xs font-semibold', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
              Environment Switcher
            </span>
          </div>
          <Button variant="ghost" size="icon" className="w-5 h-5 rounded p-0" onClick={onClose}>
            <X className="w-3 h-3" strokeWidth={2} />
          </Button>
        </div>
        <div className={cn(
          'flex flex-col items-center gap-2 p-4 rounded-lg border',
          isDark ? 'bg-[rgba(249,226,175,0.06)] border-[rgba(249,226,175,0.15)]' : 'bg-[rgba(249,226,175,0.1)] border-[rgba(249,226,175,0.2)]'
        )}>
          <Crown className="w-6 h-6 text-[#f9e2af]" strokeWidth={2} />
          <div className={cn('text-xs font-medium text-center', isDark ? 'text-[#f9e2af]' : 'text-[#a08020]')}>
            Environment Switcher is a Pro feature
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(
        'flex flex-col gap-2 p-2.5 shrink-0 border-b max-h-[280px] overflow-y-auto',
        isDark
          ? 'bg-[rgba(16,20,36,0.95)] border-white/[0.07]'
          : 'bg-[rgba(248,250,252,1)] border-black/[0.06]'
      )}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <GitBranch className={cn('w-3.5 h-3.5', isDark ? 'text-[#ff9e64]' : 'text-[#c04000]')} strokeWidth={2} />
          <span className={cn('text-xs font-semibold', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
            Environment Switcher
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn('w-5 h-5 rounded p-0', isDark ? 'text-[#1dd9b4]' : 'text-[#14b896]')}
            onClick={() => setShowAddRule(!showAddRule)}
            title="Add rule"
          >
            <Plus className="w-3 h-3" strokeWidth={2} />
          </Button>
          <Button variant="ghost" size="icon" className="w-5 h-5 rounded p-0" onClick={onClose}>
            <X className="w-3 h-3" strokeWidth={2} />
          </Button>
        </div>
      </div>

      {/* Current URL match */}
      {matchingRule && currentEnv && (
        <div className={cn(
          'p-2 rounded-lg border',
          isDark ? 'bg-white/[0.02] border-white/[0.07]' : 'bg-black/[0.02] border-black/[0.06]'
        )}>
          <div className={cn('text-[10px] mb-1.5', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
            Current: {matchingRule.name}
          </div>
          <div className="flex gap-1">
            {matchingRule.envs.map((env) => {
              const Icon = ENV_ICONS[env.type];
              const isActive = env.type === currentEnv.type;
              return (
                <button
                  key={env.type}
                  onClick={() => !isActive && handleSwitchEnv(env)}
                  disabled={isActive}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium border transition-colors',
                    isActive
                      ? 'opacity-100 cursor-default'
                      : 'opacity-60 hover:opacity-100 cursor-pointer'
                  )}
                  style={{
                    backgroundColor: isActive ? `${ENV_COLORS[env.type]}15` : 'transparent',
                    borderColor: isActive ? `${ENV_COLORS[env.type]}40` : isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)',
                    color: ENV_COLORS[env.type],
                  }}
                >
                  <Icon className="w-3 h-3" strokeWidth={2} />
                  {env.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Rule Form */}
      <AnimatePresence>
        {showAddRule && (
          <motion.div
            className={cn(
              'p-2 rounded-lg border flex flex-col gap-2',
              isDark ? 'bg-white/[0.02] border-white/[0.12]' : 'bg-black/[0.02] border-black/[0.1]'
            )}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <input
              type="text"
              value={newRuleName}
              onChange={(e) => setNewRuleName(e.target.value)}
              placeholder="Rule name (e.g., My App)"
              className={cn(
                'px-2 py-1.5 rounded border text-xs outline-none',
                isDark ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff]' : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226]'
              )}
            />
            <input
              type="text"
              value={newDevPattern}
              onChange={(e) => setNewDevPattern(e.target.value)}
              placeholder="Dev pattern (e.g., localhost:3000)"
              className={cn(
                'px-2 py-1.5 rounded border text-xs outline-none',
                isDark ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff]' : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226]'
              )}
            />
            <input
              type="text"
              value={newStagingPattern}
              onChange={(e) => setNewStagingPattern(e.target.value)}
              placeholder="Staging pattern (e.g., staging.myapp.com)"
              className={cn(
                'px-2 py-1.5 rounded border text-xs outline-none',
                isDark ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff]' : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226]'
              )}
            />
            <input
              type="text"
              value={newProdPattern}
              onChange={(e) => setNewProdPattern(e.target.value)}
              placeholder="Prod pattern (e.g., myapp.com)"
              className={cn(
                'px-2 py-1.5 rounded border text-xs outline-none',
                isDark ? 'bg-white/[0.02] border-white/[0.12] text-[#edf0ff]' : 'bg-black/[0.02] border-black/[0.1] text-[#0e1226]'
              )}
            />
            <Button
              onClick={handleAddRule}
              disabled={!newRuleName.trim()}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium',
                'bg-[rgba(29,217,180,0.12)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4]',
                'disabled:opacity-50'
              )}
            >
              <Check className="w-3 h-3 mr-1" />
              Add Rule
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules List */}
      {isLoading ? (
        <div className={cn('text-xs text-center py-4', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
          Loading...
        </div>
      ) : rules.length === 0 && !showAddRule ? (
        <div className={cn('text-xs text-center py-4', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
          No environment rules configured
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'flex items-center justify-between p-2 rounded-lg border',
                isDark ? 'bg-white/[0.02] border-white/[0.07]' : 'bg-black/[0.02] border-black/[0.06]'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className={cn('text-xs font-medium', isDark ? 'text-[#edf0ff]' : 'text-[#0e1226]')}>
                  {rule.name}
                </div>
                <div className={cn('text-[10px] flex gap-1', isDark ? 'text-[#4e5578]' : 'text-[#8890ab]')}>
                  {rule.envs.map((env) => (
                    <span key={env.type} style={{ color: ENV_COLORS[env.type] }}>
                      {env.label}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 p-0 rounded text-[#f7768e] hover:bg-[rgba(247,118,142,0.12)]"
                onClick={() => handleDeleteRule(rule.id)}
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            className="absolute bottom-14 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full whitespace-nowrap pointer-events-none text-[11.5px] font-medium bg-[rgba(29,217,180,0.15)] border border-[rgba(29,217,180,0.28)] text-[#1dd9b4]"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default EnvironmentSwitcher;
