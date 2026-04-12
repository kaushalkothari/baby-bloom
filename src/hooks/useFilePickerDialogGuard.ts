import { useCallback, useRef } from 'react';

/**
 * Prevents Radix Dialog from closing while the OS file picker is open.
 *
 * When a file input opens the native picker, focus leaves the browser window.
 * Radix detects "focus outside" and fires onOpenChange(false), resetting form state.
 *
 * Usage:
 *   - Call `beforePick()` immediately before triggering the file input.
 *   - Call `afterPick()` at the start of the input's onChange handler.
 *   - Pass `pickingFile` to onOpenChange / onFocusOutside / onPointerDownOutside
 *     to block close while the picker is active.
 */
export function useFilePickerDialogGuard() {
  const pickingFile = useRef(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout>>();

  const beforePick = useCallback(() => {
    pickingFile.current = true;
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);

    const onFocusReturn = () => {
      // After the window regains focus, give onChange 1 s to fire and call afterPick.
      // If the user cancelled the picker (no onChange), this clears the flag.
      fallbackTimer.current = setTimeout(() => {
        pickingFile.current = false;
      }, 1000);
    };

    window.addEventListener('focus', onFocusReturn, { once: true });
  }, []);

  const afterPick = useCallback(() => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    pickingFile.current = false;
  }, []);

  return { pickingFile, beforePick, afterPick };
}
