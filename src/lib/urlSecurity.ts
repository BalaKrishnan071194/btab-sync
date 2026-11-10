/**
 * URL Security Utilities for bTab Sync
 *
 * Validates and sanitizes URLs before opening to prevent:
 * - Open redirects (CWE-601)
 * - JavaScript/data URI injection
 * - Protocol handler attacks
 *
 * @module urlSecurity
 */

// ============================================================================
// Constants
// ============================================================================

/** Protocols that are safe to open */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** Protocols that are explicitly blocked */
const BLOCKED_PROTOCOLS = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
]);

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates if a URL is safe to open.
 * Only allows http: and https: protocols.
 *
 * @param url - The URL to validate
 * @returns true if the URL is safe, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch {
    // Invalid URL format
    return false;
  }
}

/**
 * Checks if a URL uses a blocked/dangerous protocol.
 *
 * @param url - The URL to check
 * @returns true if the URL uses a blocked protocol
 */
export function isBlockedProtocol(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return true;
  }

  try {
    const parsed = new URL(url);
    return BLOCKED_PROTOCOLS.has(parsed.protocol);
  } catch {
    // If we can't parse it, treat it as blocked
    return true;
  }
}

/**
 * Safely opens a URL in a new tab after validation.
 * Blocks dangerous protocols and invalid URLs.
 *
 * @param url - The URL to open
 * @returns true if the URL was opened, false if blocked
 */
export function safeOpenUrl(url: string): boolean {
  if (!isValidUrl(url)) {
    console.warn('[bTab Security] Blocked unsafe URL:', url?.substring(0, 100));
    return false;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Check if a hostname matches a pattern using strict domain matching.
 * Prevents matching like evil-app.com matching a rule for app.com
 */
function isStrictDomainMatch(hostname: string, pattern: string): boolean {
  const normalizedHost = hostname.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();
  
  // Exact match
  if (normalizedHost === normalizedPattern) return true;
  
  // Handle port variations (e.g., localhost:3000 -> localhost)
  const hostWithoutPort = normalizedHost.split(':')[0] ?? normalizedHost;
  const patternWithoutPort = normalizedPattern.split(':')[0] ?? normalizedPattern;
  
  if (hostWithoutPort === patternWithoutPort) return true;
  
  // Subdomain match: hostname ends with .pattern (e.g., staging.myapp.com matches myapp.com)
  if (normalizedHost.endsWith('.' + normalizedPattern)) return true;
  
  // Pattern could be a subdomain host: myapp.com matches dev.myapp.com pattern
  if (normalizedPattern.endsWith('.' + hostWithoutPort)) return true;
  
  return false;
}

/**
 * Validates an environment switch URL transformation.
 * Ensures the resulting URL:
 * 1. Uses a safe protocol (http/https)
 * 2. Has a hostname matching one of the allowed patterns (strict domain matching)
 *
 * @param currentUrl - The current tab URL
 * @param oldPattern - The pattern to replace
 * @param newPattern - The pattern to replace with
 * @param allowedPatterns - List of allowed hostname patterns
 * @returns The validated new URL, or null if invalid
 */
export function validateEnvironmentSwitch(
  currentUrl: string,
  oldPattern: string,
  newPattern: string,
  allowedPatterns: readonly string[]
): string | null {
  if (!currentUrl || !oldPattern || !newPattern) {
    return null;
  }

  try {
    // Perform the replacement
    const newUrl = currentUrl.replace(oldPattern, newPattern);

    // Parse and validate
    const parsed = new URL(newUrl);

    // Must be http/https
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      console.warn('[bTab Security] Blocked non-HTTP protocol in env switch');
      return null;
    }

    // SECURITY: Use strict domain matching to prevent redirect to similar domains
    const hostname = parsed.hostname;
    const isValidTarget = allowedPatterns.some((pattern) => 
      isStrictDomainMatch(hostname, pattern)
    );

    if (!isValidTarget) {
      console.warn('[bTab Security] Blocked env switch to unauthorized domain:', hostname);
      return null;
    }

    return newUrl;
  } catch (e) {
    console.warn('[bTab Security] Invalid URL in env switch:', e);
    return null;
  }
}

/**
 * Sanitizes a URL for display purposes.
 * Truncates long URLs and escapes HTML entities.
 *
 * @param url - The URL to sanitize
 * @param maxLength - Maximum length before truncation (default: 60)
 * @returns Sanitized URL string safe for display
 */
export function sanitizeUrlForDisplay(url: string, maxLength = 60): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Basic HTML entity escaping for display
  const escaped = url
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // Truncate if too long
  if (escaped.length > maxLength) {
    return escaped.substring(0, maxLength - 3) + '...';
  }

  return escaped;
}
