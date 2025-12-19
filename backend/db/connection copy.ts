// Deno-native SQLite (no native .node bindings)
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

export const db = new DB("db/tasks.db"); // file is created if missing

// one-time init
db.execute(`
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  module TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);
`);

// db.execute(`PRAGMA user_version = 1;`);
// const [{ 0: ver }] = db.query<[number]>(`PRAGMA user_version`).asObjects();
// if (ver < 2) {
//   db.execute(`
//     -- example migration to v2
//     ALTER TABLE tasks ADD COLUMN notes TEXT;
//     PRAGMA user_version = 2;
//   `);
// }

// Tiny helpers (sync API is fine for class/demo)
export function listTasks() {
    const rows = db.query<[number, string, string, string, string | null, number]>(
        `SELECT id, title, status, priority, module, created_at FROM tasks ORDER BY id DESC`
    );
    return rows.map(([id, title, status, priority, module, created_at]) => ({
        id, title, status, priority, module, createdAt: created_at
    }));
}

export function addTask(title: string, module?: string) {
    const stmt = db.prepareQuery<[string, string?], number>(
        `INSERT INTO tasks (title, module) VALUES (?, ?)`
    );
    try {
        const lastId = stmt.execute([title, module ?? null]);
        return { id: lastId };
    } finally {
        stmt.finalize();
    }
}

export function deleteTask(id: number) {
    const stmt = db.prepareQuery<[number], number>(`DELETE FROM tasks WHERE id = ?`);
    try {
        stmt.execute([id]);
    } finally {
        stmt.finalize();
    }
}
