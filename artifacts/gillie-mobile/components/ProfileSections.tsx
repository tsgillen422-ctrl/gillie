import React from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { UserAvatar } from "@/components/UserAvatar";
import { resolveAssetUrl, timeAgo } from "@/lib/format";

const { width } = Dimensions.get("window");

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export function prettify(value: string) {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type HeroUser = {
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  isOnline?: boolean;
  isBusiness?: boolean;
};

/**
 * Scenic cover banner with an identity card overlapping the bottom edge —
 * mirrors the web profile hero (cover photo + floating avatar card).
 */
export function ProfileHero({
  user,
  children,
}: {
  user: HeroUser;
  children?: React.ReactNode;
}) {
  const colors = useColors();
  const cover = resolveAssetUrl(user.coverUrl);

  return (
    <View>
      <View style={[styles.cover, { backgroundColor: colors.muted }]}>
        {cover ? (
          <Image
            source={{ uri: cover }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.primary, opacity: 0.12 },
            ]}
          />
        )}
      </View>

      <View style={styles.cardWrap}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.avatarRing, { backgroundColor: colors.card }]}>
            <UserAvatar
              name={user.displayName}
              username={user.username}
              avatarUrl={user.avatarUrl}
              size={88}
              online={user.isOnline}
            />
          </View>

          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user.displayName}
            </Text>
            {user.isBusiness ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={colors.primary}
                style={{ marginLeft: 4 }}
              />
            ) : null}
          </View>
          <Text style={[styles.username, { color: colors.mutedForeground }]}>
            @{user.username}
          </Text>

          {children}
        </View>
      </View>
    </View>
  );
}

type Stat = {
  label: string;
  value: number | string;
  star?: boolean;
  onPress?: () => void;
};

/** Row of bordered stat tiles matching the web identity-card stats grid. */
export function StatRow({ stats }: { stats: Stat[] }) {
  const colors = useColors();
  return (
    <View style={styles.statsGrid}>
      {stats.map((s) => {
        const Container: any = s.onPress ? Pressable : View;
        return (
          <Container
            key={s.label}
            onPress={s.onPress}
            style={[
              styles.statTile,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <View style={styles.statValueRow}>
              {s.star ? (
                <Ionicons
                  name="star"
                  size={13}
                  color={colors.accent}
                  style={{ marginRight: 3 }}
                />
              ) : null}
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {s.value}
              </Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              {s.label}
            </Text>
          </Container>
        );
      })}
    </View>
  );
}

/** Detail rows (location, boat, etc.) for the About card. */
export function AboutRows({
  rows,
}: {
  rows: { icon: IoniconName; label: string }[];
}) {
  const colors = useColors();
  return (
    <View>
      {rows.map((row, i) => (
        <View
          key={row.icon + String(i)}
          style={[styles.aboutRow, i > 0 && { marginTop: 12 }]}
        >
          <View style={[styles.aboutIcon, { backgroundColor: colors.primary + "1A" }]}>
            <Ionicons name={row.icon} size={16} color={colors.primary} />
          </View>
          <Text style={[styles.aboutText, { color: colors.foreground }]}>
            {row.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

type BadgeItem = { key: string; label: string; earned?: boolean };

/** 4-column achievements grid mirroring the web AchievementGrid. */
export function AchievementGrid({ badges }: { badges: BadgeItem[] }) {
  const colors = useColors();
  const tileW = (width - 32 - 32 - 30) / 4;
  return (
    <View style={styles.achievementGrid}>
      {badges.map((b) => {
        const earned = !!b.earned;
        return (
          <View
            key={b.key}
            style={[
              styles.achievementTile,
              {
                width: tileW,
                backgroundColor: earned ? colors.accent + "1A" : colors.muted,
                borderColor: earned ? colors.accent + "4D" : colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.achievementIcon,
                {
                  backgroundColor: earned ? colors.accent + "33" : colors.card,
                },
              ]}
            >
              <Ionicons
                name={earned ? "ribbon" : "lock-closed"}
                size={18}
                color={earned ? "#b45309" : colors.mutedForeground}
              />
            </View>
            <Text
              numberOfLines={2}
              style={[
                styles.achievementLabel,
                { color: earned ? colors.foreground : colors.mutedForeground },
              ]}
            >
              {b.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type ActivityItem = {
  key: string;
  icon: IoniconName;
  color: string;
  label: string;
  time: number;
};

/** Build a merged, recency-sorted activity feed (posts, catches, pins, photos). */
export function buildRecentActivity({
  posts = [],
  catches = [],
  pins = [],
  gallery = [],
}: {
  posts?: any[];
  catches?: any[];
  pins?: any[];
  gallery?: any[];
}): ActivityItem[] {
  const items: ActivityItem[] = [];
  posts.forEach((p) =>
    items.push({
      key: `post-${p.id}`,
      icon: "document-text",
      color: "#0d7fa5",
      label: p.title ? `Posted "${p.title}"` : "Shared a post",
      time: new Date(p.createdAt).getTime(),
    }),
  );
  catches.forEach((c) =>
    items.push({
      key: `catch-${c.id}`,
      icon: "fish",
      color: "#0891b2",
      label: `Logged a catch · ${c.species}`,
      time: new Date(c.caughtAt).getTime(),
    }),
  );
  pins.forEach((p) =>
    items.push({
      key: `pin-${p.id}`,
      icon: "location",
      color: "#059669",
      label: `Dropped a pin · ${p.title}`,
      time: new Date(p.createdAt).getTime(),
    }),
  );
  gallery.forEach((g) =>
    items.push({
      key: `gallery-${g.id}`,
      icon: "image",
      color: "#d97706",
      label: g.caption
        ? `Shared a photo · ${g.caption}`
        : "Added a photo to the gallery",
      time: new Date(g.createdAt).getTime(),
    }),
  );
  return items
    .filter((i) => !Number.isNaN(i.time))
    .sort((a, b) => b.time - a.time)
    .slice(0, 5);
}

/** Recent Activity list with colored icon chips + relative time. */
export function RecentActivity({ items }: { items: ActivityItem[] }) {
  const colors = useColors();
  if (items.length === 0) {
    return (
      <Text style={[styles.muted, { color: colors.mutedForeground }]}>
        No activity on the lake yet.
      </Text>
    );
  }
  return (
    <View>
      {items.map((it, i) => (
        <View
          key={it.key}
          style={[styles.activityRow, i > 0 && { marginTop: 14 }]}
        >
          <View style={[styles.activityIcon, { backgroundColor: it.color + "1A" }]}>
            <Ionicons name={it.icon} size={18} color={it.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={[styles.activityLabel, { color: colors.foreground }]}
            >
              {it.label}
            </Text>
            <Text style={[styles.activityTime, { color: colors.mutedForeground }]}>
              {timeAgo(it.time)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** 3-column gallery preview (first 6 items) used in the "Lake Adventures" card. */
export function GalleryPreview({
  gallery,
  emptyText,
}: {
  gallery: any[];
  emptyText: string;
}) {
  const colors = useColors();
  const preview = gallery.slice(0, 6);
  if (preview.length === 0) {
    return (
      <Text style={[styles.muted, { color: colors.mutedForeground }]}>
        {emptyText}
      </Text>
    );
  }
  const size = (width - 32 - 32 - 12) / 3;
  return (
    <View style={styles.galleryWrap}>
      {preview.map((item) => (
        <View
          key={item.id}
          style={[
            styles.galleryCell,
            { width: size, height: size, backgroundColor: colors.muted },
          ]}
        >
          <Image
            source={{ uri: resolveAssetUrl(item.mediaUrl) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          {item.mediaType === "video" ? (
            <View style={styles.playBadge}>
              <Ionicons name="play" size={14} color="#fff" />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { height: 168, width: "100%" },
  cardWrap: { paddingHorizontal: 12, marginTop: -52 },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    alignItems: "center",
  },
  avatarRing: {
    position: "absolute",
    top: -44,
    alignSelf: "center",
    padding: 4,
    borderRadius: 999,
  },
  nameRow: { flexDirection: "row", alignItems: "center" },
  name: { fontFamily: fonts.displayBold, fontSize: 23, textAlign: "center" },
  username: { fontFamily: fonts.sansMedium, fontSize: 14, marginTop: 2 },

  statsGrid: { flexDirection: "row", gap: 8, width: "100%", marginTop: 18 },
  statTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  statValueRow: { flexDirection: "row", alignItems: "center" },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
  statLabel: { fontFamily: fonts.sansMedium, fontSize: 11, marginTop: 2 },

  aboutRow: { flexDirection: "row", alignItems: "center" },
  aboutIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  aboutText: { fontFamily: fonts.sansMedium, fontSize: 15, flex: 1 },

  achievementGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievementTile: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  achievementIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  achievementLabel: {
    fontFamily: fonts.sansSemibold,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 13,
  },

  activityRow: { flexDirection: "row", alignItems: "center" },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityLabel: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  activityTime: { fontFamily: fonts.sans, fontSize: 12, marginTop: 1 },

  galleryWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  galleryCell: { borderRadius: 14, overflow: "hidden" },
  playBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -14,
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  muted: { fontFamily: fonts.sans, fontSize: 14 },
});
