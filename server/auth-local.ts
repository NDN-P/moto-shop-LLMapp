import crypto from "crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import type { User } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";

const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

interface Session {
  sessionId: string;
  username: string;
  createdAt: number;
  lastActivity: number;
}

const sessions = new Map<string, Session>();

export function validateCredentials(username: string, password: string): boolean {
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedUsername || !expectedPassword) return false;
  const expected = crypto.createHash("sha256").update(`${expectedUsername}\0${expectedPassword}`).digest();
  const actual = crypto.createHash("sha256").update(`${username}\0${password}`).digest();
  return crypto.timingSafeEqual(expected, actual);
}

export function createSession(username: string): string {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  sessions.set(sessionId, {
    sessionId,
    username,
    createdAt: now,
    lastActivity: now,
  });
  return sessionId;
}

export function validateSession(sessionId: string): { valid: boolean; username?: string } {
  const session = sessions.get(sessionId);
  if (!session) return { valid: false };

  const now = Date.now();
  if (now - session.createdAt > SESSION_TIMEOUT) {
    sessions.delete(sessionId);
    return { valid: false };
  }

  session.lastActivity = now;
  return { valid: true, username: session.username };
}

export function destroySession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function getSessionIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = parseCookieHeader(cookieHeader);
  return cookies[COOKIE_NAME] ?? null;
}

export function getLocalUserFromRequest(req: Request): User | null {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId) return null;

  const session = validateSession(sessionId);
  if (!session.valid || !session.username) return null;

  const now = new Date();
  return {
    id: 1,
    openId: "local-admin",
    name: session.username,
    email: null,
    loginMethod: "local",
    role: "admin",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  const expiredIds: string[] = [];
  sessions.forEach((session, sessionId) => {
    if (now - session.createdAt > SESSION_TIMEOUT) {
      expiredIds.push(sessionId);
    }
  });
  expiredIds.forEach((id) => sessions.delete(id));
}

setInterval(cleanupExpiredSessions, 60 * 60 * 1000).unref();
