import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Switch, ActivityIndicator } from "react-native";
import { useGetMe, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [hometown, setHometown] = useState("");
  const [work, setWork] = useState("");
  const [boatName, setBoatName] = useState("");
  const [shareLocation, setShareLocation] = useState(true);

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName || "");
      setBio(me.bio || "");
      setLocation(me.location || "");
      setHometown(me.hometown || "");
      setWork(me.work || "");
      setBoatName(me.boatName || "");
      setShareLocation(me.shareLocation ?? true);
    }
  }, [me]);

  const handleSave = async () => {
    try {
      await updateMe.mutateAsync({
        data: {
          displayName,
          bio,
          location,
          hometown,
          work,
          boatName,
          shareLocation
        }
      });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      router.back();
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading || !me) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 16, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Settings</Text>
        <Pressable onPress={handleSave} disabled={updateMe.isPending} style={styles.saveBtn}>
          {updateMe.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Profile Info</Text>
        
        <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Display Name</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={displayName}
            onChangeText={setDisplayName}
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Bio</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground, height: 80 }]}
            value={bio}
            onChangeText={setBio}
            placeholderTextColor={colors.mutedForeground}
            multiline
          />
        </View>

        <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Location</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={location}
            onChangeText={setLocation}
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Boat Name</Text>
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            value={boatName}
            onChangeText={setBoatName}
            placeholderTextColor={colors.mutedForeground}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 24 }]}>Preferences</Text>
        
        <View style={[styles.settingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.foreground }]}>Share Location</Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans, fontSize: 13, marginTop: 2 }}>Allow others to see you on the map</Text>
          </View>
          <Switch
            value={shareLocation}
            onValueChange={setShareLocation}
            trackColor={{ false: colors.muted, true: colors.primary }}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 24 }]}>Account</Text>

        <Pressable
          style={[styles.navRow, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/friends")}
        >
          <Feather name="users" size={20} color={colors.foreground} style={{ marginRight: 12 }} />
          <Text style={[styles.navText, { color: colors.foreground }]}>Friends</Text>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          style={[styles.navRow, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}
          onPress={() => router.push("/notifications")}
        >
          <Feather name="bell" size={20} color={colors.foreground} style={{ marginRight: 12 }} />
          <Text style={[styles.navText, { color: colors.foreground }]}>Notifications</Text>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          style={[styles.navRow, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}
          onPress={() => router.push("/conditions")}
        >
          <Feather name="sun" size={20} color={colors.foreground} style={{ marginRight: 12 }} />
          <Text style={[styles.navText, { color: colors.foreground }]}>Lake Conditions</Text>
          <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontFamily: fonts.displayBold, fontSize: 18 },
  saveBtn: { width: 50, height: 40, justifyContent: "center", alignItems: "flex-end" },
  saveText: { fontFamily: fonts.sansBold, fontSize: 16 },
  sectionTitle: { fontFamily: fonts.sansSemibold, fontSize: 13, textTransform: "uppercase", marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 },
  inputGroup: { padding: 16, borderWidth: 1, borderRadius: 16, marginBottom: 12 },
  label: { fontFamily: fonts.sansSemibold, fontSize: 15, marginBottom: 8 },
  input: { fontFamily: fonts.sans, fontSize: 16, padding: 0 },
  settingRow: { padding: 16, borderWidth: 1, borderRadius: 16, marginBottom: 12, flexDirection: "row", alignItems: "center" },
  navRow: { padding: 16, borderWidth: 1, borderRadius: 16, flexDirection: "row", alignItems: "center" },
  navText: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 16 },
});
