import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/** Hand off navigation/focus only after the native modal has left the screen. */
export function useSheetAction(visible: boolean, onClose: () => void) {
  const pending = useRef<(() => void) | null>(null);
  const onDismiss = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  useEffect(() => {
    // Android removes the modal on this commit; RN's onDismiss event is iOS-only.
    if (!visible && Platform?.OS !== "ios") onDismiss();
  }, [visible]);
  return {
    onDismiss,
    dismissThen: (action: () => void) => { pending.current = action; onClose(); },
  };
}
