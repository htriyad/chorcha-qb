import { useState, useEffect } from "react";
import { getApiUrl } from "@/lib/apiUrl";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListQuestionSetsQueryKey } from "@workspace/api-client-react";
import { Loader2, Link2, Key, BookOpen, CheckCircle, AlertCircle, Database, RefreshCw, Wand2, RotateCcw } from "lucide-react";

type ForceType = "auto" | "mcq" | "cq" | "sq";

const FORCE_TYPE_OPTIONS: { value: ForceType; label: string; desc: string; color: string }[] = [
  { value: "auto", label: "Auto", desc: "Detect from content", color: "#6b7280" },
  { value: "mcq", label: "MCQ", desc: "Multiple Choice", color: "#f59e0b" },
  { value: "cq", label: "CQ", desc: "Creative / Srijonshil", color: "#f97316" },
  { value: "sq", label: "SQ", desc: "Short Question", color: "#38bdf8" },
];

const TOKEN_STORAGE_KEY = "chorcha_session_token";

function detectInputType(input: string): "bank" | "read" {
  const trimmed = input.trim();
  if (trimmed.includes("/question-bank/")) return "bank";
  if (/^[a-z0-9][a-z0-9-]{3,}[a-z0-9]$/.test(trimmed) && trimmed.includes("-")) return "bank";
  return "read";
}

function extractBankSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/question-bank\/([A-Za-z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[A-Za-z0-9][A-Za-z0-9_-]*[A-Za-z0-9]$/.test(trimmed) && trimmed.includes("-")) return trimmed;
  return null;
}

interface DecodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: number;
  folderColor: string;
}

type Phase = "idle" | "fetching-bank" | "decoding" | "done" | "error";

interface Progress {
  phase: Phase;
  bankName?: string;
  total?: number;
  created?: number;
  failed?: number;
  errorMsg?: string;
}

export function DecodeDialog({ open, onOpenChange, folderId, folderColor }: DecodeDialogProps) {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [forceType, setForceType] = useState<ForceType>("auto");
  const [replaceMode, setReplaceMode] = useState(false);
  const [progress, setProgress] = useState<Progress>({ phase: "idle" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (saved) setToken(saved);
      setProgress({ phase: "idle" });
      setName("");
    }
  }, [open]);

  const isBank = detectInputType(url);
  const loading = progress.phase === "fetching-bank" || progress.phase === "decoding";

  const saveToken = (t: string) => {
    const trimmed = t.trim();
    if (trimmed) localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
  };

  const handleDecode = async () => {
    if (!url.trim()) {
      toast({ title: "Missing URL", description: "Please enter a Chorcha URL.", variant: "destructive" });
      return;
    }
    if (!token.trim()) {
      toast({ title: "Missing token", description: "Please enter your session token.", variant: "destructive" });
      return;
    }

    const inputType = detectInputType(url.trim());
    if (inputType === "bank") {
      await handleBankDecode();
    } else {
      await handleSingleDecode();
    }
  };

  const handleBankDecode = async () => {
    setProgress({ phase: "fetching-bank" });
    try {
      const bankSlug = extractBankSlug(url.trim()) ?? url.trim();
      const res = await fetch(getApiUrl("api/chorcha/decode-bank"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          input: url.trim(),
          bankSlug,
          token: token.trim(),
          typeHint: apiTypeHint,
          replaceExisting: replaceMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProgress({ phase: "error", errorMsg: data.error ?? `Server error ${res.status}` });
        return;
      }
      saveToken(token.trim());
      setProgress({ phase: "done", bankName: data.bankName, total: data.total, created: data.created, failed: data.failed });
      queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) });
      if (data.created > 0) {
        toast({ title: "Bank decoded!", description: `Saved ${data.created} of ${data.total} question sets from "${data.bankName}".` });
      }
    } catch (err) {
      setProgress({ phase: "error", errorMsg: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleSingleDecode = async () => {
    setProgress({ phase: "decoding" });
    try {
      const res = await fetch(getApiUrl("api/chorcha/decode-to-folder"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, input: url.trim(), token: token.trim(), name: name.trim() || undefined, typeHint: apiTypeHint }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProgress({ phase: "error", errorMsg: data.error ?? `Server error ${res.status}` });
        return;
      }
      saveToken(token.trim());
      setProgress({ phase: "done", created: 1, total: 1, bankName: data.name });
      queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) });
      toast({ title: "Decoded!", description: `Saved "${data.name}" with ${data.totalQuestions} questions.` });
    } catch (err) {
      setProgress({ phase: "error", errorMsg: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleClose = () => {
    if (!loading) {
      setUrl("");
      setName("");
      setProgress({ phase: "idle" });
      onOpenChange(false);
    }
  };

  const handleReset = () => {
    setUrl("");
    setName("");
    setForceType("auto");
    setReplaceMode(false);
    setProgress({ phase: "idle" });
  };

  const apiTypeHint = forceType === "auto" ? undefined : forceType;
  const isBankUrl = url.trim() && detectInputType(url.trim()) === "bank";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-[#111] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${folderColor}25`, border: `1px solid ${folderColor}40` }}>
              <BookOpen className="w-4 h-4" style={{ color: folderColor }} />
            </div>
            Decode Chorcha Questions
          </DialogTitle>
          <DialogDescription className="text-white/40 text-sm">
            Paste a question bank URL to import all sets, or a single read URL for one set.
          </DialogDescription>
        </DialogHeader>

        {progress.phase === "fetching-bank" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="relative">
              <Database className="w-12 h-12 text-white/20" />
              <Loader2 className="w-5 h-5 animate-spin absolute -top-1 -right-1" style={{ color: folderColor }} />
            </div>
            <div className="text-center">
              <p className="text-white/80 font-semibold">Fetching bank listing…</p>
              <p className="text-white/35 text-sm mt-1">Getting all question sets from the bank</p>
            </div>
          </div>
        )}

        {progress.phase === "decoding" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: folderColor }} />
            <div className="text-center">
              <p className="text-white/80 font-semibold">Decoding questions…</p>
              <p className="text-white/35 text-sm mt-1">Fetching and saving question set</p>
            </div>
          </div>
        )}

        {progress.phase === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <CheckCircle className="w-12 h-12 text-emerald-400" />
            <div className="text-center space-y-1">
              <p className="text-white/90 font-bold text-lg">
                {progress.bankName && <span className="block text-white/50 text-sm font-normal mb-1">{progress.bankName}</span>}
                {progress.created} set{progress.created !== 1 ? "s" : ""} saved!
              </p>
              {(progress.failed ?? 0) > 0 && (
                <p className="text-amber-400/70 text-sm">{progress.failed} set{progress.failed !== 1 ? "s" : ""} failed (token may be expired for some)</p>
              )}
              <p className="text-white/30 text-sm">{progress.total} total in bank</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={handleReset} className="border-white/10 text-white/50 hover:text-white gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Decode Another
              </Button>
              <Button size="sm" onClick={handleClose} style={{ background: `linear-gradient(135deg, ${folderColor}, ${folderColor}aa)` }}>
                Done
              </Button>
            </div>
          </div>
        )}

        {progress.phase === "error" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <div className="text-center space-y-1">
              <p className="text-white/80 font-semibold">Decode failed</p>
              <p className="text-red-400/80 text-sm max-w-xs">{progress.errorMsg}</p>
              {progress.errorMsg?.toLowerCase().includes("token") && (
                <p className="text-white/30 text-xs mt-2">Your session token may have expired. Paste a fresh one from chorcha.net cookies.</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleReset} className="border-white/10 text-white/50 hover:text-white gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Try Again
            </Button>
          </div>
        )}

        {progress.phase === "idle" && (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Chorcha URL
              </Label>
              <Input
                placeholder="https://chorcha.net/question-bank/hsc-physics-1st-paper-mcq"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-white/25"
              />
              {url.trim() && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isBankUrl
                      ? "bg-violet-500/15 text-violet-300 border border-violet-500/25"
                      : "bg-sky-500/15 text-sky-300 border border-sky-500/25"
                  }`}>
                    {isBankUrl ? (
                      <><Database className="w-3 h-3" /> Question Bank — all sets will be imported</>
                    ) : (
                      <><BookOpen className="w-3 h-3" /> Single question set</>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs flex items-center gap-1.5">
                <Wand2 className="w-3.5 h-3.5" />
                Question Type
                {isBankUrl && forceType === "auto" && (
                  <span className="text-white/25 font-normal">(auto-detected per set from name)</span>
                )}
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {FORCE_TYPE_OPTIONS.map((opt) => {
                  const active = forceType === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setForceType(opt.value)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all"
                      style={active
                        ? { background: `${opt.color}18`, border: `1.5px solid ${opt.color}60`, color: opt.color }
                        : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>
                      <span className="text-xs font-bold leading-none">{opt.label}</span>
                      <span className="text-[10px] leading-tight opacity-70">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isBankUrl && (
              <div className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/2">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-3.5 h-3.5 text-white/35" />
                  <div>
                    <p className="text-xs font-medium text-white/70">Replace existing sets</p>
                    <p className="text-[10px] text-white/30">Delete all current sets in this folder before importing</p>
                  </div>
                </div>
                <button
                  onClick={() => setReplaceMode(v => !v)}
                  className={`relative w-10 h-5 rounded-full transition-all flex-shrink-0 ${replaceMode ? "bg-red-500/70" : "bg-white/12"}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${replaceMode ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            )}

            {!isBankUrl && url.trim() && (
              <div className="space-y-1.5">
                <Label className="text-white/60 text-xs">Name (optional)</Label>
                <Input
                  placeholder="e.g. Physics Chapter 3 MCQ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-white/25"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-white/60 text-xs flex items-center gap-1.5 justify-between">
                <span className="flex items-center gap-1.5"><Key className="w-3.5 h-3.5" /> Session Token</span>
                {localStorage.getItem(TOKEN_STORAGE_KEY) && (
                  <span className="text-emerald-400/60 text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Saved
                  </span>
                )}
              </Label>
              <Textarea
                placeholder="Paste your Chorcha token (JWT, cookie string, or Cookie-Editor JSON export)"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={3}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-white/25 resize-none font-mono text-xs"
              />
              <p className="text-white/25 text-xs">
                Token is saved locally and auto-filled next time. Get it from chorcha.net → browser cookies → <code className="text-white/40">token</code>.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="border-white/10 text-white/50 hover:text-white">
                Cancel
              </Button>
              <Button onClick={handleDecode} disabled={loading || !url.trim() || !token.trim()}
                style={{ background: `linear-gradient(135deg, ${folderColor}, ${folderColor}aa)` }}>
                {isBankUrl ? (
                  <><Database className="w-4 h-4 mr-2" /> Import Full Bank</>
                ) : (
                  <><BookOpen className="w-4 h-4 mr-2" /> Decode & Save</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
