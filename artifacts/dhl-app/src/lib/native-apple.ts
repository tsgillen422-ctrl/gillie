import { Capacitor, registerPlugin } from "@capacitor/core";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export type NativeAppleResult = {
  identityToken: string;
  email: string | null;
  fullName: string | null;
  authorizationCode: string | null;
};

export class AppleSignInCancelled extends Error {
  constructor() {
    super("Apple sign-in cancelled");
    this.name = "AppleSignInCancelled";
  }
}

interface AppleNativeSignInPlugin {
  authorize(): Promise<{
    identityToken: string;
    email: string | null;
    fullName: string | null;
    authorizationCode?: string | null;
  }>;
}

// Custom native plugin implemented in Swift (ios/App/App/AppDelegate.swift,
// class AppleNativeSignInPlugin) on top of ASAuthorizationAppleIDProvider. We do
// NOT use @capacitor-community/apple-sign-in because its iOS package pins
// capacitor-swift-pm >=7 <8, which conflicts with @capacitor/push-notifications@8
// (needs capacitor-swift-pm >=8) and breaks the SwiftPM build. registerPlugin
// returns a web proxy that we never invoke — the button is native-only.
const AppleNativeSignIn =
  registerPlugin<AppleNativeSignInPlugin>("AppleNativeSignIn");

// Trigger Apple's native ASAuthorizationController popup and return the signed
// identity token plus the name/email Apple gives us (name + email are only
// populated on the very first authorization for this app).
export async function signInWithAppleNative(): Promise<NativeAppleResult> {
  let result;
  try {
    console.log("[apple-native] calling native AppleNativeSignIn.authorize()…");
    result = await AppleNativeSignIn.authorize();
    console.log("[apple-native] native authorize() returned", {
      hasIdentityToken: Boolean(result?.identityToken),
      identityTokenLength: result?.identityToken?.length ?? 0,
      hasAuthorizationCode: Boolean(result?.authorizationCode),
      hasEmail: Boolean(result?.email),
      hasFullName: Boolean(result?.fullName),
    });
  } catch (err) {
    // ASAuthorizationError.canceled (1001) is the user dismissing the sheet —
    // not a real failure, so surface it as a distinct, quiet error.
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[apple-native] native authorize() threw:", message);
    if (/1001|cancel/i.test(message)) {
      throw new AppleSignInCancelled();
    }
    throw new Error(`Apple authorization failed: ${message}`);
  }

  const identityToken = result?.identityToken ?? "";
  if (!identityToken) {
    throw new Error(
      "Apple returned no identity token (native plugin gave an empty token)",
    );
  }

  return {
    identityToken,
    email: result?.email ?? null,
    fullName: result?.fullName ?? null,
    authorizationCode: result?.authorizationCode ?? null,
  };
}
