// The editor's state: the project, a history of 300 steps, the selection and the playhead.
// A command copies the project, changes the copy and keeps the old one for undo. A drag is one transaction:
// begin() → live() on every move (always from the state at the start of the drag) → commit() makes one undo step.
import type { Id, Project } from "./schema";

export type Listener = () => void;
const clone = <T>(x: T): T => (typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

export class Editor {
  project: Project;
  past: { p: Project; label: string }[] = [];
  future: { p: Project; label: string }[] = [];
  limit = 300;
  selection: Id[] = [];
  playhead = 0;
  version = 0;                       // goes up on every change (for autosave and redraws)
  dirty = false;
  private tx: { base: Project; label: string } | null = null;
  private ls = new Set<Listener>();

  constructor(p: Project) { this.project = p; }
  subscribe(f: Listener) { this.ls.add(f); return () => { this.ls.delete(f); }; }
  emit() { this.version++; this.ls.forEach((f) => f()); }

  /** one undoable step */
  run<T>(label: string, fn: (draft: Project) => T): T {
    if (this.tx) this.commit();
    const draft = clone(this.project); const r = fn(draft);
    draft.updatedAt = Date.now();
    this.past.push({ p: this.project, label }); if (this.past.length > this.limit) this.past.shift();
    this.future = []; this.project = draft; this.dirty = true; this.emit(); return r;
  }
  begin(label: string) { if (this.tx) this.commit(); this.tx = { base: this.project, label }; }
  live<T>(fn: (draft: Project) => T): T | undefined {
    if (!this.tx) return undefined;
    const draft = clone(this.tx.base); const r = fn(draft); this.project = draft; this.emit(); return r;
  }
  commit() {
    if (!this.tx) return; const { base, label } = this.tx; this.tx = null;
    if (base === this.project) return;
    this.project.updatedAt = Date.now();
    this.past.push({ p: base, label }); if (this.past.length > this.limit) this.past.shift(); this.future = []; this.dirty = true; this.emit();
  }
  cancel() { if (!this.tx) return; this.project = this.tx.base; this.tx = null; this.emit(); }
  get inTx() { return !!this.tx; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  undo() { if (this.tx) this.cancel(); const s = this.past.pop(); if (!s) return null; this.future.push({ p: this.project, label: s.label }); this.project = s.p; this.dirty = true; this.emit(); return s.label; }
  redo() { const s = this.future.pop(); if (!s) return null; this.past.push({ p: this.project, label: s.label }); this.project = s.p; this.dirty = true; this.emit(); return s.label; }
  /** replace everything (open a project) — no undo step */
  load(p: Project) { this.tx = null; this.project = p; this.past = []; this.future = []; this.selection = []; this.playhead = 0; this.dirty = false; this.emit(); }
  select(ids: Id[]) { this.selection = ids; this.emit(); }
  seek(t: number) { this.playhead = Math.max(0, t); this.emit(); }
}
