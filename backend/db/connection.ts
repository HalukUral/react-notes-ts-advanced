import initSqlJs from "sql.js";

// Resolve the wasm file location in a version-agnostic way
const wasmUrl = import.meta.resolve("sql.js/dist/sql-wasm.wasm");
const SQL = await initSqlJs({
  locateFile: () => wasmUrl,
});

// DB file on disk
const DB_FILE = "./db/tasks.db";

// Ensure ./db exists
try { await Deno.mkdir("./db", { recursive: true }); } catch {}

// Load existing DB or create a new one
let initial: Uint8Array | null = null;
try {
  initial = await Deno.readFile(DB_FILE);
} catch {
  initial = null;
}

export const sqlDb = initial ? new SQL.Database(initial) : new SQL.Database();

// Ensure schema and handle simple legacy migrations (idempotent)
// If an older DB has `name` instead of `username`, migrate it.
try {
  // Create tasks table if missing
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      module TEXT,
      user_id INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // If users table doesn't exist, create it
  const usersInfo = sqlDb.exec("PRAGMA table_info('users')");
  if (!usersInfo || usersInfo.length === 0) {
    sqlDb.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s','now'))
      );
    `);
  } else {
    // Determine existing columns
    const cols = usersInfo[0].values.map((r: any) => r[1]);
    const hasUsername = cols.includes('username');
    const hasName = cols.includes('name');

    if (!hasUsername) {
      // Perform migration to new users table with `username` column
      // If old column `name` exists, copy it to `username`.
      // Otherwise, derive username from the email local-part.
      sqlDb.run('BEGIN TRANSACTION;');
      sqlDb.run('ALTER TABLE users RENAME TO users_old;');
      sqlDb.run(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at INTEGER DEFAULT (strftime('%s','now'))
        );
      `);

      if (hasName) {
        sqlDb.run(`
          INSERT INTO users (id, username, email, password_hash, created_at)
          SELECT id, name, email, password_hash, created_at FROM users_old;
        `);
      } else {
        // Derive username from email local-part when possible
        sqlDb.run(`
          INSERT INTO users (id, username, email, password_hash, created_at)
          SELECT id,
                 CASE WHEN instr(email, '@') > 0 THEN substr(email, 1, instr(email, '@') - 1) ELSE email END,
                 email,
                 password_hash,
                 created_at
          FROM users_old;
        `);
      }

      sqlDb.run('DROP TABLE users_old;');
      sqlDb.run('COMMIT;');
    }
  }

  // Migrate tasks table to add user_id column if missing
  try {
    const tasksInfo = sqlDb.exec("PRAGMA table_info('tasks')");
    if (tasksInfo && tasksInfo.length > 0) {
      const cols = tasksInfo[0].values.map((r: any) => r[1]);
      const hasUserId = cols.includes('user_id');
      
      if (!hasUserId) {
        console.log("Migrating tasks table to add user_id column...");
        sqlDb.run(`
          ALTER TABLE tasks ADD COLUMN user_id INTEGER;
        `);
        console.log("Tasks table migrated successfully");
      }
    }
  } catch (err) {
    console.error('Tasks table migration error:', err);
  }
} catch (err) {
  console.error('DB schema bootstrap/migration error:', err);
}

export async function saveDb() {
  const data = sqlDb.export();
  await Deno.writeFile(DB_FILE, data);
}

console.log("🗄️ sql.js ready →", DB_FILE);
