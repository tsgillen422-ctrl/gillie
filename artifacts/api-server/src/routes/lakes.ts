import { Router } from "express";
import { LAKES } from "@workspace/lake-config";

const router = Router();

// The static lake catalog. IDs are stable and referenced by users/posts/pins.
router.get("/", (_req, res) => {
  res.json(LAKES);
});

export default router;
