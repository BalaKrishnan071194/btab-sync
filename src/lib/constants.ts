/**
 * Application Constants for bTab Sync
 *
 * Central location for all hardcoded values to ensure consistency
 * and make updates easier.
 *
 * @module constants
 */

// ============================================================================
// Lemon Squeezy / Monetization
// ============================================================================

/**
 * Lemon Squeezy checkout URL for Pro upgrade.
 * This is the single source of truth for the checkout link.
 */
export const BTAB_CHECKOUT_URL =
  'https://btab-sync.lemonsqueezy.com/checkout/buy/2742cd45-08b6-4c41-bcde-13613e116565';

/**
 * Lemon Squeezy API endpoint for license operations.
 */
export const LEMONSQUEEZY_API_URL = 'https://api.lemonsqueezy.com/v1/licenses';

// ============================================================================
// Extension Metadata
// ============================================================================

/**
 * Extension display name.
 */
export const EXTENSION_NAME = 'bTab Sync';

/**
 * Firefox/Gecko extension ID.
 */
export const GECKO_EXTENSION_ID = 'btab-sync@btab.extension';

// ============================================================================
// Storage Keys
// ============================================================================

/**
 * Chrome storage key for license data.
 */
export const STORAGE_KEY_LICENSE = 'btab_license';

/**
 * Chrome storage key for Pro status.
 */
export const STORAGE_KEY_IS_PRO = 'isPro';

/**
 * Chrome storage key for recently closed tabs.
 */
export const STORAGE_KEY_RECENTLY_CLOSED = 'recentlyClosed';

// ============================================================================
// Timing Constants
// ============================================================================

/**
 * License validation interval (24 hours in milliseconds).
 */
export const LICENSE_VALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Offline grace period for license validation (7 days in milliseconds).
 */
export const LICENSE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Tab inactivity threshold (2 hours in milliseconds).
 */
export const TAB_INACTIVITY_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * Tab expiry threshold (7 days in milliseconds).
 */
export const TAB_EXPIRY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Minimum interval between license activation attempts (3 seconds).
 */
export const LICENSE_ACTIVATION_MIN_INTERVAL_MS = 3000;

/**
 * Maximum license activation attempts per hour.
 */
export const LICENSE_ACTIVATION_MAX_ATTEMPTS_PER_HOUR = 10;

// ============================================================================
// UI Constants
// ============================================================================

/**
 * Toast notification display duration (milliseconds).
 */
export const TOAST_DURATION_MS = 2000;

/**
 * Debounce delay for tab change notifications (milliseconds).
 */
export const TAB_CHANGE_DEBOUNCE_MS = 150;
