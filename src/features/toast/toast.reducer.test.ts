import { describe, expect, it } from "vitest";

import { toastReducer } from "@/features/toast/toast.reducer";
import {
  MAX_VISIBLE_TOASTS,
  NO_TOASTS,
  type ToastContent,
  type ToastState,
} from "@/features/toast/toast.types";

function contentFor(groupKey: string, description = groupKey): ToastContent {
  return { groupKey, title: "Added to cart", description };
}

function showAll(
  state: ToastState,
  contents: readonly ToastContent[],
): ToastState {
  return contents.reduce(
    (currentState, content) =>
      toastReducer(currentState, { type: "show", content }),
    state,
  );
}

describe("toastReducer", () => {
  it("appends new messages with increasing identifiers", () => {
    const state = showAll(NO_TOASTS, [
      contentFor("everyday-backpack"),
      contentFor("desk-lamp"),
    ]);

    expect(state.messages).toEqual([
      {
        id: 1,
        groupKey: "everyday-backpack",
        title: "Added to cart",
        description: "everyday-backpack",
      },
      {
        id: 2,
        groupKey: "desk-lamp",
        title: "Added to cart",
        description: "desk-lamp",
      },
    ]);
    expect(state.nextId).toBe(3);
    expect(NO_TOASTS.messages).toHaveLength(0);
  });

  it("replaces an existing message from the same group instead of stacking it", () => {
    const state = showAll(NO_TOASTS, [
      contentFor("desk-lamp", "Adjustable desk lamp, quantity 1"),
      contentFor("everyday-backpack", "Everyday backpack, quantity 1"),
      contentFor("desk-lamp", "Adjustable desk lamp, quantity 2"),
    ]);

    expect(state.messages.map((message) => message.description)).toEqual([
      "Everyday backpack, quantity 1",
      "Adjustable desk lamp, quantity 2",
    ]);
    expect(state.messages.at(-1)?.id).toBe(3);
  });

  it("keeps at most the newest visible messages", () => {
    const state = showAll(
      NO_TOASTS,
      Array.from({ length: MAX_VISIBLE_TOASTS + 2 }, (_unused, index) =>
        contentFor(`product-${index}`),
      ),
    );

    expect(state.messages).toHaveLength(MAX_VISIBLE_TOASTS);
    expect(state.messages[0]?.groupKey).toBe("product-2");
  });

  it("dismisses a message by identifier and ignores unknown identifiers", () => {
    const state = showAll(NO_TOASTS, [
      contentFor("desk-lamp"),
      contentFor("travel-mug"),
    ]);

    const dismissed = toastReducer(state, { type: "dismiss", id: 1 });
    const unchanged = toastReducer(dismissed, { type: "dismiss", id: 99 });

    expect(dismissed.messages.map((message) => message.groupKey)).toEqual([
      "travel-mug",
    ]);
    expect(dismissed.nextId).toBe(state.nextId);
    expect(unchanged).toBe(dismissed);
  });
});
