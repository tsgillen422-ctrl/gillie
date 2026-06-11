import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import friendsRouter from "./friends";
import messagesRouter from "./messages";
import pinsRouter from "./pins";
import dockLabelsRouter from "./dockLabels";
import hiddenPlacesRouter from "./hiddenPlaces";
import postsRouter from "./posts";
import notificationsRouter from "./notifications";
import storageRouter from "./storage";
import conditionsRouter from "./conditions";
import catchesRouter from "./catches";
import searchRouter from "./search";
import galleryRouter from "./gallery";
import reportsRouter from "./reports";
import pushRouter from "./push";
import gifsRouter from "./gifs";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Health check stays public (used by deployment probes). Everything below
// requires an authenticated Clerk session.
router.use(healthRouter);
router.use(requireAuth);
router.use(storageRouter);
router.use("/users", usersRouter);
router.use("/friends", friendsRouter);
router.use("/messages", messagesRouter);
router.use("/pins", pinsRouter);
router.use("/dock-labels", dockLabelsRouter);
router.use("/hidden-places", hiddenPlacesRouter);
router.use("/posts", postsRouter);
router.use("/notifications", notificationsRouter);
router.use("/conditions", conditionsRouter);
router.use("/catches", catchesRouter);
router.use("/search", searchRouter);
router.use("/gallery", galleryRouter);
router.use("/reports", reportsRouter);
router.use("/push", pushRouter);
router.use("/gifs", gifsRouter);

export default router;
