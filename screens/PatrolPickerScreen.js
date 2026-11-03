// screens/PatrolPickerScreen.js
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C, ScreenHeader, EmptyState } from "./components/PatrolUI";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
const getToken = async () => AsyncStorage.getItem("auth_token");

// Two-letter avatar text from a full name
const initialsOf = (name) =>
  (name || "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "??";

export default function PatrolPickerScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { shift, startDate, endDate, selectedIds, otherShiftIds, returnKey } =
    route.params;

  const [patrollers, setPatrollers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  // Local draft selection: only committed to the parent when Done is pressed
  const [selected, setSelected] = useState(selectedIds || []);

  // Fetch who is free for these dates (ignore the response if the screen closed)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API_BASE}/patrol/available-patrollers?start=${startDate}&end=${endDate}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.success) setPatrollers(data.data);
        else setError(true);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  const filtered = useMemo(
    () =>
      patrollers.filter((p) =>
        (p.officer_name || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [patrollers, search],
  );

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // Write the result into the Add Patrol route's params, then return to it
  const handleDone = () => {
    const picked = patrollers
      .filter((p) => selected.includes(p.active_patroller_id))
      .map((p) => ({
        active_patroller_id: p.active_patroller_id,
        officer_name: p.officer_name,
        rank: p.rank || null,
      }));
    navigation.dispatch({
      ...CommonActions.setParams({
        pickedShift: shift,
        pickedPatrollers: picked,
      }),
      source: returnKey,
    });
    navigation.goBack();
  };

  const renderItem = ({ item, index }) => {
    const id = item.active_patroller_id;
    const locked = (otherShiftIds || []).includes(id);
    const on = selected.includes(id);
    return (
      <TouchableOpacity
        style={[
          s.row,
          index === 0 && { borderTopWidth: 0 },
          on && { backgroundColor: "#eef3f9" },
          locked && { opacity: 0.55 },
        ]}
        activeOpacity={0.8}
        disabled={locked}
        onPress={() => toggle(id)}
      >
        <View style={[s.avatar, locked && { backgroundColor: "#94a3b8" }]}>
          <Text style={s.avatarTxt}>{initialsOf(item.officer_name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>
            {item.officer_name}
          </Text>
          {locked ? (
            <Text style={s.lockTxt}>
              Assigned to {shift === "AM" ? "PM" : "AM"} shift
            </Text>
          ) : (
            !!item.rank && <Text style={s.rank}>{item.rank}</Text>
          )}
        </View>
        <View style={[s.check, on && s.checkOn]}>
          {on && <Ionicons name="checkmark" size={13} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title={`${shift} Shift Patrollers`}
        subtitle={loading ? "Checking availability..." : `${patrollers.length} available`}
        onBack={() => navigation.goBack()}
      />

      <View style={s.body}>
        {/* Search */}
        <View style={s.searchBox}>
          <Ionicons name="search-outline" size={17} color={C.faint} />
          <TextInput
            style={s.searchInput}
            placeholder="Search patroller..."
            placeholderTextColor={C.faint}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.navy} />
          </View>
        ) : error ? (
          <EmptyState
            title="Could not load patrollers"
            text="Check your connection and go back to try again."
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(p) => String(p.active_patroller_id)}
            renderItem={renderItem}
            style={s.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                title="No patrollers found"
                text={
                  search
                    ? "Try a different name."
                    : "No patrollers are available for this period."
                }
              />
            }
          />
        )}

        {/* Bottom bar */}
        <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.barCount}>{selected.length} selected</Text>
            <Text style={s.barSub}>Patrollers on the other shift are locked</Text>
          </View>
          <TouchableOpacity style={s.doneBtn} onPress={handleDone} activeOpacity={0.85}>
            <Text style={s.doneTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.dark },
  body: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    height: 46,
    margin: 14,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },

  list: {
    flex: 1,
    backgroundColor: "#fff",
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8edf3",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 13, fontWeight: "800", color: "#fff" },
  name: { fontSize: 13.5, fontWeight: "700", color: C.text },
  rank: { fontSize: 11.5, color: C.muted, marginTop: 1 },
  lockTxt: { fontSize: 11.5, color: "#b45309", fontWeight: "700", marginTop: 1 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: C.navy, borderColor: C.navy },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  barCount: { fontSize: 14, fontWeight: "800", color: C.text },
  barSub: { fontSize: 11.5, color: C.muted },
  doneBtn: {
    height: 48,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  doneTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
});