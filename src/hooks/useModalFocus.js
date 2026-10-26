import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus management for modal dialogs (WCAG 2.4.3 / 2.1.2):
 * - Traps Tab / Shift+Tab inside the dialog panel
 * - Closes on Escape and restores focus to the trigger element
 * - Moves initial focus to the first focusable field (or the panel)
 *
 * Usage:
 *   const panelRef = useModalFocus(isOpen, onClose);
 *   <div ref={panelRef} role="dialog" tabIndex={-1} ...>
 */
export function useModalFocus(isOpen, onClose) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const panel = panelRef.current;
    if (!panel) return undefined;

    // Remember the trigger so focus can be restored on close.
    const previouslyFocused = document.activeElement;

    // Move initial focus into the dialog.
    const firstField = panel.querySelector(
      'input:not([type="hidden"]), select, textarea, button'
    );
    (firstField || panel).focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose]);

  return panelRef;
}
