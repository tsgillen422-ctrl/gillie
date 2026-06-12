import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

/**
 * Pill chip used for interests, filters, specs and tags. Defaults to a
 * primary-tinted look; pass `tone="muted"` for a neutral chip.
 */
export default function Chip({
  label,
  icon,
  tone = "primary",
  active = false,
  onPress,
}: {
  label: string;
  icon?: IoniconName;
  tone?: "primary" | "muted" | "accent";
  active?: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();

  const palettes = {
    primary: { bg: colors.primary + "1A", fg: colors.primary },
    accent: { bg: colors.accent + "26", fg: colors.accentForeground },
    muted: { bg: colors.muted, fg: colors.mutedForeground },
  } as const;

  const p = active
    ? { bg: colors.primary, fg: colors.primaryForeground }
    : palettes[tone];

  const Container: any = onPress ? Pressable : View;

  return (
    <Container
      onPress={onPress}
      style={[styles.chip, { backgroundColor: p.bg }]}
    >
      {icon && <Ionicons name={icon} size={13} color={p.fg} />}
      <Text style={[styles.label, { color: p.fg }]}>{label}</Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  label: { fontFamily: fonts.sansSemibold, fontSize: 13 },
});
