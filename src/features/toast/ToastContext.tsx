import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";

import { toastReducer } from "@/features/toast/toast.reducer";
import {
  NO_TOASTS,
  type ToastContent,
  type ToastMessage,
} from "@/features/toast/toast.types";

export interface ToastContextValue {
  readonly messages: readonly ToastMessage[];
  showToast(this: void, content: ToastContent): void;
  dismissToast(this: void, id: number): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastProviderProps {
  readonly children: ReactNode;
}

/**
 * Owns the transient notification queue for the application shell. The queue is
 * deliberately not persisted: a confirmation that outlives its interaction
 * would be misleading.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [state, dispatch] = useReducer(toastReducer, NO_TOASTS);

  const showToast = useCallback((content: ToastContent) => {
    dispatch({ type: "show", content });
  }, []);

  const dismissToast = useCallback((id: number) => {
    dispatch({ type: "dismiss", id });
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ messages: state.messages, showToast, dismissToast }),
    [state.messages, showToast, dismissToast],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);

  if (value === null) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return value;
}
