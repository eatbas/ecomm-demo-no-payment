import { useEffect } from "react";

import {
  Toast,
  ToastDescription,
  ToastIndicator,
  ToastTitle,
} from "@/components/ui/toast";
import { useToast } from "@/features/toast/ToastContext";
import {
  TOAST_DURATION_MS,
  type ToastMessage,
} from "@/features/toast/toast.types";

interface ToastNoticeProps {
  readonly message: ToastMessage;
}

function ToastNotice({ message }: ToastNoticeProps) {
  const { dismissToast } = useToast();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      dismissToast(message.id);
    }, TOAST_DURATION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dismissToast, message.id]);

  return (
    <Toast>
      <ToastIndicator>✓</ToastIndicator>
      <div className="min-w-0">
        <ToastTitle>{message.title}</ToastTitle>
        <ToastDescription>{message.description}</ToastDescription>
      </div>
    </Toast>
  );
}

/**
 * Renders transient cart confirmations above the page without affecting layout.
 *
 * Assistive technology reads the always-present polite live region, so the
 * visible stack is hidden from the accessibility tree to avoid announcing the
 * same confirmation twice. The stack carries no controls and ignores pointer
 * events: each notice disappears on its own and never blocks the page beneath.
 */
export function ToastRegion() {
  const { messages } = useToast();
  const latestMessage = messages.at(-1);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-6 sm:px-6 lg:px-8">
      <p
        className="sr-only"
        role="status"
        aria-label="Cart notifications"
        aria-live="polite"
      >
        {latestMessage === undefined ? null : (
          <span key={latestMessage.id}>
            {`${latestMessage.title}. ${latestMessage.description}`}
          </span>
        )}
      </p>
      <ol
        aria-hidden="true"
        className="flex flex-col items-center gap-3 sm:items-end"
      >
        {messages.map((message) => (
          <ToastNotice key={message.id} message={message} />
        ))}
      </ol>
    </div>
  );
}
