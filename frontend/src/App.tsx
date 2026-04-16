import { StatusBadge } from "./components/StatusBadge";
import { FileTree } from "./components/FileTree";
import { MonacoPane } from "./components/MonacoPane";
import { OutputPanel } from "./components/OutputPanel";
import { Toolbar } from "./components/Toolbar";
import { AssistantPanel } from "./components/AssistantPanel";
import { StatusBar } from "./components/StatusBar";
import { useSessionLifecycle } from "./hooks/useSessionLifecycle";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";

export default function App() {
  useSessionLifecycle();
  useGlobalShortcuts();

  return (
    <div className="flex h-full flex-col bg-bg text-ink">
      <header className="flex items-center justify-between border-b border-border bg-panel/80 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-accent to-violet text-[11px] font-bold text-bg shadow-glow">
            AI
          </div>
          <h1 className="text-sm font-semibold tracking-tight text-ink">
            AI Code Editor
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Toolbar />
          <StatusBadge />
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[240px_1fr_400px] overflow-hidden">
        <aside className="min-h-0 border-r border-border bg-panel p-3">
          <FileTree />
        </aside>

        <section className="flex min-h-0 flex-col border-r border-border">
          <div className="min-h-0 flex-1">
            <MonacoPane />
          </div>
          <div className="h-64 min-h-0 border-t border-border">
            <OutputPanel />
          </div>
        </section>

        <aside className="min-h-0 bg-panel">
          <AssistantPanel />
        </aside>
      </main>

      <StatusBar />
    </div>
  );
}
