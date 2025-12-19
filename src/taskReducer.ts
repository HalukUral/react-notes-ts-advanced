// taskReducer.ts
export type Id = string;

export type Priority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done" | "blocked" | "archived";
export type Filter = "all" | TaskStatus;

export interface Task {
  id: Id;
  title: string;
  status: TaskStatus;     // <-- replaces `done: boolean`
  priority: Priority;
  createdAt: number;
}

export interface State {
  tasks: Task[];
  filter: Filter;
}

export type Action =
  | { type: "add"; title: string; priority?: Priority; status?: TaskStatus }
  | { type: "setStatus"; id: Id; status: TaskStatus }
  | { type: "cycleStatus"; id: Id }          // optional convenience (todo -> in_progress -> done -> todo)
  | { type: "edit"; id: Id; title?: string; priority?: Priority }
  | { type: "remove"; id: Id }
  | { type: "clearDone" }                     // removes tasks with status === "done"
  | { type: "setFilter"; filter: Filter }
  | { type: "reorder"; from: number; to: number };

export const initialState: State = {
  tasks: [],
  filter: "all",
};

const newId = () => String(Date.now() + Math.random());

const CYCLE: TaskStatus[] = ["todo", "in_progress", "done"];
const nextStatus = (s: TaskStatus): TaskStatus => {
  const i = CYCLE.indexOf(s);
  return i === -1 ? "todo" : CYCLE[(i + 1) % CYCLE.length];
};

export function taskReducer(state: State, action: Action): State {
  switch (action.type) {
    case "add": {
      const title = action.title.trim();
      if (!title) return state;
      const t: Task = {
        id: newId(),
        title,
        status: action.status ?? "todo",
        priority: action.priority ?? "medium",
        createdAt: Date.now(),
      };
      return { ...state, tasks: [t, ...state.tasks] };
    }
    case "setStatus": {
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.id ? { ...t, status: action.status } : t
        ),
      };
    }
    case "cycleStatus": {
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.id ? { ...t, status: nextStatus(t.status) } : t
        ),
      };
    }
    case "edit": {
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.id
            ? {
              ...t,
              title: action.title ?? t.title,
              priority: action.priority ?? t.priority,
            }
            : t
        ),
      };
    }
    case "remove": {
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.id) };
    }
    case "clearDone": {
      return { ...state, tasks: state.tasks.filter(t => t.status !== "done") };
    }
    case "setFilter": {
      return { ...state, filter: action.filter };
    }
    case "reorder": {
      const next = [...state.tasks];
      const [moved] = next.splice(action.from, 1);
      if (!moved) return state;
      next.splice(action.to, 0, moved);
      return { ...state, tasks: next };
    }
    default:
      return state;
  }
}

/* --- Selectors --- */
export const selectCounts = (s: State) => {
  const byStatus = s.tasks.reduce<Record<TaskStatus, number>>(
    (acc, t) => ((acc[t.status]++, acc)),
    { todo: 0, in_progress: 0, done: 0, blocked: 0, archived: 0 }
  );
  return { total: s.tasks.length, byStatus };
};

export const selectVisible = (s: State) =>
  s.filter === "all" ? s.tasks : s.tasks.filter(t => t.status === s.filter);
