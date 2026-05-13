import { Folder } from "@workspace/api-client-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Pencil, Trash2, ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { getIcon } from "@/lib/folderIcons";
import { getStyle } from "@/lib/folderStyles";
import { cn } from "@/lib/utils";

interface FolderCardProps {
  folder: Folder;
  index: number;
  onEdit: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  reorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

export function FolderCard({
  folder,
  index,
  onEdit,
  onDelete,
  reorderMode = false,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: FolderCardProps) {
  const IconComponent = getIcon(folder.icon);
  const style = getStyle(folder.style ?? "default");
  const isFlat = folder.style === "flat";
  const isWide = folder.style === "wide";

  const cardContent = (
    <div
      className={cn(
        "relative group w-full cursor-pointer overflow-hidden border transition-all duration-300",
        style.heightClass,
        style.radiusClass,
        "shadow-lg hover:shadow-xl hover:shadow-black/20",
        isFlat ? "flex items-center gap-4 px-5" : "flex flex-col justify-between p-5",
        reorderMode && "cursor-default pointer-events-none select-none"
      )}
      style={{
        backgroundColor: `${folder.color}12`,
        borderColor: `${folder.color}35`,
      }}
    >
      <div
        className={cn(
          "absolute rounded-full blur-3xl pointer-events-none transition-opacity duration-500",
          isFlat
            ? "-top-8 -right-8 w-24 h-24 opacity-20 group-hover:opacity-35"
            : "-top-16 -right-16 w-48 h-48 opacity-15 group-hover:opacity-30"
        )}
        style={{ backgroundColor: folder.color }}
      />

      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {isFlat ? (
        <>
          <div className="relative z-10 flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${folder.color}25` }}>
              <IconComponent className="w-5 h-5" style={{ color: folder.color }} strokeWidth={1.8} />
            </div>
            <span className="font-semibold text-base truncate text-white/90 group-hover:text-white transition-colors">
              {folder.name}
            </span>
            {folder.childCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: `${folder.color}20`, color: folder.color, border: `1px solid ${folder.color}40` }}>
                {folder.childCount}
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0 relative z-10 group-hover:text-white/60 transition-colors" />
        </>
      ) : (
        <>
          <div className="relative z-10 flex items-start justify-between">
            <div className={cn("rounded-2xl flex items-center justify-center", isWide ? "w-14 h-14" : "w-12 h-12")}
              style={{ backgroundColor: `${folder.color}25` }}>
              <IconComponent className={cn(isWide ? "w-7 h-7" : "w-6 h-6")} style={{ color: folder.color }} strokeWidth={1.8} />
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {folder.childCount > 0 && (
                <span className="text-xs font-semibold px-2 py-1 rounded-full backdrop-blur-sm"
                  style={{ backgroundColor: `${folder.color}20`, color: folder.color, border: `1px solid ${folder.color}40` }}>
                  {folder.childCount}
                </span>
              )}
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(folder); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 active:scale-95"
                style={{ backgroundColor: `${folder.color}20`, border: `1px solid ${folder.color}30` }}
                data-testid={`button-edit-${folder.id}`}
              >
                <Pencil className="w-3.5 h-3.5" style={{ color: folder.color }} />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(folder); }}
                className="w-7 h-7 rounded-lg flex items-center justify-center backdrop-blur-sm transition-all hover:scale-110 active:scale-95 hover:bg-red-500/20"
                style={{ backgroundColor: `rgba(255,255,255,0.05)`, border: `1px solid rgba(255,255,255,0.08)` }}
                data-testid={`button-delete-${folder.id}`}
              >
                <Trash2 className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-auto">
            <h3 className={cn("font-bold tracking-tight text-white/90 group-hover:text-white transition-colors truncate", isWide ? "text-xl" : "text-lg")}>
              {folder.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-white/35 capitalize">{folder.style ?? "default"}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.96 }}
      transition={{ duration: 0.35, delay: reorderMode ? 0 : index * 0.06, ease: [0.23, 1, 0.32, 1] }}
      whileHover={reorderMode ? {} : { y: -3, transition: { duration: 0.2 } }}
      whileTap={reorderMode ? {} : { scale: 0.97 }}
      className={cn("relative", style.gridClass)}
      data-testid={`card-folder-${folder.id}`}
    >
      {reorderMode ? (
        <div className="relative">
          {cardContent}
          <div className="absolute inset-0 flex items-center justify-between px-4 bg-black/30 backdrop-blur-[1px] rounded-2xl">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-lg"
              style={{ backgroundColor: folder.color, color: "#fff" }}>
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
        <Link href={`/folders/${folder.id}`}>{cardContent}</Link>
      )}
    </motion.div>
  );
}
