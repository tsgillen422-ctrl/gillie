import { Capacitor } from "@capacitor/core";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export type NativeAppleResult = {
  identityToken: string;
  email: string | null;
  fullName: string | null;
};

export class AppleSignInCancelled extends Error {
  constructor() {
    super("Apple sign-in cancelled");
    this.name = "AppleSignInCancelled";
  }
}

// Trigger Apple's native ASAuthorizationController popup and return the signed
// identity token plus the name/email Apple gives us (name + email are only
// populated on the very first authorization for this app). Dynamically imported
// so the plugin never ends up in the web bundle.
export async function signInWithAppleNative(): Promise<NativeAppleResult> {
  const { SignInWithApple } = await import(
    "@capacitor-community/apple-sign-in"
  );

  let result;
  try {
    // On iOS the native flow ignores clientId/redirectURI (those are only used
    // for the web/Android fallback), but the plugin's types require them.
    result = await SignInWithApple.authorize({
      clientId: "app.dalehollowlake",
      redirectURI: "https://dale-hollow-nav.replit.app/",
      scopes: "email name",
    });
  } catch (err) {
    // ASAuthorizationError.canceled (1001) is the user dismissing the sheet —
    // not a real failure, so surface it as a distinct, quiet error.
    const message = err instanceof Error ? err.message : String(err);
    if (/1001|cancel/i.test(message)) {
      throw new AppleSignInCancelled();
    }
    throw err;
  }

  const r = result.response;
  const identityToken = r?.identityToken ?? "";
  if (!identityToken) {
    throw new Error("Apple did not return an identity token");
  }

  const fullName =
    [r?.givenName, r?.familyName].filter(Boolean).join(" ").trim() || null;

  return {
    identityToken,
    email: r?.email ?? null,
    fullName,
  };
}
