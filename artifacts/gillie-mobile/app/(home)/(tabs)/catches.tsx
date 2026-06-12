import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, RefreshControl, Modal, TextInput, Alert, Platform } from "react-native";
import { useGetCatches, useCreateCatch, useDeleteCatch, useGetMe, getGetCatchesQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { resolveAssetUrl, timeAgo } from "@/lib/format";
import UserAvatar from "@/components/UserAvatar";
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

  const [modalVisible, setModalVisible] = useState(false);
  const [species, setSpecies] = useState("");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [notes, setNotes] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const handleDelete = (id: number) => {
    Alert.alert("Delete Catch", "Are you sure you want to delete this catch?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
          deleteCatch.mutate({ catchId: id }, {
            onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCatchesQueryKey() })
          });
      }}
    ]);
  };

  const handleCreate = () => {
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
    createCatch.mutate({
      data: {
        species: species.trim(),
        weight: weightVal,
        length: lengthVal,
        notes: notes.trim() || undefined,
        isPrivate,
      }
    }, {
      onSuccess: () => {
        setModalVisible(false);
        setSpecies("");
        setWeight("");
        setLength("");
        setNotes("");
        setIsPrivate(false);
        queryClient.invalidateQueries({ queryKey: getGetCatchesQueryKey() });
      }
    });
  };

  if (isLoading && !catches) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>Catches</Text>
        <Pressable 
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <FlatList
        data={catches}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="fish-outline" size={64} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No catches yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>Log your first catch!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.cardHeader}>
              <UserAvatar 
                name={item.user?.displayName} 
                username={item.user?.username} 
                avatarUrl={item.user?.avatarUrl} 
                size={36} 
              />
              <View style={styles.cardHeaderInfo}>
                <Text style={[styles.authorName, { color: colors.foreground }]}>{item.user?.displayName || 'Angler'}</Text>
                <Text style={[styles.timeAgo, { color: colors.mutedForeground }]}>{timeAgo(item.caughtAt)}</Text>
              </View>
              {item.isPrivate && <Ionicons name="lock-closed" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />}
              {me?.id === item.userId && (
                <Pressable onPress={() => handleDelete(item.id)} hitSlop={10}>
                  <Ionicons name="trash-outline" size={20} color={colors.destructive} />
                </Pressable>
              )}
            </View>

            {item.imageUrl && (
              <View style={[styles.catchImageWrap, { backgroundColor: colors.muted }]}>
                <Ionicons name="fish" size={44} color={colors.mutedForeground} style={styles.catchImagePlaceholder} />
                <Image 
                  source={{ uri: resolveAssetUrl(item.imageUrl) }} 
                  style={styles.catchImage} 
                  contentFit="cover" 
                  transition={200}
                />
              </View>
            )}

            <View style={styles.cardBody}>
              <Text style={[styles.species, { color: colors.foreground }]}>{item.species}</Text>
              <View style={styles.statsRow}>
                {item.weight != null && (
                  <View style={[styles.statChip, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>{item.weight} lbs</Text>
                  </View>
                )}
                {item.length != null && (
                  <View style={[styles.statChip, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.statText, { color: colors.mutedForeground }]}>{item.length} in</Text>
                  </View>
                )}
              </View>
              {item.notes && (
                <Text style={[styles.notes, { color: colors.mutedForeground }]}>{item.notes}</Text>
              )}
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Pressable onPress={() => setModalVisible(false)} hitSlop={10}>
              <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Log Catch</Text>
            <Pressable onPress={handleCreate} hitSlop={10}>
              <Text style={[styles.modalBtnText, { color: colors.primary, fontFamily: fonts.sansBold }]}>Save</Text>
            </Pressable>
          </View>

          <View style={styles.modalBody}>
            <Text style={[styles.label, { color: colors.foreground }]}>Species *</Text>
            <TextInput 
              style={[styles.input, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]} 
              placeholder="Largemouth Bass" 
              placeholderTextColor={colors.mutedForeground}
              value={species}
              onChangeText={setSpecies}
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.foreground }]}>Weight (lbs)</Text>
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
              <View>
                <Text style={[styles.toggleTitle, { color: colors.foreground }]}>Keep Private</Text>
                <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>Only you can see this catch</Text>
              </View>
              <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: isPrivate ? colors.primary : 'transparent' }]}>
                {isPrivate && <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />}
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: 24 },
  fab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyTitle: { fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: 4 },
  emptySubtitle: { fontFamily: fonts.sans, fontSize: 14 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, marginBottom: 16, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  cardHeaderInfo: { flex: 1, marginLeft: 10 },
  authorName: { fontFamily: fonts.sansSemibold, fontSize: 14 },
  timeAgo: { fontFamily: fonts.sans, fontSize: 12, marginTop: 2 },
  catchImageWrap: { width: '100%', aspectRatio: 4/3, alignItems: 'center', justifyContent: 'center' },
  catchImagePlaceholder: { position: 'absolute', opacity: 0.6 },
  catchImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  cardBody: { padding: 16 },
  species: { fontFamily: fonts.displayBold, fontSize: 20, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statText: { fontFamily: fonts.sansMedium, fontSize: 12 },
  notes: { fontFamily: fonts.sans, fontSize: 14, marginTop: 4, lineHeight: 20 },
  
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBtnText: { fontFamily: fonts.sansMedium, fontSize: 16 },
  modalTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  modalBody: { padding: 16 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    alignItems: 'center',
    justifyContent: 'center',
  }
});

