import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DatabaseInstance = Database.Database;

type MigrationRow = {
  version: string;
};

export const createDatabase = (dbPath: string): DatabaseInstance => {
  return new Database(dbPath);
};

export const initializeDatabase = (db: DatabaseInstance): void => {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
};

const listMigrationFiles = (migrationsDir: string): string[] => {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
};

const hasMigration = (db: DatabaseInstance, version: string): boolean => {
  const row = db
    .prepare("SELECT version FROM schema_migrations WHERE version = ?")
    .get(version) as MigrationRow | undefined;
  return Boolean(row);
};

export const applyMigrations = (
  db: DatabaseInstance,
  migrationsDir: string,
): void => {
  const migrations = listMigrationFiles(migrationsDir);
  migrations.forEach((file) => {
    const version = file.replace(".sql", "");
    if (hasMigration(db, version)) {
      return;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    const now = new Date().toISOString();
    db.transaction(() => {
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      ).run(version, now);
    })();
  });
};
