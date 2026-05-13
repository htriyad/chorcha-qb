import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Library, ChevronRight, ChevronDown, Plus, Trash2, Pencil,
  FolderOpen, Folder, BookOpen, FileText, Loader2,
  ArrowLeft, Check, X, BookMarked, Eye, EyeOff, RefreshCw, Menu, Save, FolderPlus,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { useAuth, authFetch } from "@/contexts/AuthContext";
import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MathText } from "@/components/MathText";

// ── Tree types ─────────────────────────────────────────────────────────────
interface Card { id: number; name: string; color: string; icon: string; createdAt: string }
interface LibFolder { id: number; cardId: number; name: string; createdAt: string }
interface SubFolder { id: number; folderId: number; parentSubFolderId: number | null; name: string; qsetCount: number; createdAt: string; children: SubFolder[] }
interface FolderNode extends LibFolder { subfolders: SubFolder[] }
interface CardNode extends Card { folders: FolderNode[] }
interface QuestionSet { id: number; subFolderId: number; name: string; detectedType: string | null; forcedType: string | null; aiStatus: string; createdAt: string }
interface LibQuestion { id: number; questionSetId: number; position: number; type: string; data: Record<string, unknown> }
interface QSetFull extends QuestionSet { questions: LibQuestion[] }

// ── API helper ─────────────────────────────────────────────────────────────
async function api<T>(token: string | null, path: string, opts?: RequestInit): Promise<T> {
  const res = await authFetch(token, path, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Inline edit ────────────────────────────────────────────────────────────
function InlineInput({ defaultValue, onSave, onCancel, placeholder }: {
  defaultValue?: string; onSave: (v: string) => Promise<void>; onCancel: () => void; placeholder?: string;
}) {
  const [val, setVal] = useState(defaultValue ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const commit = async () => {
    if (!val.trim()) return;
    setSaving(true);
    try { await onSave(val.trim()); } finally { setSaving(false); }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); void commit(); }}
      className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
      <Input ref={ref} value={val} onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder ?? "Name…"}
        className="h-6 text-xs py-0 px-2 flex-1 min-w-0" disabled={saving} />
      <button type="submit" disabled={saving || !val.trim()}
        className="p-1 text-primary hover:bg-primary/10 rounded disabled:opacity-40">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      </button>
      <button type="button" onClick={onCancel}
        className="p-1 text-muted-foreground hover:bg-muted/50 rounded">
        <X className="w-3 h-3" />
      </button>
    </form>
  );
}

// ── SubFolder tree node (recursive) ───────────────────────────────────────
function SubFolderNode({
  sf, depth, token, ce, selectedSubFolderId,
  onSelect, onRename, onDelete, onAddChild, onChildCreated,
}: {
  sf: SubFolder; depth: number; token: string | null; ce: boolean;
  selectedSubFolderId: number | null;
  onSelect: (sf: SubFolder) => void;
  onRename: (sf: SubFolder, name: string) => Promise<void>;
  onDelete: (sf: SubFolder) => Promise<void>;
  onAddChild: (sf: SubFolder, name: string) => Promise<void>;
  onChildCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [addingChild, setAddingChild] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const selected = sf.id === selectedSubFolderId;
  const indent = depth * 12;

  const hasExpandable = sf.children.length > 0 || ce;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1.5 pr-1 rounded-md cursor-pointer transition-colors text-sm ${
          selected ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted/40 text-foreground/80"
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={() => onSelect(sf)}
      >
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="p-0.5 rounded hover:bg-muted/60 shrink-0">
          {hasExpandable
            ? open
              ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
              : <ChevronRight className="w-3 h-3 text-muted-foreground" />
            : <span className="w-3 h-3 block" />}
        </button>

        {open ? <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-500" /> : <Folder className="w-3.5 h-3.5 shrink-0 text-amber-500" />}

        {renaming ? (
          <InlineInput defaultValue={sf.name}
            onSave={async (n) => { await onRename(sf, n); setRenaming(false); }}
            onCancel={() => setRenaming(false)} />
        ) : (
          <>
            <span className="flex-1 truncate text-xs">{sf.name}</span>
            {sf.qsetCount > 0 && !showActions && (
              <span className="text-[9px] bg-muted/60 text-muted-foreground px-1 rounded-full shrink-0 mr-1">
                {sf.qsetCount}
              </span>
            )}
            {ce && showActions && (
              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button type="button" title="Add sub-folder"
                  onClick={() => { setAddingChild(true); setOpen(true); }}
                  className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary">
                  <FolderPlus className="w-3 h-3" />
                </button>
                <button type="button" title="Rename" onClick={() => setRenaming(true)}
                  className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground">
                  <Pencil className="w-3 h-3" />
                </button>
                <button type="button" title="Delete" onClick={() => { void onDelete(sf); }}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {open && (
        <div>
          {sf.children.map((c) => (
            <SubFolderNode key={c.id} sf={c} depth={depth + 1} token={token} ce={ce}
              selectedSubFolderId={selectedSubFolderId}
              onSelect={onSelect} onRename={onRename} onDelete={onDelete}
              onAddChild={onAddChild} onChildCreated={onChildCreated} />
          ))}
          {addingChild ? (
            <div style={{ paddingLeft: `${indent + 28}px` }} className="py-1 pr-2">
              <InlineInput placeholder="Sub-folder name…"
                onSave={async (n) => { await onAddChild(sf, n); setAddingChild(false); onChildCreated(); }}
                onCancel={() => setAddingChild(false)} />
            </div>
          ) : ce && (
            <button type="button"
              onClick={(e) => { e.stopPropagation(); setAddingChild(true); }}
              style={{ paddingLeft: `${indent + 28}px` }}
              className="w-full flex items-center gap-1.5 pr-2 py-1 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors">
              <Plus className="w-3 h-3" />
              <span>Add sub-folder</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Question viewer ────────────────────────────────────────────────────────
type QSViewMode = "practice" | "solution" | "edit";

function QSetViewer({ qs, onBack, token, canEdit }: {
  qs: QSetFull; onBack: () => void; token: string | null; canEdit: boolean;
}) {
  const [mode, setMode] = useState<QSViewMode>("practice");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [localQs, setLocalQs] = useState<LibQuestion[]>(qs.questions);
  const [addingType, setAddingType] = useState<"mcq" | "cq" | null>(null);
  const [addingBusy, setAddingBusy] = useState(false);
  const toggle = (id: number) => setRevealed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sorted = [...localQs].sort((a, b) => a.position - b.position);

  const handleSaved = (updated: LibQuestion) => {
    setLocalQs((prev) => prev.map((q) => q.id === updated.id ? updated : q));
  };

  const handleDeleted = (id: number) => {
    setLocalQs((prev) => prev.filter((q) => q.id !== id));
  };

  const handleMove = async (id: number, dir: -1 | 1) => {
    const s = [...localQs].sort((a, b) => a.position - b.position);
    const idx = s.findIndex((q) => q.id === id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= s.length) return;
    const newOrder = s.map((q) => q.id);
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
    const reordered = s.map((q, i) => ({ ...q, position: i }));
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const fixed = reordered.map((q, i) => ({ ...q, position: i }));
    setLocalQs(fixed);
    try {
      await authFetch(token, `/library/questionsets/${qs.id}/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ order: newOrder }),
      });
    } catch { }
  };

  const addBlankQuestion = async (type: "mcq" | "cq") => {
    setAddingBusy(true);
    try {
      const blankData: Record<string, unknown> = type === "mcq"
        ? { question: "", options: [{ letter: "A", text: "" }, { letter: "B", text: "" }, { letter: "C", text: "" }, { letter: "D", text: "" }], solution: "", aiSolution: "" }
        : { question: "", parts: [{ key: "A", label: "ক", text: "", solution: "", aiSolution: null }, { key: "B", label: "খ", text: "", solution: "", aiSolution: null }, { key: "C", label: "গ", text: "", solution: "", aiSolution: null }], aiSolution: "" };
      const res = await authFetch(token, `/library/questionsets/${qs.id}/questions`, {
        method: "POST",
        body: JSON.stringify({ type, data: blankData }),
      });
      if (res.ok) {
        const newQ = await res.json() as LibQuestion;
        setLocalQs((prev) => [...prev, newQ]);
        setMode("edit");
      }
    } catch { } finally { setAddingBusy(false); setAddingType(null); }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-border/50 px-4 md:px-6 py-3 flex items-center gap-3 z-10">
        <button type="button" onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{qs.name}</h2>
          <p className="text-xs text-muted-foreground">{sorted.length} question{sorted.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-0.5 gap-0.5 shrink-0">
          <button type="button" onClick={() => { setMode("practice"); setRevealed(new Set()); }}
            className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "practice" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <EyeOff className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Practice</span>
          </button>
          <button type="button" onClick={() => { setMode("solution"); setRevealed(new Set()); }}
            className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === "solution" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Solution</span>
          </button>
          {canEdit && (
            <button type="button" onClick={() => { setMode("edit"); setRevealed(new Set()); }}
              className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === "edit" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Pencil className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {sorted.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-16">No questions in this set</div>
        )}
        {sorted.map((q, idx) => (
          <QuestionCard key={q.id} q={q} num={idx + 1} mode={mode} token={token}
            revealed={revealed.has(q.id)} onToggle={() => toggle(q.id)} onSaved={handleSaved}
            onDeleted={canEdit ? handleDeleted : undefined}
            onMoveUp={canEdit && idx > 0 ? () => handleMove(q.id, -1) : undefined}
            onMoveDown={canEdit && idx < sorted.length - 1 ? () => handleMove(q.id, 1) : undefined}
          />
        ))}
        {canEdit && mode === "edit" && (
          <div className="border-2 border-dashed border-border/50 rounded-xl p-4">
            {addingType === null ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-xs text-muted-foreground">Add question:</span>
                <button type="button" disabled={addingBusy}
                  onClick={() => setAddingType("mcq")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> MCQ
                </button>
                <button type="button" disabled={addingBusy}
                  onClick={() => setAddingType("cq")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-400 text-xs font-semibold hover:bg-violet-500/20 transition-colors disabled:opacity-50">
                  <Plus className="w-3.5 h-3.5" /> CQ
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <span className="text-xs text-muted-foreground">Add blank {addingType.toUpperCase()}?</span>
                <button type="button" disabled={addingBusy} onClick={() => void addBlankQuestion(addingType)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-semibold hover:bg-green-600 transition-colors disabled:opacity-50">
                  {addingBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirm
                </button>
                <button type="button" disabled={addingBusy} onClick={() => setAddingType(null)}
                  className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs hover:bg-muted/70 transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({ q, num, mode, revealed, onToggle, token, onSaved, onDeleted, onMoveUp, onMoveDown }: {
  q: LibQuestion; num: number; mode: QSViewMode; revealed: boolean;
  onToggle: () => void; token: string | null; onSaved: (updated: LibQuestion) => void;
  onDeleted?: (id: number) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const d = q.data as Record<string, unknown>;
  const question = (d.question as string) ?? "";
  const showAnswer = mode === "solution" || revealed;
  const isEdit = mode === "edit";

  const [editData, setEditData] = useState<Record<string, unknown>>(() => ({ ...q.data }));
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setEditData({ ...q.data }); setSaveErr(null); setSaved(false); }, [q.data]);

  const saveEdit = async () => {
    setSaving(true); setSaveErr(null); setSaved(false);
    try {
      const res = await authFetch(token, `/library/questions/${q.id}`, {
        method: "PUT",
        body: JSON.stringify({ data: editData, type: q.type }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})) as { error?: string }; throw new Error(b.error ?? `HTTP ${res.status}`); }
      const updated = await res.json() as LibQuestion;
      onSaved({ ...updated, data: editData });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setSaveErr((e as Error).message); }
    finally { setSaving(false); }
  };

  const deleteQuestion = async () => {
    if (!confirm("Delete this question?")) return;
    setDeleting(true);
    try {
      await authFetch(token, `/library/questions/${q.id}`, { method: "DELETE" });
      onDeleted?.(q.id);
    } catch (e) { alert((e as Error).message); }
    finally { setDeleting(false); }
  };

  const ed = editData as Record<string, unknown>;

  const NumBadge = () => (
    <span className="text-xs font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded shrink-0 mt-0.5 select-none">
      {num}
    </span>
  );

  const EditSaveBar = () => (
    <div className="border-t border-amber-200/60 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/20 px-4 md:px-5 py-2.5 flex items-center gap-2 flex-wrap">
      <button type="button" onClick={() => void saveEdit()} disabled={saving}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 transition-colors">
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
      <div className="flex items-center gap-1 ml-auto">
        {onMoveUp && (
          <button type="button" onClick={onMoveUp} title="Move up"
            className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        )}
        {onMoveDown && (
          <button type="button" onClick={onMoveDown} title="Move down"
            className="p-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        )}
        {onDeleted && (
          <button type="button" onClick={() => void deleteQuestion()} disabled={deleting} title="Delete question"
            className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      {saveErr && <span className="text-xs text-destructive w-full">{saveErr}</span>}
    </div>
  );

  if (isEdit) {
    if (q.type === "mcq") {
      const opts = (ed.options as Array<{ letter: string; text: string }>) ?? [];
      return (
        <div className="border border-amber-300/60 dark:border-amber-700/40 rounded-xl bg-card overflow-hidden">
          <div className="px-4 md:px-5 py-4 space-y-3">
            <div className="flex items-start gap-2">
              <NumBadge />
              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Question</p>
                <textarea rows={3} value={(ed.question as string) ?? ""} onChange={(e) => setEditData((p) => ({ ...p, question: e.target.value }))}
                  className="w-full text-sm border border-border/60 rounded-lg px-3 py-2 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Options</p>
              {opts.map((opt, oi) => (
                <div key={opt.letter} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary w-5 shrink-0">{opt.letter}</span>
                  <input type="text" value={opt.text} onChange={(e) => {
                    const newOpts = opts.map((o, i) => i === oi ? { ...o, text: e.target.value } : o);
                    setEditData((p) => ({ ...p, options: newOpts }));
                  }} className="flex-1 text-xs border border-border/60 rounded px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">Answer</p>
              <div className="flex gap-1">
                {opts.map((opt) => {
                  const active = (ed.solution as string) === opt.letter;
                  return (
                    <button key={opt.letter} type="button" onClick={() => setEditData((p) => ({ ...p, solution: opt.letter }))}
                      className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${active ? "bg-green-500 text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                      {opt.letter}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">AI Explanation</p>
              <textarea rows={3} value={(ed.aiSolution as string) ?? ""} onChange={(e) => setEditData((p) => ({ ...p, aiSolution: e.target.value }))}
                placeholder="Optional AI explanation…"
                className="w-full text-xs border border-border/60 rounded-lg px-3 py-2 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/40 placeholder:text-muted-foreground/40" />
            </div>
          </div>
          <EditSaveBar />
        </div>
      );
    }

    if (q.type === "cq") {
      const parts = (ed.parts as Array<{ key: string; label: string; text: string; solution: string | null; aiSolution: string | null }>) ?? [];
      return (
        <div className="border border-amber-300/60 dark:border-amber-700/40 rounded-xl bg-card overflow-hidden">
          <div className="px-4 md:px-5 py-4 space-y-3">
            <div className="flex items-start gap-2">
              <NumBadge />
              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Question (Stem)</p>
                <textarea rows={3} value={(ed.question as string) ?? ""} onChange={(e) => setEditData((p) => ({ ...p, question: e.target.value }))}
                  className="w-full text-sm border border-border/60 rounded-lg px-3 py-2 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
              </div>
            </div>
            {parts.map((part, pi) => (
              <div key={part.key} className="space-y-1.5 border border-border/40 rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase text-primary">{part.label}</p>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Part text</p>
                  <textarea rows={2} value={part.text} onChange={(e) => {
                    const newParts = parts.map((p, i) => i === pi ? { ...p, text: e.target.value } : p);
                    setEditData((prev) => ({ ...prev, parts: newParts }));
                  }} className="w-full text-xs border border-border/60 rounded px-2 py-1.5 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Solution / answer</p>
                  <textarea rows={2} value={part.solution ?? ""} onChange={(e) => {
                    const newParts = parts.map((p, i) => i === pi ? { ...p, solution: e.target.value } : p);
                    setEditData((prev) => ({ ...prev, parts: newParts }));
                  }} className="w-full text-xs border border-border/60 rounded px-2 py-1.5 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                </div>
              </div>
            ))}
          </div>
          <EditSaveBar />
        </div>
      );
    }

    return (
      <div className="border border-amber-300/60 dark:border-amber-700/40 rounded-xl bg-card overflow-hidden">
        <div className="px-4 md:px-5 py-4 space-y-3">
          <div className="flex items-start gap-2">
            <NumBadge />
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Question</p>
              <textarea rows={3} value={(ed.question as string) ?? ""} onChange={(e) => setEditData((p) => ({ ...p, question: e.target.value }))}
                className="w-full text-sm border border-border/60 rounded-lg px-3 py-2 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">Answer / Solution</p>
            <textarea rows={4} value={(ed.solution as string) ?? ""} onChange={(e) => setEditData((p) => ({ ...p, solution: e.target.value }))}
              className="w-full text-sm border border-border/60 rounded-lg px-3 py-2 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
          </div>
        </div>
        <EditSaveBar />
      </div>
    );
  }

  if (q.type === "mcq") {
    const options = (d.options as Array<{ letter: string; text: string }>) ?? [];
    const rawSolution = (d.solution as string) ?? "";
    const aiSolution = (d.aiSolution as string) ?? "";
    const isAnswerKey = /^[A-E]$/.test(rawSolution.trim()) && options.some((o) => o.letter === rawSolution.trim());
    const answerLetter = isAnswerKey ? rawSolution.trim() : null;
    const solutionText = isAnswerKey ? "" : rawSolution;

    return (
      <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
        <div className="px-4 md:px-5 py-4">
          <div className="flex items-start gap-2 mb-3">
            <NumBadge />
            <div className="text-sm text-foreground leading-relaxed"><MathText text={question} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {options.map((opt) => {
              const isCorrect = showAnswer && answerLetter === opt.letter;
              return (
                <div key={opt.letter} className={`flex items-start gap-2 px-3 py-2 rounded-lg border transition-colors ${
                  isCorrect ? "bg-green-50 dark:bg-green-950/30 border-green-300/60 dark:border-green-700/50" : "bg-muted/30 border-border/40"
                }`}>
                  <span className={`text-xs font-bold shrink-0 ${isCorrect ? "text-green-700 dark:text-green-400" : "text-primary"}`}>
                    {opt.letter}{isCorrect ? " ✓" : ""}
                  </span>
                  <span className={`text-xs leading-relaxed ${isCorrect ? "text-green-900 dark:text-green-200 font-medium" : "text-foreground/80"}`}>
                    <MathText text={opt.text} imageBlock={false} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        {showAnswer && solutionText && (
          <div className="border-t border-border/40 bg-green-50/30 dark:bg-green-950/20 px-4 md:px-5 py-3">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Solution</p>
            <div className="text-sm text-foreground/90"><MathText text={solutionText} /></div>
          </div>
        )}
        {showAnswer && aiSolution && (
          <div className="border-t border-border/40 bg-blue-50/30 dark:bg-blue-950/20 px-4 md:px-5 py-3">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">AI Explanation</p>
            <div className="text-sm text-foreground/90"><MathText text={aiSolution} /></div>
          </div>
        )}
        {mode === "practice" && (
          <button type="button" onClick={onToggle}
            className="w-full px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/40">
            {revealed ? "Hide answer" : "Tap to reveal answer"}
          </button>
        )}
      </div>
    );
  }

  if (q.type === "cq") {
    const parts = (d.parts as Array<{ key: string; label: string; text: string; solution: string | null; aiSolution: string | null }>) ?? [];
    return (
      <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
        <div className="px-4 md:px-5 py-4">
          <div className="flex items-start gap-2 mb-3">
            <NumBadge />
            <div className="text-sm text-foreground leading-relaxed"><MathText text={question} /></div>
          </div>
        </div>
        <div className="border-t border-border/40">
          {parts.map((part) => (
            <CqPartRow key={part.key} part={part} showAnswer={showAnswer} study={mode === "practice"} />
          ))}
        </div>
      </div>
    );
  }

  const solution = (d.solution as string) || (d.aiSolution as string) || "";
  return (
    <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
      <div className="px-4 md:px-5 py-4">
        <div className="flex items-start gap-2">
          <NumBadge />
          <div className="text-sm text-foreground leading-relaxed"><MathText text={question} /></div>
        </div>
      </div>
      {showAnswer && solution && (
        <div className="border-t border-border/40 bg-blue-50/30 dark:bg-blue-950/20 px-4 md:px-5 py-3">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Answer</p>
          <div className="text-sm"><MathText text={solution} /></div>
        </div>
      )}
      {mode === "practice" && (
        <button type="button" onClick={onToggle}
          className="w-full px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/40">
          {revealed ? "Hide answer" : "Tap to reveal answer"}
        </button>
      )}
    </div>
  );
}

function CqPartRow({ part, showAnswer, study }: {
  part: { key: string; label: string; text: string; solution: string | null; aiSolution: string | null };
  showAnswer: boolean; study: boolean;
}) {
  const [open, setOpen] = useState(false);
  const answer = part.solution || part.aiSolution || "";
  const show = showAnswer || open;
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <button type="button" onClick={() => study && setOpen((v) => !v)}
        className={`w-full flex items-start gap-3 px-4 md:px-5 py-3 text-left transition-colors ${study ? "hover:bg-muted/30 cursor-pointer" : "cursor-default"}`}>
        <span className="text-xs font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">{part.label}</span>
        <div className="flex-1 text-xs text-foreground/80 leading-relaxed"><MathText text={part.text} /></div>
        {study && <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>
      {show && answer && (
        <div className="px-4 md:px-5 pb-3 ml-10">
          <div className="bg-green-50/50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/40 rounded-lg px-3 py-2">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">উত্তর</p>
            <div className="text-xs text-foreground/90"><MathText text={answer} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  mcq: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  cq:  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  sq:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};
function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase ${TYPE_COLORS[type] ?? "bg-muted text-muted-foreground"}`}>{type}</span>;
}

const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#0ea5e9", "#f97316", "#ec4899"];
const ICONS  = ["📚", "📖", "📝", "🗂️", "🏆", "🔬", "🧮", "📐", "🌍", "💡"];

// ── Main Library Page ──────────────────────────────────────────────────────
export default function LibraryPage() {
  const { token, user, canEdit } = useAuth();
  const [, setLoc] = useLocation();

  const [tree, setTree] = useState<CardNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  const [addingCard, setAddingCard] = useState(false);
  const [newCardColor, setNewCardColor] = useState(COLORS[0]);
  const [newCardIcon, setNewCardIcon] = useState(ICONS[0]);
  const [renamingCard, setRenamingCard] = useState<number | null>(null);
  const [addingFolderIn, setAddingFolderIn] = useState<number | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<number | null>(null);
  const [addingSubfolderIn, setAddingSubfolderIn] = useState<number | null>(null);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);

  const [selectedSfId, setSelectedSfId] = useState<number | null>(null);
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [loadingQSets, setLoadingQSets] = useState(false);
  const [selectedQSet, setSelectedQSet] = useState<QSetFull | null>(null);
  const [loadingQSet, setLoadingQSet] = useState(false);
  const [addingQSet, setAddingQSet] = useState(false);
  const [newQSetName, setNewQSetName] = useState("");

  useEffect(() => { if (!user) setLoc("/login"); }, [user, setLoc]);

  const loadTree = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError(null);
    try {
      const data = await api<CardNode[]>(token, "/library/tree");
      setTree(data);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void loadTree(); }, [loadTree]);

  const loadQSets = useCallback(async (sfId: number) => {
    if (!token) return;
    setLoadingQSets(true);
    try {
      const rows = await api<QuestionSet[]>(token, `/library/subfolders/${sfId}/questionsets`);
      setQuestionSets(rows);
    } catch { setQuestionSets([]); } finally { setLoadingQSets(false); }
  }, [token]);

  const selectSf = (sf: SubFolder) => {
    setSelectedSfId(sf.id);
    setSelectedQSet(null);
    void loadQSets(sf.id);
    setMobileSidebarOpen(false);
  };

  const openQSet = async (qs: QuestionSet) => {
    setLoadingQSet(true);
    try {
      const full = await api<QSetFull>(token, `/library/questionsets/${qs.id}`);
      setSelectedQSet(full);
    } catch { } finally { setLoadingQSet(false); }
  };

  const createCard = async (name: string) => {
    const row = await api<CardNode>(token, "/library/cards", {
      method: "POST", body: JSON.stringify({ name, color: newCardColor, icon: newCardIcon }),
    });
    setTree((prev) => [...prev, { ...row, folders: [] }]);
    setAddingCard(false);
  };

  const renameCard = async (id: number, name: string) => {
    const card = tree.find((c) => c.id === id)!;
    await api(token, `/library/cards/${id}`, { method: "PUT", body: JSON.stringify({ name, color: card.color, icon: card.icon }) });
    setTree((prev) => prev.map((c) => c.id === id ? { ...c, name } : c));
    setRenamingCard(null);
  };

  const deleteCard = async (id: number, name: string) => {
    if (!confirm(`Delete card "${name}"? All folders and question sets inside will be deleted.`)) return;
    try {
      await api(token, `/library/cards/${id}`, { method: "DELETE" });
      setTree((prev) => prev.filter((c) => c.id !== id));
      if (selectedSfId && tree.find((c) => c.id === id)?.folders.some((f) => f.subfolders.some((sf) => sf.id === selectedSfId))) {
        setSelectedSfId(null); setQuestionSets([]);
      }
    } catch (e) { alert((e as Error).message); }
  };

  const createFolder = async (cardId: number, name: string) => {
    const row = await api<FolderNode>(token, `/library/cards/${cardId}/folders`, { method: "POST", body: JSON.stringify({ name }) });
    setTree((prev) => prev.map((c) => c.id === cardId ? { ...c, folders: [...c.folders, { ...row, subfolders: [] }] } : c));
    setAddingFolderIn(null);
  };

  const renameFolder = async (f: FolderNode, name: string) => {
    await api(token, `/library/folders/${f.id}`, { method: "PUT", body: JSON.stringify({ name }) });
    setTree((prev) => prev.map((c) => c.id === f.cardId ? {
      ...c, folders: c.folders.map((fl) => fl.id === f.id ? { ...fl, name } : fl),
    } : c));
    setRenamingFolder(null);
  };

  const deleteFolder = async (f: FolderNode) => {
    if (!confirm(`Delete folder "${f.name}"?`)) return;
    try {
      await api(token, `/library/folders/${f.id}`, { method: "DELETE" });
      setTree((prev) => prev.map((c) => c.id === f.cardId ? {
        ...c, folders: c.folders.filter((fl) => fl.id !== f.id),
      } : c));
    } catch (e) { alert((e as Error).message); }
  };

  const updateSfInTree = (updater: (sf: SubFolder) => SubFolder | null, nodes: SubFolder[]): SubFolder[] =>
    nodes.flatMap((sf) => {
      const res = updater(sf);
      if (res === null) return [];
      return [{ ...res, children: updateSfInTree(updater, sf.children) }];
    });

  const createSubfolder = async (folderId: number, cardId: number, name: string) => {
    const row = await api<SubFolder>(token, `/library/folders/${folderId}/subfolders`, { method: "POST", body: JSON.stringify({ name }) });
    setTree((prev) => prev.map((c) => c.id !== cardId ? c : {
      ...c, folders: c.folders.map((f) => f.id !== folderId ? f : {
        ...f, subfolders: [...f.subfolders, { ...row, qsetCount: 0, children: [] }],
      }),
    }));
    setAddingSubfolderIn(null);
  };

  const createChildSf = async (parent: SubFolder, name: string) => {
    const row = await api<SubFolder>(token, `/library/subfolders/${parent.id}/subfolders`, { method: "POST", body: JSON.stringify({ name }) });
    const newNode: SubFolder = { ...row, qsetCount: 0, children: [] };
    setTree((prev) => prev.map((c) => ({
      ...c, folders: c.folders.map((f) => ({
        ...f, subfolders: updateSfInTree((sf) => sf.id === parent.id ? { ...sf, children: [...sf.children, newNode] } : sf, f.subfolders),
      })),
    })));
  };

  const renameSf = async (sf: SubFolder, name: string) => {
    await api(token, `/library/subfolders/${sf.id}`, { method: "PUT", body: JSON.stringify({ name }) });
    setTree((prev) => prev.map((c) => ({
      ...c, folders: c.folders.map((f) => ({
        ...f, subfolders: updateSfInTree((s) => s.id === sf.id ? { ...s, name } : s, f.subfolders),
      })),
    })));
  };

  const deleteSf = async (sf: SubFolder) => {
    if (!confirm(`Delete "${sf.name}"? All question sets inside will be deleted.`)) return;
    try {
      await api(token, `/library/subfolders/${sf.id}`, { method: "DELETE" });
      setTree((prev) => prev.map((c) => ({
        ...c, folders: c.folders.map((f) => ({
          ...f, subfolders: updateSfInTree((s) => s.id === sf.id ? null : s, f.subfolders),
        })),
      })));
      if (selectedSfId === sf.id) { setSelectedSfId(null); setQuestionSets([]); }
    } catch (e) { alert((e as Error).message); }
  };

  const createQSet = async () => {
    if (!newQSetName.trim() || !selectedSfId) return;
    await api(token, `/library/subfolders/${selectedSfId}/questionsets`, {
      method: "POST", body: JSON.stringify({ name: newQSetName.trim(), questions: [] }),
    });
    setNewQSetName(""); setAddingQSet(false);
    void loadQSets(selectedSfId);
    setTree((prev) => prev.map((c) => ({
      ...c, folders: c.folders.map((f) => ({
        ...f, subfolders: updateSfInTree((s) => s.id === selectedSfId ? { ...s, qsetCount: s.qsetCount + 1 } : s, f.subfolders),
      })),
    })));
  };

  const deleteQSet = async (qs: QuestionSet) => {
    if (!confirm(`Delete "${qs.name}"?`)) return;
    try {
      await api(token, `/library/questionsets/${qs.id}`, { method: "DELETE" });
      setQuestionSets((prev) => prev.filter((q) => q.id !== qs.id));
      setTree((prev) => prev.map((c) => ({
        ...c, folders: c.folders.map((f) => ({
          ...f, subfolders: updateSfInTree((s) => s.id === qs.subFolderId ? { ...s, qsetCount: Math.max(0, s.qsetCount - 1) } : s, f.subfolders),
        })),
      })));
    } catch (e) { alert((e as Error).message); }
  };

  if (!user) return null;

  const selectedSf = (() => {
    for (const c of tree) for (const f of c.folders) {
      const find = (nodes: SubFolder[]): SubFolder | null => {
        for (const s of nodes) { if (s.id === selectedSfId) return s; const r = find(s.children); if (r) return r; } return null;
      };
      const r = find(f.subfolders); if (r) return r;
    } return null;
  })();

  const sidebarContent = (
    <>
      <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">My Library</span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" title="Refresh" onClick={() => void loadTree()}
            className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          {canEdit && (
            <button type="button" onClick={() => setAddingCard(true)} title="New card"
              className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-primary transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 scroll-smooth">
        {loading && tree.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        )}
        {error && <div className="px-4 py-3 text-xs text-destructive">{error}</div>}
        {!loading && tree.length === 0 && !addingCard && (
          <div className="text-center py-8 px-4">
            <BookMarked className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No cards yet.{canEdit ? " Use + to create one." : ""}</p>
          </div>
        )}

        {addingCard && (
          <div className="px-3 pb-2">
            <div className="border border-border/60 rounded-lg p-3 space-y-2 bg-muted/10">
              <InlineInput placeholder="Card name…" onSave={createCard} onCancel={() => setAddingCard(false)} />
              <div className="flex gap-1 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => setNewCardColor(c)}
                    style={{ background: c }}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${newCardColor === c ? "border-foreground scale-110" : "border-transparent"}`} />
                ))}
              </div>
              <div className="flex gap-1 flex-wrap">
                {ICONS.map((ic) => (
                  <button key={ic} type="button" onClick={() => setNewCardIcon(ic)}
                    className={`w-7 h-7 rounded-md text-sm transition-all ${newCardIcon === ic ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tree.map((card) => {
          const isOpen = expandedCards.has(card.id);
          return (
            <div key={card.id}>
              <div
                className="group flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedCards((p) => { const n = new Set(p); n.has(card.id) ? n.delete(card.id) : n.add(card.id); return n; })}>
                <button type="button" className="p-0.5 rounded hover:bg-muted/60 shrink-0">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                <div className="w-4 h-4 rounded-full shrink-0" style={{ background: card.color }} />
                <span className="text-sm shrink-0">{card.icon}</span>
                {renamingCard === card.id ? (
                  <InlineInput defaultValue={card.name}
                    onSave={(n) => renameCard(card.id, n)} onCancel={() => setRenamingCard(null)} />
                ) : (
                  <>
                    <span className="flex-1 font-medium text-sm truncate">{card.name}</span>
                    {canEdit && (
                      <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button type="button" title="Add folder"
                          onClick={() => { setAddingFolderIn(card.id); setExpandedCards((p) => new Set([...p, card.id])); }}
                          className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-primary">
                          <Plus className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => setRenamingCard(card.id)}
                          className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => { void deleteCard(card.id, card.name); }}
                          className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {isOpen && (
                <div className="ml-2">
                  {addingFolderIn === card.id && (
                    <div className="pl-8 pr-2 py-1">
                      <InlineInput placeholder="Folder name…"
                        onSave={(n) => createFolder(card.id, n)} onCancel={() => setAddingFolderIn(null)} />
                    </div>
                  )}
                  {card.folders.map((folder) => {
                    const isFOpen = expandedFolders.has(folder.id);
                    return (
                      <div key={folder.id}>
                        <div
                          className="group flex items-center gap-1.5 pl-6 pr-2 py-1.5 rounded-md mx-1 cursor-pointer hover:bg-muted/30 transition-colors text-sm"
                          onClick={() => setExpandedFolders((p) => { const n = new Set(p); n.has(folder.id) ? n.delete(folder.id) : n.add(folder.id); return n; })}>
                          <button type="button" className="p-0.5 rounded hover:bg-muted/60 shrink-0">
                            {isFOpen ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                          </button>
                          <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          {renamingFolder === folder.id ? (
                            <InlineInput defaultValue={folder.name}
                              onSave={(n) => renameFolder(folder, n)} onCancel={() => setRenamingFolder(null)} />
                          ) : (
                            <>
                              <span className="flex-1 text-xs truncate">{folder.name}</span>
                              {canEdit && (
                                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button type="button" title="Add sub-folder"
                                    onClick={() => { setAddingSubfolderIn(folder.id); setExpandedFolders((p) => new Set([...p, folder.id])); }}
                                    className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-primary">
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={() => setRenamingFolder(folder.id)}
                                    className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground">
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={() => { void deleteFolder(folder); }}
                                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {isFOpen && (
                          <div className="ml-2">
                            {folder.subfolders.map((sf) => (
                              <SubFolderNode key={sf.id} sf={sf} depth={0} token={token} ce={canEdit}
                                selectedSubFolderId={selectedSfId}
                                onSelect={selectSf}
                                onRename={renameSf}
                                onDelete={deleteSf}
                                onAddChild={createChildSf}
                                onChildCreated={() => void loadTree()} />
                            ))}
                            {addingSubfolderIn === folder.id ? (
                              <div className="pl-8 pr-2 py-1">
                                <InlineInput placeholder="Sub-folder name…"
                                  onSave={(n) => createSubfolder(folder.id, card.id, n)}
                                  onCancel={() => setAddingSubfolderIn(null)} />
                              </div>
                            ) : canEdit ? (
                              <button type="button"
                                onClick={() => setAddingSubfolderIn(folder.id)}
                                className="w-full flex items-center gap-1.5 pl-10 pr-2 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-md transition-colors">
                                <Plus className="w-3 h-3" />
                                <span>Add sub-folder</span>
                              </button>
                            ) : (
                              folder.subfolders.length === 0 && (
                                <div className="pl-10 py-1 text-xs text-muted-foreground italic">No sub-folders</div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {card.folders.length === 0 && addingFolderIn !== card.id && (
                    <div className="pl-8 py-1 text-xs text-muted-foreground italic">No folders</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <AppNav />
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100dvh - 48px)" }}>

        <aside className="hidden md:flex w-72 shrink-0 border-r border-border/50 flex-col bg-background overflow-hidden">
          {sidebarContent}
        </aside>

        {mobileSidebarOpen && (
          <aside className="flex md:hidden flex-col flex-1 bg-background overflow-hidden">
            {sidebarContent}
          </aside>
        )}

        <main className={`flex-1 overflow-y-auto ${mobileSidebarOpen ? "hidden md:block" : "block"}`}>
          {!mobileSidebarOpen && (
            <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/50 px-4 py-2 flex items-center gap-3">
              <button type="button" onClick={() => { setMobileSidebarOpen(true); setSelectedQSet(null); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Menu className="w-4 h-4" />
                <span className="text-xs">Library</span>
              </button>
              {selectedSf && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium truncate flex-1">{selectedSf.name}</span>
                </>
              )}
            </div>
          )}

          {selectedQSet ? (
            <QSetViewer qs={selectedQSet} onBack={() => setSelectedQSet(null)} token={token} canEdit={canEdit} />
          ) : selectedSf ? (
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-semibold text-lg">{selectedSf.name}</h2>
                  <p className="text-sm text-muted-foreground">Question Sets</p>
                </div>
                {canEdit && (
                  <Button size="sm" onClick={() => setAddingQSet(true)} className="gap-2">
                    <Plus className="w-3.5 h-3.5" /> New Set
                  </Button>
                )}
              </div>

              {addingQSet && (
                <div className="flex items-center gap-2 mb-4 p-3 border border-border/60 rounded-lg bg-muted/10">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input placeholder="Question set name…" value={newQSetName}
                    onChange={(e) => setNewQSetName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void createQSet(); if (e.key === "Escape") { setAddingQSet(false); setNewQSetName(""); } }}
                    className="flex-1 h-8 text-sm" autoFocus />
                  <Button size="sm" onClick={() => void createQSet()} disabled={!newQSetName.trim()}>Create</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingQSet(false); setNewQSetName(""); }}>Cancel</Button>
                </div>
              )}

              {loadingQSets && (
                <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              )}

              {!loadingQSets && questionSets.length === 0 && (
                <div className="text-center py-16">
                  <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No question sets yet.</p>
                  {canEdit && <p className="text-xs text-muted-foreground mt-1">Import from the Decoder or create a new set.</p>}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {questionSets.map((qs) => (
                  <div key={qs.id}
                    className="border border-border/60 rounded-xl bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer group p-4"
                    onClick={() => { void openQSet(qs); }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <TypeBadge type={qs.forcedType ?? qs.detectedType} />
                        </div>
                        <h3 className="font-medium text-sm truncate">{qs.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(qs.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {canEdit && (
                        <button type="button"
                          onClick={(e) => { e.stopPropagation(); void deleteQSet(qs); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {loadingQSet && (
                <div className="fixed inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-50">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full text-center p-8">
              <div>
                <Library className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Your Library</h3>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {tree.length === 0
                    ? "Create your first card in the sidebar to get started."
                    : "Select a sub-folder from the sidebar to view its question sets."}
                </p>
                {tree.length === 0 && canEdit && (
                  <Button className="mt-4 gap-2" onClick={() => { setAddingCard(true); setMobileSidebarOpen(true); }}>
                    <Plus className="w-4 h-4" /> Create first card
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
