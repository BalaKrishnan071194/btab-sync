/**
 * Portal Provider for Shadow DOM
 *
 * Provides a container reference for Radix UI portals to render into
 * the Shadow DOM instead of document.body. This ensures all floating
 * UI elements (dialogs, tooltips, dropdowns) stay within the shadow
 * boundary and receive proper styling.
 */

import * as React from 'react';
import { createContext, useContext, useRef, useState, useEffect, type ReactNode } from 'react';

// ============================================================================
// Types
// ============================================================================

interface PortalContextValue {
  /** The container element where portals should render */
  container: HTMLElement | null;
  /** Set the container element (called by the root component) */
  setContainer: (element: HTMLElement | null) => void;
}

// ============================================================================
// Context
// ============================================================================

const PortalContext = createContext<PortalContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the portal container for Shadow DOM.
 * Returns the container element or null if not within a PortalProvider.
 *
 * @example
 * ```tsx
 * const container = usePortalContainer();
 * return <Dialog.Portal container={container}>...</Dialog.Portal>;
 * ```
 */
export function usePortalContainer(): HTMLElement | null {
  const context = useContext(PortalContext);
  if (!context) {
    // Not within a PortalProvider - components will portal to document.body
    return null;
  }
  return context.container;
}

// ============================================================================
// Provider Component
// ============================================================================

interface PortalProviderProps {
  children: ReactNode;
}

/**
 * Provider component that creates a portal container within Shadow DOM.
 *
 * Place this at the root of your Shadow DOM React tree. It creates a
 * dedicated div for Radix portals and passes it down via context.
 *
 * @example
 * ```tsx
 * // In your shadow root mount
 * <PortalProvider>
 *   <App />
 * </PortalProvider>
 * ```
 */
export function PortalProvider({ children }: PortalProviderProps): React.JSX.Element {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Set the container once the ref is attached
  useEffect(() => {
    if (containerRef.current) {
      setContainer(containerRef.current);
    }
  }, []);

  const contextValue: PortalContextValue = {
    container,
    setContainer,
  };

  return (
    <PortalContext.Provider value={contextValue}>
      {children}
      {/* Portal container - Radix components will render floating elements here */}
      <div
        ref={containerRef}
        id="btab-portal-container"
        style={{
          // Ensure portal container doesn't affect layout
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />
    </PortalContext.Provider>
  );
}

export { PortalContext };
