import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const decodeJobsTable = pgTable("decode_jobs", {
  id: serial("id").primaryKey(),
  sourceKind: text("source_kind").notNull(),
  sourceInput: text("source_input").notNull(),
  examId: text("exam_id"),
  examName: text("exam_name"),
  bankSlug: text("bank_slug"),
  host: text("host"),
  rawTotal: integer("raw_total").notNull().default(0),
  visibleTotal: integer("visible_total").notNull().default(0),
  examType: text("exam_type"),
  decodedAt: timestamp("decoded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDecodeJobSchema = createInsertSchema(decodeJobsTable).omit({ id: true, decodedAt: true });
export type InsertDecodeJob = z.infer<typeof insertDecodeJobSchema>;
export type DecodeJob = typeof decodeJobsTable.$inferSelect;
