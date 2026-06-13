import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { logger } from "../lib/logger";
import { REVIEWER_EMAIL } from "../middlewares/auth";

const router: IRouter = Router();

// Public endpoint that lets the App Store reviewer sign in without an email
// verification code.
//
// Production Clerk enforces a "new device" email challenge on password sign-ins
// (after the password is accepted it requires an email code to "verify a new
// device"). On a Replit-managed Clerk instance that challenge cannot be turned
// off, and it mails the code to the reviewer's unreachable mailbox — locking
// them out. To get the reviewer in we verify their password server-side (so this
// is NOT an open backdoor) and mint a Clerk sign-in token (ticket). The ticket
// strategy completes the sign-in directly, skipping the new-device email step.

// Light in-memory throttle so the reviewer password can't be brute-forced
// through this endpoint. Per-IP, best-effort (resets on restart).
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

router.post("/login", async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (rateLimited(ip)) {
    res.status(429).json({ error: "Too many attempts. Try again later." });
    return;
  }

  const password =
    typeof req.body?.password === "string" ? req.body.password : "";
  if (!password) {
    res.status(400).json({ error: "Password is required" });
    return;
  }

  try {
    const result = await clerkClient.users.getUserList({
      emailAddress: [REVIEWER_EMAIL],
    });
    const list = Array.isArray(result) ? result : (result?.data ?? []);
    const user = list[0];
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Throws when the password is wrong — handled by the catch below.
    await clerkClient.users.verifyPassword({ userId: user.id, password });

    const token = await clerkClient.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: 600,
    });

    res.json({ token: token.token });
  } catch (err) {
    logger.warn({ err }, "reviewer login failed");
    res.status(401).json({ error: "Invalid credentials" });
  }
});

export default router;
