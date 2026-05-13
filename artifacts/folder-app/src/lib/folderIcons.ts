import {
  Folder, FolderOpen, Briefcase, Star, Heart, BookOpen, Camera, Music,
  Code2, Coffee, Home, Globe, Zap, Shield, Flag, Trophy, Target, Rocket,
  Lightbulb, Gem, Crown, Cloud, Sun, Moon, Leaf, Mountain, Plane, Car,
  Wrench, Settings, Database, Server, Terminal, Archive, Lock, Key,
  Mail, Phone, User, Users, MapPin, Calendar, Clock, Tag, Bookmark,
  Film, Gamepad2, Headphones, Image, Package, Palette, PenLine,
  ShoppingCart, Wallet, Flame, Sparkles, Bell, Gift, type LucideIcon,
} from "lucide-react";

export interface IconOption {
  name: string;
  label: string;
  icon: LucideIcon;
  category: string;
}

export const FOLDER_ICONS: IconOption[] = [
  { name: "folder", label: "Folder", icon: Folder, category: "Files" },
  { name: "folder-open", label: "Open Folder", icon: FolderOpen, category: "Files" },
  { name: "archive", label: "Archive", icon: Archive, category: "Files" },
  { name: "package", label: "Package", icon: Package, category: "Files" },
  { name: "bookmark", label: "Bookmark", icon: Bookmark, category: "Files" },
  { name: "tag", label: "Tag", icon: Tag, category: "Files" },

  { name: "briefcase", label: "Briefcase", icon: Briefcase, category: "Work" },
  { name: "target", label: "Target", icon: Target, category: "Work" },
  { name: "trophy", label: "Trophy", icon: Trophy, category: "Work" },
  { name: "flag", label: "Flag", icon: Flag, category: "Work" },
  { name: "calendar", label: "Calendar", icon: Calendar, category: "Work" },
  { name: "clock", label: "Clock", icon: Clock, category: "Work" },
  { name: "mail", label: "Mail", icon: Mail, category: "Work" },
  { name: "phone", label: "Phone", icon: Phone, category: "Work" },
  { name: "user", label: "User", icon: User, category: "Work" },
  { name: "users", label: "Team", icon: Users, category: "Work" },

  { name: "code", label: "Code", icon: Code2, category: "Tech" },
  { name: "terminal", label: "Terminal", icon: Terminal, category: "Tech" },
  { name: "database", label: "Database", icon: Database, category: "Tech" },
  { name: "server", label: "Server", icon: Server, category: "Tech" },
  { name: "globe", label: "Web", icon: Globe, category: "Tech" },
  { name: "settings", label: "Settings", icon: Settings, category: "Tech" },
  { name: "wrench", label: "Tools", icon: Wrench, category: "Tech" },
  { name: "lock", label: "Lock", icon: Lock, category: "Tech" },
  { name: "key", label: "Key", icon: Key, category: "Tech" },
  { name: "shield", label: "Shield", icon: Shield, category: "Tech" },

  { name: "palette", label: "Design", icon: Palette, category: "Creative" },
  { name: "pen", label: "Writing", icon: PenLine, category: "Creative" },
  { name: "camera", label: "Camera", icon: Camera, category: "Creative" },
  { name: "film", label: "Film", icon: Film, category: "Creative" },
  { name: "music", label: "Music", icon: Music, category: "Creative" },
  { name: "headphones", label: "Headphones", icon: Headphones, category: "Creative" },
  { name: "image", label: "Image", icon: Image, category: "Creative" },
  { name: "book", label: "Book", icon: BookOpen, category: "Creative" },

  { name: "heart", label: "Heart", icon: Heart, category: "Life" },
  { name: "star", label: "Star", icon: Star, category: "Life" },
  { name: "home", label: "Home", icon: Home, category: "Life" },
  { name: "coffee", label: "Coffee", icon: Coffee, category: "Life" },
  { name: "gift", label: "Gift", icon: Gift, category: "Life" },
  { name: "shopping", label: "Shopping", icon: ShoppingCart, category: "Life" },
  { name: "wallet", label: "Wallet", icon: Wallet, category: "Life" },
  { name: "map-pin", label: "Location", icon: MapPin, category: "Life" },
  { name: "plane", label: "Travel", icon: Plane, category: "Life" },
  { name: "car", label: "Car", icon: Car, category: "Life" },
  { name: "gamepad", label: "Gaming", icon: Gamepad2, category: "Life" },

  { name: "zap", label: "Lightning", icon: Zap, category: "Icons" },
  { name: "rocket", label: "Rocket", icon: Rocket, category: "Icons" },
  { name: "gem", label: "Gem", icon: Gem, category: "Icons" },
  { name: "crown", label: "Crown", icon: Crown, category: "Icons" },
  { name: "sparkles", label: "Sparkles", icon: Sparkles, category: "Icons" },
  { name: "fire", label: "Fire", icon: Flame, category: "Icons" },
  { name: "lightbulb", label: "Idea", icon: Lightbulb, category: "Icons" },
  { name: "bell", label: "Bell", icon: Bell, category: "Icons" },
  { name: "cloud", label: "Cloud", icon: Cloud, category: "Icons" },
  { name: "sun", label: "Sun", icon: Sun, category: "Icons" },
  { name: "moon", label: "Moon", icon: Moon, category: "Icons" },
  { name: "leaf", label: "Nature", icon: Leaf, category: "Icons" },
  { name: "mountain", label: "Mountain", icon: Mountain, category: "Icons" },
];

export const ICON_MAP = new Map<string, LucideIcon>(
  FOLDER_ICONS.map((i) => [i.name, i.icon])
);

export function getIcon(name: string): LucideIcon {
  return ICON_MAP.get(name) ?? Folder;
}

export const ICON_CATEGORIES = Array.from(
  new Set(FOLDER_ICONS.map((i) => i.category))
);
