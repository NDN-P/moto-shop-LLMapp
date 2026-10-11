import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateCredentials, createSession, validateSession, destroySession } from "./auth-local";

describe("auth-local", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_USERNAME", "admin");
    vi.stubEnv("ADMIN_PASSWORD", "test-password");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("validates correct credentials", () => {
    const result = validateCredentials("admin", "test-password");
    expect(result).toBe(true);
  });

  it("rejects incorrect username", () => {
    const result = validateCredentials("wronguser", "test-password");
    expect(result).toBe(false);
  });

  it("rejects incorrect password", () => {
    const result = validateCredentials("admin", "wrongpass");
    expect(result).toBe(false);
  });

  it("fails closed without configured credentials", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(validateCredentials("admin", "admin123")).toBe(false);
  });

  it("creates a valid session", () => {
    const sessionId = createSession("admin");
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe("string");
    expect(sessionId.length).toBeGreaterThan(0);
  });

  it("validates an active session", () => {
    const sessionId = createSession("admin");
    const result = validateSession(sessionId);
    expect(result.valid).toBe(true);
    expect(result.username).toBe("admin");
  });

  it("invalidates a non-existent session", () => {
    const result = validateSession("invalid-session-id");
    expect(result.valid).toBe(false);
    expect(result.username).toBeUndefined();
  });

  it("destroys a session", () => {
    const sessionId = createSession("admin");
    destroySession(sessionId);
    const result = validateSession(sessionId);
    expect(result.valid).toBe(false);
  });
});
