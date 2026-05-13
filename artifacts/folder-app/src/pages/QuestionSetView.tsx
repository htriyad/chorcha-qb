import { useState, useCallback, useEffect, useRef } from "react";
import { getApiUrl } from "@/lib/apiUrl";
import { useParams, Link } from "wouter";
import { useGetQuestionSet, useGetFolderBreadcrumb, Question } from "@workspace/api-client-react";
import { MathText } from "@/components/folder/MathText";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { getGetQuestionSetQueryKey } from "@workspace/api-client-react";
import {
  ChevronRight, Home as HomeIcon, CheckCircle, HelpCircle, Layers,
  Eye, EyeOff, BookOpen, Pencil, Trash2, X, Save, Plus, ImageIcon,
  Loader2, ChevronDown, ChevronUp, GripVertical, ArrowUp, ArrowDown, Check,
  BookMarked, Zap
} from "lucide-react";

const ANSWER_COLORS: Record<string, string> = { A: "#22c55e", B: "#3b82f6", C: "#f59e0b", D: "#ef4444", E: "#8b5cf6" };
const CQ_COLORS: Record<string, string> = { A: "#22c55e", B: "#3b82f6", C: "#f59e0b", D: "#8b5cf6" };
const CQ_LABELS: Record<string, string> = { A: "ক", B: "খ", C: "গ", D: "ঘ" };

type EditablePart = { key: string; label: string; text: string; solution: string | null; aiSolution: string | null };
type EditableOption = { letter: string; text: string };

function ExamTypeBadge({ type }: { type: string | null }) {
  if (!type || type === "unknown") return null;
  const config: Record<string, { label: string; color: string; Icon: typeof CheckCircle }> = {
    mcq: { label: "MCQ", color: "#22c55e", Icon: CheckCircle },
    cq: { label: "CQ", color: "#f59e0b", Icon: HelpCircle },
    sq: { label: "SQ", color: "#0ea5e9", Icon: BookOpen },
    mixed: { label: "Mixed", color: "#8b5cf6", Icon: Layers },
  };
  const c = config[type];
  if (!c) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: `${c.color}18`, color: c.color, border: `1px solid ${c.color}30` }}>
      <c.Icon className="w-3 h-3" strokeWidth={2} />{c.label}
    </span>
  );
}

function ta(value: string, onChange: (v: string) => void, placeholder: string, rows = 2) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 rounded-xl bg-white/6 border border-white/12 text-white/90 placeholder:text-white/20 text-sm resize-none focus:outline-none focus:border-white/25 transition-colors"
    />
  );
}

function inp(value: string, onChange: (v: string) => void, placeholder: string) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl bg-white/6 border border-white/12 text-white/90 placeholder:text-white/20 text-sm focus:outline-none focus:border-white/25 transition-colors"
    />
  );
}

type ViewMode = "browse" | "solution" | "practice";

const STEM_IMAGE_HOST_FALLBACKS = ["https://chorcha.net", "https://assets.chorcha.net", "https://cdn.chorcha.net", "https://media.chorcha.net"];

function handleStemImageError(e: { currentTarget: HTMLImageElement }) {
  const img = e.currentTarget;
  const tried = (img.dataset.triedHosts ?? "").split("|").filter(Boolean);
  try {
    const path = new URL(img.src).pathname + new URL(img.src).search;
    for (const host of STEM_IMAGE_HOST_FALLBACKS) {
      if (tried.includes(host)) continue;
      tried.push(host);
      img.dataset.triedHosts = tried.join("|");
      img.src = `${host}${path}`;
      return;
    }
  } catch { /* ignore */ }
  img.style.display = "none";
}

interface QuestionCardProps {
  q: Question;
  index: number;
  totalCount: number;
  onUpdated: (updated: Question) => void;
  onDeleted: (id: number) => void;
  onReorderToPosition?: (id: number, newPos: number) => void;
  viewMode?: ViewMode;
}

function QuestionCard({ q, index, totalCount, onUpdated, onDeleted, onReorderToPosition, viewMode = "browse" }: QuestionCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [openParts, setOpenParts] = useState<Record<string, boolean>>(
    viewMode === "solution" ? { A: true, B: true, C: true, D: true } : {}
  );
  const [editingPos, setEditingPos] = useState(false);
  const [posInput, setPosInput] = useState("");
  const [practiceSelected, setPracticeSelected] = useState<string | null>(null);
  const [practiceRevealedParts, setPracticeRevealedParts] = useState<Record<string, boolean>>({});

  const [questionText, setQuestionText] = useState(q.questionText ?? "");
  const [answer, setAnswer] = useState(q.answer ?? "");
  const [solution, setSolution] = useState(q.solution ?? "");
  const [aiExplanation, setAiExplanation] = useState(q.aiExplanation ?? "");
  const [stemImages, setStemImages] = useState<string[]>(Array.isArray(q.stemImages) ? [...q.stemImages] : []);
  const [options, setOptions] = useState<EditableOption[]>(Array.isArray(q.options) ? q.options.map(o => ({ ...o })) : []);
  const [parts, setParts] = useState<EditablePart[]>(Array.isArray(q.parts) ? q.parts.map(p => ({ key: p.key, label: p.label, text: p.text, solution: p.solution ?? null, aiSolution: p.aiSolution ?? null })) : []);

  const resetEdit = () => {
    setQuestionText(q.questionText ?? "");
    setAnswer(q.answer ?? "");
    setSolution(q.solution ?? "");
    setAiExplanation(q.aiExplanation ?? "");
    setStemImages(Array.isArray(q.stemImages) ? [...q.stemImages] : []);
    setOptions(Array.isArray(q.options) ? q.options.map(o => ({ ...o })) : []);
    setParts(Array.isArray(q.parts) ? q.parts.map(p => ({ key: p.key, label: p.label, text: p.text, solution: p.solution ?? null, aiSolution: p.aiSolution ?? null })) : []);
    setEditing(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(getApiUrl(`api/questions/${q.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionText, answer: answer || null, solution: solution || null, aiExplanation: aiExplanation || null, stemImages, options, parts }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      const updated = await res.json();
      onUpdated(updated);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this question?")) return;
    setDeleting(true);
    try {
      const res = await fetch(getApiUrl(`api/questions/${q.id}`), { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Delete failed");
      onDeleted(q.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  };

  const isMcq = q.type === "mcq";
  const isCq = q.type === "cq";
  const isSq = q.type === "sq";
  const qNum = q.questionIndex > 0 ? q.questionIndex : index + 1;

  const prevViewModeRef = useRef(viewMode);
  useEffect(() => {
    if (prevViewModeRef.current !== viewMode) {
      prevViewModeRef.current = viewMode;
      setPracticeSelected(null);
      setPracticeRevealedParts({});
      setShowAnswer(false);
    }
  }, [viewMode]);

  if (editing) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/4 overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-white/30 uppercase tracking-widest">Q{qNum} · Editing</span>
            <button onClick={resetEdit} className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/35 font-medium">Question Text</label>
            {ta(questionText, setQuestionText, "Question text (supports LaTeX: $...$)", 3)}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/35 font-medium flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Stem Images</label>
              <button onClick={() => setStemImages(p => [...p, ""])} className="text-xs text-white/35 hover:text-white/60 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add URL
              </button>
            </div>
            {stemImages.map((url, i) => (
              <div key={i} className="flex gap-2">
                {inp(url, (v) => setStemImages(p => p.map((x, j) => j === i ? v : x)), "https://...")}
                <button onClick={() => setStemImages(p => p.filter((_, j) => j !== i))} className="px-2 rounded-xl hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {isMcq && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/35 font-medium">Options</label>
                {options.length < 5 && (
                  <button onClick={() => { const letters = ["A","B","C","D","E"]; const next = letters.find(l => !options.some(o => o.letter === l)); if (next) setOptions(p => [...p, { letter: next, text: "" }]); }}
                    className="text-xs text-white/35 hover:text-white/60 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add Option
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {options.map((opt, i) => (
                  <div key={opt.letter} className="flex gap-2 items-center">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: `${ANSWER_COLORS[opt.letter] ?? "#6b7280"}20`, color: ANSWER_COLORS[opt.letter] ?? "#6b7280" }}>
                      {opt.letter}
                    </span>
                    <div className="flex-1">
                      {inp(opt.text, (v) => setOptions(p => p.map((x, j) => j === i ? { ...x, text: v } : x)), `Option ${opt.letter}`)}
                    </div>
                    <button onClick={() => setOptions(p => p.filter((_, j) => j !== i))} className="px-2 rounded-xl hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <label className="text-xs text-white/35 font-medium">Answer</label>
                <select value={answer} onChange={(e) => setAnswer(e.target.value)}
                  className="px-2 py-1 rounded-lg bg-white/6 border border-white/12 text-white/80 text-xs focus:outline-none">
                  <option value="">— None —</option>
                  {options.map(o => <option key={o.letter} value={o.letter}>{o.letter}</option>)}
                </select>
              </div>
            </div>
          )}

          {isCq && (
            <div className="space-y-2">
              <label className="text-xs text-white/35 font-medium">Parts</label>
              {parts.map((part, i) => {
                const color = CQ_COLORS[part.key] ?? "#6b7280";
                return (
                  <div key={part.key} className="rounded-xl border border-white/8 bg-white/2 p-3 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold" style={{ background: `${color}25`, color }}>{part.label}</span>
                      <span className="text-xs text-white/35 font-medium">Part {part.key}</span>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/25">Question text</label>
                      {ta(part.text, (v) => setParts(p => p.map((x, j) => j === i ? { ...x, text: v } : x)), "Part text...", 2)}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/25">Solution</label>
                      {ta(part.solution ?? "", (v) => setParts(p => p.map((x, j) => j === i ? { ...x, solution: v || null } : x)), "Solution...", 2)}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-white/25">AI Solution</label>
                      {ta(part.aiSolution ?? "", (v) => setParts(p => p.map((x, j) => j === i ? { ...x, aiSolution: v || null } : x)), "AI solution...", 2)}
                    </div>
                    <button onClick={() => setParts(p => p.filter((_, j) => j !== i))} className="text-xs text-red-400/50 hover:text-red-400 flex items-center gap-1 transition-colors">
                      <Trash2 className="w-3 h-3" /> Remove part
                    </button>
                  </div>
                );
              })}
              {parts.length < 4 && (
                <button onClick={() => {
                  const keys = ["A","B","C","D"]; const next = keys.find(k => !parts.some(p => p.key === k));
                  if (next) setParts(p => [...p, { key: next, label: CQ_LABELS[next] ?? next, text: "", solution: null, aiSolution: null }]);
                }} className="text-xs text-white/35 hover:text-white/60 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add Part
                </button>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs text-white/35 font-medium">Solution {isCq && "(for overall stem)"}</label>
            {ta(solution, setSolution, "Solution text...", 2)}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/35 font-medium">AI Explanation</label>
            {ta(aiExplanation, setAiExplanation, "AI explanation...", 2)}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-white/8">
            <button onClick={handleDelete} disabled={deleting} className="flex items-center gap-1.5 text-xs text-red-400/50 hover:text-red-400 transition-colors disabled:opacity-50">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete question
            </button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetEdit} className="h-8 border-white/10 text-white/40 hover:text-white text-xs px-3">Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 bg-emerald-500 hover:bg-emerald-400 text-white text-xs px-3 gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const effectiveShowAnswer =
    viewMode === "solution" ||
    (viewMode === "practice" && (practiceSelected !== null || isSq)) ||
    showAnswer;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden group">
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {editingPos ? (
            <input
              autoFocus
              value={posInput}
              onChange={e => setPosInput(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const n = parseInt(posInput, 10);
                  if (n >= 1 && n <= totalCount && n !== qNum) onReorderToPosition?.(q.id, n);
                  setEditingPos(false);
                }
                if (e.key === "Escape") setEditingPos(false);
              }}
              onBlur={() => setEditingPos(false)}
              className="flex-shrink-0 w-9 h-7 rounded-lg bg-white/12 border border-white/25 text-center text-xs font-bold text-white focus:outline-none focus:border-white/50"
              placeholder={String(qNum)}
            />
          ) : (
            <button
              title="Click to move to position"
              onClick={() => { if (!editing && onReorderToPosition && viewMode === "browse") { setPosInput(String(qNum)); setEditingPos(true); } }}
              className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                onReorderToPosition && !editing && viewMode === "browse" ? "cursor-pointer hover:scale-110 hover:ring-1 hover:ring-white/20" : "cursor-default"
              } ${isCq ? "bg-amber-500/15 border border-amber-500/20 text-amber-400/70" : isSq ? "bg-sky-500/15 border border-sky-500/20 text-sky-400/70" : "bg-white/8 text-white/50"}`}>
              {qNum}
            </button>
          )}
          <div className="min-w-0 flex-1">
            {stemImages.length > 0 && (
              <div className="mb-3 space-y-2">
                {stemImages.map((url, i) => url && (
                  <img key={i} src={url} alt="" loading="lazy" className="max-w-full rounded-lg border border-white/15 bg-white p-1" onError={handleStemImageError} />
                ))}
              </div>
            )}
            {questionText && (
              <div className={`text-white/90 text-sm leading-relaxed ${isCq ? "p-3 rounded-xl bg-amber-500/5 border border-amber-500/15" : isSq ? "p-3 rounded-xl bg-sky-500/5 border border-sky-500/15" : ""}`}>
                <MathText text={questionText} />
              </div>
            )}
          </div>
          <button onClick={() => setEditing(true)}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center opacity-40 hover:opacity-100 transition-opacity hover:bg-white/8 text-white/30 hover:text-white/70">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>

        {isMcq && options.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 ml-10">
            {options.map((opt) => {
              const letter = opt.letter.toUpperCase();
              const isCorrectOpt = answer && letter === answer.toUpperCase();

              if (viewMode === "practice") {
                const isSelected = practiceSelected === opt.letter;
                const revealed = practiceSelected !== null;
                const showGreen = revealed && isCorrectOpt;
                const showRed = revealed && isSelected && !isCorrectOpt;
                return (
                  <button key={opt.letter}
                    onClick={() => { if (!revealed) setPracticeSelected(opt.letter); }}
                    disabled={revealed}
                    className={`flex items-start gap-2 p-2.5 rounded-xl transition-all text-left w-full ${!revealed ? "cursor-pointer active:scale-[0.98] hover:border-white/20" : "cursor-default"}`}
                    style={{
                      background: showGreen ? "rgba(34,197,94,0.13)" : showRed ? "rgba(239,68,68,0.13)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${showGreen ? "rgba(34,197,94,0.40)" : showRed ? "rgba(239,68,68,0.40)" : "rgba(255,255,255,0.06)"}`,
                    }}>
                    <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background: showGreen ? "#22c55e" : showRed ? "#ef4444" : "rgba(255,255,255,0.08)",
                        color: showGreen ? "#000" : showRed ? "#fff" : "rgba(255,255,255,0.5)",
                      }}>
                      {opt.letter}
                    </span>
                    <span className={`text-xs leading-relaxed ${showGreen ? "text-white/95 font-medium" : showRed ? "text-white/70" : "text-white/60"}`}>
                      <MathText text={opt.text} imageBlock={false} />
                    </span>
                  </button>
                );
              }

              const isAns = effectiveShowAnswer && isCorrectOpt;
              return (
                <div key={opt.letter} className="flex items-start gap-2 p-2.5 rounded-xl transition-colors"
                  style={isAns ? { background: `${ANSWER_COLORS[opt.letter] ?? "#22c55e"}18`, border: `1px solid ${ANSWER_COLORS[opt.letter] ?? "#22c55e"}40` } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
                    style={isAns ? { background: ANSWER_COLORS[opt.letter] ?? "#22c55e", color: "#000" } : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                    {opt.letter}
                  </span>
                  <span className={`text-xs leading-relaxed ${isAns ? "text-white/95 font-medium" : "text-white/60"}`}>
                    <MathText text={opt.text} imageBlock={false} />
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === "practice" && isMcq && options.length > 0 && practiceSelected === null && (
          <p className="ml-10 text-xs text-white/25 italic">Tap an option to check your answer</p>
        )}

        {isSq && (
          <div className="ml-10">
            {viewMode === "browse" && (
              <button onClick={() => setShowAnswer(v => !v)}
                className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors">
                {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showAnswer ? "Hide answer" : "Show answer"}
              </button>
            )}
            {effectiveShowAnswer && (
              <div className="mt-2 space-y-2">
                {answer && (
                  <div className="p-3 rounded-xl bg-sky-500/6 border border-sky-500/20">
                    <p className="text-xs font-semibold text-sky-400/50 mb-1.5 uppercase tracking-wide">Answer</p>
                    <div className="text-sm text-white/75"><MathText text={answer} /></div>
                  </div>
                )}
                {solution && (
                  <div className="p-3 rounded-xl bg-white/4 border border-white/8">
                    <p className="text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wide">Solution</p>
                    <div className="text-sm text-white/70"><MathText text={solution} /></div>
                  </div>
                )}
                {aiExplanation && (
                  <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
                    <p className="text-xs font-semibold text-purple-400/50 mb-1.5 uppercase tracking-wide">AI Explanation</p>
                    <div className="text-sm text-white/65"><MathText text={aiExplanation} /></div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isMcq && viewMode === "browse" && (
          <div className="ml-10 flex items-center gap-3 flex-wrap">
            <button onClick={() => setShowAnswer(v => !v)}
              className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/65 transition-colors">
              {showAnswer ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showAnswer ? "Hide answer" : "Show answer"}
            </button>
            {showAnswer && answer && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${ANSWER_COLORS[answer.toUpperCase()] ?? "#22c55e"}20`, color: ANSWER_COLORS[answer.toUpperCase()] ?? "#22c55e" }}>
                Answer: {answer.toUpperCase()}
              </span>
            )}
          </div>
        )}

        {isMcq && viewMode === "solution" && answer && (
          <div className="ml-10">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${ANSWER_COLORS[answer.toUpperCase()] ?? "#22c55e"}20`, color: ANSWER_COLORS[answer.toUpperCase()] ?? "#22c55e" }}>
              Answer: {answer.toUpperCase()}
            </span>
          </div>
        )}

        {isMcq && viewMode === "practice" && practiceSelected !== null && answer && (
          <div className="ml-10 flex items-center gap-2 flex-wrap">
            {practiceSelected.toUpperCase() === answer.toUpperCase() ? (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">Correct!</span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                Incorrect — Answer: {answer.toUpperCase()}
              </span>
            )}
          </div>
        )}
        {isMcq && viewMode === "practice" && practiceSelected !== null && !answer && (
          <div className="ml-10">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/8 text-white/40 border border-white/12">No answer key available</span>
          </div>
        )}

        {!isSq && effectiveShowAnswer && solution && (
          <div className="ml-10 p-3 rounded-xl bg-white/4 border border-white/8">
            <p className="text-xs font-semibold text-white/35 mb-1.5 uppercase tracking-wide">Solution</p>
            <div className="text-sm text-white/70"><MathText text={solution} /></div>
          </div>
        )}
        {!isSq && effectiveShowAnswer && aiExplanation && (
          <div className="ml-10 p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
            <p className="text-xs font-semibold text-purple-400/50 mb-1.5 uppercase tracking-wide">AI Explanation</p>
            <div className="text-sm text-white/65"><MathText text={aiExplanation} /></div>
          </div>
        )}

        {isCq && parts.length > 0 && (
          <div className="ml-10 space-y-2">
            {viewMode === "practice" && parts.some(p => p.solution || p.aiSolution) && (
              <p className="text-xs text-white/25 italic mb-1">
                {Object.keys(practiceRevealedParts).length === 0
                  ? `Tap a part label (${parts.map(p => p.label).join(", ")}) to reveal its answer`
                  : `${Object.keys(practiceRevealedParts).length} of ${parts.filter(p => p.solution || p.aiSolution).length} revealed`}
              </p>
            )}
            {parts.map((part) => {
              const color = CQ_COLORS[part.key] ?? "#6b7280";
              const hasSol = !!(part.solution || part.aiSolution);
              const isOpen =
                viewMode === "solution" ? true
                : viewMode === "practice" ? !!practiceRevealedParts[part.key]
                : !!openParts[part.key];
              const isPracticeRevealable = viewMode === "practice" && hasSol;
              return (
                <div key={part.key} className={`rounded-xl border bg-white/2 overflow-hidden transition-all ${isOpen && viewMode === "practice" ? "border-white/15" : "border-white/8"}`}>
                  <div className="p-3 space-y-2">
                    <div
                      className={`flex items-start gap-2 ${isPracticeRevealable ? "cursor-pointer select-none" : ""}`}
                      onClick={isPracticeRevealable ? () => setPracticeRevealedParts(p => ({ ...p, [part.key]: !p[part.key] })) : undefined}
                    >
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 transition-all ${isPracticeRevealable ? "hover:scale-110 active:scale-95" : ""}`}
                        style={
                          isOpen && viewMode === "practice"
                            ? { background: color, color: "#000" }
                            : { background: `${color}25`, color }
                        }
                      >
                        {part.label}
                      </span>
                      <div className="text-sm text-white/80 leading-relaxed flex-1">
                        <MathText text={part.text} />
                      </div>
                      {isPracticeRevealable && (
                        <span className="flex-shrink-0 self-center text-white/20">
                          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </span>
                      )}
                    </div>

                    {hasSol && viewMode === "browse" && (
                      <button
                        onClick={() => setOpenParts(p => ({ ...p, [part.key]: !p[part.key] }))}
                        className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/55 transition-colors ml-8"
                      >
                        {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isOpen ? "Hide solution" : "Show solution"}
                      </button>
                    )}

                    {isOpen && hasSol && (
                      <div className="ml-8 space-y-2">
                        {part.solution && (
                          <div className="p-3 rounded-xl" style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                            <p className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: `${color}60` }}>Solution</p>
                            <div className="text-sm text-white/70"><MathText text={part.solution} /></div>
                          </div>
                        )}
                        {part.aiSolution && (
                          <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/15">
                            <p className="text-xs font-semibold text-purple-400/50 mb-1.5 uppercase tracking-wide">AI Solution</p>
                            <div className="text-sm text-white/65"><MathText text={part.aiSolution} /></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface AddQuestionDialogProps {
  setId: number;
  onAdded: (q: Question) => void;
  onClose: () => void;
}

function AddQuestionDialog({ setId, onAdded, onClose }: AddQuestionDialogProps) {
  const [type, setType] = useState<"mcq" | "cq">("mcq");
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl(`api/sets/${setId}/questions`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      const q = await res.json();
      onAdded(q);
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to add question");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-[#111] border border-white/12 rounded-2xl p-5 w-full max-w-xs space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white/90">Add Question</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["mcq", "cq"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`py-3 rounded-xl border text-sm font-semibold transition-all ${type === t ? "border-white/25 bg-white/10 text-white" : "border-white/8 text-white/35 hover:text-white/60 hover:border-white/15"}`}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/30">
          {type === "mcq" ? "Creates a blank MCQ with options A–D." : "Creates a blank CQ with parts ক–ঘ."}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1 border-white/10 text-white/40">Cancel</Button>
          <Button size="sm" onClick={handleAdd} disabled={loading} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

export function QuestionSetView() {
  const params = useParams();
  const setId = parseInt(params.id ?? "0", 10);
  const [showHidden, setShowHidden] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [localQuestions, setLocalQuestions] = useState<Question[] | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderOrder, setReorderOrder] = useState<Question[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("browse");

  const queryClient = useQueryClient();
  const { data, isLoading } = useGetQuestionSet(setId);
  const { data: breadcrumbs = [] } = useGetFolderBreadcrumb(data?.set?.folderId ?? 0);

  const questions = localQuestions ?? data?.questions ?? [];

  const handleUpdated = useCallback((updated: Question) => {
    setLocalQuestions(prev => (prev ?? data?.questions ?? []).map(q => q.id === updated.id ? updated : q));
    queryClient.invalidateQueries({ queryKey: getGetQuestionSetQueryKey(setId) });
  }, [data, setId, queryClient]);

  const handleDeleted = useCallback((id: number) => {
    setLocalQuestions(prev => (prev ?? data?.questions ?? []).filter(q => q.id !== id));
    queryClient.invalidateQueries({ queryKey: getGetQuestionSetQueryKey(setId) });
  }, [data, setId, queryClient]);

  const handleAdded = useCallback((q: Question) => {
    setLocalQuestions(prev => [...(prev ?? data?.questions ?? []), q]);
    queryClient.invalidateQueries({ queryKey: getGetQuestionSetQueryKey(setId) });
  }, [data, setId, queryClient]);

  const handleReorderToPosition = useCallback(async (questionId: number, newPos: number) => {
    const current = localQuestions ?? data?.questions ?? [];
    if (current.length === 0) return;
    const fromIdx = current.findIndex(q => q.id === questionId);
    if (fromIdx === -1) return;
    const toIdx = newPos - 1;
    const arr = [...current];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    const items = arr.map((q, i) => ({ id: q.id, position: i + 1 }));
    setLocalQuestions(arr);
    try {
      await fetch(getApiUrl(`api/sets/${setId}/questions/reorder`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      queryClient.invalidateQueries({ queryKey: getGetQuestionSetQueryKey(setId) });
    } catch {
      setLocalQuestions(current);
    }
  }, [data, setId, localQuestions, queryClient]);

  const enterReorder = () => {
    setReorderOrder([...questions.filter(q => !q.hidden)]);
    setReorderMode(true);
  };
  const moveQuestion = (idx: number, dir: "up" | "down") => {
    const arr = [...reorderOrder];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setReorderOrder(arr);
  };
  const saveReorder = async () => {
    setSavingOrder(true);
    try {
      await fetch(getApiUrl(`api/sets/${setId}/questions/reorder`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: reorderOrder.map((q, i) => ({ id: q.id, position: i + 1 })) }),
      });
      setLocalQuestions(reorderOrder);
      queryClient.invalidateQueries({ queryKey: getGetQuestionSetQueryKey(setId) });
      setReorderMode(false);
    } finally {
      setSavingOrder(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-5 py-8 space-y-4">
        <Skeleton className="h-5 w-48 rounded-full" />
        <Skeleton className="h-9 w-64" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!data?.set) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h2 className="text-2xl font-bold text-white/70">Question set not found</h2>
        <Link href="/"><Button variant="outline">Return Home</Button></Link>
      </div>
    );
  }

  const { set } = data;
  const visible = showHidden ? questions : questions.filter(q => !q.hidden);
  const hiddenCount = questions.filter(q => q.hidden).length;

  return (
    <div className="max-w-3xl mx-auto px-5 py-6 md:px-8 md:py-10 space-y-5">
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto scrollbar-none">
        <Link href="/">
          <button className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors p-1 rounded-lg hover:bg-white/5">
            <HomeIcon className="w-3.5 h-3.5" />
          </button>
        </Link>
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-white/15 flex-shrink-0" />
              <Link href={`/folders/${crumb.id}`}>
                <button className={`transition-colors p-1 rounded-lg hover:bg-white/5 truncate max-w-[120px] ${isLast ? "text-white/50 hover:text-white/70" : "text-white/25 hover:text-white/50"}`}>
                  {crumb.name}
                </button>
              </Link>
            </span>
          );
        })}
        <ChevronRight className="w-3 h-3 text-white/15 flex-shrink-0" />
        <span className="font-semibold text-white/90 truncate max-w-[200px] text-sm">{set.name}</span>
      </nav>

      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 flex-shrink-0">
            <BookOpen className="w-6 h-6 text-white/45" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-white/95">{set.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-white/30 text-xs">{questions.length} questions</span>
              <ExamTypeBadge type={set.examType ?? null} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {reorderMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setReorderMode(false)} className="border-white/10 text-white/40 hover:text-white h-8 text-xs">Cancel</Button>
              <Button size="sm" onClick={saveReorder} disabled={savingOrder} className="bg-emerald-500 hover:bg-emerald-400 text-white gap-1.5 h-8 text-xs">
                {savingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save Order
              </Button>
            </>
          ) : (
            <>
              {hiddenCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowHidden(v => !v)} className="border-white/10 text-white/35 hover:text-white gap-1.5 h-8 text-xs">
                  {showHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showHidden ? "Hide filtered" : `${hiddenCount} filtered`}
                </Button>
              )}
              {visible.length > 1 && (
                <Button variant="outline" size="sm" onClick={enterReorder} className="border-white/10 text-white/35 hover:text-white gap-1.5 h-8 text-xs">
                  <GripVertical className="w-3.5 h-3.5" /> Reorder
                </Button>
              )}
              <Button size="sm" onClick={() => setAddOpen(true)} className="bg-white/10 hover:bg-white/15 text-white/80 gap-1.5 h-8 text-xs border border-white/10">
                <Plus className="w-3.5 h-3.5" /> Add Question
              </Button>
            </>
          )}
        </div>
      </header>

      {reorderMode && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <GripVertical className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="text-sm text-amber-300/80">Use the arrows to reorder questions, then hit Save Order</span>
        </div>
      )}

      {visible.length > 0 && !reorderMode && (
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/4 border border-white/8 w-fit">
          {([
            { id: "browse" as const, label: "Browse", Icon: BookOpen },
            { id: "solution" as const, label: "Solution", Icon: BookMarked },
            { id: "practice" as const, label: "Practice", Icon: Zap },
          ]).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setViewMode(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === id
                  ? id === "practice"
                    ? "bg-amber-500/20 text-amber-300 shadow-sm"
                    : id === "solution"
                      ? "bg-emerald-500/20 text-emerald-300 shadow-sm"
                      : "bg-white/12 text-white/90 shadow-sm"
                  : "text-white/30 hover:text-white/60 hover:bg-white/6"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      )}

      {reorderMode ? (
        <div className="space-y-2">
          {reorderOrder.map((q, idx) => (
            <div key={q.id} className="relative rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
              <div className="p-4 flex items-start gap-3">
                <div className="flex-shrink-0 flex flex-col items-center gap-1 mr-1">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-xs font-bold text-white/60">{idx + 1}</div>
                  <button onClick={() => moveQuestion(idx, "up")} disabled={idx === 0}
                    className="w-6 h-6 rounded-md bg-white/6 hover:bg-white/12 flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <ArrowUp className="w-3 h-3 text-white/50" />
                  </button>
                  <button onClick={() => moveQuestion(idx, "down")} disabled={idx === reorderOrder.length - 1}
                    className="w-6 h-6 rounded-md bg-white/6 hover:bg-white/12 flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                    <ArrowDown className="w-3 h-3 text-white/50" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/70 line-clamp-2 leading-relaxed">
                    {q.questionText || <span className="text-white/25 italic">No text</span>}
                  </p>
                  <p className="text-xs text-white/25 mt-1 uppercase">{q.type}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 rounded-2xl border border-dashed border-white/8">
          <BookOpen className="w-8 h-8 text-white/12" strokeWidth={1.3} />
          <p className="text-white/25 text-sm">No questions yet — add one or decode from Chorcha.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((q, idx) => (
            <QuestionCard key={q.id} q={q} index={idx} totalCount={visible.length} onUpdated={handleUpdated} onDeleted={handleDeleted} onReorderToPosition={handleReorderToPosition} viewMode={viewMode} />
          ))}
        </div>
      )}

      {addOpen && <AddQuestionDialog setId={setId} onAdded={handleAdded} onClose={() => setAddOpen(false)} />}
    </div>
  );
}
