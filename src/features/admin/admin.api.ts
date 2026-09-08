export class AdminApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminApiError";
  }
}

async function requestVoid(
  request: () => ReturnType<typeof fetch>,
  unreachableMessage: string,
): Promise<Response> {
  try {
    return await request();
  } catch {
    throw new AdminApiError(unreachableMessage);
  }
}

/** True only when the current browser session already carries a valid admin cookie. */
export async function checkAdminSession(signal?: AbortSignal): Promise<boolean> {
  const response = await requestVoid(
    () => fetch("/api/admin/session", { signal }),
    "The admin service could not be reached.",
  );
  return response.ok;
}

export async function adminLogin(password: string, signal?: AbortSignal): Promise<void> {
  const response = await requestVoid(
    () =>
      fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        signal,
      }),
    "The admin service could not be reached. Try again.",
  );

  if (!response.ok) {
    throw new AdminApiError("Incorrect admin password.");
  }
}

export async function adminLogout(signal?: AbortSignal): Promise<void> {
  await requestVoid(
    () => fetch("/api/admin/logout", { method: "POST", signal }),
    "The admin service could not be reached.",
  );
}
