/**
 * Tooltip Component (Shadow DOM Compatible)
 *
 * Wraps Radix UI Tooltip with Shadow DOM portal support.
 * Portals render into the PortalProvider container instead of document.body.
 */

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from './cn';
import { usePortalContainer } from './PortalProvider';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

// ============================================================================
// TooltipPortal - Shadow DOM aware
// ============================================================================

interface TooltipPortalProps extends TooltipPrimitive.TooltipPortalProps {
  children: React.ReactNode;
}

/**
 * Portal that renders into Shadow DOM container when available.
 * Falls back to document.body if not within a PortalProvider.
 */
const TooltipPortal = ({ children, ...props }: TooltipPortalProps): React.JSX.Element => {
  const container = usePortalContainer();

  return (
    <TooltipPrimitive.Portal container={container} {...props}>
      {children}
    </TooltipPrimitive.Portal>
  );
};
TooltipPortal.displayName = 'TooltipPortal';

// ============================================================================
// TooltipContent - Shadow DOM aware
// ============================================================================

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => {
  const container = usePortalContainer();

  return (
    <TooltipPrimitive.Portal container={container}>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(
          'z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
});
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, TooltipPortal };
