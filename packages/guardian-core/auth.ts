/**
 * Parent authentication.
 *
 * Deliberately small, but not fake: passwords are scrypt-hashed with a per-user salt
 * (node:crypto, no dependency) and compared in constant time, and sessions are opaque
 * 32-byte random tokens held server-side. A project about protecting children should not
 * ship plaintext passwords even in a demo.
 *
 * ponytail: single in-process user table and in-memory sessions. Real deployment needs a
 * user store, email verification, and rotation — see README "Production readiness".
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export interface Parent {
  parent_id: string;
  email: string;
  name: string;
  /** Children this parent may see. */
  children: string[];
  salt: string;
  hash: string;
}

const KEYLEN = 64;
const hashPassword = (password: string, salt: string) => scryptSync(password, salt, KEYLEN).toString("hex");

function makeParent(parent_id: string, email: string, name: string, password: string, children: string[]): Parent {
  const salt = randomBytes(16).toString("hex");
  return { parent_id, email, name, children, salt, hash: hashPassword(password, salt) };
}

/** Demo account. Printed by the API on boot so the credentials are never a mystery. */
export const DEMO_LOGIN = { email: "parent@guardian.dev", password: "guardian" };

const parents = new Map<string, Parent>();
const demo = makeParent("p_1", DEMO_LOGIN.email, "Sarah", DEMO_LOGIN.password, ["emma"]);
parents.set(demo.email, demo);

const sessions = new Map<string, { parent_id: string; created: number }>();
const SESSION_TTL = 12 * 60 * 60 * 1000;

export function verifyPassword(email: string, password: string): Parent | null {
  const parent = parents.get(email.trim().toLowerCase());
  if (!parent) return null;
  const attempt = Buffer.from(hashPassword(password, parent.salt), "hex");
  const stored = Buffer.from(parent.hash, "hex");
  // Lengths are equal by construction, so timingSafeEqual is safe to call directly.
  return timingSafeEqual(attempt, stored) ? parent : null;
}

export function createSession(parent: Parent): string {
  const token = randomBytes(32).toString("base64url");
  sessions.set(token, { parent_id: parent.parent_id, created: Date.now() });
  return token;
}

export function parentFromSession(token?: string): Parent | null {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.created > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  return [...parents.values()].find((p) => p.parent_id === s.parent_id) ?? null;
}

export const destroySession = (token?: string) => {
  if (token) sessions.delete(token);
};

/** Does this parent have authority over this child? */
export const canSee = (parent: Parent, child_id: string) => parent.children.includes(child_id);
