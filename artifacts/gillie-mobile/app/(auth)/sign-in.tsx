import { useSignIn, useSSO } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand } from "@/components/Brand";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

type MfaStrategy = "totp" | "phone_code" | "backup_code";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [secondFactor, setSecondFactor] = React.useState(false);
  const [mfaStrategy, setMfaStrategy] = React.useState<MfaStrategy>("totp");
  const [mfaHint, setMfaHint] = React.useState("");
  const [mfaCode, setMfaCode] = React.useState("");

  const loading = fetchStatus === "fetching";

  const finalizeSignIn = useCallback(async () => {
    await signIn.finalize({ navigate: async () => router.replace("/") });
  }, [signIn, router]);

  const beginSecondFactor = useCallback(async () => {
    const factors = signIn.supportedSecondFactors ?? [];
    const totp = factors.find((f) => f.strategy === "totp");
    const phone = factors.find((f) => f.strategy === "phone_code");
    const backup = factors.find((f) => f.strategy === "backup_code");

    if (totp) {
      setMfaStrategy("totp");
      setMfaHint("Enter the 6-digit code from your authenticator app.");
    } else if (phone) {
      const { error } = await signIn.mfa.sendPhoneCode();
      if (error) {
        Alert.alert("Couldn't send code", error.message ?? "Please try again.");
        return;
      }
      setMfaStrategy("phone_code");
      setMfaHint(
        phone.safeIdentifier
          ? `Enter the code we texted to ${phone.safeIdentifier}.`
          : "Enter the code we texted to your phone.",
      );
    } else if (backup) {
      setMfaStrategy("backup_code");
      setMfaHint("Enter one of your backup codes.");
    } else {
      const found = factors.map((f) => f.strategy).join(", ") || "none";
      console.log("[sign-in] unsupported second factors:", JSON.stringify(factors));
      Alert.alert(
        "Two-step method",
        `Your account's two-step method isn't handled yet.\n\nReported factors: ${found}\n\nPlease tell the developer this exact list.`,
      );
      return;
    }
    setMfaCode("");
    setSecondFactor(true);
  }, [signIn]);

  const handleSubmit = async () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    try {
      const { error } = await signIn.password({
        emailAddress: emailAddress.trim(),
        password,
      });
      if (error) {
        Alert.alert(
          "Sign in failed",
          error.message ?? "Please check your email and password and try again.",
        );
        return;
      }
      if (signIn.status === "needs_second_factor") {
        await beginSecondFactor();
        return;
      }
      if (signIn.status !== "complete") {
        Alert.alert(
          "One more step",
          `Your account needs an extra step to sign in (status: ${signIn.status}).`,
        );
        return;
      }
      await finalizeSignIn();
    } catch (err) {
      Alert.alert(
        "Sign in error",
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  const handleVerifyMfa = async () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    try {
      const code = mfaCode.trim();
      let result: { error: { message?: string } | null };
      if (mfaStrategy === "totp") {
        result = await signIn.mfa.verifyTOTP({ code });
      } else if (mfaStrategy === "phone_code") {
        result = await signIn.mfa.verifyPhoneCode({ code });
      } else {
        result = await signIn.mfa.verifyBackupCode({ code });
      }
      if (result.error) {
        Alert.alert(
          "Verification failed",
          result.error.message ?? "That code didn't work. Please try again.",
        );
        return;
      }
      if (signIn.status !== "complete") {
        Alert.alert(
          "One more step",
          `Almost there (status: ${signIn.status}).`,
        );
        return;
      }
      await finalizeSignIn();
    } catch (err) {
      Alert.alert(
        "Sign in error",
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  const useBackupCode = () => {
    setMfaStrategy("backup_code");
    setMfaHint("Enter one of your backup codes.");
    setMfaCode("");
  };

  const handleGoogle = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err) {
      Alert.alert(
        "Google sign in error",
        err instanceof Error ? err.message : String(err),
      );
    }
  }, [router, startSSOFlow]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 48 }]}
      >
        <Brand size={56} color="#ffffff" />
        <Text style={styles.tagline}>Find your crew on the water.</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          {secondFactor ? (
            <>
              <Text style={[styles.heading, { color: colors.foreground }]}>
                Two-step verification
              </Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                {mfaHint}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    color: colors.foreground,
                    backgroundColor: colors.card,
                    letterSpacing: mfaStrategy === "backup_code" ? 1 : 6,
                    textAlign: "center",
                  },
                ]}
                value={mfaCode}
                placeholder={mfaStrategy === "backup_code" ? "backup code" : "••••••"}
                placeholderTextColor={colors.mutedForeground}
                onChangeText={setMfaCode}
                keyboardType={mfaStrategy === "backup_code" ? "default" : "number-pad"}
                autoCapitalize="none"
                autoFocus
              />
              {errors?.fields?.code && (
                <Text style={[styles.error, { color: colors.destructive }]}>
                  {errors.fields.code.message}
                </Text>
              )}
              {errors?.global?.[0] && (
                <Text style={[styles.error, { color: colors.destructive }]}>
                  {errors.global[0].message}
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 },
                  !mfaCode && { opacity: 0.5 },
                ]}
                onPress={handleVerifyMfa}
                disabled={!mfaCode || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                    Verify
                  </Text>
                )}
              </Pressable>

              {mfaStrategy !== "backup_code" && (
                <Pressable style={styles.altAction} onPress={useBackupCode}>
                  <Text style={{ color: colors.primary, fontFamily: fonts.sansSemibold }}>
                    Use a backup code instead
                  </Text>
                </Pressable>
              )}
              <Pressable
                style={styles.altAction}
                onPress={() => {
                  setSecondFactor(false);
                  setMfaCode("");
                }}
              >
                <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sansMedium }}>
                  Back
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.heading, { color: colors.foreground }]}>
                Welcome back
              </Text>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Email
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
                ]}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={colors.mutedForeground}
                value={emailAddress}
                onChangeText={setEmailAddress}
              />
              {errors?.fields?.identifier && (
                <Text style={[styles.error, { color: colors.destructive }]}>
                  {errors.fields.identifier.message}
                </Text>
              )}

              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Password
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
                ]}
                secureTextEntry
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
              />
              {errors?.fields?.password && (
                <Text style={[styles.error, { color: colors.destructive }]}>
                  {errors.fields.password.message}
                </Text>
              )}
              {errors?.global?.[0] && (
                <Text style={[styles.error, { color: colors.destructive }]}>
                  {errors.global[0].message}
                </Text>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 },
                  (!emailAddress || !password) && { opacity: 0.5 },
                ]}
                onPress={handleSubmit}
                disabled={!emailAddress || !password || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                    Sign in
                  </Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
                  or
                </Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.googleButton,
                  { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
                ]}
                onPress={handleGoogle}
              >
                <Ionicons name="logo-google" size={20} color={colors.foreground} />
                <Text style={[styles.googleText, { color: colors.foreground }]}>
                  Continue with Google
                </Text>
              </Pressable>

              <View style={styles.footer}>
                <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans }}>
                  New here?{" "}
                </Text>
                <Link href="/sign-up">
                  <Text style={{ color: colors.primary, fontFamily: fonts.sansSemibold }}>
                    Create an account
                  </Text>
                </Link>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  tagline: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 15,
    marginTop: 8,
    fontFamily: fonts.sansMedium,
  },
  form: { padding: 24, gap: 6, paddingBottom: 48 },
  heading: { fontSize: 26, fontFamily: fonts.display, marginBottom: 12 },
  label: { fontSize: 13, fontFamily: fonts.sansMedium, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: fonts.sans,
  },
  error: { fontSize: 12, fontFamily: fonts.sans, marginTop: 2 },
  button: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  buttonText: { fontSize: 16, fontFamily: fonts.sansBold },
  altAction: { alignItems: "center", marginTop: 16 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: fonts.sans },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleText: { fontSize: 15, fontFamily: fonts.sansSemibold },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
});
