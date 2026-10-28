/**
 * Password hashing for cloud-sync accounts.
 *
 * scrypt (N=16384, r=8, p=1, 64-byte key) with a per-user random salt and a
 * self-describing storage format, verified with timingSafeEqual. No external
 * dependency — Node's builtin crypto is FIPS-friendly and battle-tested.
 *
 * Everything here is pure + synchronous so route factories stay trivially
 * unit-testable with injected dbs.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** Format: scrypt$<N>$<r>$<p>$<saltHex>$<hashHex> */
const FORMAT = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([0-9a-f]+)\$([0-9a-f]+)$/;
const KEYLEN = 64;
const DEFAULT_PARAMS = { N: 16384, r: 8, p: 1 } as const;
const SALT_BYTES = 16;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN, { ...DEFAULT_PARAMS }).toString("hex");
  const { N, r, p } = DEFAULT_PARAMS;
  return `scrypt$${N}$${r}$${p}$${salt}$${hash}`;
}

/**
 * Constant-time verification. NEVER throws on malformed stored hashes —
 * a corrupt row must simply fail to authenticate, not crash the route.
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (typeof password !== "string" || typeof stored !== "string") return false;
  const match = FORMAT.exec(stored);
  if (!match) return false;

  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = match;
  const params = { N: Number(nRaw), r: Number(rRaw), p: Number(pRaw) };
  if (
    !Number.isFinite(params.N) ||
    !Number.isFinite(params.r) ||
    !Number.isFinite(params.p) ||
    params.N <= 0 ||
    params.r <= 0 ||
    params.p <= 0 ||
    saltHex.length === 0 ||
    hashHex.length === 0
  ) {
    return false;
  }

  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = scryptSync(password, saltHex, expected.length, params);
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** Password policy: 8-200 chars, at least one letter and one digit. */
export function passwordIssues(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 200) {
    return "Password must be under 200 characters.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password needs at least one letter and one digit.";
  }
  return null;
}
