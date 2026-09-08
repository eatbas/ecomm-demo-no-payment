// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ADMIN_SESSION_COOKIE_NAME,
  createSessionToken,
  hashAdminPassword,
  parseCookies,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  verifyAdminPassword,
  verifySessionToken,
} from "./admin-session.js";

describe("admin password hashing", () => {
  it("verifies a matching password and rejects a wrong one", () => {
    const storedHash = hashAdminPassword("correct horse battery staple");

    expect(verifyAdminPassword("correct horse battery staple", storedHash)).toBe(
      true,
    );
    expect(verifyAdminPassword("wrong password", storedHash)).toBe(false);
  });

  it("produces a different salt (and hash) for the same password each time", () => {
    const first = hashAdminPassword("same-password");
    const second = hashAdminPassword("same-password");

    expect(first).not.toBe(second);
    expect(verifyAdminPassword("same-password", first)).toBe(true);
    expect(verifyAdminPassword("same-password", second)).toBe(true);
  });

  it("rejects a malformed stored hash instead of throwing", () => {
    expect(verifyAdminPassword("anything", "not-a-valid-hash")).toBe(false);
    expect(verifyAdminPassword("anything", "scrypt$zz$zz")).toBe(false);
  });
});

describe("admin session tokens", () => {
  it("verifies a freshly issued token and rejects a tampered one", () => {
    const now = () => new Date("2026-09-08T12:00:00.000Z");
    const token = createSessionToken("session-secret", now);

    expect(verifySessionToken(token, "session-secret", now)).toBe(true);
    expect(verifySessionToken(token, "wrong-secret", now)).toBe(false);
    expect(verifySessionToken(`${token}x`, "session-secret", now)).toBe(false);
  });

  it("rejects an expired token", () => {
    const issuedAt = () => new Date("2026-09-08T00:00:00.000Z");
    const token = createSessionToken("session-secret", issuedAt);
    const muchLater = () => new Date("2026-09-09T00:00:00.000Z");

    expect(verifySessionToken(token, "session-secret", muchLater)).toBe(false);
  });

  it("rejects structurally invalid tokens", () => {
    expect(verifySessionToken("no-dot-here", "secret")).toBe(false);
    expect(verifySessionToken("not-a-number.abcd", "secret")).toBe(false);
  });
});

describe("cookie helpers", () => {
  it("parses a cookie header into a name/value map", () => {
    const cookies = parseCookies("foo=bar; admin_session=abc%20123; baz=qux");
    expect(cookies.get("foo")).toBe("bar");
    expect(cookies.get(ADMIN_SESSION_COOKIE_NAME)).toBe("abc 123");
    expect(cookies.get("baz")).toBe("qux");
  });

  it("returns an empty map for a missing header", () => {
    expect(parseCookies(undefined).size).toBe(0);
  });

  it("serializes a session cookie with the expected attributes", () => {
    const cookie = serializeSessionCookie("token-value", true);
    expect(cookie).toContain("admin_session=token-value");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Secure");
  });

  it("omits Secure for non-HTTPS development", () => {
    expect(serializeSessionCookie("token-value", false)).not.toContain("Secure");
  });

  it("serializes an expired cookie that clears the session", () => {
    const cookie = serializeExpiredSessionCookie(true);
    expect(cookie).toContain("admin_session=;");
    expect(cookie).toContain("Max-Age=0");
  });
});
