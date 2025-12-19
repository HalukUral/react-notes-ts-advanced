// Sidebar.tsx
import { type Filter, type TaskStatus } from "./taskReducer";

type Counts = {
  total: number;
  byStatus: Record<TaskStatus, number>;
};

type Props = {
  active: Filter;
  onPick: (f: Filter) => void;
  counts: Counts;
  onNew: () => void;
  onClearDone: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
};

const ALL: Filter[] = ["all", "todo", "in_progress", "done", "blocked", "archived"];

export default function Sidebar({ active, onPick, counts, onNew, onClearDone, isDarkMode, onToggleDarkMode }: Props) {
  return (
    <aside style={aside}>
      <div style={brand}>🗂️ Tasks</div>

      <button style={primary} onClick={onNew}>＋ New Task</button>
      
      <button 
        onClick={onToggleDarkMode}
        title={isDarkMode ? "Light mode" : "Dark mode"}
        style={{...primary, fontSize: "1.2em", padding: "8px"}}
      >
        {isDarkMode ? "☀️" : "🌙"}
      </button>

      <nav style={{ marginTop: 16 }}>
        {ALL.map((f) => (
          <button
            key={f}
            onClick={() => onPick(f)}
            style={{
              ...navBtn,
              ...(active === f ? navBtnActive : null),
            }}
            title={`Show ${f}`}
          >
            <span style={{ textTransform: "none" }}>{label(f)}</span>
            <span style={{ marginLeft: "auto", opacity: 0.75 }}>
              {f === "all" ? counts.total :
                f === "todo" ? counts.byStatus.todo :
                  f === "in_progress" ? counts.byStatus.in_progress :
                    f === "done" ? counts.byStatus.done :
                      f === "blocked" ? counts.byStatus.blocked :
                        counts.byStatus.archived}
            </span>
          </button>
        ))}
      </nav>

      <div style={{ marginTop: "auto", display: "grid", gap: 8 }}>
        <button onClick={onClearDone} style={ghost}>Clear “done”</button>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Tip: Press <kbd>N</kbd> for new, <kbd>/</kbd> to focus search.
        </div>
      </div>
    </aside>
  );
}

function label(f: Filter) {
  if (f === "in_progress") return "in progress";
  return f;
}

const aside: React.CSSProperties = {
  width: 220, padding: 16, display: "flex", flexDirection: "column", gap: 12,
  borderRight: "1px solid var(--border-color)", background: "var(--bg-secondary)", 
  height: "100vh", position: "sticky", top: 0, color: "var(--text-primary)"
};
const brand: React.CSSProperties = { fontWeight: 700, letterSpacing: 0.3, marginBottom: 4 };
const primary: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 10, border: "1px solid transparent",
  background: "var(--accent-color)", color: "#fff", cursor: "pointer", textAlign: "left",
  transition: "opacity 0.2s"
};
const navBtn: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", gap: 8,
  padding: "8px 10px", borderRadius: 10, border: "1px solid transparent",
  background: "transparent", cursor: "pointer", color: "var(--text-primary)",
  transition: "background-color 0.2s"
};
const navBtnActive: React.CSSProperties = {
  background: "var(--hover-bg)", borderColor: "var(--border-color)", 
  boxShadow: "0 1px 0 rgba(0,0,0,0.03)"
};
const ghost: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 10, border: "1px solid var(--border-color)", 
  background: "var(--bg-primary)", cursor: "pointer", color: "var(--text-primary)",
  transition: "background-color 0.2s"
};
