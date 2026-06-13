import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { Brand } from "@/components/Brand";

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * Slim top header mirroring the web app chrome (artifacts/dhl-app AppLayout):
 * a thin card-colored bar with the "Gillie" script wordmark on the left and
 * round action icons (Pins, Alerts, Settings) on the right. Active route is
 * tinted in the primary color. Pass `floating` to overlay it (used on the map).
 */
export function AppHeader({ floating = false }: { floating?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const items: {
    icon: IoniconName;
    activeIcon: IoniconName;
    route: string;
    match: string;
  }[] = [
    { icon: "location-outline", activeIcon: "location", route: "/", match: "/" },
    {
      icon: "notifications-outline",
      activeIcon: "notifications",
      route: "/notifications",
      match: "/notifications",
    },
    {
      icon: "settings-outline",
      activeIcon: "settings",
      route: "/settings",
      match: "/settings",
    },
  ];

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
          {items.map((it) => {
            const active = pathname === it.match;
            return (
              <Pressable
                key={it.route}
                onPress={() => router.push(it.route as never)}
                hitSlop={6}
                style={[
                  styles.iconBtn,
                  active && { backgroundColor: colors.primary + "1A" },
                ]}
              >
                <Ionicons
                  name={active ? it.activeIcon : it.icon}
                  size={20}
                  color={active ? colors.primary : colors.mutedForeground}
                />
              </Pressable>
            );
          })}
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
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  icons: { flexDirection: "row", alignItems: "center", gap: 2 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AppHeader;
