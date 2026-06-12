import { Ionicons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

type IoniconName = keyof typeof Ionicons.glyphMap;

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
};

type Item = {
  name: string;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
};

const LEFT: Item[] = [
  { name: "index", label: "Map", icon: "map-outline", activeIcon: "map" },
  { name: "feed", label: "Feed", icon: "people-outline", activeIcon: "people" },
];
const RIGHT: Item[] = [
  {
    name: "messages",
    label: "Messages",
    icon: "chatbubble-outline",
    activeIcon: "chatbubble",
  },
  {
    name: "profile",
    label: "Profile",
    icon: "person-outline",
    activeIcon: "person",
  },
];

function TabBar({ state, navigation }: TabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const activeName = state.routes[state.index]?.name;

  const renderItem = (item: Item) => {
    const focused = activeName === item.name;
    const color = focused ? colors.primary : colors.mutedForeground;
    return (
      <Pressable
        key={item.name}
        style={styles.item}
        onPress={() => navigation.navigate(item.name)}
      >
        <Ionicons
          name={focused ? item.activeIcon : item.icon}
          size={22}
          color={color}
        />
        <Text style={[styles.label, { color }]}>{item.label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.side}>{LEFT.map(renderItem)}</View>
        <View style={styles.fabWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.fab,
              {
                backgroundColor: colors.primary,
                shadowColor: colors.primary,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
            onPress={() => router.push("/create-post")}
          >
            <Ionicons name="add" size={30} color={colors.primaryForeground} />
          </Pressable>
        </View>
        <View style={styles.side}>{RIGHT.map(renderItem)}</View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="catches" options={{ href: null }} />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "stretch", height: 60 },
  side: { flex: 1, flexDirection: "row" },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontFamily: fonts.sansMedium, fontSize: 10 },
  fabWrap: { width: 76, alignItems: "center", justifyContent: "flex-start" },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -22,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
