import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { Brand } from "@/components/Brand";

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Shared top header mirroring the web app chrome: "Gillie" wordmark on the left,
 * round action icons on the right. Use `floating` to overlay it on the map.
 */
export function AppHeader({ floating = false }: { floating?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const IconBtn = ({
    name,
    onPress,
  }: {
    name: IoniconName;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconBtn,
        { backgroundColor: pressed ? colors.muted : "transparent" },
      ]}
    >
      <Ionicons name={name} size={21} color={colors.mutedForeground} />
    </Pressable>
  );

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: insets.top,
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
        },
        floating && styles.floating,
      ]}
    >
      <View style={styles.row}>
        <Brand size={26} showIcon={false} />
        <View style={styles.icons}>
          <IconBtn name="fish-outline" onPress={() => router.push("/catches")} />
          <IconBtn
            name="notifications-outline"
            onPress={() => router.push("/notifications")}
          />
          <IconBtn
            name="settings-outline"
            onPress={() => router.push("/settings")}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: StyleSheet.hairlineWidth },
  floating: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  row: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  icons: { flexDirection: "row", alignItems: "center", gap: 2 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AppHeader;
