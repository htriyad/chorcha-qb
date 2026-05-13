import { useState, useEffect, useRef } from "react";
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
import { Search, Plus, FolderIcon, GripVertical, Check, Layers, BookOpen } from "lucide-react";
import { AnimatePresence, motion, useSpring, useTransform, useInView } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

const titleVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const letterVariants = {
  hidden: { opacity: 0, y: 32, rotate: -8, scale: 0.65 },
  visible: {
    opacity: 1, y: 0, rotate: 0, scale: 1,
    transition: { type: "spring" as const, stiffness: 280, damping: 20 },
  },
};

function AnimatedTitle({ text }: { text: string }) {
  return (
    <motion.h1
      variants={titleVariants}
      initial="hidden"
      animate="visible"
      className="text-4xl md:text-5xl font-extrabold tracking-tight flex flex-wrap"
      style={{
        background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.5) 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }}
    >
      {text.split("").map((char, i) => (
        <motion.span key={i} variants={letterVariants} style={{ display: "inline-block", whiteSpace: "pre" }}>
          {char}
        </motion.span>
      ))}
    </motion.h1>
  );
}

function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 55, damping: 16, restDelta: 0.5 });
  const display = useTransform(spring, (v) => Math.round(v).toString());
  useEffect(() => { if (isInView) spring.set(value); }, [isInView, value, spring]);
  return <motion.span ref={ref}>{display}</motion.span>;
}

function StatBadge({ children, color, pulseColor }: { children: React.ReactNode; color: string; pulseColor: string }) {
  return (
    <div className="relative">
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ background: pulseColor }}
        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        whileHover={{ scale: 1.06 }}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
        style={{ background: color, border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

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

  const enterReorderMode = () => { setLocalOrder([...folders]); setReorderMode(true); };
  const moveFolder = (idx: number, dir: "up" | "down") => {
    const arr = [...localOrder];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setLocalOrder(arr);
  };
  const saveOrder = async () => {
    await reorderFolders.mutateAsync({
      data: { items: localOrder.map((f, i) => ({ id: f.id, position: i + 1 })) },
    });
    queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
    setReorderMode(false);
  };

  return (
    <div className="relative min-h-screen">

      {/* ── Ambient background lighting ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute top-[-18%] left-[20%] w-[650px] h-[520px] rounded-full blur-[130px]"
          style={{ background: "radial-gradient(ellipse, #8b5cf6 0%, #6366f1 45%, transparent 70%)", opacity: 0.065 }}
          animate={{ scale: [1, 1.14, 1], x: [0, 28, 0], y: [0, -22, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[45%] right-[-8%] w-[420px] h-[420px] rounded-full blur-[110px]"
          style={{ background: "radial-gradient(ellipse, #3b82f6 0%, transparent 70%)", opacity: 0.045 }}
          animate={{ scale: [1, 1.22, 1], x: [0, -22, 0], y: [0, 32, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2.5 }}
        />
        <motion.div
          className="absolute bottom-[8%] left-[-6%] w-[360px] h-[360px] rounded-full blur-[100px]"
          style={{ background: "radial-gradient(ellipse, #a78bfa 0%, transparent 70%)", opacity: 0.038 }}
          animate={{ scale: [1, 1.12, 1], y: [0, -28, 0] }}
          transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        />
      </div>

      {/* ── Dot grid ── */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      {/* ── Page content ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-5 py-8 md:px-10 md:py-12 space-y-8">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="space-y-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <AnimatedTitle text="My Folders" />

              {stats && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22, duration: 0.4 }}
                  className="flex items-center gap-2.5"
                >
                  <StatBadge
                    color="rgba(99,102,241,0.13)"
                    pulseColor="rgba(99,102,241,0.2)"
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-indigo-300">
                      <AnimatedNumber value={stats.totalFolders} /> folders
                    </span>
                  </StatBadge>

                  <StatBadge
                    color="rgba(139,92,246,0.13)"
                    pulseColor="rgba(139,92,246,0.2)"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-violet-300">
                      depth <AnimatedNumber value={stats.maxDepth} />
                    </span>
                  </StatBadge>
                </motion.div>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.14, duration: 0.45 }}
              className="flex items-center gap-2 flex-shrink-0"
            >
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
                    <Check className="w-3.5 h-3.5" /> Save Order
                  </Button>
                </>
              ) : (
                <>
                  {folders.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={enterReorderMode}
                      className="border-white/10 text-white/40 hover:text-white gap-1.5"
                    >
                      <GripVertical className="w-3.5 h-3.5" /> Reorder
                    </Button>
                  )}
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }}>
                    <Button
                      onClick={() => setCreateOpen(true)}
                      className="gap-2 rounded-full font-semibold shadow-lg shadow-indigo-500/20"
                      style={{
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        boxShadow: "0 0 0 1px rgba(139,92,246,0.4), 0 8px 24px rgba(99,102,241,0.25)",
                      }}
                    >
                      <Plus className="w-4 h-4" /> New Folder
                    </Button>
                  </motion.div>
                </>
              )}
            </motion.div>
          </div>

          {!reorderMode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.26, duration: 0.4 }}
              className="relative"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
              <Input
                placeholder="Search folders…"
                className="pl-11 h-11 rounded-2xl text-white placeholder:text-white/22 focus-visible:ring-1 focus-visible:ring-indigo-500/40"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  backdropFilter: "blur(12px)",
                }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search"
              />
            </motion.div>
          )}

          {reorderMode && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-2xl"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}
            >
              <GripVertical className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <span className="text-sm text-amber-300/75">Use the arrows on each card to set your preferred order</span>
            </motion.div>
          )}
        </motion.header>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="h-36 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.05)" }}
                animate={{ opacity: [0.4, 0.65, 0.4] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.18 }}
              />
            ))}
          </div>
        ) : displayFolders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-24 text-center space-y-5"
          >
            <motion.div
              animate={{ y: [0, -9, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.08))",
                border: "1px solid rgba(99,102,241,0.2)",
                boxShadow: "0 8px 32px rgba(99,102,241,0.12)",
              }}
            >
              <FolderIcon className="w-10 h-10 text-indigo-400/55" strokeWidth={1.5} />
            </motion.div>
            <div>
              <h3 className="text-xl font-bold text-white/75">No folders yet</h3>
              <p className="text-white/32 max-w-xs mt-2 text-sm leading-relaxed">
                {search
                  ? "Try a different search term."
                  : "Create your first folder to start organizing your space."}
              </p>
            </div>
            {!search && (
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="rounded-full gap-2"
                  style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
                >
                  <Plus className="w-4 h-4" /> Create First Folder
                </Button>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              className="grid grid-cols-2 gap-4"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
            >
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
            </motion.div>
          </AnimatePresence>
        )}
      </div>

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
