import { Router, type IRouter } from "express";
import { clerkClient } from "@clerk/express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Native "Sign in with Apple" for the iOS Capacitor app.
//
// The web OAuth flow (Clerk -> Apple authorization code -> token exchange)
// requires Clerk to sign a "client secret" JWT with the Apple .p8 private key.
// That production key is malformed, so the web Apple flow fails at token
// exchange. This endpoint bypasses it entirely: the native app uses Apple's
// own ASAuthorizationController to get an identity token (a JWT Apple signs
// with ITS keys), and we verify that here against Apple's PUBLIC JWKS — no .p8
// needed. We then find/create the matching Clerk user and mint a sign-in token
// (ticket), exactly like the reviewer flow. The webview consumes the ticket via
// signIn.create({ strategy: "ticket" }), which sets the same first-party Clerk
// session cookie a normal login would.

const APPLE_ISSUER = "https://appleid.apple.com";
// The audience of a NATIVE Apple identity token is the app's Bundle ID (the
// Apple "client_id" for the native app), not the web Services ID.
const APPLE_AUDIENCE = "app.dalehollowlake";
const APPLE_JWKS = createRemoteJWKSet(
  new URL("https://appleid.apple.com/auth/keys"),
);

// Light per-IP throttle (best-effort, resets on restart) so the endpoint can't
// be hammered. A valid Apple-signed token is still required to get a ticket.
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 20;
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

function splitName(fullName: string | undefined | null): {
  firstName?: string;
  lastName?: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function findClerkUserByEmail(email: string) {
  const res = await clerkClient.users.getUserList({ emailAddress: [email] });
  const list = Array.isArray(res) ? res : (res?.data ?? []);
  return list[0];
}

async function findClerkUserByExternalId(externalId: string) {
  try {
    const res = await clerkClient.users.getUserList({
      externalId: [externalId],
    });
    const list = Array.isArray(res) ? res : (res?.data ?? []);
    return list[0];
  } catch {
    return undefined;
  }
}

function errDetail(err: unknown): { name: string; message: string } {
  if (err instanceof Error) {
    return { name: err.name || "Error", message: err.message || String(err) };
  }
  return { name: "Unknown", message: String(err) };
}

router.post("/apple-native", async (req, res) => {
  const ip = req.ip ?? "unknown";
  if (rateLimited(ip)) {
    logger.warn({ ip }, "apple native: rate limited");
    res
      .status(429)
      .json({ error: "Too many attempts. Try again later.", stage: "rate_limit" });
    return;
  }

  const identityToken =
    typeof req.body?.identityToken === "string" ? req.body.identityToken : "";
  const bodyEmail =
    typeof req.body?.email === "string" ? req.body.email : "";
  const bodyFullName =
    typeof req.body?.fullName === "string" ? req.body.fullName : "";

  // Stage 0: what did the client actually send? Log presence/sizes only — never
  // the raw token or PII content.
  logger.info(
    {
      ip,
      hasIdentityToken: Boolean(identityToken),
      identityTokenLength: identityToken.length,
      hasBodyEmail: Boolean(bodyEmail),
      hasBodyFullName: Boolean(bodyFullName),
    },
    "apple native: request received",
  );

  if (!identityToken) {
    logger.warn({ ip }, "apple native: missing identityToken in body");
    res
      .status(400)
      .json({ error: "identityToken is required", stage: "missing_token" });
    return;
  }

  // Stage 1: verify the Apple-signed identity token (signature vs Apple JWKS +
  // issuer + audience + expiry). This is the most common failure point.
  let payload;
  try {
    ({ payload } = await jwtVerify(identityToken, APPLE_JWKS, {
      issuer: APPLE_ISSUER,
      audience: APPLE_AUDIENCE,
    }));
  } catch (err) {
    const detail = errDetail(err);
    logger.warn(
      { ip, expectedIssuer: APPLE_ISSUER, expectedAudience: APPLE_AUDIENCE, detail },
      "apple native: token verification FAILED",
    );
    res.status(401).json({
      error: "Apple token verification failed",
      stage: "verify_token",
      detail: `${detail.name}: ${detail.message}`,
      expectedAudience: APPLE_AUDIENCE,
    });
    return;
  }

  try {
    const sub = typeof payload.sub === "string" ? payload.sub : "";
    logger.info(
      {
        ip,
        sub: sub ? `${sub.slice(0, 6)}…` : "(none)",
        tokenAud: payload.aud,
        tokenIss: payload.iss,
        hasTokenEmail: typeof payload.email === "string",
        emailVerified: payload.email_verified,
      },
      "apple native: token verified",
    );
    if (!sub) {
      res
        .status(401)
        .json({ error: "Invalid Apple token (no subject)", stage: "no_subject" });
      return;
    }

    // Only the VERIFIED email claim from Apple's signed token may be used for
    // account matching or creation. The client-supplied body email is NEVER
    // trusted: a forged body email on a token whose own email claim is absent
    // would otherwise let an attacker mint a Clerk ticket for any existing
    // account (auth bypass / account takeover). Apple includes the email claim
    // (real address, or stable private-relay address for "Hide My Email") in
    // the identity token; on re-authorization it may be omitted, in which case
    // we resolve solely by the stable Apple subject.
    const tokenEmail =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";
    const externalId = `apple:${sub}`;

    // Resolve the Clerk user: prefer the stable Apple subject (set on accounts
    // we created or anchored), then the verified token email (matches users who
    // signed up via web Apple OAuth or any other method with the same address),
    // otherwise create a new one.
    let user = await findClerkUserByExternalId(externalId);
    let resolution = user ? "externalId" : "";
    if (!user && tokenEmail) {
      user = await findClerkUserByEmail(tokenEmail);
      if (user) resolution = "email";
      // Anchor the matched account to this Apple subject so future sign-ins
      // resolve by externalId even once Apple stops sending the email claim.
      if (user && !user.externalId) {
        try {
          await clerkClient.users.updateUser(user.id, { externalId });
        } catch (e) {
          logger.warn({ e }, "apple native: failed to set externalId on match");
        }
      }
    }

    if (!user) {
      if (!tokenEmail) {
        logger.warn(
          { ip },
          "apple native: no existing user and no verified email to create one",
        );
        res.status(400).json({
          error: "No verified email available from Apple",
          stage: "no_email_for_create",
        });
        return;
      }
      const { firstName, lastName } = splitName(bodyFullName);
      user = await clerkClient.users.createUser({
        emailAddress: [tokenEmail],
        externalId,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        skipPasswordRequirement: true,
      });
      resolution = "created";
    }
    logger.info(
      { ip, userId: user.id, resolution },
      "apple native: user resolved",
    );

    const token = await clerkClient.signInTokens.createSignInToken({
      userId: user.id,
      expiresInSeconds: 600,
    });
    logger.info({ ip, userId: user.id }, "apple native: sign-in token minted OK");

    res.json({ token: token.token });
  } catch (err) {
    // Reaches here only for failures AFTER token verification: Clerk user
    // lookup/create or sign-in-token minting. Surface the specific Clerk error.
    const detail = errDetail(err);
    logger.error({ err, detail }, "apple native: post-verify step FAILED");
    res.status(401).json({
      error: "Apple sign-in failed",
      stage: "clerk_user_or_token",
      detail: `${detail.name}: ${detail.message}`,
    });
  }
});

export default router;
