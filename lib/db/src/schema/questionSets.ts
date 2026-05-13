import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { foldersTable } from "./folders";

export const questionSetsTable = pgTable("question_sets", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull().references(() => foldersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  examType: text("exam_type"),
  totalQuestions: integer("total_questions").notNull().default(0),
  sourceUrl: text("source_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  setId: integer("set_id").notNull().references(() => questionSetsTable.id, { onDelete: "cascade" }),
  chorchaId: text("chorcha_id").notNull(),
  questionIndex: integer("question_index").notNull(),
  type: text("type").notNull(),
  questionText: text("question_text").notNull().default(""),
  options: jsonb("options").$type<Array<{ letter: string; text: string }>>().notNull().default([]),
  parts: jsonb("parts").$type<Array<{ key: string; label: string; text: string; solution: string | null; aiSolution: string | null }>>().notNull().default([]),
  answer: text("answer"),
  solution: text("solution"),
  stemImages: text("stem_images").array().notNull().default([]),
  aiExplanation: text("ai_explanation"),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type QuestionSet = typeof questionSetsTable.$inferSelect;
export type Question = typeof questionsTable.$inferSelect;
