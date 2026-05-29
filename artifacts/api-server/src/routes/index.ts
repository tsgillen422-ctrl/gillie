import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import friendsRouter from "./friends";
import messagesRouter from "./messages";
import pinsRouter from "./pins";
import postsRouter from "./posts";
import notificationsRouter from "./notifications";
import storageRouter from "./storage";
import conditionsRouter from "./conditions";
import catchesRouter from "./catches";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use("/users", usersRouter);
router.use("/friends", friendsRouter);
router.use("/messages", messagesRouter);
router.use("/pins", pinsRouter);
router.use("/posts", postsRouter);
router.use("/notifications", notificationsRouter);
router.use("/conditions", conditionsRouter);
router.use("/catches", catchesRouter);
router.use("/search", searchRouter);

export default router;
