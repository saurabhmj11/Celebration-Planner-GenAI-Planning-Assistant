/**
 * scrypt password hashing contracts.
 *
 * Round-trip correctness, uniqueness of salts, timing-safe rejection, and
 * the password policy the register endpoint enforces.
 */
import { describe, expect, test } from "bun:test";
import {
  hashPassword,
  passwordIssues,
  verifyPassword,
} from "../../src/lib/security/passwords";

describe("hashPassword / verifyPassword", () => {
  test("round-trips a valid password", () => {
    const stored = hashPassword("party2026");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("party2026", stored)).toBe(true);
  });

  test("rejects a wrong password", () => {
    const stored = hashPassword("party2026");
    expect(verifyPassword("party2027", stored)).toBe(false);
  });

  test("salts are per-hash: same password, different stored values, both verify", () => {
    const a = hashPassword("samePassword1");
    const b = hashPassword("samePassword1");
    expect(a).not.toBe(b);
    expect(verifyPassword("samePassword1", a)).toBe(true);
    expect(verifyPassword("samePassword1", b)).toBe(true);
  });

  test("never throws on malformed stored hashes", () => {
    expect(verifyPassword("whatever1", "")).toBe(false);
    expect(verifyPassword("whatever1", "plaintext")).toBe(false);
    expect(verifyPassword("whatever1", "scrypt$not$this")).toBe(false);
    expect(verifyPassword("whatever1", "scrypt$0$0$0$ab$cd")).toBe(false);
    expect(verifyPassword("whatever1", null as unknown as string)).toBe(false);
  });
});

describe("passwordIssues policy", () => {
  test("requires 8+ characters, a letter and a digit", () => {
    expect(passwordIssues("short1")).toBe("Password must be at least 8 characters.");
    expect(passwordIssues("allletters")).toBe("Password needs at least one letter and one digit.");
    expect(passwordIssues("12345678")).toBe("Password needs at least one letter and one digit.");
    expect(passwordIssues("party2026")).toBeNull();
  });

  test("caps absurd lengths", () => {
    expect(passwordIssues("a".repeat(201) + "1")).toBe("Password must be under 200 characters.");
    expect(passwordIssues("a".repeat(199) + "1")).toBeNull();
  });
});
