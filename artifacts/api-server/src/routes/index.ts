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
import lakesRouter from "./lakes";
import catchesRouter from "./catches";
import boatsRouter, { fleetRouter } from "./boats";
import searchRouter from "./search";
import galleryRouter from "./gallery";
import reportsRouter from "./reports";
import pushRouter from "./push";
import gifsRouter from "./gifs";
import storiesRouter from "./stories";
import highlightsRouter from "./highlights";
import adminRouter from "./admin";
import reviewerRouter from "./reviewer";
import appleNativeRouter from "./appleNative";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Health check stays public (used by deployment probes). The reviewer login
// endpoint is also public (it verifies the reviewer password itself and mints a
// Clerk sign-in ticket). Everything below requires an authenticated session.
router.use(healthRouter);
router.use("/reviewer", reviewerRouter);
// Native iOS "Sign in with Apple" — public: it verifies an Apple-signed
// identity token itself and mints a Clerk sign-in ticket.
router.use("/auth", appleNativeRouter);
router.use(requireAuth);
router.use(storageRouter);
// Must be registered before /users so /users/me/boats never falls through to
// the /users/:userId matcher.
router.use("/users/me/boats", fleetRouter);
router.use("/users", usersRouter);
router.use("/friends", friendsRouter);
router.use("/messages", messagesRouter);
router.use("/pins", pinsRouter);
router.use("/dock-labels", dockLabelsRouter);
router.use("/hidden-places", hiddenPlacesRouter);
router.use("/posts", postsRouter);
router.use("/notifications", notificationsRouter);
router.use("/conditions", conditionsRouter);
router.use("/lakes", lakesRouter);
router.use("/catches", catchesRouter);
router.use("/boats", boatsRouter);
router.use("/search", searchRouter);
router.use("/gallery", galleryRouter);
router.use("/reports", reportsRouter);
router.use("/push", pushRouter);
router.use("/gifs", gifsRouter);
router.use("/stories", storiesRouter);
router.use("/highlights", highlightsRouter);
router.use("/admin", adminRouter);

export default router;
