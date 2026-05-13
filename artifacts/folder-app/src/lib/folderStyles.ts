export type FolderStyle = "default" | "square" | "big" | "flat" | "wide";

export interface StyleOption {
  id: FolderStyle;
  label: string;
  description: string;
  preview: string;
  gridClass: string;
  heightClass: string;
  radiusClass: string;
}

export const FOLDER_STYLES: StyleOption[] = [
  {
    id: "default",
    label: "Default",
    description: "Standard card",
    preview: "⬜",
    gridClass: "",
    heightClass: "h-36",
    radiusClass: "rounded-2xl",
  },
  {
    id: "square",
    label: "Square",
    description: "Perfect square",
    preview: "⬛",
    gridClass: "",
    heightClass: "aspect-square",
    radiusClass: "rounded-3xl",
  },
  {
    id: "big",
    label: "Big",
    description: "Tall & prominent",
    preview: "▬",
    gridClass: "",
    heightClass: "h-52",
    radiusClass: "rounded-2xl",
  },
  {
    id: "flat",
    label: "Flat",
    description: "Compact & minimal",
    preview: "▭",
    gridClass: "",
    heightClass: "h-20",
    radiusClass: "rounded-xl",
  },
  {
    id: "wide",
    label: "Wide",
    description: "Full width banner",
    preview: "▬",
    gridClass: "col-span-2",
    heightClass: "h-32",
    radiusClass: "rounded-2xl",
  },
];

export function getStyle(id: string): StyleOption {
  return FOLDER_STYLES.find((s) => s.id === id) ?? FOLDER_STYLES[0];
}
