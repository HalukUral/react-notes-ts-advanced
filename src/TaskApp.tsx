// TaskApp.tsx
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  taskReducer,
  initialState,
  selectVisible,
  selectCounts,
  type Filter,
  type Priority,
  type TaskStatus,
  type Task,
} from "./taskReducer";
import Modal from "./Modal";
import Sidebar from "./Sidebar";
const API = "http://localhost:8000/api";
type TaskRow = {
  id: number;
  title: string;
  status: "todo" | "in_progress" | "done" | "blocked" | "archived";
  priority: "low" | "medium" | "high";
  created_at?: number;
};

function safeParse<T>(s: string | null): T | null {
  try { return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}

type OldTask = { id: string; title: string; done: boolean; priority: Priority; createdAt: number };
type OldState = { tasks: OldTask[]; filter: any };

const STORAGE_KEY = "task-manager-state";

const STATUSES: TaskStatus[] = ["todo", "in_progress", "done", "blocked", "archived"];
const PRIOS: Priority[] = ["low", "medium", "high"];

export default function TaskApp() {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftPriority, setDraftPriority] = useState<Priority>("medium");
  const [draftStatus, setDraftStatus] = useState<TaskStatus>("todo");

  const [isNewOpen, setNewOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [q, setQ] = useState("");
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("darkMode");
    if (saved !== null) return saved === "true";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  
  // Apply dark mode
  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode.toString());
    if (isDarkMode) {
      document.documentElement.setAttribute("data-dark-mode", "true");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.removeAttribute("data-dark-mode");
      document.documentElement.style.colorScheme = "light";
    }
  }, [isDarkMode]);

  async function reload() {
    const url = q ? `${API}/tasks?q=${encodeURIComponent(q)}` : `${API}/tasks`;
    const token = localStorage.getItem("token");
    const headers: Record<string,string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        // If unauthorized, redirect to login but do NOT clear token here.
        if (res.status === 401) {
          window.location.pathname = '/login';
          return;
        }
        console.error('Failed to load tasks', res.status);
        setTasks([]);
        return;
      }
      const data = await res.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Error fetching tasks', e);
      setTasks([]);
    }
  }

  // WebSocket connection for real-time updates
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Decode JWT to get userId (basic extraction, not full verification)
    let userId: number | null = null;
    let username: string | null = null;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        userId = payload.userId;
        username = payload.username;
      }
    } catch (e) {
      console.warn('Failed to parse token:', e);
    }

    if (!userId || !username) {
      console.warn('Could not extract userId/username from token');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//localhost:8000/ws?userId=${userId}&username=${encodeURIComponent(username)}&token=${token}`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('✓ WebSocket connected');
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
      ws.onclose = () => clearInterval(pingInterval);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'task') {
          const { eventType, task } = message;
          
          setTasks((prevTasks) => {
            if (eventType === 'create') {
              
              return prevTasks.some(t => t.id === task.id) 
                ? prevTasks 
                : [...prevTasks, task];
            } else if (eventType === 'update') {
              
              return prevTasks.map(t => t.id === task.id ? task : t);
            } else if (eventType === 'delete') {
             
              return prevTasks.filter(t => t.id !== task.id);
            }
            return prevTasks;
          });
          
          console.log(`[WS] Task ${eventType}: ${task.title || task.id}`);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  useEffect(() => { reload(); }, []);       // initial load
  useEffect(() => { reload(); }, [q]);      // refetch on search
  // optional: small search
  // const [q, setQ] = useState("");

  // const [state, dispatch] = useReducer(
  //   taskReducer,
  //   undefined,
  //   () => {
  //     const stored = safeParse<unknown>(localStorage.getItem(STORAGE_KEY));
  //     // migrate if needed
  //     if (stored && typeof stored === "object" && "tasks" in (stored as any)) {
  //       const s = stored as OldState | any;
  //       if (s.tasks?.length && typeof s.tasks[0]?.done === "boolean") {
  //         const tasks = (s.tasks as OldTask[]).map(t => ({
  //           id: t.id,
  //           title: t.title,
  //           status: t.done ? "done" as TaskStatus : "todo",
  //           priority: t.priority ?? "medium",
  //           createdAt: t.createdAt ?? Date.now(),
  //         }));
  //         const filter: Filter = (["all", ...STATUSES] as const).includes(s.filter) ? s.filter : "all";
  //         return { tasks, filter };
  //       }
  //       // already new shape
  //       return s as any;
  //     }
  //     return initialState;
  //   }
  // );
  useEffect(() => { reload(); }, []);
  const editing = tasks.find(t => t.id === editId) || null;

  // useEffect(() => {
  //   localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // }, [state]);

  const visible = useMemo(() => {
    const byFilter = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
    return byFilter;
  }, [tasks, filter]);

  const counts = useMemo(() => {
    const base = { all: tasks.length, byStatus: { todo: 0, in_progress: 0, done: 0, blocked: 0, archived: 0 } };
    for (const t of tasks) (base as any)[t.status]++;
    return base;
  }, [tasks]);


  // keyboard shortcuts: N = new, / = search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === "n" || e.key === "N")) { e.preventDefault(); setNewOpen(true); }
      if (e.shiftKey && (e.key === "/")) { e.preventDefault(); (document.getElementById("q") as HTMLInputElement)?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  async function apiAdd(title: string, priority: Priority, status: TaskStatus) {
    const token = localStorage.getItem("token");
    const headers: Record<string,string> = { "content-type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(`${API}/tasks`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title, priority, status })
      });
      if (!res.ok && res.status === 401) {
        // Unauthorized: redirect to login but do NOT clear token here.
        window.location.pathname = '/login';
        return;
      }
    } catch (e) {
      console.error('Error adding task', e);
    }
    await reload();
  }

  async function apiUpdate(id: number, patch: Partial<TaskRow>) {
    const token = localStorage.getItem("token");
    const headers: Record<string,string> = { "content-type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(`${API}/tasks/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(patch)
      });
      if (!res.ok && res.status === 401) {
        // Unauthorized: redirect to login but do NOT clear token here.
        window.location.pathname = '/login';
        return;
      }
    } catch (e) {
      console.error('Error updating task', e);
    }
    await reload();
  }

  async function apiDelete(id: number) {
    const token = localStorage.getItem("token");
    const headers: Record<string,string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(`${API}/tasks/${id}`, { method: "DELETE", headers });
      if (!res.ok && res.status === 401) {
        // Unauthorized: redirect to login but do NOT clear token here.
        window.location.pathname = '/login';
        return;
      }
    } catch (e) {
      console.error('Error deleting task', e);
    }
    await reload();
  }

  // Logout handler: explicit clearing of token/user
  async function handleLogout() {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        // Call backend logout to blacklist the token
        await fetch(`${API}/auth/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
      }
    } catch (e) {
      console.error('Error calling logout endpoint', e);
    } finally {
      // Clear local storage regardless
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.pathname = '/login';
    }
  }

  // Top-bar quick add (if you have it)
  const add = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    await apiAdd(title, draftPriority, draftStatus);
    setDraftTitle("");
  };

  // Modal add
  const addFromModal = async () => {
    const title = draftTitle.trim();
    if (!title) return;
    await apiAdd(title, draftPriority, draftStatus);
    setDraftTitle(""); setDraftPriority("medium"); setDraftStatus("todo"); setNewOpen(false);
  };

  // Edit modal save
  const saveEdit = async (fields: Partial<{ title: string; priority: Priority; status: TaskStatus }>) => {
    if (!editing) return;
    await apiUpdate(editing.id, fields as any);
    setEditId(null);
  };

  // filter by q (client side)
  const filteredVisible = visible.filter(t =>
    !q || t.title.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div style={{ display: "flex", gridTemplateColumns: "220px 1fr", minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}>
      <Sidebar
        active={filter}
        counts={counts}
        onPick={(f) => setFilter(f)}
        onNew={() => setNewOpen(true)}
        onClearDone={async () => {
          // optional: delete all done on server
          const done = tasks.filter(t => t.status === "done");
          await Promise.all(done.map(t => fetch(`${API}/tasks/${t.id}`, { method: "DELETE" })));
          reload();
        }}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "24px 24px", width: "100%" }}>
        <h2 style={{ margin: 0, color: "var(--text-primary)" }}>Task Manager</h2>

        {/* top bar: search + quick add button */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <input id="q" value={q} onChange={e => setQ(e.target.value)} placeholder="Search tasks…" style={{ padding: 8, flex: 1 }} />
          <button onClick={() => setNewOpen(true)}>＋ New</button>
          <button onClick={handleLogout} style={{ marginLeft: 8 }}>Logout</button>
        </div>

        {/* List */}
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
          {filteredVisible.map((t, idx) => (
            <li key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 130px repeat(5, max-content)",
                gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-color)"
              }}>
              <button onClick={() => setEditId(t.id)} title="Edit" style={{ textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer", color: "var(--accent-color)" }}>
                <span style={{ textDecoration: t.status === "archived" ? "line-through" : "none", color: "var(--text-primary)" }} title={`priority: ${t.priority}`}>
                  {t.title}
                </span>
              </button>

              <select
                value={t.status}
                onChange={(e) => apiUpdate(t.id, { status: e.target.value as TaskStatus })}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={t.priority}
                onChange={(e) => apiUpdate(t.id, { priority: e.target.value as Priority })}
              >
                {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <button
                onClick={() => {
                  const order: TaskStatus[] = ["todo", "in_progress", "done", "blocked", "archived"];
                  const next = order[(order.indexOf(t.status) + 1) % order.length];
                  apiUpdate(t.id, { status: next });
                }}
                title="Cycle status"
              >⟳</button>
              {/* <button
                onClick={() => dispatch({ type: "reorder", from: idx, to: Math.max(0, idx - 1) })}
                disabled={idx === 0}
                title="Move up"
              >↑</button>
              <button
                onClick={() => dispatch({ type: "reorder", from: idx, to: Math.min(state.tasks.length - 1, idx + 1) })}
                disabled={idx === state.tasks.length - 1}
                title="Move down"
              >↓</button> */}
              <button onClick={() => setEditId(t.id)} title="Edit">✎</button>
              <button onClick={() => apiDelete(t.id)} title="Delete">✕</button>
            </li>
          ))}
        </ul>
      </main>

      {/* NEW TASK MODAL */}
      <Modal open={isNewOpen} onClose={() => setNewOpen(false)} title="New Task"
        footer={
          <>
            <button onClick={() => setNewOpen(false)}>Cancel</button>
            <button onClick={addFromModal}>Create</button>
          </>
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFromModal()}
            placeholder="Task title"
            style={{ padding: 8 }}
            autoFocus
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label>Priority{" "}
              <select value={draftPriority} onChange={e => setDraftPriority(e.target.value as Priority)}>
                {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>Status{" "}
              <select value={draftStatus} onChange={e => setDraftStatus(e.target.value as TaskStatus)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
        </div>
      </Modal>

      {/* EDIT TASK MODAL */}
      <Modal
        open={!!editing}
        onClose={() => setEditId(null)}
        title="Edit Task"
        footer={
          <>
            <button onClick={() => setEditId(null)}>Close</button>
            <button onClick={() => {
              const title = (document.getElementById("edit-title") as HTMLInputElement)?.value?.trim();
              const prio = (document.getElementById("edit-prio") as HTMLSelectElement)?.value as Priority;
              const st = (document.getElementById("edit-status") as HTMLSelectElement)?.value as TaskStatus;
              saveEdit({ title, priority: prio, status: st });
            }}>Save</button>
          </>
        }
      >
        {editing && (
          <div style={{ display: "grid", gap: 10 }}>
            <input id="edit-title" defaultValue={editing.title} style={{ padding: 8 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label>Priority{" "}
                <select id="edit-prio" defaultValue={editing.priority}>
                  {PRIOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label>Status{" "}
                <select id="edit-status" defaultValue={editing.status}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
