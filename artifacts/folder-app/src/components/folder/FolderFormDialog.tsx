import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  useCreateFolder,
  useUpdateFolder,
  getListFoldersQueryKey,
  getGetFolderQueryKey,
  getGetFolderStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { FOLDER_ICONS, ICON_CATEGORIES } from "@/lib/folderIcons";
import { FOLDER_STYLES, type FolderStyle } from "@/lib/folderStyles";

const FOLDER_COLORS = [
  { hex: "#6366f1", name: "Indigo" },
  { hex: "#8b5cf6", name: "Purple" },
  { hex: "#ec4899", name: "Pink" },
  { hex: "#f43f5e", name: "Rose" },
  { hex: "#ef4444", name: "Red" },
  { hex: "#f97316", name: "Orange" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#eab308", name: "Yellow" },
  { hex: "#22c55e", name: "Green" },
  { hex: "#10b981", name: "Emerald" },
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#3b82f6", name: "Blue" },
  { hex: "#64748b", name: "Slate" },
];

const folderSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  color: z.string(),
  icon: z.string(),
  style: z.string(),
});

type FolderFormValues = z.infer<typeof folderSchema>;

interface FolderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: number | null;
  initialData?: {
    id: number;
    name: string;
    color: string;
    icon: string;
    style: string;
  } | null;
}

export function FolderFormDialog({
  open,
  onOpenChange,
  parentId = null,
  initialData,
}: FolderFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!initialData;
  const [activeIconCategory, setActiveIconCategory] = useState(ICON_CATEGORIES[0]);

  const form = useForm<FolderFormValues>({
    resolver: zodResolver(folderSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      color: initialData?.color ?? FOLDER_COLORS[0].hex,
      icon: initialData?.icon ?? "folder",
      style: initialData?.style ?? "default",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: initialData?.name ?? "",
        color: initialData?.color ?? FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)].hex,
        icon: initialData?.icon ?? "folder",
        style: initialData?.style ?? "default",
      });
    }
  }, [open, initialData]);

  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();

  const onSubmit = async (data: FolderFormValues) => {
    try {
      if (isEdit) {
        await updateFolder.mutateAsync({
          id: initialData.id,
          data: { name: data.name, color: data.color, icon: data.icon, style: data.style },
        });
        queryClient.invalidateQueries({ queryKey: getGetFolderQueryKey(initialData.id) });
      } else {
        await createFolder.mutateAsync({
          data: { name: data.name, color: data.color, icon: data.icon, style: data.style, parentId },
        });
      }
      queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetFolderStatsQueryKey() });
      onOpenChange(false);
    } catch {
      // silent — user sees no change
    }
  };

  const selectedColor = form.watch("color");
  const selectedIcon = form.watch("icon");

  const filteredIcons = FOLDER_ICONS.filter((i) => i.category === activeIconCategory);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
              style={{ backgroundColor: `${selectedColor}25`, border: `1.5px solid ${selectedColor}40` }}
            >
              {(() => {
                const IconComp = FOLDER_ICONS.find((i) => i.name === selectedIcon)?.icon;
                return IconComp ? <IconComp className="w-6 h-6" style={{ color: selectedColor }} strokeWidth={1.8} /> : null;
              })()}
            </div>
            <div>
              <DialogTitle>{isEdit ? "Edit Folder" : "New Folder"}</DialogTitle>
              <DialogDescription>
                {isEdit ? "Update your folder details." : "Create a new space to organize your world."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Work Projects" {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2.5">
                      {FOLDER_COLORS.map(({ hex, name }) => (
                        <button
                          key={hex}
                          type="button"
                          title={name}
                          className={cn(
                            "w-7 h-7 rounded-full transition-all hover:scale-110 active:scale-95",
                            field.value === hex
                              ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110"
                              : "opacity-70 hover:opacity-100"
                          )}
                          style={{ backgroundColor: hex }}
                          onClick={() => field.onChange(hex)}
                        />
                      ))}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {ICON_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setActiveIconCategory(cat)}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                              activeIconCategory === cat
                                ? "text-white"
                                : "bg-white/5 text-white/50 hover:bg-white/10"
                            )}
                            style={
                              activeIconCategory === cat
                                ? { backgroundColor: selectedColor, opacity: 1 }
                                : {}
                            }
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-8 gap-1.5 h-28 overflow-y-auto p-2 border border-white/8 rounded-xl bg-white/3">
                        {filteredIcons.map(({ name, label, icon: IconComp }) => (
                          <button
                            key={name}
                            type="button"
                            title={label}
                            className={cn(
                              "w-full aspect-square flex items-center justify-center rounded-lg transition-all hover:scale-110 active:scale-95",
                              field.value === name
                                ? "ring-2 scale-110"
                                : "hover:bg-white/8"
                            )}
                            style={
                              field.value === name
                                ? {
                                    backgroundColor: `${selectedColor}25`,
                                    outline: `2px solid ${selectedColor}`,
                                    outlineOffset: "1px",
                                  }
                                : {}
                            }
                            onClick={() => field.onChange(name)}
                          >
                            <IconComp
                              className="w-4.5 h-4.5"
                              style={{ color: field.value === name ? selectedColor : "rgba(255,255,255,0.5)" }}
                              strokeWidth={1.8}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="style"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Card Style</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-5 gap-2">
                      {FOLDER_STYLES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => field.onChange(s.id)}
                          className={cn(
                            "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all text-center",
                            field.value === s.id
                              ? "border-transparent"
                              : "border-white/8 bg-white/3 hover:bg-white/6"
                          )}
                          style={
                            field.value === s.id
                              ? {
                                  backgroundColor: `${selectedColor}20`,
                                  border: `1.5px solid ${selectedColor}60`,
                                }
                              : {}
                          }
                        >
                          <StylePreview
                            styleId={s.id as FolderStyle}
                            active={field.value === s.id}
                            color={selectedColor}
                          />
                          <span
                            className="text-[10px] font-medium leading-none"
                            style={{ color: field.value === s.id ? selectedColor : "rgba(255,255,255,0.4)" }}
                          >
                            {s.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createFolder.isPending || updateFolder.isPending}
                style={{ backgroundColor: selectedColor }}
                className="text-white hover:opacity-90"
              >
                {isEdit ? "Save Changes" : "Create Folder"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function StylePreview({ styleId, active, color }: { styleId: FolderStyle; active: boolean; color: string }) {
  const c = active ? color : "rgba(255,255,255,0.15)";
  const dims: Record<FolderStyle, { w: number; h: number }> = {
    default: { w: 32, h: 22 },
    square: { w: 26, h: 26 },
    big: { w: 32, h: 34 },
    flat: { w: 32, h: 14 },
    wide: { w: 40, h: 20 },
  };
  const { w, h } = dims[styleId];
  return (
    <div
      className="rounded-md transition-all"
      style={{ width: w, height: h, backgroundColor: c, opacity: active ? 0.9 : 0.4 }}
    />
  );
}
