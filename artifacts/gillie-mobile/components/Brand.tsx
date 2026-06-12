import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

export function Brand({
  size = 44,
  color,
  showIcon = true,
}: {
  size?: number;
  color?: string;
  showIcon?: boolean;
}) {
  const colors = useColors();
  const wordColor = color ?? colors.primary;
  return (
    <View style={styles.row}>
      {showIcon && (
        <MaterialCommunityIcons
          name="fish"
          size={size * 0.85}
          color={colors.secondary}
        />
      )}
      <Text
        style={[
          styles.word,
          { fontSize: size, color: wordColor, fontFamily: fonts.script },
        ]}
      >
        Gillie
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  word: { includeFontPadding: false, paddingTop: 4 },
});
