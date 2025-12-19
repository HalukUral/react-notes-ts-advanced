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
try {
    await migrate(orm, { migrationsFolder: "./db/migrations" });
    console.log("Migrations applied.");
} catch (e) {
    let exists = false;
    let e1 = e;
    while(e1){
        const msg = e1 instanceof Error ? e1.message : String(e1);
        if (msg.includes("already exists")) {
            exists=true;
            console.warn("Migrations skipped: tables already exist (baseline assumed).");
            break;
        }
        e1 = e1.cause;
    }

    if(!exists) {
        throw e; // farklı bir hata ise fırlat
    }
} finally {
    await saveDb();  // her durumda diske yaz
}
const baseHeaders = {
    ...cors,
    "content-type": "application/json; charset=utf-8",
};
const json = (data: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(data), {
        ...init,
        headers: { ...baseHeaders, ...(init.headers ?? {}) },
    });

// helper to extract numeric id
const matchId = (path: string) => {
    const m = path.match(/^\/api\/tasks\/(\d+)$/);
    return m ? Number(m[1]) : NaN;
};

// ---------- handlers ----------
type H = (req: Request, url: URL) => Promise<Response> | Response;

const hello: H = () => json({ msg: "Hello from Deno + sql.js ✅" });

const listTasks: H = async (_req, url) => {
    const q = (url.searchParams.get("q") || "").toLowerCase();
    let rows = await orm.select().from(tasks).all();
    if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    return json(rows);
};

const createTask: H = async (req) => {
    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    if (!title) return json({ error: "title required" }, { status: 400 });

    const priority = (body.priority ?? "medium") as string;
    const status = (body.status ?? "todo") as string;
    const module = (body.module ?? null) as string | null;

    const inserted = await orm
        .insert(tasks)
        .values({ title, priority, status, module })
        .returning()
        .get();

    await saveDb();

    const headers = new Headers(baseHeaders);
    headers.set("location", `/api/tasks/${inserted.id}`);
    return new Response(JSON.stringify(inserted), { status: 201, headers });
};

const updateTask: H = async (req, url) => {
    const id = matchId(url.pathname);
    if (Number.isNaN(id)) return json({ error: "invalid id" }, { status: 400 });

    const patch = await req.json().catch(() => ({}));
    const { id: _ignore, ...safePatch } = patch;

    await orm.update(tasks).set(safePatch).where(eq(tasks.id, id)).run();
    const updated = await orm.select().from(tasks).where(eq(tasks.id, id)).get();
    await saveDb();
    if (!updated) return json({ error: "not found" }, { status: 404 });
    return json(updated);
};

const deleteTask: H = async (_req, url) => {
    const id = matchId(url.pathname);
    if (Number.isNaN(id)) return json({ error: "invalid id" }, { status: 400 });
    await orm.delete(tasks).where(eq(tasks.id, id)).run();
    await saveDb();
    return json({ ok: true });
};

// ---------- router table ----------
const routes: [string, string, H][] = [
    ["GET", "^/api/hello$", hello],
    ["GET", "^/api/tasks$", listTasks],
    ["POST", "^/api/tasks$", createTask],
    ["PUT", "^/api/tasks/\\d+$", updateTask],
    ["DELETE", "^/api/tasks/\\d+$", deleteTask],
];

function match(method: string, path: string) {
    for (const [m, re, h] of routes) {
        if (m === method && new RegExp(re).test(path)) return h;
    }
    return null;
}

function allowedMethods(path: string) {
    const methods = routes
        .filter(([m, re]) => new RegExp(re).test(path))
        .map(([m]) => m);
    return Array.from(new Set(methods));
}

// ---------- server ----------
Deno.serve(
    async (req) => {
        const url = new URL(req.url);

        // CORS preflight
        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: cors });
        }

        const h = match(req.method, url.pathname);
        if (!h) {
            // same path but wrong method? -> 405
            const allowed = allowedMethods(url.pathname);
            if (allowed.length) {
                const headers = new Headers(cors);
                headers.set("allow", allowed.join(", ") + ", OPTIONS");
                return new Response(null, { status: 405, headers });
            }
            // completely unknown path -> 404
            return new Response("Not Found", { status: 404, headers: cors });
        }

        return await h(req, url);
    },
    { port: 8000 },
);

console.log("Deno server running at http://localhost:8000");
