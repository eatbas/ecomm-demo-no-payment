import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastRegion } from "@/components/toast/ToastRegion";
import { ToastProvider, useToast } from "@/features/toast/ToastContext";
import { TOAST_DURATION_MS } from "@/features/toast/toast.types";

const NOTICE_DESCRIPTION = "Everyday backpack, quantity 1";

function ToastProbe() {
  const { showToast } = useToast();

  return (
    <button
      type="button"
      onClick={() =>
        showToast({
          groupKey: "everyday-backpack",
          title: "Added to cart",
          description: NOTICE_DESCRIPTION,
        })
      }
    >
      Show confirmation
    </button>
  );
}

function renderRegion() {
  render(
    <ToastProvider>
      <ToastProbe />
      <ToastRegion />
    </ToastProvider>,
  );

  return screen.getByRole("status", { name: "Cart notifications" });
}

function confirmAdd() {
  fireEvent.click(screen.getByRole("button", { name: "Show confirmation" }));
}

function advanceBy(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

describe("ToastRegion", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces the confirmation once and shows a visible notice", () => {
    const liveRegion = renderRegion();

    expect(liveRegion).toBeEmptyDOMElement();

    confirmAdd();

    expect(liveRegion).toHaveTextContent(`Added to cart. ${NOTICE_DESCRIPTION}`);

    const notice = screen.getByText(NOTICE_DESCRIPTION);
    expect(notice.closest("ol")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("dismisses the notice once its lifetime elapses", () => {
    const liveRegion = renderRegion();

    confirmAdd();
    advanceBy(TOAST_DURATION_MS);

    expect(screen.queryByText(NOTICE_DESCRIPTION)).not.toBeInTheDocument();
    expect(liveRegion).toBeEmptyDOMElement();
  });

  it("restarts the lifetime when the same group is confirmed again", () => {
    renderRegion();

    confirmAdd();
    advanceBy(TOAST_DURATION_MS / 2);
    confirmAdd();
    advanceBy(TOAST_DURATION_MS / 2);

    expect(screen.getAllByText(NOTICE_DESCRIPTION)).toHaveLength(1);
  });
});
