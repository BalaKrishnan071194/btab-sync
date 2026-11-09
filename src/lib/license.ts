/**
 * License Validation Module for bTab Sync Pro
 * 
 * Integrates with LemonSqueezy for license key validation.
 * Features:
 * - Device fingerprinting (max 3 devices per license)
 * - Periodic re-validation (every 24 hours)
 * - 7-day offline grace period
 * - Secure local storage of license state
 */

import { ext } from '@/lib/browsers';

// ============================================================================
// Types
// ============================================================================

export interface LicenseInfo {
  readonly key: string;
  readonly email: string;
  readonly status: 'active' | 'expired' | 'disabled' | 'pending';
  readonly activatedAt: number;
  readonly lastValidatedAt: number;
  readonly expiresAt: number | null; // null = lifetime
  readonly instanceId: string;
  readonly deviceName: string;
}

export interface LicenseValidationResult {
  readonly valid: boolean;
  readonly error?: string;
  readonly license_key?: {
    readonly id: number;
    readonly status: string;
    readonly key: string;
    readonly activation_limit: number;
    readonly activation_usage: number;
    readonly expires_at: string | null;
  };
  readonly instance?: {
    readonly id: string;
    readonly name: string;
  };
  readonly meta?: {
    readonly store_id: number;
    readonly product_id: number;
    readonly customer_email: string;
  };
}

interface StoredLicense {
  key: string;
  instanceId: string;
  email: string;
  status: 'active' | 'expired' | 'disabled';
  activatedAt: number;
  lastValidatedAt: number;
  expiresAt: number | null;
  deviceFingerprint: string;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'btab_license';
const VALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days offline grace

// LemonSqueezy API endpoint
const LEMONSQUEEZY_API = 'https://api.lemonsqueezy.com/v1/licenses';

// ============================================================================
// Device Fingerprinting
// ============================================================================

/**
 * Generate a unique device fingerprint based on browser characteristics.
 * Same device = same fingerprint (deterministic).
 * Note: Uses only APIs available in service workers (no DOM/screen access).
 */
async function getDeviceFingerprint(): Promise<string> {
  // Build fingerprint from service worker-safe APIs only
  const parts: string[] = [];
  
  // Navigator properties available in service workers
  if (typeof navigator !== 'undefined') {
    parts.push(navigator.userAgent || '');
    parts.push(navigator.language || '');
    parts.push(navigator.languages?.join(',') || '');
    parts.push(navigator.hardwareConcurrency?.toString() || '0');
  }
  
  // Timezone offset is available everywhere
  parts.push(new Date().getTimezoneOffset().toString());
  
  // Extension ID provides uniqueness per browser profile
  try {
    const extensionId = chrome.runtime?.id || '';
    parts.push(extensionId);
  } catch {
    // Ignore if not in extension context
  }
  
  const data = parts.join('|');

  // Hash the fingerprint using Web Crypto API
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

/**
 * Generate a human-readable device name
 * Note: Uses only APIs available in service workers.
 */
function getDeviceName(): string {
  // Check if navigator is available (should be in service workers)
  if (typeof navigator === 'undefined') {
    return 'Browser';
  }
  
  const ua = navigator.userAgent || '';
  let browser = 'Browser';
  let os = 'Unknown';

  // Detect browser
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  // Detect OS
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}

// ============================================================================
// Storage Helpers
// ============================================================================

async function getStoredLicense(): Promise<StoredLicense | null> {
  try {
    const result = await ext.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    if (stored && typeof stored === 'object' && 'key' in stored) {
      return stored as StoredLicense;
    }
    return null;
  } catch (e) {
    console.warn('[bTab License] Failed to get stored license:', e);
    return null;
  }
}

async function setStoredLicense(license: StoredLicense | null): Promise<void> {
  try {
    if (license) {
      await ext.storage.local.set({ [STORAGE_KEY]: license });
    } else {
      await ext.storage.local.remove(STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[bTab License] Failed to store license:', e);
  }
}

async function setProStatus(isPro: boolean): Promise<void> {
  try {
    await ext.storage.local.set({ isPro });
  } catch (e) {
    console.warn('[bTab License] Failed to set Pro status:', e);
  }
}

// ============================================================================
// LemonSqueezy API
// ============================================================================

/**
 * Activate a license key with LemonSqueezy
 */
async function callLemonSqueezyActivate(
  licenseKey: string,
  instanceName: string
): Promise<LicenseValidationResult> {
  try {
    const response = await fetch(`${LEMONSQUEEZY_API}/activate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        license_key: licenseKey,
        instance_name: instanceName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        valid: false,
        error: data.error || data.message || `HTTP ${response.status}`,
      };
    }

    // LemonSqueezy returns { valid: true, ... } on success
    if (data.valid === false || data.error) {
      return {
        valid: false,
        error: data.error || 'License validation failed',
      };
    }

    return {
      valid: true,
      license_key: data.license_key,
      instance: data.instance,
      meta: data.meta,
    };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

/**
 * Validate an existing license instance with LemonSqueezy
 */
async function callLemonSqueezyValidate(
  licenseKey: string,
  instanceId: string
): Promise<LicenseValidationResult> {
  try {
    const response = await fetch(`${LEMONSQUEEZY_API}/validate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        license_key: licenseKey,
        instance_id: instanceId,
      }),
    });

    const data = await response.json();

    if (!response.ok || data.valid === false) {
      return {
        valid: false,
        error: data.error || data.message || 'Validation failed',
      };
    }

    return {
      valid: true,
      license_key: data.license_key,
      instance: data.instance,
      meta: data.meta,
    };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

/**
 * Deactivate a license instance
 */
async function callLemonSqueezyDeactivate(
  licenseKey: string,
  instanceId: string
): Promise<boolean> {
  try {
    const response = await fetch(`${LEMONSQUEEZY_API}/deactivate`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        license_key: licenseKey,
        instance_id: instanceId,
      }),
    });

    const data = await response.json();
    return data.deactivated === true;
  } catch {
    return false;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Activate a new license key
 */
export async function activateLicense(licenseKey: string): Promise<{
  success: boolean;
  error?: string;
  license?: LicenseInfo;
}> {
  // Normalize key format
  const key = licenseKey.trim().toUpperCase();
  
  // Basic format validation (LemonSqueezy keys are typically UUID or custom format)
  if (key.length < 10) {
    return { success: false, error: 'Invalid license key format' };
  }

  // Get device info
  const deviceFingerprint = await getDeviceFingerprint();
  const deviceName = getDeviceName();

  // Call LemonSqueezy API
  const result = await callLemonSqueezyActivate(key, deviceName);

  if (!result.valid || !result.license_key || !result.instance) {
    return {
      success: false,
      error: result.error || 'Failed to activate license',
    };
  }

  // Store license locally
  const now = Date.now();
  const expiresAt = result.license_key.expires_at 
    ? new Date(result.license_key.expires_at).getTime() 
    : null;

  const stored: StoredLicense = {
    key: result.license_key.key,
    instanceId: result.instance.id,
    email: result.meta?.customer_email || '',
    status: result.license_key.status === 'active' ? 'active' : 'expired',
    activatedAt: now,
    lastValidatedAt: now,
    expiresAt,
    deviceFingerprint,
  };

  await setStoredLicense(stored);
  await setProStatus(true);

  return {
    success: true,
    license: {
      key: stored.key,
      email: stored.email,
      status: stored.status,
      activatedAt: stored.activatedAt,
      lastValidatedAt: stored.lastValidatedAt,
      expiresAt: stored.expiresAt,
      instanceId: stored.instanceId,
      deviceName,
    },
  };
}

/**
 * Validate the current license (periodic check)
 * Returns true if Pro features should be enabled
 */
export async function validateLicense(): Promise<boolean> {
  const stored = await getStoredLicense();

  // No license stored
  if (!stored) {
    await setProStatus(false);
    return false;
  }

  // Check if license has expired (for subscription licenses)
  if (stored.expiresAt && stored.expiresAt < Date.now()) {
    await setProStatus(false);
    return false;
  }

  const now = Date.now();
  const timeSinceValidation = now - stored.lastValidatedAt;

  // Still within validation interval - trust cached state
  if (timeSinceValidation < VALIDATE_INTERVAL_MS) {
    await setProStatus(stored.status === 'active');
    return stored.status === 'active';
  }

  // Need to re-validate with server
  const result = await callLemonSqueezyValidate(stored.key, stored.instanceId);

  if (result.valid && result.license_key) {
    // Update last validated timestamp
    const updated: StoredLicense = {
      ...stored,
      lastValidatedAt: now,
      status: result.license_key.status === 'active' ? 'active' : 'expired',
      expiresAt: result.license_key.expires_at 
        ? new Date(result.license_key.expires_at).getTime() 
        : stored.expiresAt,
    };
    await setStoredLicense(updated);
    await setProStatus(updated.status === 'active');
    return updated.status === 'active';
  }

  // Validation failed - check grace period
  if (timeSinceValidation < GRACE_PERIOD_MS) {
    // Within grace period - keep Pro active but don't update timestamp
    await setProStatus(true);
    return true;
  }

  // Grace period expired - disable Pro
  await setProStatus(false);
  return false;
}

/**
 * Deactivate the current license (sign out)
 */
export async function deactivateLicense(): Promise<boolean> {
  const stored = await getStoredLicense();

  if (!stored) {
    return true; // Already deactivated
  }

  // Call LemonSqueezy to deactivate the instance
  await callLemonSqueezyDeactivate(stored.key, stored.instanceId);

  // Clear local storage
  await setStoredLicense(null);
  await setProStatus(false);

  return true;
}

/**
 * Get current license info (if any)
 */
export async function getLicenseInfo(): Promise<LicenseInfo | null> {
  const stored = await getStoredLicense();

  if (!stored) {
    return null;
  }

  return {
    key: stored.key,
    email: stored.email,
    status: stored.status,
    activatedAt: stored.activatedAt,
    lastValidatedAt: stored.lastValidatedAt,
    expiresAt: stored.expiresAt,
    instanceId: stored.instanceId,
    deviceName: getDeviceName(),
  };
}

/**
 * Check if Pro is currently active (fast, cached check)
 */
export async function isProActive(): Promise<boolean> {
  try {
    const result = await ext.storage.local.get('isPro');
    return result['isPro'] === true;
  } catch {
    return false;
  }
}

/**
 * Format license key for display (mask middle portion)
 */
export function formatLicenseKey(key: string): string {
  if (key.length <= 8) return key;
  const start = key.substring(0, 4);
  const end = key.substring(key.length - 4);
  return `${start}••••••••${end}`;
}

/**
 * Format expiry date for display
 */
export function formatExpiryDate(expiresAt: number | null): string {
  if (!expiresAt) return 'Lifetime';
  
  const date = new Date(expiresAt);
  const now = new Date();
  const diffDays = Math.ceil((expiresAt - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Expired';
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Expires tomorrow';
  if (diffDays <= 30) return `Expires in ${diffDays} days`;
  
  return `Expires ${date.toLocaleDateString()}`;
}
