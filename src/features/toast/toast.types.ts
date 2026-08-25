export const TOAST_DURATION_MS = 4_000;
export const MAX_VISIBLE_TOASTS = 3;

/**
 * A single notification. Identifiers increase monotonically and new messages
 * are appended, so the last entry is always the most recent one.
 */
export interface ToastMessage {
  readonly id: number;
  readonly groupKey: string;
  readonly title: string;
  readonly description: string;
}

/** The caller-supplied part of a notification; the reducer owns identifiers. */
export type ToastContent = Omit<ToastMessage, "id">;

export interface ToastState {
  readonly messages: readonly ToastMessage[];
  readonly nextId: number;
}

export type ToastAction =
  | { readonly type: "show"; readonly content: ToastContent }
  | { readonly type: "dismiss"; readonly id: number };

export const NO_TOASTS: ToastState = Object.freeze({
  messages: Object.freeze([]),
  nextId: 1,
});
