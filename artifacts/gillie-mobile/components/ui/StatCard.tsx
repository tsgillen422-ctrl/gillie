import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

/**
 * A single stat (value + label) used in the profile stats row.
 */
export default function StatCard({
  value,
  label,
  onPress,
}: {
  value: number | string;
  label: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  const Container: any = onPress ? Pressable : View;
  return (
    <Container onPress={onPress} style={styles.wrap}>
      <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </Container>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", paddingVertical: 4 },
  value: { fontFamily: fonts.displayBold, fontSize: 20, fontVariant: ["tabular-nums"] },
  label: { fontFamily: fonts.sansMedium, fontSize: 12, marginTop: 2 },
});
