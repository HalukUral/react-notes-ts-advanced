// config/env.ts
/**
 * Safe environment variable reader with default or error.
 * Usage: const DB_URL = get("DATABASE_URL");
 */
export function get(key: string, def?: string): string {
    const v = Deno.env.get(key) ?? def;
    if (v === undefined) {
        throw new Error(`Missing env ${key}`);
    }
    return v;
}

// Example exports
export const DB_URL = get("DATABASE_URL", "sqlite://./db/tasks.db");
export const JWT_SECRET = get("JWT_SECRET", "dev-secret");
export const PORT = Number(get("PORT", "8000"));
