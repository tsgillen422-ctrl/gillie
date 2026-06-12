import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { resolveAssetUrl, initials, colorFromString } from "@/lib/format";

export function UserAvatar({
  name,
  username,
  avatarUrl,
  size = 40,
  online = false,
}: {
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  size?: number;
  online?: boolean;
}) {
  const colors = useColors();
  const resolved = resolveAssetUrl(avatarUrl);
  const dot = Math.max(10, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size }}>
      {resolved ? (
        <Image
          source={{ uri: resolved }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
          }}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colorFromString(username || name),
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontFamily: fonts.sansBold,
              fontSize: size * 0.4,
            }}
          >
            {initials(name)}
          </Text>
        </View>
      )}
      {online && (
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: "#10b981",
            borderWidth: 2,
            borderColor: colors.background,
          }}
        />
      )}
    </View>
  );
}

export default UserAvatar;
