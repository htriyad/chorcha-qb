import {
  pgTable, serial, text, timestamp, integer, jsonb, pgEnum
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionTypeEnum = pgEnum("question_type", ["mcq", "cq", "sq"]);
export const aiStatusEnum = pgEnum("ai_status", ["none", "pending", "done", "failed"]);

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  icon: text("icon").notNull().default("📚"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const subFolders = pgTable("sub_folders", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull().references(() => folders.id, { onDelete: "cascade" }),
  parentSubFolderId: integer("parent_sub_folder_id").references((): AnyPgColumn => subFolders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const questionSets = pgTable("question_sets", {
  id: serial("id").primaryKey(),
  subFolderId: integer("sub_folder_id").notNull().references(() => subFolders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  detectedType: questionTypeEnum("detected_type"),
  forcedType: questionTypeEnum("forced_type"),
  aiStatus: aiStatusEnum("ai_status").notNull().default("none"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  questionSetId: integer("question_set_id").notNull().references(() => questionSets.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  type: questionTypeEnum("type").notNull(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertCardSchema = createInsertSchema(cards).omit({ id: true, createdAt: true });
export const insertFolderSchema = createInsertSchema(folders).omit({ id: true, createdAt: true });
export const insertSubFolderSchema = createInsertSchema(subFolders).omit({ id: true, createdAt: true });
export const insertQuestionSetSchema = createInsertSchema(questionSets).omit({ id: true, createdAt: true, aiStatus: true });
export const insertQuestionSchema = createInsertSchema(questions).omit({ id: true, createdAt: true, updatedAt: true });

export type Card = typeof cards.$inferSelect;
export type Folder = typeof folders.$inferSelect;
export type SubFolder = typeof subFolders.$inferSelect;
export type QuestionSet = typeof questionSets.$inferSelect;
export type Question = typeof questions.$inferSelect;

export type InsertCard = z.infer<typeof insertCardSchema>;
export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type InsertSubFolder = z.infer<typeof insertSubFolderSchema>;
export type InsertQuestionSet = z.infer<typeof insertQuestionSetSchema>;
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
