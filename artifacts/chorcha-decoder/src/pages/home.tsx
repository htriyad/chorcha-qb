import {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  createContext,
  useContext,
} from "react";
import { useMutation } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  AlertCircle,
  Download,
  FileDown,
  FileLock2,
  HelpCircle,
  Loader2,
  RefreshCcw,
  CheckCircle2,
  ChevronDown,
  BookOpen,
  Clock,
  ListChecks,
  ChevronsDown,
  ChevronsUp,
  MessageCircle,
  Send,
  Sparkles,
  X,
  Moon,
  Sun,
  Eye,
  EyeOff,
  Pencil,
  ImageIcon,
  Check,
  Library,
  FolderOpen,
  ChevronRight,
  Plus,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth, authFetch } from "@/contexts/AuthContext";
import { getApiUrl } from "@/lib/apiUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MathText } from "@/components/MathText";
import { AppNav } from "@/components/AppNav";

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = "auto" | "mcq" | "cq" | "sq";
type AnswerMode = "study" | "answer";

interface DecodedOption {
  letter: string;
  text: string;
}

interface DecodedPart {
  key: string;
  label: string;
  text: string;
  solution: string | null;
  aiSolution: string | null;
}

interface DecodedQuestion {
  id: string;
  index: number;
  type: "mcq" | "cq" | "unknown";
  question: string;
  stemImages?: string[];
  options: DecodedOption[];
  parts: DecodedPart[];
  answer: string | null;
  solution: string | null;
  aiExplanation: string | null;
  extraFields: Record<string, string>;
  debug?: Record<string, string>;
  hidden?: boolean;
}

interface ReadResult {
  kind: "read";
  id: string;
  host: string;
  total: number;
  rawTotal?: number;
  droppedByType?: number;
  examType: "mcq" | "cq" | "mixed" | "unknown";
  questions: DecodedQuestion[];
}

interface ExamSuccess {
  ok: true;
  id: string;
  name: string | null;
  serial: number;
  host: string | null;
  total: number;
  rawTotal?: number;
  droppedByType?: number;
  examType: "mcq" | "cq" | "mixed" | "unknown";
  questions: DecodedQuestion[];
  duration: number | null;
  qCount: number | null;
}

interface ExamFailure {
  ok: false;
  id: string;
  name: string | null;
  serial: number;
  error: string;
  duration: number | null;
  qCount: number | null;
}

interface BankResult {
  kind: "question-bank";
  slug: string;
  totalExams: number;
  exams: Array<ExamSuccess | ExamFailure>;
}

type DecodeResponse = ReadResult | BankResult;

// ─── Contexts ─────────────────────────────────────────────────────────────────
interface AutoFillCtx {
  get: (qId: string, cqType: string | null) => string | undefined;
  isPending: (qId: string, cqType: string | null) => boolean;
}

interface QuestionPatch {
  question?: string;
  options?: DecodedOption[];
  solution?: string | null;
  parts?: DecodedPart[];
}

interface EditCtx {
  patch: (chorchaId: string, p: QuestionPatch) => void;
}

const ViewModeContext = createContext<ViewMode>("auto");
const AnswerModeContext = createContext<AnswerMode>("study");
const AutoFillContext = createContext<AutoFillCtx>({
  get: () => undefined,
  isPending: () => false,
});
const EditContext = createContext<EditCtx>({ patch: () => undefined });

const autoFillKey = (qId: string, cqType: string | null) =>
  `${qId}::${cqType ?? ""}`;

// ─── RichText ─────────────────────────────────────────────────────────────────
function RichText({
  text,
  className,
  imageBlock = true,
}: {
  text: string;
  className?: string;
  imageBlock?: boolean;
}) {
  return (
    <div className={`break-words leading-relaxed ${className ?? ""}`}>
      <MathText text={text} imageBlock={imageBlock} />
    </div>
  );
}

// ─── MCQ Options ──────────────────────────────────────────────────────────────
function McqOptions({ q }: { q: DecodedQuestion }) {
  const allOptionsAreImages =
    q.options.length > 0 &&
    q.options.every((o) => {
      const stripped = o.text.replace(/\[IMG:[^\]]+\]/g, "").trim();
      const hasImage = /\[IMG:/.test(o.text);
      return hasImage && stripped.length === 0;
    });
  return (
    <div className="md:pl-9 space-y-2">
      {q.options.map((opt) => {
        const isCorrect = q.answer === opt.letter;
        return (
          <div
            key={opt.letter}
            className={`flex gap-3 p-3 rounded-lg border transition-colors ${
              isCorrect
                ? "bg-primary/10 border-primary/30"
                : "bg-muted/30 border-transparent"
            }`}
          >
            <div
              className={`font-mono font-medium shrink-0 ${
                isCorrect ? "text-primary" : "text-muted-foreground/60"
              }`}
            >
              {opt.letter}.
            </div>
            <div
              className={`flex-1 min-w-0 ${
                isCorrect ? "text-foreground font-medium" : "text-muted-foreground"
              }`}
            >
              <RichText text={opt.text} imageBlock={allOptionsAreImages} />
            </div>
            {isCorrect && (
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Part AI Solution ─────────────────────────────────────────────────────────
function PartAiSolution({
  qId,
  part,
  token,
}: {
  qId: string;
  part: DecodedPart;
  token: string;
}) {
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoFill = useContext(AutoFillContext);
  const autoFilled = autoFill.get(qId, part.key);
  const autoPending = autoFill.isPending(qId, part.key);

  const ai = part.aiSolution || generated || autoFilled;

  const handleGenerate = async () => {
    if (!token) {
      setError("Missing token.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const html = await generateSolution({ qId, token, cqType: part.key });
      setGenerated(html);
      saveAiToDb({ chorchaId: qId, cqType: part.key, aiText: html }).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setLoading(false);
    }
  };

  if (ai) {
    return (
      <div className="border-t border-border/40 px-4 py-3 bg-sky-500/5">
        <div className="flex items-center gap-2 text-xs font-semibold text-sky-700 dark:text-sky-400 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
          AI সল্যুশন ({part.label})
          {!part.aiSolution && (generated || autoFilled) && (
            <span className="text-[10px] text-muted-foreground font-normal">
              ({autoFilled && !generated ? "auto-filled" : "generated"})
            </span>
          )}
        </div>
        <div className="text-sm text-foreground/85">
          <RichText text={ai} />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border/40 px-3.5 py-2.5 flex items-center justify-between gap-3 bg-sky-500/5">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-500/40" />
        AI সল্যুশন ({part.label})
        {error && <span className="text-[11px] text-destructive ml-1">— {error}</span>}
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={handleGenerate}
        disabled={loading || autoPending || !token}
        className="h-7 text-xs gap-1.5"
      >
        {loading || autoPending ? (
          <><Loader2 className="w-3 h-3 animate-spin" />{autoPending ? "Auto-filling…" : "Generating…"}</>
        ) : "Generate"}
      </Button>
    </div>
  );
}

// ─── CQ Part Accordion ────────────────────────────────────────────────────────
function CqPartAccordion({
  qId,
  part,
  token,
}: {
  qId: string;
  part: DecodedPart;
  token: string;
}) {
  const answerMode = useContext(AnswerModeContext);
  const [open, setOpen] = useState(answerMode === "answer");

  useEffect(() => {
    setOpen(answerMode === "answer");
  }, [answerMode]);

  const toggle = () => {
    if (answerMode === "answer") return;
    setOpen((v) => !v);
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className={`w-full flex items-start gap-3 p-3.5 text-left transition-colors ${
          answerMode === "study"
            ? "hover:bg-muted/20 active:bg-muted/30 cursor-pointer"
            : "cursor-default bg-emerald-500/3"
        }`}
      >
        <div className="font-bold text-primary shrink-0 text-base leading-relaxed min-w-[1.75rem]">
          {part.label})
        </div>
        <div className="flex-1 min-w-0 text-foreground text-base">
          {part.text ? (
            <RichText text={part.text} />
          ) : (
            <span className="text-muted-foreground italic text-sm">(no question text)</span>
          )}
        </div>
        {answerMode === "study" ? (
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          />
        ) : (
          <Eye className="w-4 h-4 text-emerald-500/60 shrink-0 mt-1" />
        )}
      </button>

      {open && (
        <div>
          {part.solution && (
            <div className="border-t border-border/40 px-4 py-3 bg-emerald-500/5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                সল্যুশন ({part.label})
              </div>
              <div className="text-sm text-foreground/85">
                <RichText text={part.solution} />
              </div>
            </div>
          )}
          <PartAiSolution qId={qId} part={part} token={token} />
        </div>
      )}
    </div>
  );
}

// ─── CQ Parts list ─────────────────────────────────────────────────────────────
function CqParts({ qId, parts, token }: { qId: string; parts: DecodedPart[]; token: string }) {
  if (parts.length === 0) return null;
  return (
    <div className="md:pl-9 space-y-2">
      {parts.map((part) => (
        <CqPartAccordion key={part.key} qId={qId} part={part} token={token} />
      ))}
    </div>
  );
}

// ─── API helpers ──────────────────────────────────────────────────────────────
async function generateSolution(args: {
  qId: string;
  token: string;
  cqType: string | null;
  regenerate?: boolean;
  isMcqNSub?: boolean;
}): Promise<string> {
  const res = await fetch(getApiUrl("api/chorcha/generate-solution"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: args.token,
      qId: args.qId,
      cqType: args.cqType,
      regenerate: args.regenerate ?? false,
      isMcqNSub: args.isMcqNSub ?? false,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  if (!data.solution) throw new Error("Empty solution returned");
  return data.solution as string;
}

async function saveAiToDb(args: {
  chorchaId: string;
  cqType: string | null;
  aiText: string;
}): Promise<void> {
  const res = await fetch(getApiUrl("api/chorcha/save-ai"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chorchaId: args.chorchaId, cqType: args.cqType, aiText: args.aiText }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `save-ai failed with status ${res.status}`);
  }
}

async function patchQuestion(chorchaId: string, patch: QuestionPatch, authToken?: string | null): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  const res = await fetch(getApiUrl(`api/chorcha/questions/${chorchaId}`), {
    method: "PATCH",
    headers,
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || `patch failed with status ${res.status}`);
  }
}

// ─── MCQ AI Solution ──────────────────────────────────────────────────────────
function McqAiSolution({
  qId,
  token,
  initialAi,
  isMcqNSub = false,
}: {
  qId: string;
  token: string;
  initialAi: string | null;
  isMcqNSub?: boolean;
}) {
  const [generated, setGenerated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoFill = useContext(AutoFillContext);
  const autoFilled = autoFill.get(qId, null);
  const autoPending = autoFill.isPending(qId, null);

  const ai = initialAi || generated || autoFilled;

  const handleGenerate = async () => {
    if (!token) { setError("Missing token."); return; }
    setLoading(true);
    setError(null);
    try {
      const html = await generateSolution({ qId, token, cqType: null });
      setGenerated(html);
      saveAiToDb({ chorchaId: qId, cqType: null, aiText: html }).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setLoading(false);
    }
  };

  if (ai) {
    return (
      <Collapsible
        defaultOpen={!!generated || !!initialAi}
        className="bg-primary/5 rounded-lg border border-primary/10 overflow-hidden"
      >
        <CollapsibleTrigger className="group flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-primary/10 transition-colors text-primary/80">
          <span className="flex items-center gap-2">
            AI Explanation
            {!initialAi && (generated || autoFilled) && (
              <span className="text-[10px] text-muted-foreground font-normal">
                ({autoFilled && !generated ? "auto-filled" : "generated"})
              </span>
            )}
          </span>
          <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 pt-1 text-sm text-foreground/80 border-t border-primary/10 mt-2">
            <RichText text={ai} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  if (isMcqNSub) {
    return (
      <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-sm text-muted-foreground italic">
        AI explanation not available for this grouped MCQ.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-primary/80">
        AI Explanation
        {error && <span className="text-[11px] text-destructive ml-1">— {error}</span>}
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={handleGenerate}
        disabled={loading || autoPending || !token}
        className="h-7 text-xs gap-1.5"
      >
        {loading || autoPending ? (
          <><Loader2 className="w-3 h-3 animate-spin" />{autoPending ? "Auto-filling…" : "Generating…"}</>
        ) : "Generate"}
      </Button>
    </div>
  );
}

// ─── Stem Images ──────────────────────────────────────────────────────────────
function StemImages({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="md:pl-9 space-y-3">
      {urls.map((url, i) => (
        <div
          key={`${url}-${i}`}
          className="flex justify-center rounded-lg border border-border/40 bg-background p-3"
        >
          <img
            src={url}
            alt=""
            loading="lazy"
            className="max-w-full h-auto"
            onError={(e) => {
              const img = e.currentTarget;
              try {
                const path = new URL(img.src).pathname + new URL(img.src).search;
                const tried = (img.dataset.triedHosts ?? "").split("|").filter(Boolean);
                const fallbacks = [
                  "https://chorcha.net",
                  "https://assets.chorcha.net",
                  "https://cdn.chorcha.net",
                  "https://media.chorcha.net",
                  "https://api.chorcha.net",
                ];
                for (const host of fallbacks) {
                  if (tried.includes(host)) continue;
                  tried.push(host);
                  img.dataset.triedHosts = tried.join("|");
                  img.src = `${host}${path}`;
                  return;
                }
              } catch { /* fall through */ }
              img.style.display = "none";
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Inline Edit Panel ────────────────────────────────────────────────────────
function EditPanel({
  label,
  value,
  onSave,
  onCancel,
}: {
  label: string;
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      setDraft((d) => (d ? `${d}\n[IMG:${dataUrl}]` : `[IMG:${dataUrl}]`));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  };

  return (
    <div className="border border-primary/30 rounded-lg bg-background shadow-sm p-3 space-y-3">
      <div className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider">{label}</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-[11px] text-muted-foreground font-medium">✏️ Edit — $math$, $$block$$, [IMG:url]</div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono text-sm min-h-[110px] resize-y bg-muted/20 leading-relaxed"
            placeholder="Text, $inline math$, $$display math$$, [IMG:url]..."
            autoFocus
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-border hover:bg-muted/40 transition-colors text-muted-foreground"
          >
            <ImageIcon className="w-3 h-3" />
            Upload image
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>
        <div className="space-y-2">
          <div className="text-[11px] text-muted-foreground font-medium">👁️ Live Preview</div>
          <div className="border border-border/50 rounded-md bg-muted/10 p-3 min-h-[110px] text-sm overflow-auto">
            {draft ? (
              <RichText text={draft} />
            ) : (
              <span className="text-muted-foreground italic text-xs">Preview appears here…</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs" disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} className="h-7 text-xs gap-1" disabled={saving}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save
        </Button>
      </div>
    </div>
  );
}

// ─── SQ View ──────────────────────────────────────────────────────────────────
function SqView({ q, token }: { q: DecodedQuestion; token: string }) {
  const answerMode = useContext(AnswerModeContext);
  const editCtx = useContext(EditContext);
  const [revealed, setRevealed] = useState(answerMode === "answer");
  const [editing, setEditing] = useState<"question" | "solution" | null>(null);

  useEffect(() => {
    setRevealed(answerMode === "answer");
  }, [answerMode]);

  const isMcqNSub = q.extraFields?.parent_type === "MCQ_N";
  const inlineImageUrls = Array.from(q.question.matchAll(/\[IMG:([^\]]+)\]/g))
    .map((m) => m[1].trim()).filter(Boolean);
  const allImageUrls: string[] = [];
  const seenUrls = new Set<string>();
  for (const url of [...(q.stemImages ?? []), ...inlineImageUrls]) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    allImageUrls.push(url);
  }
  const questionTextNoImages = q.question.replace(/\[IMG:[^\]]+\]/g, "").trim();
  const hasQuestionText = questionTextNoImages.length > 0;

  return (
    <div className="space-y-3 pb-6 border-b border-border/30 last:border-0">
      <div className="flex items-baseline gap-3 group">
        <span className="text-muted-foreground font-mono text-sm shrink-0 w-7">{q.index}.</span>
        <div className="flex-1 min-w-0">
          <div
            className={answerMode === "study" ? "cursor-pointer select-none" : ""}
            onClick={() => answerMode === "study" && setRevealed((v) => !v)}
          >
            {allImageUrls.length > 0 && (
              <div className="mb-3"><StemImages urls={allImageUrls} /></div>
            )}
            <div className="text-base">
              {hasQuestionText ? (
                <RichText text={questionTextNoImages} />
              ) : allImageUrls.length > 0 ? (
                <span className="text-muted-foreground italic text-sm">(refer to diagram above)</span>
              ) : (
                <span className="text-muted-foreground italic text-sm">(no question text)</span>
              )}
            </div>
            {answerMode === "study" && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-primary/60">
                {revealed
                  ? <><EyeOff className="w-3 h-3" /> Tap to hide answer</>
                  : <><Eye className="w-3 h-3" /> Tap to reveal answer</>}
              </div>
            )}
          </div>
          {editing === "question" && (
            <div className="mt-2">
              <EditPanel
                label="Edit Question"
                value={q.question}
                onSave={(v) => { editCtx.patch(q.id, { question: v }); setEditing(null); }}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(editing === "question" ? null : "question")}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted/50 transition-all shrink-0"
          title="Edit question"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {revealed && (
        <div className="md:pl-9 space-y-2">
          {q.solution && (
            <div className="bg-emerald-500/5 rounded-lg border border-emerald-500/20 p-3 group">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  Solution
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(editing === "solution" ? null : "solution")}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted/50 transition-all"
                >
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
              {editing === "solution" ? (
                <EditPanel
                  label="Edit Solution"
                  value={q.solution}
                  onSave={(v) => { editCtx.patch(q.id, { solution: v }); setEditing(null); }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="text-sm text-foreground/85"><RichText text={q.solution} /></div>
              )}
            </div>
          )}
          <McqAiSolution qId={q.id} token={token} initialAi={q.aiExplanation} isMcqNSub={isMcqNSub} />
        </div>
      )}
    </div>
  );
}

// ─── Question Block ────────────────────────────────────────────────────────────
function QuestionBlock({ q, token }: { q: DecodedQuestion; token: string }) {
  const viewMode = useContext(ViewModeContext);
  const editCtx = useContext(EditContext);
  const [editing, setEditing] = useState<string | null>(null);

  const inlineImageUrls = Array.from(q.question.matchAll(/\[IMG:([^\]]+)\]/g))
    .map((m) => m[1].trim()).filter(Boolean);
  const allImageUrls: string[] = [];
  const seenUrls = new Set<string>();
  for (const url of [...(q.stemImages ?? []), ...inlineImageUrls]) {
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    allImageUrls.push(url);
  }
  const questionTextNoImages = q.question.replace(/\[IMG:[^\]]+\]/g, "").trim();
  const hasQuestionText = questionTextNoImages.length > 0;
  const isHidden = q.hidden === true;
  const topicLabel = q.extraFields?.topic?.length > 0 ? q.extraFields.topic : null;
  const isMcqNSub = q.extraFields?.parent_type === "MCQ_N";
  const isCq = q.type === "cq" || (q.parts.length > 0 && q.options.length === 0);

  if (viewMode === "sq" && !isHidden) {
    return <SqView q={q} token={token} />;
  }

  return (
    <div className={`space-y-3 pb-6 border-b border-border/30 last:border-0 ${isHidden ? "opacity-60" : ""}`}>
      <div className="flex items-baseline gap-3 group">
        <span className="text-muted-foreground font-mono text-sm shrink-0 w-7">
          {isHidden ? "—" : `${q.index}.`}
        </span>
        <div className="text-base flex-1 min-w-0">
          {allImageUrls.length > 0 && (
            <div className="mb-3"><StemImages urls={allImageUrls} /></div>
          )}
          {hasQuestionText ? (
            <RichText text={questionTextNoImages} />
          ) : allImageUrls.length > 0 ? (
            <span className="text-muted-foreground italic text-sm">(refer to the diagram above)</span>
          ) : isHidden ? (
            <span className="text-muted-foreground italic text-sm">
              (filtered{topicLabel ? `; topic: ${topicLabel}` : ""})
            </span>
          ) : (
            <span className="text-muted-foreground italic text-sm">(no question text)</span>
          )}
          {editing === "question" && (
            <div className="mt-2">
              <EditPanel
                label="Edit Question"
                value={q.question}
                onSave={(v) => { editCtx.patch(q.id, { question: v }); setEditing(null); }}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isHidden && (
            <button
              type="button"
              onClick={() => setEditing(editing === "question" ? null : "question")}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted/50 transition-all"
              title="Edit question"
            >
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          {isHidden ? (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-amber-500/40 text-amber-600 dark:text-amber-400">
              Hidden · {q.type.toUpperCase()}
            </Badge>
          ) : (
            isCq && (
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">CQ</Badge>
            )
          )}
        </div>
      </div>

      {!isCq && q.options.length > 0 && (
        <div className="md:pl-9 space-y-2">
          {q.options.map((opt) => {
            const isCorrect = q.answer === opt.letter;
            const isEditingOpt = editing === `opt-${opt.letter}`;
            return (
              <div key={opt.letter} className="group">
                <div
                  className={`flex gap-3 p-3 rounded-lg border transition-colors ${
                    isCorrect ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-transparent"
                  }`}
                >
                  <div className={`font-mono font-medium shrink-0 ${isCorrect ? "text-primary" : "text-muted-foreground/60"}`}>
                    {opt.letter}.
                  </div>
                  <div className={`flex-1 min-w-0 ${isCorrect ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                    <RichText text={opt.text} />
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isCorrect && <CheckCircle2 className="w-5 h-5 text-primary" />}
                    <button
                      type="button"
                      onClick={() => setEditing(isEditingOpt ? null : `opt-${opt.letter}`)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted/50 transition-all"
                    >
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                {isEditingOpt && (
                  <div className="mt-2">
                    <EditPanel
                      label={`Edit Option ${opt.letter}`}
                      value={opt.text}
                      onSave={(v) => {
                        editCtx.patch(q.id, { options: q.options.map((o) => o.letter === opt.letter ? { ...o, text: v } : o) });
                        setEditing(null);
                      }}
                      onCancel={() => setEditing(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isCq && <CqParts qId={q.id} parts={q.parts} token={token} />}

      <div className="md:pl-9 space-y-2 mt-3">
        {q.solution && (
          <div className="group">
            <Collapsible className="bg-muted/40 rounded-lg border border-border/50 overflow-hidden">
              <div className="flex items-center">
                <CollapsibleTrigger className="group/trigger flex-1 flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/60 transition-colors text-left">
                  <span className="text-muted-foreground">{isCq ? "Show full solution" : "Show solution"}</span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]/trigger:rotate-180" />
                </CollapsibleTrigger>
                <button
                  type="button"
                  onClick={() => setEditing(editing === "solution" ? null : "solution")}
                  className="opacity-0 group-hover:opacity-100 p-2.5 hover:bg-muted/60 transition-all shrink-0"
                  title="Edit solution"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              <CollapsibleContent>
                <div className="p-4 pt-2 text-sm text-muted-foreground border-t border-border/30">
                  {editing === "solution" ? (
                    <EditPanel
                      label="Edit Solution"
                      value={q.solution}
                      onSave={(v) => { editCtx.patch(q.id, { solution: v }); setEditing(null); }}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <RichText text={q.solution} />
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {!isCq && (
          <McqAiSolution qId={q.id} token={token} initialAi={q.aiExplanation} isMcqNSub={isMcqNSub} />
        )}

        {isCq && q.aiExplanation && (
          <Collapsible defaultOpen className="bg-primary/5 rounded-lg border border-primary/10 overflow-hidden">
            <CollapsibleTrigger className="group flex items-center justify-between w-full p-3 text-sm font-medium hover:bg-primary/10 transition-colors text-primary/80">
              <span>AI Explanation</span>
              <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-4 pt-2 text-sm text-foreground/80 border-t border-primary/10">
                <RichText text={q.aiExplanation} />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}

// ─── ExamTypeBadge ─────────────────────────────────────────────────────────────
function ExamTypeBadge({ type, className }: { type: "mcq" | "cq" | "mixed" | "unknown"; className?: string }) {
  if (type === "unknown") return null;
  const label = type === "mcq" ? "MCQ" : type === "cq" ? "CQ" : "Mixed";
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 uppercase tracking-wider ${className ?? ""}`}>
      <BookOpen className="w-3 h-3" />{label}
    </Badge>
  );
}

// ─── FilterNotice ──────────────────────────────────────────────────────────────
function FilterNotice({ total, rawTotal, droppedByType, viewMode, showHidden, onToggleHidden }: {
  total: number; rawTotal: number | undefined; droppedByType: number | undefined;
  viewMode: ViewMode; showHidden: boolean; onToggleHidden: () => void;
}) {
  if (rawTotal === undefined || rawTotal <= total) return null;
  const hidden = rawTotal - total;
  const droppedNum = droppedByType ?? 0;
  const reasonParts: string[] = [];
  if (viewMode === "mcq" && droppedNum > 0) reasonParts.push(`${droppedNum} tagged CQ (filtered by Force MCQ)`);
  else if (viewMode === "cq" && droppedNum > 0) reasonParts.push(`${droppedNum} tagged MCQ (filtered by Force CQ)`);
  const stemMerged = hidden - droppedNum;
  if (stemMerged > 0) reasonParts.push(`${stemMerged} merged into other questions as stem images / passage`);
  const reason = reasonParts.length > 0 ? reasonParts.join(" + ") : `${hidden} hidden`;
  return (
    <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2 flex-wrap">
      <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
      <span className="flex-1 min-w-[200px]">Showing {total} of {rawTotal} entries. {reason}.</span>
      {droppedNum > 0 && (
        <button type="button" onClick={onToggleHidden}
          className="text-xs px-2 py-1 rounded border border-border/60 bg-background/60 hover:bg-background transition-colors shrink-0">
          {showHidden ? "Hide" : `Show ${droppedNum} hidden`}
        </button>
      )}
    </div>
  );
}

function formatDuration(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// ─── Import to Library Dialog ────────────────────────────────────────────────
interface LibCard { id: number; name: string; color: string; icon: string }
interface LibFolder { id: number; cardId: number; name: string }
interface LibSubFolder { id: number; folderId: number; parentSubFolderId: number | null; name: string }

function ImportDialog({ questions, examName, examType, token, onClose }: {
  questions: DecodedQuestion[];
  examName: string;
  examType: string;
  token: string | null;
  onClose: () => void;
}) {
  const { token: authToken } = useAuth();
  const effectiveToken = authToken;

  const [cards, setCards] = useState<LibCard[]>([]);
  const [folders, setFolders] = useState<LibFolder[]>([]);
  const [subfolders, setSubfolders] = useState<LibSubFolder[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedSubFolderId, setSelectedSubFolderId] = useState<number | null>(null);
  const [qsName, setQsName] = useState(examName || "Imported Questions");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<"card" | "folder" | "subfolder" | null>(null);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [newIcon, setNewIcon] = useState("📚");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#0ea5e9", "#f97316", "#ec4899"];
  const ICONS = ["📚", "📖", "📝", "🗂️", "🏆", "🔬", "🧮", "📐", "🌍", "💡"];

  const libFetch = useCallback(async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const res = await authFetch(effectiveToken, path, options);
    if (!res.ok) { const b = await res.json().catch(() => ({})) as { error?: string }; throw new Error(b.error || "Request failed"); }
    return res.json() as Promise<T>;
  }, [effectiveToken]);

  useEffect(() => {
    setLoading(true);
    libFetch<LibCard[]>("/library/cards").then(setCards).catch(() => setCards([])).finally(() => setLoading(false));
  }, [libFetch]);

  useEffect(() => {
    if (!selectedCardId) { setFolders([]); setSelectedFolderId(null); return; }
    libFetch<LibFolder[]>(`/library/cards/${selectedCardId}/folders`).then(setFolders).catch(() => setFolders([]));
    setSelectedFolderId(null);
    setSubfolders([]);
    setSelectedSubFolderId(null);
  }, [selectedCardId, libFetch]);

  useEffect(() => {
    if (!selectedFolderId) { setSubfolders([]); setSelectedSubFolderId(null); return; }
    libFetch<LibSubFolder[]>(`/library/folders/${selectedFolderId}/subfolders`).then(setSubfolders).catch(() => setSubfolders([]));
    setSelectedSubFolderId(null);
  }, [selectedFolderId, libFetch]);

  const createCard = async () => {
    if (!newName.trim()) return;
    const row = await libFetch<LibCard>("/library/cards", { method: "POST", body: JSON.stringify({ name: newName.trim(), color: newColor, icon: newIcon }) });
    setCards((p) => [...p, row]);
    setSelectedCardId(row.id);
    setCreating(null);
    setNewName("");
  };

  const createFolder = async () => {
    if (!newName.trim() || !selectedCardId) return;
    const row = await libFetch<LibFolder>(`/library/cards/${selectedCardId}/folders`, { method: "POST", body: JSON.stringify({ name: newName.trim() }) });
    setFolders((p) => [...p, row]);
    setSelectedFolderId(row.id);
    setCreating(null);
    setNewName("");
  };

  const createSubfolder = async () => {
    if (!newName.trim() || !selectedFolderId) return;
    const row = await libFetch<LibSubFolder>(`/library/folders/${selectedFolderId}/subfolders`, { method: "POST", body: JSON.stringify({ name: newName.trim() }) });
    setSubfolders((p) => [...p, row]);
    setSelectedSubFolderId(row.id);
    setCreating(null);
    setNewName("");
  };

  const handleImport = async () => {
    if (!selectedSubFolderId || !qsName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const libQuestions = questions.filter((q) => !q.hidden).map((q) => {
        if (q.type === "mcq" || (q.options.length > 0 && q.parts.length === 0)) {
          return { type: "mcq" as const, data: { question: q.question, options: q.options, solution: q.answer || q.solution, aiSolution: q.aiExplanation } };
        } else if (q.parts.length > 0) {
          return { type: "cq" as const, data: { question: q.question, parts: q.parts } };
        } else {
          return { type: "sq" as const, data: { question: q.question, solution: q.solution, aiSolution: q.aiExplanation } };
        }
      });
      await libFetch(`/library/subfolders/${selectedSubFolderId}/questionsets`, {
        method: "POST",
        body: JSON.stringify({ name: qsName.trim(), detectedType: examType || null, questions: libQuestions }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border border-border/60 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-sm">Save to Library</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-semibold text-sm mb-1">Imported successfully!</p>
            <p className="text-xs text-muted-foreground mb-4">{questions.filter((q) => !q.hidden).length} questions saved to your library</p>
            <Button size="sm" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {loading && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" />Loading library…</div>}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium">Card (Library)</label>
                <button type="button" onClick={() => setCreating("card")} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                  <Plus className="w-3 h-3" />New
                </button>
              </div>
              {creating === "card" ? (
                <div className="space-y-2 p-2 border border-border/60 rounded-lg bg-muted/10">
                  <Input placeholder="Card name…" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 text-xs" autoFocus />
                  <div className="flex gap-1 flex-wrap">
                    {COLORS.map((c) => <button key={c} type="button" onClick={() => setNewColor(c)} style={{ background: c }} className={`w-5 h-5 rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`} />)}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {ICONS.map((ic) => <button key={ic} type="button" onClick={() => setNewIcon(ic)} className={`w-6 h-6 rounded text-sm ${newIcon === ic ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"}`}>{ic}</button>)}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-6 text-xs" onClick={() => { void createCard(); }} disabled={!newName.trim()}>Create</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setCreating(null); setNewName(""); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <select value={selectedCardId || ""} onChange={(e) => setSelectedCardId(Number(e.target.value) || null)}
                  className="w-full h-8 text-xs rounded-md border border-border/60 bg-background px-2">
                  <option value="">— Select card —</option>
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              )}
            </div>

            {selectedCardId && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Folder</label>
                  <button type="button" onClick={() => setCreating("folder")} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                    <Plus className="w-3 h-3" />New
                  </button>
                </div>
                {creating === "folder" ? (
                  <div className="flex gap-2">
                    <Input placeholder="Folder name…" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 text-xs flex-1" autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") void createFolder(); }} />
                    <Button size="sm" className="h-7 text-xs" onClick={() => { void createFolder(); }} disabled={!newName.trim()}>Create</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreating(null); setNewName(""); }}>✕</Button>
                  </div>
                ) : (
                  <select value={selectedFolderId || ""} onChange={(e) => setSelectedFolderId(Number(e.target.value) || null)}
                    className="w-full h-8 text-xs rounded-md border border-border/60 bg-background px-2">
                    <option value="">— Select folder —</option>
                    {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {selectedFolderId && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">Sub-folder</label>
                  <button type="button" onClick={() => setCreating("subfolder")} className="text-xs text-primary hover:underline flex items-center gap-0.5">
                    <Plus className="w-3 h-3" />New
                  </button>
                </div>
                {creating === "subfolder" ? (
                  <div className="flex gap-2">
                    <Input placeholder="Sub-folder name…" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-7 text-xs flex-1" autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") void createSubfolder(); }} />
                    <Button size="sm" className="h-7 text-xs" onClick={() => { void createSubfolder(); }} disabled={!newName.trim()}>Create</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreating(null); setNewName(""); }}>✕</Button>
                  </div>
                ) : (
                  <select value={selectedSubFolderId || ""} onChange={(e) => setSelectedSubFolderId(Number(e.target.value) || null)}
                    className="w-full h-8 text-xs rounded-md border border-border/60 bg-background px-2">
                    <option value="">— Select sub-folder —</option>
                    {subfolders.map((sf) => <option key={sf.id} value={sf.id}>{sf.name}</option>)}
                  </select>
                )}
              </div>
            )}

            {selectedSubFolderId && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Question Set Name</label>
                <Input value={qsName} onChange={(e) => setQsName(e.target.value)} className="h-8 text-xs" placeholder="Set name…" />
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-xs text-muted-foreground">{questions.length} questions</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={onClose} className="h-7 text-xs">Cancel</Button>
                <Button size="sm" onClick={() => { void handleImport(); }}
                  disabled={!selectedSubFolderId || !qsName.trim() || saving}
                  className="h-7 text-xs gap-1">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Library className="w-3 h-3" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ExamCard ─────────────────────────────────────────────────────────────────
function ExamCard({ exam, index, defaultOpen, token, showHidden, isHidden, onToggleHide }: {
  exam: ExamSuccess | ExamFailure; index: number; defaultOpen: boolean; token: string; showHidden: boolean;
  isHidden?: boolean; onToggleHide?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { setOpen(defaultOpen); }, [defaultOpen]);
  const duration = formatDuration(exam.duration);
  const serial = exam.serial ?? index + 1;
  const title = exam.name ? `${serial}. ${exam.name}` : `Exam ${serial}`;

  return (
    <Card className="border-border/60 overflow-hidden p-0 gap-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left px-5 py-4 hover:bg-muted/10 cursor-pointer transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base text-foreground">{title}</div>
                <div className="mt-2 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  {duration && <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{duration}</span>}
                  {exam.qCount !== null && <span className="inline-flex items-center gap-1.5"><ListChecks className="w-3.5 h-3.5" />{exam.qCount} questions</span>}
                  {exam.ok && <ExamTypeBadge type={exam.examType} />}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {exam.ok ? (
                  <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />Decoded
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />Failed</Badge>
                )}
                {onToggleHide && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); onToggleHide(); }}
                    className={`p-1 rounded hover:bg-muted/50 transition-colors ${isHidden ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-foreground"}`}
                    title={isHidden ? "Restore exam" : "Hide this exam"}>
                    {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                )}
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </div>
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/40 px-5 py-5 bg-muted/10">
            {exam.ok ? (
              <div className="space-y-5">
                {exam.questions.filter((q) => !q.hidden || showHidden).map((q) => (
                  <QuestionBlock key={q.id} q={q} token={token} />
                ))}
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Could not decode</AlertTitle>
                <AlertDescription className="break-words text-xs">{exam.error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ─── Theme Toggle ──────────────────────────────────────────────────────────────
function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg hover:bg-muted/50 transition-colors" aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
    </button>
  );
}

// ─── Answer Mode Toggle ────────────────────────────────────────────────────────
function AnswerModeToggle({ mode, onChange }: { mode: AnswerMode; onChange: (m: AnswerMode) => void }) {
  return (
    <div className="flex items-center rounded-lg border border-border/60 bg-muted/20 p-0.5 gap-0.5">
      <button
        type="button"
        onClick={() => onChange("study")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          mode === "study" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <EyeOff className="w-3.5 h-3.5" />
        Study
      </button>
      <button
        type="button"
        onClick={() => onChange("answer")}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          mode === "answer"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Eye className="w-3.5 h-3.5" />
        Answer
      </button>
    </div>
  );
}

// ─── Chorcha AI Bot ────────────────────────────────────────────────────────────
type ChatMsg = { role: "user" | "assistant"; content: string };

function ChorchaAiBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "হ্যালো! আমি Chorcha AI। তোমার পড়ালেখা সংক্রান্ত যেকোনো প্রশ্ন করো — MCQ, CQ, Math, Physics, Chemistry, Biology — সব কিছুতে সাহায্য করব।" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("api/chorcha/ai-chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMessages((m) => [...m, { role: "assistant", content: String(data.reply || "") }]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([{ role: "assistant", content: "নতুন শুরু! তোমার নতুন প্রশ্ন কী?" }]);
    setError(null);
  }

  return (
    <>
      {!open && (
        <button type="button" onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-colors">
          <Sparkles className="w-5 h-5" /><span className="font-semibold">Chorcha AI</span>
        </button>
      )}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[min(92vw,400px)] h-[min(85vh,600px)] flex flex-col rounded-2xl bg-background border border-emerald-200 dark:border-emerald-900/60 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-emerald-600 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-5 h-5 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold leading-tight truncate">Chorcha AI</div>
                <div className="text-[11px] opacity-80 leading-tight truncate">পড়ালেখার যেকোনো প্রশ্ন করো</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={clearChat} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors">
                <RefreshCcw className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-muted/30">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm break-words ${
                  m.role === "user"
                    ? "bg-emerald-600 text-white rounded-br-sm"
                    : "bg-background text-foreground border border-border rounded-bl-sm"
                }`}>
                  {m.role === "assistant" ? <MathText text={m.content} /> : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[88%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 bg-background border border-border">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">{error}</div>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-end gap-2 p-3 border-t border-border bg-background">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="তোমার প্রশ্ন লিখো..." rows={1}
              className="resize-none min-h-[40px] max-h-32 text-sm" disabled={loading} />
            <Button type="submit" size="icon" className="bg-emerald-600 hover:bg-emerald-700 shrink-0"
              disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [, setLoc] = useLocation();
  const { user, token: authToken } = useAuth();
  const [showImport, setShowImport] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [bankFilter, setBankFilter] = useState<"" | "board" | "college">("");
  const [customBankFilter, setCustomBankFilter] = useState("");
  const [hiddenExams, setHiddenExams] = useState<Set<string>>(new Set());
  const [showHiddenExams, setShowHiddenExams] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem("chorcha:token") || "");
  const [result, setResult] = useState<DecodeResponse | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [allExpanded, setAllExpanded] = useState(false);
  const [expandKey, setExpandKey] = useState(0);
  const [autoFillEnabled, setAutoFillEnabled] = useState(
    () => localStorage.getItem("chorcha:autofill") !== "0",
  );
  const [showHidden, setShowHidden] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("chorcha:viewMode");
    if (saved === "mcq" || saved === "cq" || saved === "sq") return saved;
    return "auto";
  });
  const [answerMode, setAnswerMode] = useState<AnswerMode>(() => {
    return localStorage.getItem("chorcha:answerMode") === "answer" ? "answer" : "study";
  });

  useEffect(() => { localStorage.setItem("chorcha:viewMode", viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem("chorcha:answerMode", answerMode); }, [answerMode]);
  useEffect(() => { localStorage.setItem("chorcha:token", token); }, [token]);
  useEffect(() => { localStorage.setItem("chorcha:autofill", autoFillEnabled ? "1" : "0"); }, [autoFillEnabled]);

  const [autoFillMap, setAutoFillMap] = useState<Record<string, string>>({});
  const [autoFillPending, setAutoFillPending] = useState<Set<string>>(() => new Set());
  const [autoFillStatus, setAutoFillStatus] = useState<{
    total: number; done: number; failed: number; running: boolean;
  }>({ total: 0, done: 0, failed: 0, running: false });
  const autoFillCancelRef = useRef<(() => void) | null>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  const autoFillCtx = useMemo<AutoFillCtx>(
    () => ({
      get: (qId, cqType) => autoFillMap[autoFillKey(qId, cqType)],
      isPending: (qId, cqType) => autoFillPending.has(autoFillKey(qId, cqType)),
    }),
    [autoFillMap, autoFillPending],
  );

  const editCtx = useMemo<EditCtx>(
    () => ({
      patch: (chorchaId, p) => {
        setResult((prev) => {
          if (!prev) return prev;
          const apply = (q: DecodedQuestion): DecodedQuestion =>
            q.id === chorchaId ? { ...q, ...p } : q;
          if (prev.kind === "read") return { ...prev, questions: prev.questions.map(apply) };
          return {
            ...prev,
            exams: prev.exams.map((e) => e.ok ? { ...e, questions: e.questions.map(apply) } : e),
          };
        });
        patchQuestion(chorchaId, p, authToken).catch(() => undefined);
      },
    }),
    [authToken],
  );

  useEffect(() => {
    autoFillCancelRef.current?.();
    autoFillCancelRef.current = null;
    setAutoFillMap({});
    setAutoFillPending(new Set());
    setAutoFillStatus({ total: 0, done: 0, failed: 0, running: false });

    if (!autoFillEnabled || !result || !token) return;

    const tasks: Array<{ qId: string; cqType: string | null }> = [];
    const collect = (q: DecodedQuestion) => {
      if (q.hidden || q.extraFields?.parent_type === "MCQ_N") return;
      const isCq = q.type === "cq" || (q.parts.length > 0 && q.options.length === 0);
      if (!isCq) {
        if (!q.aiExplanation) tasks.push({ qId: q.id, cqType: null });
      } else {
        for (const p of q.parts) {
          if (!p.aiSolution) tasks.push({ qId: q.id, cqType: p.key });
        }
      }
    };
    if (result.kind === "read") result.questions.forEach(collect);
    else result.exams.forEach((e) => { if (e.ok) e.questions.forEach(collect); });
    if (tasks.length === 0) return;

    const pending = new Set(tasks.map((t) => autoFillKey(t.qId, t.cqType)));
    setAutoFillPending(pending);
    setAutoFillStatus({ total: tasks.length, done: 0, failed: 0, running: true });

    let cancelled = false;
    autoFillCancelRef.current = () => { cancelled = true; };
    let nextIdx = 0;

    const worker = async () => {
      while (!cancelled) {
        const i = nextIdx++;
        if (i >= tasks.length) return;
        const t = tasks[i];
        const key = autoFillKey(t.qId, t.cqType);
        try {
          const html = await generateSolution({ qId: t.qId, token, cqType: t.cqType });
          if (cancelled) return;
          setAutoFillMap((m) => ({ ...m, [key]: html }));
          setAutoFillStatus((s) => ({ ...s, done: s.done + 1 }));
          saveAiToDb({ chorchaId: t.qId, cqType: t.cqType, aiText: html }).catch(() => undefined);
        } catch {
          if (cancelled) return;
          setAutoFillStatus((s) => ({ ...s, failed: s.failed + 1 }));
        }
        setAutoFillPending((p) => { const n = new Set(p); n.delete(key); return n; });
      }
    };

    const workers = Array.from({ length: Math.min(4, tasks.length) }, worker);
    Promise.all(workers).finally(() => { if (!cancelled) setAutoFillStatus((s) => ({ ...s, running: false })); });
    return () => { cancelled = true; };
  }, [result, autoFillEnabled, token]);

  const backendTypeOverride = viewMode === "mcq" ? "mcq" : viewMode === "cq" ? "cq" : undefined;

  const decodeMutation = useMutation({
    mutationFn: async (data: { input: string; token: string; bankFilter?: string }) => {
      const response = await fetch(getApiUrl("api/chorcha/decode"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: data.input, token: data.token, typeOverride: backendTypeOverride, bankFilter: data.bankFilter ?? "" }),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        let message = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          if (text && text.length < 300 && !text.trim().startsWith("<")) message = text.trim();
        }
        throw new Error(message);
      }
      return response.json() as Promise<DecodeResponse>;
    },
    onSuccess: (data) => { setResult(data); setAllExpanded(false); setExpandKey((k) => k + 1); setHiddenExams(new Set()); setShowHiddenExams(false); },
  });

  const handleDecode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl || !token) return;
    const effectiveFilter = customBankFilter.trim() || bankFilter;
    decodeMutation.mutate({ input: inputUrl, token, bankFilter: effectiveFilter });
  };

  const [flatView, setFlatView] = useState(false);
  const [flatPageSize, setFlatPageSize] = useState(100);

  const handleReset = () => { setResult(null); setInputUrl(""); setBankFilter(""); setCustomBankFilter(""); setHiddenExams(new Set()); setShowHiddenExams(false); setFlatPageSize(100); };
  const toggleExpandAll = () => { setAllExpanded((v) => !v); setExpandKey((k) => k + 1); };

  const handleDownloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.kind === "read" ? `chorcha-${result.id}.json` : `chorcha-bank-${result.slug}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!result || !printableRef.current) return;
    setIsExportingPdf(true);
    setAllExpanded(true);
    setExpandKey((k) => k + 1);
    await new Promise((r) => setTimeout(r, 250));
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas-pro"),
      ]);
      const node = printableRef.current;
      node.classList.add("pdf-export");
      const canvas = await html2canvas(node, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
      node.classList.remove("pdf-export");
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const renderWidth = pageWidth - margin * 2;
      const renderHeight = (canvas.height * renderWidth) / canvas.width;
      let heightLeft = renderHeight;
      let position = margin;
      pdf.addImage(imgData, "JPEG", margin, position, renderWidth, renderHeight);
      heightLeft -= pageHeight - margin * 2;
      while (heightLeft > 0) {
        position = margin - (renderHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", margin, position, renderWidth, renderHeight);
        heightLeft -= pageHeight - margin * 2;
      }
      const name = result.kind === "read" ? `chorcha-${result.id}.pdf` : `chorcha-bank-${result.slug}.pdf`;
      pdf.save(name);
    } finally { setIsExportingPdf(false); }
  };

  const headerStats = useMemo(() => {
    if (!result) return null;
    if (result.kind === "read") {
      return { leftLabel: result.id, meta: [result.host, `${result.total} question${result.total === 1 ? "" : "s"}`], examType: result.examType };
    }
    const successCount = result.exams.filter((e) => e.ok).length;
    const totalQuestions = result.exams.reduce((acc, e) => acc + (e.ok ? e.questions.length : 0), 0);
    return { leftLabel: result.slug, meta: [`${successCount}/${result.totalExams} exams`, `${totalQuestions} questions`], examType: undefined };
  }, [result]);

  if (result && headerStats) {
    const isBank = result.kind === "question-bank";
    return (
      <ViewModeContext.Provider value={viewMode}>
      <AnswerModeContext.Provider value={answerMode}>
      <AutoFillContext.Provider value={autoFillCtx}>
      <EditContext.Provider value={editCtx}>
      <div className="min-h-[100dvh] bg-background w-full pb-20">
        <AppNav />
        <header className="sticky top-0 z-10 bg-background/85 backdrop-blur-md border-b border-border/50">
          <div className="max-w-3xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold tracking-tight">
                {isBank ? "Question Bank" : "Chorcha Decoder"}
              </h1>
              <div className="text-xs text-muted-foreground flex gap-2 mt-0.5 items-center flex-wrap">
                <span className="font-mono truncate max-w-[200px]">{headerStats.leftLabel}</span>
                {headerStats.meta.map((m, i) => (
                  <span key={i} className="flex items-center gap-2">
                    <span className="opacity-50">•</span><span>{m}</span>
                  </span>
                ))}
                {headerStats.examType && <ExamTypeBadge type={headerStats.examType} />}
                {viewMode !== "auto" && (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {viewMode === "mcq" ? "Force MCQ" : viewMode === "cq" ? "Force CQ" : "Force SQ"}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <AnswerModeToggle mode={answerMode} onChange={setAnswerMode} />
              <ThemeToggle />
              {isBank && !flatView && (
                <Button variant="outline" size="sm" onClick={toggleExpandAll} className="gap-2">
                  {allExpanded ? <><ChevronsUp className="w-4 h-4" />Collapse</> : <><ChevronsDown className="w-4 h-4" />Expand all</>}
                </Button>
              )}
              {isBank && (
                <>
                  <div className="flex items-center rounded-md border border-border/60 bg-muted/20 p-0.5 gap-0.5 text-xs">
                    {([
                      { v: "" as const,        label: "সকল"   },
                      { v: "board" as const,   label: "বোর্ড" },
                      { v: "college" as const, label: "কলেজ"  },
                    ]).map((opt) => {
                      const active = bankFilter === opt.v && !customBankFilter.trim();
                      return (
                        <button key={opt.v} type="button"
                          onClick={() => {
                            setBankFilter(opt.v);
                            setCustomBankFilter("");
                            decodeMutation.mutate({ input: inputUrl, token, bankFilter: opt.v });
                          }}
                          disabled={decodeMutation.isPending}
                          className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                            active ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                          }`}>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {hiddenExams.size > 0 && (
                    <button type="button" onClick={() => setShowHiddenExams((v) => !v)}
                      className="text-xs px-2 py-1 rounded border border-amber-400/40 bg-amber-50/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100/50 transition-colors">
                      {showHiddenExams ? "Hide hidden" : `${hiddenExams.size} hidden`}
                    </button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setFlatView((v) => !v)} className="gap-2">
                    {flatView ? <><ChevronRight className="w-4 h-4" />By Board</> : <><ChevronsDown className="w-4 h-4" />Flat</>}
                  </Button>
                </>
              )}
              <button type="button" onClick={() => setLoc("/library")}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-colors">
                <Library className="w-3.5 h-3.5" />Library
              </button>
              {user && (
                <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="gap-2">
                  <FolderOpen className="w-4 h-4" />Save
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownloadJson} className="gap-2">
                <Download className="w-4 h-4" />JSON
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isExportingPdf} className="gap-2">
                {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                <RefreshCcw className="w-4 h-4" />New
              </Button>
            </div>
          </div>
        </header>

        <main ref={printableRef} className="max-w-3xl mx-auto p-4 md:p-6 space-y-3 mt-2">
          {autoFillStatus.total > 0 && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 flex items-center gap-3 text-xs print:hidden">
              {autoFillStatus.running
                ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                : <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground/90">
                  {autoFillStatus.running
                    ? "Auto-filling AI answers… auto-saving to DB as each completes"
                    : autoFillStatus.failed > 0
                      ? `Complete · ${autoFillStatus.done}/${autoFillStatus.total} saved · ${autoFillStatus.failed} failed`
                      : `Complete · ${autoFillStatus.done}/${autoFillStatus.total} AI answers saved to DB`}
                </div>
                <div className="h-1 mt-1.5 rounded-full bg-primary/10 overflow-hidden">
                  <div className="h-full bg-primary transition-all"
                    style={{ width: `${autoFillStatus.total === 0 ? 0 : ((autoFillStatus.done + autoFillStatus.failed) / autoFillStatus.total) * 100}%` }} />
                </div>
              </div>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {autoFillStatus.done + autoFillStatus.failed}/{autoFillStatus.total}
              </span>
            </div>
          )}

          {result.kind === "read" ? (
            <Card className="border-border/60">
              <CardContent className="space-y-5 pt-6">
                <FilterNotice total={result.total} rawTotal={result.rawTotal} droppedByType={result.droppedByType}
                  viewMode={viewMode} showHidden={showHidden} onToggleHidden={() => setShowHidden((v) => !v)} />
                {result.questions.filter((q) => !q.hidden || showHidden).map((q) => (
                  <QuestionBlock key={q.id} q={q} token={token} />
                ))}
              </CardContent>
            </Card>
          ) : flatView ? (
            <Card className="border-border/60">
              <CardContent className="space-y-5 pt-6">
                {(() => {
                  const aggRaw = result.exams.reduce((acc, e) => acc + (e.ok ? (e.rawTotal ?? e.total) : 0), 0);
                  const aggDropped = result.exams.reduce((acc, e) => acc + (e.ok ? (e.droppedByType ?? 0) : 0), 0);
                  const aggShown = result.exams.reduce((acc, e) => acc + (e.ok ? e.total : 0), 0);
                  return <FilterNotice total={aggShown} rawTotal={aggRaw} droppedByType={aggDropped}
                    viewMode={viewMode} showHidden={showHidden} onToggleHidden={() => setShowHidden((v) => !v)} />;
                })()}
                {(() => {
                  const allNodes: Array<{ key: string; node: React.ReactNode }> = [];
                  result.exams.forEach((exam, ei) => {
                    if (!exam.ok) return;
                    if (hiddenExams.has(exam.id) && !showHiddenExams) return;
                    const visible = exam.questions.filter((q) => !q.hidden || showHidden);
                    if (visible.length === 0) return;
                    const flatSerial = exam.serial ?? ei + 1;
                    const flatLabel = exam.name ? `${flatSerial}. ${exam.name}` : `Exam ${flatSerial}`;
                    allNodes.push({
                      key: `board-sep-${ei}`,
                      node: (
                        <div key={`board-sep-${ei}`} className="flex items-center gap-3 py-1 -mx-1">
                          <div className="h-px flex-1 bg-border/40" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1 shrink-0">{flatLabel}</span>
                          <div className="h-px flex-1 bg-border/40" />
                        </div>
                      ),
                    });
                    visible.forEach((q) => allNodes.push({ key: q.id, node: <QuestionBlock key={q.id} q={q} token={token} /> }));
                  });
                  const visible = allNodes.slice(0, flatPageSize);
                  const remaining = allNodes.length - visible.length;
                  return (
                    <>
                      {visible.map((n) => n.node)}
                      {remaining > 0 && (
                        <div className="pt-2 text-center">
                          <button type="button"
                            onClick={() => setFlatPageSize((s) => s + 100)}
                            className="px-4 py-2 rounded-lg border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
                            আরো {Math.min(remaining, 100)} টি প্রশ্ন দেখুন ({remaining} বাকি)
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {(() => {
                const aggRaw = result.exams.reduce((acc, e) => acc + (e.ok ? (e.rawTotal ?? e.total) : 0), 0);
                const aggDropped = result.exams.reduce((acc, e) => acc + (e.ok ? (e.droppedByType ?? 0) : 0), 0);
                const aggShown = result.exams.reduce((acc, e) => acc + (e.ok ? e.total : 0), 0);
                return <FilterNotice total={aggShown} rawTotal={aggRaw} droppedByType={aggDropped}
                  viewMode={viewMode} showHidden={showHidden} onToggleHidden={() => setShowHidden((v) => !v)} />;
              })()}
              {result.exams.filter((e) => showHiddenExams || !hiddenExams.has(e.id)).map((exam, idx) => (
                <ExamCard key={`${expandKey}-${exam.id || idx}-${idx}`} exam={exam} index={idx}
                  defaultOpen={allExpanded} token={token} showHidden={showHidden}
                  isHidden={hiddenExams.has(exam.id)}
                  onToggleHide={() => setHiddenExams((prev) => {
                    const n = new Set(prev); n.has(exam.id) ? n.delete(exam.id) : n.add(exam.id); return n;
                  })} />
              ))}
            </div>
          )}
        </main>
      </div>
      {showImport && result && (() => {
        let allQs: DecodedQuestion[];
        let name: string;
        let eType: string;
        if (result.kind === "read") {
          allQs = result.questions;
          name = result.id;
          eType = result.examType;
        } else {
          allQs = result.exams.flatMap((e: ExamSuccess | ExamFailure) => (e.ok ? (e as ExamSuccess).questions : []));
          const firstOk = result.exams.find((e: ExamSuccess | ExamFailure) => e.ok) as ExamSuccess | undefined;
          name = firstOk?.name ?? "Imported Questions";
          eType = firstOk?.examType ?? "";
        }
        return (
          <ImportDialog questions={allQs} examName={name || "Imported Questions"} examType={eType || ""}
            token={token} onClose={() => setShowImport(false)} />
        );
      })()}
      <ChorchaAiBot />
      </EditContext.Provider>
      </AutoFillContext.Provider>
      </AnswerModeContext.Provider>
      </ViewModeContext.Provider>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background selection:bg-primary/30">
      <AppNav />

      <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

      <div className="flex-1 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-lg space-y-6">

        <div className="text-center space-y-3">
          <div className="inline-flex w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl items-center justify-center shadow-lg mb-1">
            <FileLock2 className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Chorcha Decoder</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Decrypt &amp; extract protected questions — MCQ, CQ &amp; SQ — fast.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40 bg-muted/20">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Decode questions</p>
          </div>
          <form onSubmit={handleDecode} className="p-5 space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="url" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                URL or ID
              </label>
              <input
                id="url"
                type="text"
                placeholder="chorcha.net/read/4wg11y275hbUiIBP  or  chorcha.net/question-bank/hsc-chemistry-cq"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border/60 bg-muted/20 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all placeholder:text-muted-foreground/40"
                required
              />
              <p className="text-[11px] text-muted-foreground/70">
                Question-bank URLs decode every exam in the bank in parallel — MCQ &amp; CQ both supported.
              </p>
            </div>

            {/question-bank/i.test(inputUrl) && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filter</label>
                <div className="flex gap-1 p-1 rounded-xl bg-muted/30 border border-border/40">
                  {([
                    { v: "" as const,        label: "সকল",   en: "All"     },
                    { v: "board" as const,   label: "বোর্ড", en: "Board"   },
                    { v: "college" as const, label: "কলেজ",  en: "College" },
                  ]).map((opt) => {
                    const active = bankFilter === opt.v && !customBankFilter.trim();
                    return (
                      <button key={opt.v} type="button" onClick={() => { setBankFilter(opt.v); setCustomBankFilter(""); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 ${
                          active ? "bg-background text-primary shadow-sm border border-border/60" : "text-muted-foreground hover:text-foreground"
                        }`}>
                        <span>{opt.label}</span>
                        <span className="opacity-50 text-[10px]">{opt.en}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-semibold shrink-0 uppercase tracking-wider">Custom:</span>
                  <input
                    type="text"
                    placeholder="type any filter value (e.g. board, college…)"
                    value={customBankFilter}
                    onChange={(e) => setCustomBankFilter(e.target.value)}
                    className="flex-1 px-2 py-1 text-xs rounded-md border border-border/60 bg-muted/20 font-mono focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
                  />
                </div>
                {customBankFilter.trim() && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0 inline-block" />
                    Custom filter active — overrides preset tab
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mode</label>
              <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/40">
                {([
                  { v: "auto" as ViewMode, label: "Auto" },
                  { v: "mcq" as ViewMode, label: "MCQ" },
                  { v: "cq" as ViewMode, label: "CQ" },
                  { v: "sq" as ViewMode, label: "SQ" },
                ]).map((opt) => {
                  const active = viewMode === opt.v;
                  return (
                    <label key={opt.v} className={`flex items-center justify-center py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      active
                        ? "bg-background text-primary shadow-sm border border-border/60"
                        : "text-muted-foreground hover:text-foreground"
                    }`}>
                      <input type="radio" name="viewMode" value={opt.v} checked={active}
                        onChange={() => setViewMode(opt.v)} className="sr-only" />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="token" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Session Token
                </label>
                <a href="https://chorcha.net" target="_blank" rel="noreferrer"
                  className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-1 transition-colors">
                  <HelpCircle className="w-3 h-3" />How to get?
                </a>
              </div>
              <input
                id="token"
                type="password"
                placeholder="eyJh…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                className="w-full px-3 py-2.5 rounded-lg border border-border/60 bg-muted/20 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all placeholder:text-muted-foreground/40"
                required
              />
              <p className="text-[11px] text-muted-foreground/70">Your token is saved locally in this browser.</p>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/40">
              <button
                type="button"
                role="switch"
                aria-checked={autoFillEnabled}
                onClick={() => setAutoFillEnabled((v) => !v)}
                className={`relative shrink-0 h-5 w-9 rounded-full border-2 transition-all duration-200 ${
                  autoFillEnabled ? "border-primary bg-primary" : "border-muted-foreground/30 bg-muted"
                }`}
              >
                <span className={`block h-3.5 w-3.5 translate-y-px rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  autoFillEnabled ? "translate-x-3.5" : "translate-x-px"
                }`} />
              </button>
              <div>
                <div className="text-sm font-semibold leading-none">Auto-fill AI explanations</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Generates &amp; auto-saves AI solutions for every question as they decode.
                </p>
              </div>
            </div>

            {decodeMutation.isError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold">Decode failed</div>
                  <div className="text-xs opacity-90 mt-0.5">{decodeMutation.error?.message || "Unknown error occurred"}</div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={decodeMutation.isPending || !inputUrl || !token}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/25 hover:shadow-primary/40"
            >
              {decodeMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Decoding…</>
                : <><FileLock2 className="w-4 h-4" />Decode</>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground/60">Chorcha Decoder · For educational use only</p>
      </div>
      </div>
      <ChorchaAiBot />
    </div>
  );
}
