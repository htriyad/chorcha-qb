import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const foldersTable = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  parentId: integer("parent_id"),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon").notNull().default("folder"),
  style: text("style").notNull().default("default"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Folder = typeof foldersTable.$inferSelect;
