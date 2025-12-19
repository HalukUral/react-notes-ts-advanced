import { Hono } from "npm:hono";
import { eq } from "npm:drizzle-orm";
import { orm } from "../db/drizzle.ts";
import { tasks } from "../db/schema.ts";
import { saveDb } from "../db/connection.ts";

export const tasksRoute = new Hono();

// GET /api/tasks?q=keyword
tasksRoute.get("/", async (c) => {
    try {
        const user = c.get("user");
        if (!user) {
            return c.json({ error: "User not found in context" }, 401);
        }
        const q = (c.req.query("q") ?? "").toLowerCase();
        
        // Sadece bu user'a ait task'ları getir
        let rows = await orm.select().from(tasks)
            .where(eq(tasks.userId, user.userId))
            .all();
        
        if (q) rows = rows.filter((r) => r.title.toLowerCase().includes(q));
        return c.json(rows);
    } catch (error) {
        console.error("GET /api/tasks error:", error);
        return c.json({ error: "Failed to fetch tasks", details: String(error) }, 500);
    }
});

// POST /api/tasks
tasksRoute.post("/", async (c) => {
    try {
        const user = c.get("user");
        if (!user) {
            return c.json({ error: "User not found in context" }, 401);
        }
        const body = await c.req.json().catch(() => ({}));
        const title = String(body.title ?? "").trim();
        if (!title) return c.json({ error: "title required" }, 400);

        const priority = (body.priority ?? "medium") as string;
        const status = (body.status ?? "todo") as string;
        const module = (body.module ?? null) as string | null;

        const inserted = await orm
            .insert(tasks)
            .values({ 
                title, 
                priority, 
                status, 
                module,
                userId: user.userId
            })
            .returning()
            .get();

        await saveDb();

        const headers = new Headers();
        headers.set("location", `/api/tasks/${inserted.id}`);
        return new Response(JSON.stringify(inserted), {
            status: 201,
            headers,
        });
    } catch (error) {
        console.error("POST /api/tasks error:", error);
        return c.json({ error: "Failed to create task", details: String(error) }, 500);
    }
});

// PUT /api/tasks/:id
tasksRoute.put("/:id", async (c) => {
    const user = c.get("user");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);

    // Önce task'ın bu user'a ait olup olmadığını kontrol et
    const existingTask = await orm.select().from(tasks)
        .where(eq(tasks.id, id))
        .get();
    
    if (!existingTask) {
        return c.json({ error: "task not found" }, 404);
    }
    
    if (existingTask.userId !== user.userId) {
        return c.json({ error: "unauthorized" }, 403);
    }

    const patch = await c.req.json().catch(() => ({}));
    const { id: _ignore, userId: _ignore2, ...safePatch } = patch;

    await orm.update(tasks).set(safePatch).where(eq(tasks.id, id)).run();
    const updated = await orm.select().from(tasks).where(eq(tasks.id, id)).get();
    await saveDb();

    if (!updated) return c.json({ error: "not found" }, 404);
    return c.json(updated);
});

// DELETE /api/tasks/:id
tasksRoute.delete("/:id", async (c) => {
    const user = c.get("user");
    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "invalid id" }, 400);

    // Önce task'ın bu user'a ait olup olmadığını kontrol et
    const existingTask = await orm.select().from(tasks)
        .where(eq(tasks.id, id))
        .get();
    
    if (!existingTask) {
        return c.json({ error: "task not found" }, 404);
    }
    
    if (existingTask.userId !== user.userId) {
        return c.json({ error: "unauthorized" }, 403);
    }

    await orm.delete(tasks).where(eq(tasks.id, id)).run();
    await saveDb();
    return c.json({ ok: true });
});