import { useState } from "react";
import { getApiUrl } from "@/lib/apiUrl";
import { useParams, Link } from "wouter";
import {
  useListFolders,
  useGetFolder,
  useGetFolderBreadcrumb,
  useReorderFolders,
  useListQuestionSets,
  getListFoldersQueryKey,
  getListQuestionSetsQueryKey,
  Folder,
  QuestionSet,
} from "@workspace/api-client-react";
import { FolderCard } from "@/components/folder/FolderCard";
import { FolderFormDialog } from "@/components/folder/FolderFormDialog";
import { DeleteFolderDialog } from "@/components/folder/DeleteFolderDialog";
import { DecodeDialog } from "@/components/folder/DecodeDialog";
import { QuestionSetCard } from "@/components/folder/QuestionSetCard";
import { Button } from "@/components/ui/button";
import { ChevronRight, Home as HomeIcon, Plus, FolderIcon, GripVertical, Check, Pencil, Trash2, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion } from "framer-motion";
import { getIcon } from "@/lib/folderIcons";
import { useQueryClient } from "@tanstack/react-query";

export function FolderView() {
  const params = useParams();
  const folderId = parseInt(params.id ?? "0", 10);

  const { data: folder, isLoading: folderLoading } = useGetFolder(folderId);
  const { data: breadcrumbs = [], isLoading: breadcrumbLoading } = useGetFolderBreadcrumb(folderId);
  const { data: subfolders = [], isLoading: listLoading } = useListFolders({ parentId: folderId });
  const { data: questionSets = [], isLoading: setsLoading } = useListQuestionSets(folderId);

  const [createOpen, setCreateOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);
  const [decodeOpen, setDecodeOpen] = useState(false);

  const [folderReorderMode, setFolderReorderMode] = useState(false);
  const [localFolderOrder, setLocalFolderOrder] = useState<Folder[]>([]);

  const [setReorderMode, setSetReorderMode] = useState(false);
  const [localSetOrder, setLocalSetOrder] = useState<QuestionSet[]>([]);
  const [savingSetsOrder, setSavingSetsOrder] = useState(false);

  const reorderFolders = useReorderFolders();
  const queryClient = useQueryClient();

  if (folderLoading || breadcrumbLoading) {
    return (
      <div className="max-w-4xl mx-auto px-5 py-8 md:px-10 md:py-12 space-y-8">
        <Skeleton className="h-6 w-56 rounded-full" />
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h2 className="text-2xl font-bold text-white/70">Folder not found</h2>
        <Link href="/"><Button variant="outline">Return Home</Button></Link>
      </div>
    );
  }

  const FolderIconComp = getIcon(folder.icon);
  const displayFolders = folderReorderMode ? localFolderOrder : subfolders;
  const displaySets = setReorderMode ? localSetOrder : questionSets;

  const enterFolderReorder = () => { setLocalFolderOrder([...subfolders]); setFolderReorderMode(true); };
  const moveFolder = (idx: number, dir: "up" | "down") => {
    const arr = [...localFolderOrder];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setLocalFolderOrder(arr);
  };
  const saveFolderOrder = async () => {
    await reorderFolders.mutateAsync({ data: { items: localFolderOrder.map((f, i) => ({ id: f.id, position: i + 1 })) } });
    queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
    setFolderReorderMode(false);
  };

  const enterSetReorder = () => { setLocalSetOrder([...questionSets]); setSetReorderMode(true); };
  const moveSet = (idx: number, dir: "up" | "down") => {
    const arr = [...localSetOrder];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setLocalSetOrder(arr);
  };
  const saveSetOrder = async () => {
    setSavingSetsOrder(true);
    try {
      await fetch(getApiUrl(`api/folders/${folderId}/sets/reorder`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: localSetOrder.map((s, i) => ({ id: s.id, position: i + 1 })) }),
      });
      queryClient.invalidateQueries({ queryKey: getListQuestionSetsQueryKey(folderId) });
      setSetReorderMode(false);
    } finally {
      setSavingSetsOrder(false);
    }
  };

  const hasContent = subfolders.length > 0 || questionSets.length > 0;
  const anyReorderMode = folderReorderMode || setReorderMode;

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 md:px-10 md:py-12 space-y-7">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm overflow-x-auto scrollbar-none">
        <Link href="/">
          <button className="flex items-center gap-1 text-white/35 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/5">
            <HomeIcon className="w-3.5 h-3.5" />
          </button>
        </Link>
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <span key={crumb.id} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0" />
              {isLast ? (
                <span className="font-semibold text-white/90 truncate max-w-[180px]">{crumb.name}</span>
              ) : (
                <Link href={`/folders/${crumb.id}`}>
                  <button className="text-white/35 hover:text-white/70 transition-colors truncate max-w-[120px] p-1 rounded-lg hover:bg-white/5">{crumb.name}</button>
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl flex-shrink-0 transition-all duration-500"
            style={{ background: `linear-gradient(135deg, ${folder.color}30, ${folder.color}15)`, border: `1.5px solid ${folder.color}40`, boxShadow: `0 8px 32px ${folder.color}25` }}>
            <FolderIconComp className="w-8 h-8" style={{ color: folder.color }} strokeWidth={1.7} />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white/95">{folder.name}</h1>
            <p className="text-white/35 text-sm mt-0.5">
              {folder.childCount} {folder.childCount === 1 ? "subfolder" : "subfolders"}
              {questionSets.length > 0 && (
                <span className="ml-2 text-white/25">· {questionSets.length} question {questionSets.length === 1 ? "set" : "sets"}</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {anyReorderMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setFolderReorderMode(false); setSetReorderMode(false); }} className="border-white/10 text-white/60 hover:text-white">
                Cancel
              </Button>
              {folderReorderMode && (
                <Button size="sm" onClick={saveFolderOrder} disabled={reorderFolders.isPending} className="bg-emerald-500 hover:bg-emerald-400 text-white gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Save Folder Order
                </Button>
              )}
              {setReorderMode && (
                <Button size="sm" onClick={saveSetOrder} disabled={savingSetsOrder} className="bg-emerald-500 hover:bg-emerald-400 text-white gap-1.5">
                  <Check className="w-3.5 h-3.5" /> Save Set Order
                </Button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setEditFolder(folder)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{ backgroundColor: `${folder.color}20`, border: `1px solid ${folder.color}35` }}>
                <Pencil className="w-4 h-4" style={{ color: folder.color }} />
              </button>
              <button onClick={() => setDeleteFolder(folder)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 hover:bg-red-500/15 border border-white/8">
                <Trash2 className="w-4 h-4 text-white/40" />
              </button>
              <Button variant="outline" size="sm" onClick={() => setDecodeOpen(true)} className="border-white/10 text-white/50 hover:text-white gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Decode
              </Button>
              <Button onClick={() => setCreateOpen(true)} className="gap-2 rounded-full font-semibold"
                style={{ background: `linear-gradient(135deg, ${folder.color}, ${folder.color}aa)` }}>
                <Plus className="w-4 h-4" /> Add Subfolder
              </Button>
            </>
          )}
        </div>
      </header>

      {anyReorderMode && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <GripVertical className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-300/80">Use the arrows on each card to set your preferred order</span>
        </motion.div>
      )}

      {/* Subfolders */}
      {listLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-36 rounded-2xl bg-white/4 animate-pulse border border-white/5" />)}
        </div>
      ) : displayFolders.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-white/25 uppercase tracking-widest">Subfolders</p>
            {!anyReorderMode && subfolders.length > 1 && (
              <button onClick={enterFolderReorder} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
                <GripVertical className="w-3.5 h-3.5" /> Reorder
              </button>
            )}
          </div>
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-2 gap-4">
              {displayFolders.map((subfolder, idx) => (
                <FolderCard key={subfolder.id} folder={subfolder} index={idx} onEdit={setEditFolder} onDelete={setDeleteFolder}
                  reorderMode={folderReorderMode} onMoveUp={() => moveFolder(idx, "up")} onMoveDown={() => moveFolder(idx, "down")}
                  isFirst={idx === 0} isLast={idx === displayFolders.length - 1} />
              ))}
            </div>
          </AnimatePresence>
        </div>
      ) : null}

      {/* Question Sets */}
      {setsLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-36 rounded-2xl bg-white/4 animate-pulse border border-white/5" />)}
        </div>
      ) : displaySets.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-white/25 uppercase tracking-widest">Question Sets</p>
            {!anyReorderMode && questionSets.length > 1 && (
              <button onClick={enterSetReorder} className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors">
                <GripVertical className="w-3.5 h-3.5" /> Reorder
              </button>
            )}
          </div>
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-2 gap-4">
              {displaySets.map((set, idx) => (
                <QuestionSetCard key={set.id} set={set} index={idx} folderColor={folder.color} folderId={folderId}
                  reorderMode={setReorderMode} onMoveUp={() => moveSet(idx, "up")} onMoveDown={() => moveSet(idx, "down")}
                  isFirst={idx === 0} isLast={idx === displaySets.length - 1}
                  onRenamed={(id, name) => setLocalSetOrder(prev => prev.map(s => s.id === id ? { ...s, name } : s))} />
              ))}
            </div>
          </AnimatePresence>
        </div>
      ) : null}

      {/* Empty state */}
      {!listLoading && !setsLoading && !hasContent && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center space-y-5 rounded-3xl border border-dashed border-white/8 bg-white/2">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: `${folder.color}15`, border: `1px solid ${folder.color}25` }}>
            <FolderIcon className="w-8 h-8" style={{ color: `${folder.color}70` }} strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white/70">This folder is empty</h3>
            <p className="text-white/30 max-w-xs mt-2 text-sm">Add subfolders or decode Chorcha questions into "{folder.name}".</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => setDecodeOpen(true)} className="rounded-full gap-2 border-white/10 text-white/50 hover:text-white">
              <BookOpen className="w-4 h-4" /> Decode Questions
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="rounded-full gap-2"
              style={{ background: `linear-gradient(135deg, ${folder.color}, ${folder.color}99)` }}>
              <Plus className="w-4 h-4" /> Create Subfolder
            </Button>
          </div>
        </motion.div>
      )}

      {/* Modals */}
      <FolderFormDialog open={createOpen} onOpenChange={setCreateOpen} parentId={folder.id} />
      {editFolder && <FolderFormDialog open={true} onOpenChange={(open) => !open && setEditFolder(null)} initialData={editFolder} />}
      {deleteFolder && (
        <DeleteFolderDialog open={true} onOpenChange={(open) => !open && setDeleteFolder(null)}
          folderId={deleteFolder.id} folderName={deleteFolder.name} isViewingSelf={deleteFolder.id === folder.id} />
      )}
      <DecodeDialog open={decodeOpen} onOpenChange={setDecodeOpen} folderId={folderId} folderColor={folder.color} />
    </div>
  );
}
