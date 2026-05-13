import {
  pgTable, serial, text, integer, boolean, jsonb, timestamp, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { decodeJobsTable } from "./decode_jobs";

export const decodedQuestionsTable = pgTable(
  "decoded_questions",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id").notNull().references(() => decodeJobsTable.id, { onDelete: "cascade" }),
    chorchaId: text("chorcha_id").notNull(),
    questionIndex: integer("question_index").notNull(),
    type: text("type").notNull(),
    questionText: text("question_text").notNull().default(""),
    options: jsonb("options").notNull().default([]),
    parts: jsonb("parts").notNull().default([]),
    answer: text("answer"),
    solution: text("solution"),
    aiExplanation: text("ai_explanation"),
    stemImages: text("stem_images").array().notNull().default([]),
    parentId: text("parent_id"),
    subIndex: integer("sub_index"),
    extraFields: jsonb("extra_fields").notNull().default({}),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    jobChorchaUniq: uniqueIndex("dq_job_chorcha_uniq").on(t.jobId, t.chorchaId),
    jobIdx: index("dq_job_idx").on(t.jobId),
    chorchaIdIdx: index("dq_chorcha_id_idx").on(t.chorchaId),
  }),
);

export const insertDecodedQuestionSchema = createInsertSchema(decodedQuestionsTable).omit({ id: true, createdAt: true });
export type InsertDecodedQuestion = z.infer<typeof insertDecodedQuestionSchema>;
export type DecodedQuestionRow = typeof decodedQuestionsTable.$inferSelect;
