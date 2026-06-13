import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import {
  useGetCatches,
  useCreateCatch,
  useDeleteCatch,
  useGetMe,
  useRequestUploadUrl,
  getGetCatchesQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { resolveAssetUrl, timeAgo } from "@/lib/format";
import UserAvatar from "@/components/UserAvatar";
import ScreenHeader from "@/components/ui/ScreenHeader";
import SoftCard from "@/components/ui/SoftCard";
import Chip from "@/components/ui/Chip";
import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";

export default function CatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { data: me } = useGetMe();
  const { data: catches, isLoading, isRefetching, refetch } = useGetCatches({});
  const deleteCatch = useDeleteCatch();
  const createCatch = useCreateCatch();
  const requestUpload = useRequestUploadUrl();

  const [modalVisible, setModalVisible] = useState(false);
  const [species, setSpecies] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [notes, setNotes] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setSpecies("");
    setWeight("");
    setLength("");
    setNotes("");
    setIsPrivate(false);
    setPhoto(null);
  };

  const handleDelete = (id: number) => {
    Alert.alert("Delete Catch", "Are you sure you want to delete this catch?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteCatch.mutate(
            { catchId: id },
            { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCatchesQueryKey() }) }
          );
        },
      },
    ]);
  };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo access to add a catch photo.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset): Promise<string | undefined> => {
    const res = await fetch(asset.uri);
    const blob = await res.blob();
    const contentType = asset.mimeType || "image/jpeg";
    const name = asset.fileName || `catch-${Date.now()}.jpg`;
    const { uploadURL, objectPath } = await requestUpload.mutateAsync({
      data: { name, size: blob.size || asset.fileSize || 1, contentType },
    });
    await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });
    return objectPath;
  };

  const handleCreate = async () => {
    if (!species.trim()) {
      Alert.alert("Error", "Please enter a species.");
      return;
    }
    let weightVal: number | undefined;
    if (weight.trim()) {
      const w = parseFloat(weight);
      if (!Number.isFinite(w) || w < 0) {
        Alert.alert("Error", "Please enter a valid weight.");
        return;
      }
      weightVal = w;
    }
    let lengthVal: number | undefined;
    if (length.trim()) {
      const l = parseFloat(length);
      if (!Number.isFinite(l) || l < 0) {
        Alert.alert("Error", "Please enter a valid length.");
        return;
      }
      lengthVal = l;
    }

    setSaving(true);
    try {
      let imageUrl: string | undefined;
      if (photo) {
        imageUrl = await uploadPhoto(photo);
      }
      await createCatch.mutateAsync({
        data: {
          species: species.trim(),
          weight: weightVal,
          length: lengthVal,
          notes: notes.trim() || undefined,
          imageUrl,
          isPrivate,
        },
      });
      setModalVisible(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: getGetCatchesQueryKey() });
    } catch {
      Alert.alert("Could not save", "Something went wrong logging your catch. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <SoftCard style={{ marginBottom: 16 }} padded={false}>
      <View style={styles.cardHeader}>
        <UserAvatar
          name={item.user?.displayName}
          username={item.user?.username}
          avatarUrl={item.user?.avatarUrl}
          size={40}
        />
        <View style={styles.cardHeaderInfo}>
          <Text style={[styles.authorName, { color: colors.foreground }]}>
            {item.user?.displayName || "Angler"}
          </Text>
          <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>
            {timeAgo(item.caughtAt)}
          </Text>
        </View>
        {item.isPrivate && (
          <View style={[styles.lockPill, { backgroundColor: colors.muted }]}>
            <Ionicons name="lock-closed" size={13} color={colors.mutedForeground} />
            <Text style={[styles.lockText, { color: colors.mutedForeground }]}>Private</Text>
          </View>
        )}
        {me?.id === item.userId && (
          <Pressable onPress={() => handleDelete(item.id)} hitSlop={10} style={{ marginLeft: 10 }}>
            <Ionicons name="trash-outline" size={20} color={colors.destructive} />
          </Pressable>
        )}
      </View>

      {item.imageUrl ? (
        <View style={[styles.catchImageWrap, { backgroundColor: colors.muted }]}>
          <Ionicons
            name="fish"
            size={44}
            color={colors.mutedForeground}
            style={styles.catchImagePlaceholder}
          />
          <Image
            source={{ uri: resolveAssetUrl(item.imageUrl) }}
            style={styles.catchImage}
            contentFit="cover"
            transition={200}
          />
        </View>
      ) : null}

      <View style={styles.cardBody}>
        <Text style={[styles.species, { color: colors.foreground }]}>{item.species}</Text>
        {(item.weight != null || item.length != null) && (
          <View style={styles.statsRow}>
            {item.weight != null && <Chip label={`${item.weight} lb`} icon="barbell" tone="primary" />}
            {item.length != null && <Chip label={`${item.length} in`} icon="resize" tone="accent" />}
          </View>
        )}
        {item.notes ? (
          <Text style={[styles.notes, { color: colors.mutedForeground }]}>{item.notes}</Text>
        ) : null}
      </View>
    </SoftCard>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Catch Log"
        subtitle="Every fish has a story"
        back
        right={
          <Pressable onPress={() => setModalVisible(true)} style={styles.headerIcon}>
            <Ionicons name="add-circle" size={28} color={colors.primary} />
          </Pressable>
        }
      />

      {isLoading && !catches ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={catches}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="fish-outline" size={56} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No catches yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                Log your first catch and show off the trophy.
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.background, paddingTop: Platform.OS === "ios" ? 0 : insets.top },
          ]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable
              onPress={() => {
                setModalVisible(false);
                resetForm();
              }}
              hitSlop={10}
            >
              <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Catch</Text>
            <Pressable onPress={handleCreate} hitSlop={10} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.modalBtnText, { color: colors.primary, fontFamily: fonts.sansBold }]}>
                  Save
                </Text>
              )}
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Pressable
              style={[styles.photoPicker, { borderColor: colors.border, backgroundColor: colors.muted }]}
              onPress={pickPhoto}
            >
              {photo ? (
                <Image source={{ uri: photo.uri }} style={styles.photoPreview} contentFit="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={30} color={colors.mutedForeground} />
                  <Text style={[styles.photoHint, { color: colors.mutedForeground }]}>Add a photo</Text>
                </View>
              )}
            </Pressable>

            <Text style={[styles.label, { color: colors.foreground }]}>Species *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Largemouth Bass"
              placeholderTextColor={colors.mutedForeground}
              value={species}
              onChangeText={setSpecies}
            />

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.foreground }]}>Weight (lb)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                  placeholder="4.5"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  value={weight}
                  onChangeText={setWeight}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.foreground }]}>Length (in)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                  placeholder="18"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  value={length}
                  onChangeText={setLength}
                />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
              placeholder="What a fight..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              value={notes}
              onChangeText={setNotes}
            />

            <Pressable
              style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setIsPrivate(!isPrivate)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.foreground }]}>Keep Private</Text>
                <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>
                  Only you can see this catch
                </Text>
              </View>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.primary, backgroundColor: isPrivate ? colors.primary : "transparent" },
                ]}
              >
                {isPrivate && <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />}
              </View>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerIcon: { padding: 4 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 70, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  emptySubtitle: { fontFamily: fonts.sans, fontSize: 14, textAlign: "center" },

  cardHeader: { flexDirection: "row", alignItems: "center", padding: 14 },
  cardHeaderInfo: { flex: 1, marginLeft: 10 },
  authorName: { fontFamily: fonts.sansBold, fontSize: 15 },
  timeAgo: { fontFamily: fonts.sans, fontSize: 12.5, marginTop: 1 },
  lockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  lockText: { fontFamily: fonts.sansSemibold, fontSize: 11 },

  catchImageWrap: { width: "100%", aspectRatio: 4 / 3, alignItems: "center", justifyContent: "center" },
  catchImagePlaceholder: { position: "absolute", opacity: 0.6 },
  catchImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },

  cardBody: { padding: 16 },
  species: { fontFamily: fonts.displayBold, fontSize: 22, marginBottom: 10 },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  notes: { fontFamily: fonts.sans, fontSize: 14.5, lineHeight: 21 },

  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBtnText: { fontFamily: fonts.sansMedium, fontSize: 16 },
  modalTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  modalBody: { padding: 16, paddingBottom: 48 },
  photoPicker: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  photoPreview: { width: "100%", height: "100%" },
  photoPlaceholder: { alignItems: "center", gap: 8 },
  photoHint: { fontFamily: fonts.sansMedium, fontSize: 14 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  textArea: { height: 100, textAlignVertical: "top" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    marginTop: 24,
  },
  toggleTitle: { fontFamily: fonts.sansMedium, fontSize: 16 },
  toggleDesc: { fontFamily: fonts.sans, fontSize: 13, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
});
