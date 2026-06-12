import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

/**
 * Section title with an optional leading icon and trailing text action.
 */
export default function SectionHeader({
  title,
  icon,
  actionLabel,
  onAction,
}: {
  title: string;
  icon?: IoniconName;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        {icon && <Ionicons name={icon} size={18} color={colors.primary} />}
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.action, { color: colors.primary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.displayBold, fontSize: 18 },
  action: { fontFamily: fonts.sansSemibold, fontSize: 14 },
});
