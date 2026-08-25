import {
  MAX_VISIBLE_TOASTS,
  type ToastAction,
  type ToastContent,
  type ToastMessage,
  type ToastState,
} from "@/features/toast/toast.types";

function showMessage(state: ToastState, content: ToastContent): ToastState {
  const message: ToastMessage = { ...content, id: state.nextId };
  const otherGroups = state.messages.filter(
    (candidate) => candidate.groupKey !== content.groupKey,
  );

  return {
    messages: [...otherGroups, message].slice(-MAX_VISIBLE_TOASTS),
    nextId: state.nextId + 1,
  };
}

function dismissMessage(state: ToastState, id: number): ToastState {
  const remaining = state.messages.filter((message) => message.id !== id);

  return remaining.length === state.messages.length
    ? state
    : { ...state, messages: remaining };
}

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "show":
      return showMessage(state, action.content);
    case "dismiss":
      return dismissMessage(state, action.id);
  }
}
