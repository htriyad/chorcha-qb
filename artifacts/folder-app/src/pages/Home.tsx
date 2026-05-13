import { useState } from "react";
import {
  useListFolders,
  useGetFolderStats,
  useReorderFolders,
  getListFoldersQueryKey,
  Folder,
} from "@workspace/api-client-react";
import { FolderCard } from "@/components/folder/FolderCard";
import { FolderFormDialog } from "@/components/folder/FolderFormDialog";
import { DeleteFolderDialog } from "@/components/folder/DeleteFolderDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, FolderIcon, GripVertical, Check, Layers } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

export function Home() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<Folder | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [localOrder, setLocalOrder] = useState<Folder[]>([]);

  const { data: folders = [], isLoading } = useListFolders({ search: search || undefined });
  const { data: stats } = useGetFolderStats();
  const reorderFolders = useReorderFolders();
  const queryClient = useQueryClient();

  const displayFolders = reorderMode ? localOrder : folders;

  const enterReorderMode = () => {
    setLocalOrder([...folders]);
    setReorderMode(true);
  };

  const moveFolder = (idx: number, dir: "up" | "down") => {
    const arr = [...localOrder];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setLocalOrder(arr);
  };

  const saveOrder = async () => {
    await reorderFolders.mutateAsync({
      data: {
        items: localOrder.map((f, i) => ({ id: f.id, position: i + 1 })),
      },
    });
    queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
    setReorderMode(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-5 py-8 md:px-10 md:py-12 space-y-8">
      {/* Header */}
      <header className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-extrabold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.55) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              My Folders
            </motion.h1>
            {stats && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 mt-2"
              >
                <span className="text-sm text-white/40 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  {stats.totalFolders} folders
                </span>
                <span className="w-1 h-1 rounded-full bg-white/20" />
                <span className="text-sm text-white/40">depth {stats.maxDepth}</span>
              </motion.div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {reorderMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReorderMode(false)}
                  className="border-white/10 text-white/60 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveOrder}
                  disabled={reorderFolders.isPending}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Order
                </Button>
              </>
            ) : (
              <>
                {folders.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={enterReorderMode}
                    className="border-white/10 text-white/50 hover:text-white gap-1.5"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                    Reorder
                  </Button>
                )}
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="gap-2 rounded-full shadow-lg font-semibold"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  <Plus className="w-4 h-4" />
                  New Folder
                </Button>
              </>
            )}
          </div>
        </div>

        {!reorderMode && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              placeholder="Search folders..."
              className="pl-11 h-11 bg-white/4 border-white/8 rounded-2xl focus-visible:ring-1 focus-visible:ring-indigo-500/50 text-white placeholder:text-white/25"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
        )}

        {reorderMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20"
          >
            <GripVertical className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-amber-300/80">Use the arrows on each card to set your preferred order</span>
          </motion.div>
        )}
      </header>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-white/4 animate-pulse border border-white/5" />
          ))}
        </div>
      ) : displayFolders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-24 text-center space-y-5"
        >
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))", border: "1px solid rgba(99,102,241,0.2)" }}
          >
            <FolderIcon className="w-10 h-10 text-indigo-400/60" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white/80">No folders yet</h3>
            <p className="text-white/35 max-w-xs mt-2 text-sm leading-relaxed">
              {search ? "Try a different search term." : "Create your first folder to start organizing your space beautifully."}
            </p>
          </div>
          {!search && (
            <Button onClick={() => setCreateOpen(true)} className="rounded-full gap-2" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Plus className="w-4 h-4" />
              Create First Folder
            </Button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-2 gap-4">
            {displayFolders.map((folder, idx) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                index={idx}
                onEdit={setEditFolder}
                onDelete={setDeleteFolder}
                reorderMode={reorderMode}
                onMoveUp={() => moveFolder(idx, "up")}
                onMoveDown={() => moveFolder(idx, "down")}
                isFirst={idx === 0}
                isLast={idx === displayFolders.length - 1}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      <FolderFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      {editFolder && (
        <FolderFormDialog
          open={true}
          onOpenChange={(open) => !open && setEditFolder(null)}
          initialData={editFolder}
        />
      )}

      {deleteFolder && (
        <DeleteFolderDialog
          open={true}
          onOpenChange={(open) => !open && setDeleteFolder(null)}
          folderId={deleteFolder.id}
          folderName={deleteFolder.name}
        />
      )}
    </div>
  );
}
