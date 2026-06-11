import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { currentUserId } from "../middlewares/auth";
import { seedDemoData, clearDemoData, countDemoUsers } from "../lib/demoData";
import { logger } from "../lib/logger";

const router = Router();

async function isAdmin(userId: number): Promise<boolean> {
  const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, userId) });
  return Boolean(user?.isAdmin);
}

router.get("/demo-data", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  const demoUserCount = await countDemoUsers();
  return res.json({ demoUserCount });
});

router.post("/demo-data", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  try {
    const result = await seedDemoData();
    return res.json(result);
  } catch (err) {
    logger.error({ err }, "seedDemoData failed");
    return res.status(500).json({ error: "Failed to generate demo data" });
  }
});

router.delete("/demo-data", async (req, res) => {
  const uid = currentUserId(req);
  if (!(await isAdmin(uid))) return res.status(403).json({ error: "Admin access required" });
  try {
    const result = await clearDemoData();
    return res.json(result);
  } catch (err) {
    logger.error({ err }, "clearDemoData failed");
    return res.status(500).json({ error: "Failed to remove demo data" });
  }
});

export default router;
