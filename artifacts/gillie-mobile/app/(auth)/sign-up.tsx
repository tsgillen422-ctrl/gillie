import { useAuth, useSignUp } from "@clerk/expo";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
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

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);

  const loading = fetchStatus === "fetching";

  const handleSubmit = async () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    const { error } = await signUp.password({
      emailAddress: emailAddress.trim(),
      password,
    });
    if (error) return;
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) return;
    setVerifying(true);
  };

  const handleVerify = async () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return;
    if (signUp.status !== "complete") return;
    try {
      await signUp.finalize({
        navigate: async ({ session }) => {
          if (session?.currentTask) return;
          router.replace("/");
        },
      });
    } catch (err) {
      console.error("Sign-up finalize failed", err);
    }
  };

  const handleResend = async () => {
    await signUp.verifications.sendEmailCode();
  };

  if (isSignedIn) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 48 }]}
      >
        <Brand size={56} color="#ffffff" />
        <Text style={styles.tagline}>Join the lake community.</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          {verifying ? (
            <>
              <Text style={[styles.heading, { color: colors.foreground }]}>
                Check your email
              </Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Enter the 6-digit code we sent to {emailAddress}.
              </Text>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card, letterSpacing: 6, textAlign: "center" },
                ]}
                value={code}
                placeholder="••••••"
                placeholderTextColor={colors.mutedForeground}
                onChangeText={setCode}
                keyboardType="number-pad"
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
                  !code && { opacity: 0.5 },
                ]}
                onPress={handleVerify}
                disabled={!code || loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                    Verify
                  </Text>
                )}
              </Pressable>
              <Pressable style={styles.resend} onPress={handleResend}>
                <Text style={{ color: colors.primary, fontFamily: fonts.sansSemibold }}>
                  Resend code
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={[styles.heading, { color: colors.foreground }]}>
                Create your account
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
              {errors?.fields?.emailAddress && (
                <Text style={[styles.error, { color: colors.destructive }]}>
                  {errors.fields.emailAddress.message}
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
                placeholder="At least 8 characters"
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
                    Continue
                  </Text>
                )}
              </Pressable>

              <View style={styles.footer}>
                <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans }}>
                  Already have an account?{" "}
                </Text>
                <Link href="/sign-in">
                  <Text style={{ color: colors.primary, fontFamily: fonts.sansSemibold }}>
                    Sign in
                  </Text>
                </Link>
              </View>
            </>
          )}

          {/* Required for sign-up flows. Clerk's bot sign-up protection is enabled by default */}
          <View nativeID="clerk-captcha" />
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
  resend: { alignItems: "center", marginTop: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
});
