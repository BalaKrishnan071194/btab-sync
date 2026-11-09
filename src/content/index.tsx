/**
 * Content Script Entry Point
 *
 * Creates a Shadow DOM container to isolate our styles from the page,
 * then mounts the React app inside the shadow root.
 *
 * Uses React 19 APIs with createRoot for concurrent features.
 */

import { createRoot, type Root } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App';
import type { TabPayload } from './BTabContext';

// Import Tailwind CSS - this will be bundled and injected
import contentStyles from './styles/index.css?inline';

// ============================================================================
// Constants
// ============================================================================

const CONTAINER_ID = 'btab-sync-root';
const SHADOW_HOST_CLASS = 'btab-sync-shadow-host';

// ============================================================================
// Types
// ============================================================================

/** Message from background script */
interface ToggleOverlayMessage {
  readonly action: 'toggleOmniOverlay';
  readonly payload: TabPayload;
}

/** Global state for the content script */
interface ContentScriptState {
  shadowHost: HTMLDivElement | null;
  shadowRoot: ShadowRoot | null;
  reactRoot: Root | null;
  isInitialized: boolean;
  currentPayload: TabPayload | null;
}

// ============================================================================
// State
// ============================================================================

const state: ContentScriptState = {
  shadowHost: null,
  shadowRoot: null,
  reactRoot: null,
  isInitialized: false,
  currentPayload: null,
};

// ============================================================================
// Styles
// ============================================================================

/**
 * Returns the CSS styles to inject into the Shadow DOM.
 * This isolates our styles completely from the host page.
 * Uses Vite's ?inline import to get the compiled Tailwind CSS.
 */
function getStyles(): string {
  // Return the compiled Tailwind CSS from the inline import
  return contentStyles;
}

// ============================================================================
// Shadow DOM Creation
// ============================================================================

/**
 * Creates the Shadow DOM host element and attaches a shadow root.
 * The shadow root isolates our styles from the page.
 */
function createShadowContainer(): { host: HTMLDivElement; shadow: ShadowRoot } {
  // Check if container already exists
  const existing = document.getElementById(CONTAINER_ID);
  if (existing) {
    existing.remove();
  }

  // Create host element
  const host = document.createElement('div');
  host.id = CONTAINER_ID;
  host.className = SHADOW_HOST_CLASS;

  // Style the host to not affect page layout
  host.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 0 !important;
    height: 0 !important;
    overflow: visible !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
  `;

  // Attach shadow root
  const shadow = host.attachShadow({ mode: 'closed' });

  // Inject styles
  const styleSheet = document.createElement('style');
  styleSheet.textContent = getStyles();
  shadow.appendChild(styleSheet);

  // Create React mount point
  const mountPoint = document.createElement('div');
  mountPoint.id = 'btab-react-root';
  mountPoint.style.cssText = 'pointer-events: auto;';
  shadow.appendChild(mountPoint);

  // Append to document
  document.body.appendChild(host);

  return { host, shadow };
}

// ============================================================================
// React Mount
// ============================================================================

/**
 * Mounts the React app inside the Shadow DOM.
 * Uses React 19's createRoot for concurrent features.
 */
function mountReactApp(shadowRoot: ShadowRoot, payload?: TabPayload | undefined): Root {
  const mountPoint = shadowRoot.getElementById('btab-react-root');
  if (!mountPoint) {
    throw new Error('[bTab] Mount point not found in shadow root');
  }

  const root = createRoot(mountPoint);

  root.render(
    <StrictMode>
      <App initialPayload={payload} />
    </StrictMode>
  );

  return root;
}

// ============================================================================
// Initialize
// ============================================================================

/**
 * Initializes the content script:
 * 1. Creates Shadow DOM container
 * 2. Mounts React app
 * 3. Sets up message listeners
 */
function initialize(): void {
  if (state.isInitialized) {
    console.warn('[bTab] Content script already initialized');
    return;
  }

  try {
    // Create shadow container
    const { host, shadow } = createShadowContainer();
    state.shadowHost = host;
    state.shadowRoot = shadow;

    // Mount React app (initially hidden, no payload)
    state.reactRoot = mountReactApp(shadow);

    // Set up message listener
    chrome.runtime.onMessage.addListener(handleMessage);

    state.isInitialized = true;
    // Production: silent init
  } catch (error) {
    console.warn('[bTab] Failed to initialize content script:', error);
  }
}

/**
 * Handles messages from the background script.
 */
function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  _sendResponse: (response?: unknown) => void
): boolean | void {
  const msg = message as ToggleOverlayMessage;

  if (msg.action === 'toggleOmniOverlay' && msg.payload) {
    state.currentPayload = msg.payload;

    // Re-render with new payload
    if (state.reactRoot && state.shadowRoot) {
      state.reactRoot.unmount();
      state.reactRoot = mountReactApp(state.shadowRoot, msg.payload);
    }
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Cleans up the content script.
 * Called when the extension is unloaded or the page is navigating away.
 */
function cleanup(): void {
  if (state.reactRoot) {
    state.reactRoot.unmount();
    state.reactRoot = null;
  }

  if (state.shadowHost) {
    state.shadowHost.remove();
    state.shadowHost = null;
  }

  state.shadowRoot = null;
  state.currentPayload = null;
  state.isInitialized = false;

  chrome.runtime.onMessage.removeListener(handleMessage);
}

// Listen for page unload using pagehide (unload is deprecated/restricted)
window.addEventListener('pagehide', cleanup);

// ============================================================================
// Auto-initialize
// ============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Export for testing
export { initialize, cleanup, state as __testState };
