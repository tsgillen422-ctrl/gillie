import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand } from "@/components/Brand";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

/**
 * Top-of-screen header. When `gradient` is set it renders a lake gradient
 * banner with white text (used for hero screens like Feed/Profile);
 * otherwise it's a clean card-colored bar. Pass `showBrand` to render the
 * "Gillie" script wordmark instead of a title.
 */
export default function ScreenHeader({
  title,
  subtitle,
  showBrand = false,
  gradient = false,
  right,
}: {
  title?: string;
  subtitle?: string;
  showBrand?: boolean;
  gradient?: boolean;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const fg = gradient ? "#ffffff" : colors.foreground;
  const subFg = gradient ? "rgba(255,255,255,0.85)" : colors.mutedForeground;

  const content = (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        {showBrand ? (
          <Brand size={30} color={gradient ? "#ffffff" : colors.primary} />
        ) : (
          <Text style={[styles.title, { color: fg }]}>{title}</Text>
        )}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: subFg }]}>{subtitle}</Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 8, paddingBottom: 16 }}
      >
        {content}
      </LinearGradient>
    );
  }

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingBottom: 12,
        backgroundColor: colors.card,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 26 },
  subtitle: { fontFamily: fonts.sans, fontSize: 13, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
});
