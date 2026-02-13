import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyMigrations, createDatabase, initializeDatabase } from "../db";
import {
  changePasswordWithOldPassword,
  confirmRecoveryKeyBinding,
  hasAdminUser,
  login,
  removeUser,
  registerAdmin,
  markEmailCodeSent,
  resetPasswordByEmailCode,
  resetPasswordByRecoveryKey,
  saveEmailCode,
  updateUserRole,
  updateUserStatus,
  validateRecoveryKey,
  verifyEmailCode,
  verifyEmailCodeSendInterval,
  revealRecoveryKey,
} from "../auth";

const setupDatabase = () => {
  const db = createDatabase(":memory:");
  initializeDatabase(db);
  const migrationsPath = path.join(process.cwd(), "electron", "migrations");
  applyMigrations(db, migrationsPath);
  return db;
};

describe("auth", () => {
  it("creates admin and allows login", () => {
    const db = setupDatabase();
    expect(hasAdminUser(db)).toBe(false);
    const registerResult = registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    expect(registerResult.success).toBe(true);
    expect(hasAdminUser(db)).toBe(true);
    const loginResult = login(db, "admin", "Admin1234");
    expect(loginResult.success).toBe(true);
    if (loginResult.success) {
      expect(loginResult.user.email).toBe("admin@example.com");
    }
  });

  it("rejects duplicate admin creation", () => {
    const db = setupDatabase();
    registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    const secondResult = registerAdmin(db, "another", "Admin1234", "another@example.com");
    expect(secondResult.success).toBe(false);
  });

  it("rejects invalid password", () => {
    const db = setupDatabase();
    registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    const loginResult = login(db, "admin", "Wrong1234");
    expect(loginResult.success).toBe(false);
  });

  it("rejects login for disabled account with explicit message", () => {
    const db = setupDatabase();
    registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    db.prepare("UPDATE users SET status = ? WHERE username = ?").run("DISABLED", "admin");
    const loginResult = login(db, "admin", "Admin1234");
    expect(loginResult.success).toBe(false);
    if (!loginResult.success) {
      expect(loginResult.message).toBe("账户已被禁用，请联系管理员");
    }
  });

  it("binds recovery key and resets password", () => {
    const db = setupDatabase();
    const registerResult = registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    if (!registerResult.success) {
      throw new Error("register failed");
    }
    const bindResult = confirmRecoveryKeyBinding(
      db,
      registerResult.user.id,
      registerResult.recoveryKey,
    );
    expect(bindResult.success).toBe(true);
    const resetResult = resetPasswordByRecoveryKey(
      db,
      "admin",
      registerResult.recoveryKey,
      "Admin5678",
    );
    expect(resetResult.success).toBe(true);
    const loginResult = login(db, "admin", "Admin5678");
    expect(loginResult.success).toBe(true);
  });

  it("allows reset on a new device with recovery key", () => {
    const db = setupDatabase();
    const registerResult = registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    if (!registerResult.success) {
      throw new Error("register failed");
    }
    db.prepare(
      "UPDATE users SET device_fingerprint = ?, recovery_key_bound_at = ? WHERE username = ?",
    ).run("DIFFERENT_DEVICE", new Date().toISOString(), "admin");
    const resetResult = resetPasswordByRecoveryKey(
      db,
      "admin",
      registerResult.recoveryKey,
      "Admin5678",
    );
    expect(resetResult.success).toBe(true);
    const loginResult = login(db, "admin", "Admin5678");
    expect(loginResult.success).toBe(true);
  });

  it("changes password with old password", () => {
    const db = setupDatabase();
    registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    const changeResult = changePasswordWithOldPassword(
      db,
      "admin",
      "Admin1234",
      "Admin5678",
    );
    expect(changeResult.success).toBe(true);
    const loginResult = login(db, "admin", "Admin5678");
    expect(loginResult.success).toBe(true);
  });

  it("reveals recovery key with password", () => {
    const db = setupDatabase();
    const registerResult = registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    if (!registerResult.success) {
      throw new Error("register failed");
    }
    const revealResult = revealRecoveryKey(db, "admin", "Admin1234");
    expect(revealResult.success).toBe(true);
    if (revealResult.success) {
      expect(revealResult.recoveryKey).toBe(registerResult.recoveryKey);
    }
  });

  it("validates recovery key by username", () => {
    const db = setupDatabase();
    const registerResult = registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    if (!registerResult.success) {
      throw new Error("register failed");
    }
    const okResult = validateRecoveryKey(db, "admin", registerResult.recoveryKey);
    expect(okResult.success).toBe(true);
    const badResult = validateRecoveryKey(db, "admin", "RK-INVALID");
    expect(badResult.success).toBe(false);
  });

  it("blocks deleting admin user", () => {
    const db = setupDatabase();
    const registerResult = registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    if (!registerResult.success) {
      throw new Error("register failed");
    }
    const deleteResult = removeUser(db, registerResult.user.id);
    expect(deleteResult.success).toBe(false);
  });

  it("enforces email code send interval", () => {
    const db = setupDatabase();
    const firstCheck = verifyEmailCodeSendInterval(db, "password_reset", "admin");
    expect(firstCheck.success).toBe(true);
    const now = new Date().toISOString();
    markEmailCodeSent(db, "password_reset", "admin", now);
    const blocked = verifyEmailCodeSendInterval(db, "password_reset", "admin");
    expect(blocked.success).toBe(false);
    const past = new Date(Date.now() - 121 * 1000).toISOString();
    markEmailCodeSent(db, "password_reset", "admin", past);
    const allowed = verifyEmailCodeSendInterval(db, "password_reset", "admin");
    expect(allowed.success).toBe(true);
  });

  it("verifies admin email bind code", () => {
    const db = setupDatabase();
    const code = "123456";
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    saveEmailCode(db, "admin_email_bind", "admin", "admin@example.com", code, expiresAt);
    const mismatch = verifyEmailCode(
      db,
      "admin_email_bind",
      "admin",
      "other@example.com",
      code,
    );
    expect(mismatch.success).toBe(false);
    const okResult = verifyEmailCode(
      db,
      "admin_email_bind",
      "admin",
      "admin@example.com",
      code,
    );
    expect(okResult.success).toBe(true);
  });

  it("blocks admin role change", () => {
    const db = setupDatabase();
    const registerResult = registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    if (!registerResult.success) {
      throw new Error("register failed");
    }
    const updateResult = updateUserRole(db, registerResult.user.id, "USER");
    expect(updateResult.success).toBe(false);
  });

  it("blocks admin status change", () => {
    const db = setupDatabase();
    const registerResult = registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    if (!registerResult.success) {
      throw new Error("register failed");
    }
    const updateResult = updateUserStatus(db, registerResult.user.id, "DISABLED");
    expect(updateResult.success).toBe(false);
  });

  it("resets password with email code", () => {
    const db = setupDatabase();
    const registerResult = registerAdmin(db, "admin", "Admin1234", "admin@example.com");
    if (!registerResult.success) {
      throw new Error("register failed");
    }
    const code = "123456";
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    saveEmailCode(db, "password_reset", "admin", "admin@example.com", code, expiresAt);
    const resetResult = resetPasswordByEmailCode(
      db,
      "admin",
      "admin@example.com",
      code,
      "Admin5678",
    );
    expect(resetResult.success).toBe(true);
    const loginResult = login(db, "admin", "Admin5678");
    expect(loginResult.success).toBe(true);
  });
});
