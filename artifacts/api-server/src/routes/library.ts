import { Router } from "express";
import { db } from "@workspace/db";
import { cards, folders, subFolders, questionSets, questions } from "@workspace/db/schema";
import { eq, asc, isNull, and, count } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

const canEdit = [requireAuth];

function badId(id: number, res: ReturnType<Router["put"]> extends void ? never : Parameters<Parameters<Router["put"]>[1]>[1]): boolean {
  if (isNaN(id) || id <= 0) {
    (res as import("express").Response).status(400).json({ error: "Invalid ID" });
    return true;
  }
  return false;
}

// ── Cards ────────────────────────────────────────────────
router.get("/library/cards", requireAuth, async (_req, res) => {
  const rows = await db.select().from(cards).orderBy(asc(cards.createdAt));
  res.json(rows);
});

router.post("/library/cards", ...canEdit, async (req, res) => {
  const { name, color, icon } = req.body as { name: string; color: string; icon: string };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [row] = await db.insert(cards).values({ name, color, icon }).returning();
  res.status(201).json(row);
});

router.put("/library/cards/:cardId", ...canEdit, async (req, res) => {
  const id = Number(req.params.cardId);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, color, icon } = req.body as { name: string; color: string; icon: string };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [row] = await db.update(cards).set({ name, color, icon }).where(eq(cards.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Card not found" }); return; }
  res.json(row);
});

router.delete("/library/cards/:cardId", ...canEdit, async (req, res) => {
  await db.delete(cards).where(eq(cards.id, Number(req.params.cardId)));
  res.status(204).end();
});

// ── Folders ──────────────────────────────────────────────
router.get("/library/cards/:cardId/folders", requireAuth, async (req, res) => {
  const rows = await db.select().from(folders)
    .where(eq(folders.cardId, Number(req.params.cardId)))
    .orderBy(asc(folders.createdAt));
  res.json(rows);
});

router.post("/library/cards/:cardId/folders", ...canEdit, async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [row] = await db.insert(folders).values({ cardId: Number(req.params.cardId), name }).returning();
  res.status(201).json(row);
});

router.put("/library/folders/:folderId", ...canEdit, async (req, res) => {
  const id = Number(req.params.folderId);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name } = req.body as { name: string };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [row] = await db.update(folders).set({ name }).where(eq(folders.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Folder not found" }); return; }
  res.json(row);
});

router.delete("/library/folders/:folderId", ...canEdit, async (req, res) => {
  await db.delete(folders).where(eq(folders.id, Number(req.params.folderId)));
  res.status(204).end();
});

// ── SubFolders ───────────────────────────────────────────
router.get("/library/folders/:folderId/subfolders", requireAuth, async (req, res) => {
  const rows = await db.select().from(subFolders)
    .where(and(
      eq(subFolders.folderId, Number(req.params.folderId)),
      isNull(subFolders.parentSubFolderId)
    ))
    .orderBy(asc(subFolders.createdAt));
  res.json(rows);
});

router.post("/library/folders/:folderId/subfolders", ...canEdit, async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [row] = await db.insert(subFolders).values({ folderId: Number(req.params.folderId), name }).returning();
  res.status(201).json(row);
});

router.get("/library/subfolders/:subFolderId", requireAuth, async (req, res) => {
  const [row] = await db.select().from(subFolders)
    .where(eq(subFolders.id, Number(req.params.subFolderId)))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/library/subfolders/:subFolderId", ...canEdit, async (req, res) => {
  const id = Number(req.params.subFolderId);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name } = req.body as { name: string };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [row] = await db.update(subFolders).set({ name }).where(eq(subFolders.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Subfolder not found" }); return; }
  res.json(row);
});

router.delete("/library/subfolders/:subFolderId", ...canEdit, async (req, res) => {
  await db.delete(subFolders).where(eq(subFolders.id, Number(req.params.subFolderId)));
  res.status(204).end();
});

router.get("/library/subfolders/:subFolderId/subfolders", requireAuth, async (req, res) => {
  const rows = await db.select().from(subFolders)
    .where(eq(subFolders.parentSubFolderId, Number(req.params.subFolderId)))
    .orderBy(asc(subFolders.createdAt));
  res.json(rows);
});

router.post("/library/subfolders/:subFolderId/subfolders", ...canEdit, async (req, res) => {
  const parentId = Number(req.params.subFolderId);
  const [parent] = await db.select().from(subFolders).where(eq(subFolders.id, parentId)).limit(1);
  if (!parent) { res.status(404).json({ error: "Parent subfolder not found" }); return; }
  const { name } = req.body as { name: string };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [row] = await db.insert(subFolders).values({
    folderId: parent.folderId,
    parentSubFolderId: parentId,
    name,
  }).returning();
  res.status(201).json(row);
});

// ── QuestionSets ─────────────────────────────────────────
router.get("/library/subfolders/:subFolderId/questionsets", requireAuth, async (req, res) => {
  const rows = await db.select().from(questionSets)
    .where(eq(questionSets.subFolderId, Number(req.params.subFolderId)))
    .orderBy(asc(questionSets.createdAt));
  res.json(rows);
});

router.post("/library/subfolders/:subFolderId/questionsets", ...canEdit, async (req, res) => {
  const { name, detectedType, forcedType, questions: qList } = req.body as {
    name: string;
    detectedType?: string | null;
    forcedType?: string | null;
    questions: Array<{ type: string; data: Record<string, unknown> }>;
  };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }

  const [qs] = await db.insert(questionSets).values({
    subFolderId: Number(req.params.subFolderId),
    name,
    detectedType: (detectedType as "mcq" | "cq" | "sq" | null) ?? null,
    forcedType: (forcedType as "mcq" | "cq" | "sq" | null) ?? null,
  }).returning();

  if (qList?.length) {
    await db.insert(questions).values(
      qList.map((q, i) => ({
        questionSetId: qs.id,
        position: i,
        type: (q.type as "mcq" | "cq" | "sq"),
        data: q.data,
      }))
    );
  }

  res.status(201).json(qs);
});

router.get("/library/questionsets/:questionSetId", requireAuth, async (req, res) => {
  const id = Number(req.params.questionSetId);
  const [qs] = await db.select().from(questionSets).where(eq(questionSets.id, id)).limit(1);
  if (!qs) { res.status(404).json({ error: "Not found" }); return; }
  const qs_questions = await db.select().from(questions)
    .where(eq(questions.questionSetId, id))
    .orderBy(asc(questions.position));
  res.json({ ...qs, questions: qs_questions });
});

router.put("/library/questionsets/:questionSetId", ...canEdit, async (req, res) => {
  const id = Number(req.params.questionSetId);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { name, forcedType } = req.body as { name?: string; forcedType?: string | null };
  const updates: Partial<typeof questionSets.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (forcedType !== undefined) updates.forcedType = (forcedType as "mcq" | "cq" | "sq" | null);
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [row] = await db.update(questionSets).set(updates).where(eq(questionSets.id, id)).returning();
  if (!row) { res.status(404).json({ error: "QuestionSet not found" }); return; }
  res.json(row);
});

router.delete("/library/questionsets/:questionSetId", ...canEdit, async (req, res) => {
  await db.delete(questionSets).where(eq(questionSets.id, Number(req.params.questionSetId)));
  res.status(204).end();
});

router.patch("/library/questionsets/:questionSetId/reorder", ...canEdit, async (req, res) => {
  const qsId = Number(req.params.questionSetId);
  const { order } = req.body as { order: number[] };
  if (!Array.isArray(order)) {
    res.status(400).json({ error: "order must be an array of question IDs" });
    return;
  }
  for (let i = 0; i < order.length; i++) {
    await db.update(questions)
      .set({ position: i })
      .where(and(eq(questions.id, order[i]), eq(questions.questionSetId, qsId)));
  }
  res.json({ ok: true });
});

// ── Full tree ────────────────────────────────────────────
router.get("/library/tree", requireAuth, async (_req, res) => {
  const [allCards, allFolders, allSfs, qsCounts] = await Promise.all([
    db.select().from(cards).orderBy(asc(cards.createdAt)),
    db.select().from(folders).orderBy(asc(folders.createdAt)),
    db.select().from(subFolders).orderBy(asc(subFolders.createdAt)),
    db.select({ subFolderId: questionSets.subFolderId, cnt: count(questionSets.id) })
      .from(questionSets).groupBy(questionSets.subFolderId),
  ]);

  const qsCountMap = new Map(qsCounts.map((r) => [r.subFolderId, Number(r.cnt)]));

  type SfNode = (typeof allSfs)[0] & { qsetCount: number; children: SfNode[] };
  const sfMap = new Map<number, SfNode>(
    allSfs.map((sf) => [sf.id, { ...sf, qsetCount: qsCountMap.get(sf.id) ?? 0, children: [] as SfNode[] }]),
  );

  for (const sf of sfMap.values()) {
    if (sf.parentSubFolderId) sfMap.get(sf.parentSubFolderId)?.children.push(sf);
  }

  type FolderNode = (typeof allFolders)[0] & { subfolders: SfNode[] };
  const folderMap = new Map<number, FolderNode>(
    allFolders.map((f) => [f.id, { ...f, subfolders: [] as SfNode[] }]),
  );
  for (const sf of allSfs.filter((s) => !s.parentSubFolderId)) {
    const folderNode = folderMap.get(sf.folderId);
    if (folderNode) {
      const sfNode = sfMap.get(sf.id);
      if (sfNode) folderNode.subfolders.push(sfNode);
    }
  }

  const tree = allCards.map((card) => ({
    ...card,
    folders: allFolders
      .filter((f) => f.cardId === card.id)
      .map((f) => folderMap.get(f.id)!)
      .filter(Boolean),
  }));

  res.json(tree);
});

// ── Questions ────────────────────────────────────────────
router.put("/library/questions/:questionId", ...canEdit, async (req, res) => {
  const id = Number(req.params.questionId);
  if (isNaN(id) || id <= 0) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { data, type } = req.body as { data: Record<string, unknown>; type?: "mcq" | "cq" | "sq" };
  if (!data) { res.status(400).json({ error: "data is required" }); return; }
  const updates: Partial<typeof questions.$inferInsert> = { data, updatedAt: new Date() };
  if (type) updates.type = type;
  const [row] = await db.update(questions).set(updates).where(eq(questions.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Question not found" }); return; }
  res.json(row);
});

router.delete("/library/questions/:questionId", ...canEdit, async (req, res) => {
  await db.delete(questions).where(eq(questions.id, Number(req.params.questionId)));
  res.status(204).end();
});

router.post("/library/questionsets/:questionSetId/questions", ...canEdit, async (req, res) => {
  const qsId = Number(req.params.questionSetId);
  const { type, data } = req.body as {
    type: "mcq" | "cq" | "sq";
    data: Record<string, unknown>;
    position?: number;
  };

  const allQs = await db.select({ pos: questions.position }).from(questions).where(eq(questions.questionSetId, qsId));
  const maxPos = allQs.length > 0 ? Math.max(...allQs.map((q) => q.pos)) : -1;

  const [row] = await db.insert(questions).values({
    questionSetId: qsId,
    type,
    data,
    position: maxPos + 1,
  }).returning();
  res.status(201).json(row);
});

export default router;
