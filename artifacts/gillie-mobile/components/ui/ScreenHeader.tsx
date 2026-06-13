import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand } from "@/components/Brand";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

/**
 * Clean, card-colored top bar mirroring the web app chrome
 * (artifacts/dhl-app). No gradient banners. Renders an optional back chevron,
 * a page title (or the "Gillie" wordmark when `showBrand` is set), an optional
 * subtitle, and right-aligned actions.
 */
export default function ScreenHeader({
  title,
  subtitle,
  showBrand = false,
  back = false,
  onBack,
  right,
}: {
  title?: string;
  subtitle?: string;
  showBrand?: boolean;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.card,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
    >
      <View style={styles.row}>
        {back ? (
          <Pressable
            onPress={onBack ?? (() => router.back())}
            hitSlop={8}
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </Pressable>
        ) : null}

        <View style={{ flex: 1 }}>
          {showBrand ? (
            <Brand size={26} color={colors.primary} />
          ) : (
            <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
              {title}
            </Text>
          )}
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 22 },
  subtitle: { fontFamily: fonts.sans, fontSize: 12, marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
});
