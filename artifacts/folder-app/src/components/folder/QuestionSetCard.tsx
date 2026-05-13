import { useState } from "react";
import { getApiUrl } from "@/lib/apiUrl";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BookOpen, Trash2, CheckCircle, HelpCircle, Layers, Pencil, Check, ArrowUp, ArrowDown, X, Loader2 } from "lucide-react";
import { QuestionSet, useDeleteQuestionSet, getListQuestionSetsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface QuestionSetCardProps {
  set: QuestionSet;
  index: number;
  folderColor: string;
  folderId: number;
  reorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  onRenamed?: (id: number, newName: string) => void;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; Icon: typeof CheckCircle }> = {
  mcq: { label: "MCQ", color: "#22c55e", Icon: CheckCircle },
  cq: { label: "CQ", color: "#f59e0b", Icon: HelpCircle },
  sq: { label: "SQ", color: "#0ea5e9", Icon: BookOpen },
  mixed: { label: "Mixed", color: "#8b5cf6", Icon: Layers },
  unknown: { label: "Questions", color: "#64748b", Icon: BookOpen },
};

export function QuestionSetCard({
  set, index, folderColor, folderId,
  reorderMode = false, onMoveUp, onMoveDown, isFirst, isLast, onRenamed,
}: QuestionSetCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteSet = useDeleteQuestionSet();

  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(set.name);
  const [saving, setSaving] = useState(false);

  const cfg = TYPE_CONFIG[set.examType ?? "unknown"] ?? TYPE_CONFIG.unknown;
  const TypeIcon = cfg.Icon;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Delete "${set.name}"? This removes all ${set.totalQuestions} questions.`)) return;
    try {
      await deleteSet.mutateAsync({ id: set.id });
      queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) });
      toast({ title: "Deleted", description: `"${set.name}" removed.` });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const startRename = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setNameInput(set.name);
    setRenaming(true);
  };

  const commitRename = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === set.name) { setRenaming(false); return; }
    setSaving(true);
    try {
      const res = await fetch(getApiUrl(`api/sets/${set.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Rename failed");
      onRenamed?.(set.id, trimmed);
      queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) });
      setRenaming(false);
    } catch {
      toast({ title: "Rename failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const cardContent = (
    <div
      className="relative group w-full overflow-hidden border transition-all duration-200 rounded-2xl h-36 flex flex-col justify-between p-4 cursor-pointer hover:shadow-xl hover:shadow-black/20"
      style={{ backgroundColor: `${cfg.color}10`, borderColor: `${cfg.color}30` }}
    >
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-15 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
        style={{ backgroundColor: cfg.color }} />

      <div className="relative z-10 flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}22` }}>
          <TypeIcon className="w-5 h-5" style={{ color: cfg.color }} strokeWidth={1.8} />
        </div>
        {!reorderMode && (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={startRename}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95"
              style={{ backgroundColor: `${cfg.color}18`, border: `1px solid ${cfg.color}28` }}>
              <Pencil className="w-3.5 h-3.5" style={{ color: cfg.color }} />
            </button>
            <button onClick={handleDelete} disabled={deleteSet.isPending}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 hover:bg-red-500/20"
              style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Trash2 className="w-3.5 h-3.5 text-white/40" />
            </button>
          </div>
        )}
      </div>

      <div className="relative z-10">
        {renaming ? (
          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(false); }}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white/90 focus:outline-none focus:border-white/40 min-w-0"
            />
            <button onClick={commitRename} disabled={saving}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-emerald-500/20 hover:bg-emerald-500/35 transition-colors">
              {saving ? <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" /> : <Check className="w-3 h-3 text-emerald-400" />}
            </button>
            <button onClick={() => setRenaming(false)}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-white/8 hover:bg-white/15 transition-colors">
              <X className="w-3 h-3 text-white/40" />
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-bold text-white/90 group-hover:text-white transition-colors truncate text-base leading-snug">{set.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-white/35">{set.totalQuestions} {set.totalQuestions === 1 ? "question" : "questions"}</span>
              {set.examType && set.examType !== "unknown" && (
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${cfg.color}18`, color: cfg.color }}>
                  {cfg.label}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ duration: 0.25, delay: reorderMode ? 0 : index * 0.04, ease: [0.23, 1, 0.32, 1] }}
      whileHover={reorderMode ? {} : { y: -2, transition: { duration: 0.15 } }}
      className="relative"
    >
      {reorderMode ? (
        <div className="relative">
          {cardContent}
          <div className="absolute inset-0 flex items-center justify-between px-4 bg-black/30 backdrop-blur-[1px] rounded-2xl">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg"
              style={{ backgroundColor: cfg.color, color: "#000" }}>
              {index + 1}
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={onMoveUp} disabled={isFirst}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                <ArrowUp className="w-3.5 h-3.5 text-white" />
              </button>
              <button onClick={onMoveDown} disabled={isLast}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all disabled:opacity-20 disabled:cursor-not-allowed">
                <ArrowDown className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <Link href={`/sets/${set.id}`}>{cardContent}</Link>
      )}
    </motion.div>
  );
}
