// backend/main.ts
import { orm } from "./db/drizzle.ts";
import { tasks } from "./db/schema.ts";
import { saveDb } from "./db/connection.ts";
import { eq } from "npm:drizzle-orm";
import { migrate } from "npm:drizzle-orm/sql-js/migrator";

const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
};


// Run pending migrations at boot, then persist the DB file
await migrate(orm, { migrationsFolder: "./db/migrations" });
await saveDb();  // ensure the migrated state is saved to ./db/tasks.db

function json(data: unknown, init: ResponseInit = {}) {
    const h = new Headers(init.headers || {});
    h.set("content-type", "application/json; charset=utf-8");
    for (const [k, v] of Object.entries(cors)) h.set(k, v);
    return new Response(JSON.stringify(data), { ...init, headers: h });
}


Deno.serve(async (req) => {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: cors });
    }

    // health
    if (url.pathname === "/api/hello") {
        return json({ msg: "Hello from Deno + sql.js ✅" });
    }

    // list (q ile arama)
    if (url.pathname === "/api/tasks" && req.method === "GET") {
        const q = (url.searchParams.get("q") || "").toLowerCase();
        let rows = await orm.select().from(tasks).all();
        if (q) rows = rows.filter(r => r.title.toLowerCase().includes(q));
        return json(rows);
    }

    // add
    if (url.pathname === "/api/tasks" && req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        const title = String(body.title || "").trim();
        if (!title) return json({ error: "title required" }, { status: 400 });

        const priority = (body.priority ?? "medium") as string;
        const status = (body.status ?? "todo") as string;
        const module = (body.module ?? null) as string | null;

        const inserted = await orm.insert(tasks).values({ title, priority, status, module }).returning().get();
        await saveDb();
        return json(inserted, { status: 201 });
    }

    // update
    if (url.pathname.startsWith("/api/tasks/") && req.method === "PUT") {
        const id = Number(url.pathname.split("/").pop());
        const patch = await req.json().catch(() => ({}));
        await orm.update(tasks).set(patch).where(eq(tasks.id, id)).run();
        const updated = await orm.select().from(tasks).where(eq(tasks.id, id)).get();
        await saveDb();
        return json(updated ?? {});
    }

    // delete
    if (url.pathname.startsWith("/api/tasks/") && req.method === "DELETE") {
        const id = Number(url.pathname.split("/").pop());
        await orm.delete(tasks).where(eq(tasks.id, id)).run();
        await saveDb();
        return json({ ok: true });
    }

    return new Response("Not Found", { status: 404, headers: cors });
}, { port: 8000 });

console.log("Deno server running at http://localhost:8000");
