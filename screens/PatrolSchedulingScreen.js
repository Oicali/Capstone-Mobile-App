// screens/PatrolSchedulingScreen.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Platform,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;

// ── Helpers ───────────────────────────────────────────────────────
const parseLocalDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const today = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};

const formatDate = (d) => {
  const dt = parseLocalDate(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getPatrolStatus = (patrol) => {
  const t = today();
  const start = parseLocalDate(patrol.start_date);
  const end = parseLocalDate(patrol.end_date);
  if (!start || !end) return "unknown";
  if (t < start) return "upcoming";
  if (t > end) return "completed";
  return "active";
};

const STATUS_CONFIG = {
  active:    { label: "Active",    bg: "#dcfce7", color: "#166534", border: "#86efac" },
  upcoming:  { label: "Upcoming",  bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  completed: { label: "Completed", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  unknown:   { label: "Unknown",   bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
};

const STATUS_ORDER = { active: 0, upcoming: 1, completed: 2, unknown: 3 };

const getToken = async () => AsyncStorage.getItem("auth_token"); // ✅ match the key

// ── Status Badge ──────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: cfg.bg, borderColor: cfg.border },
      ]}
    >
      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

// ── Patrol Card ───────────────────────────────────────────────────
const PatrolCard = ({ patrol, onPress }) => {
  const status = getPatrolStatus(patrol);
  const uniquePatrollers = patrol.patrollers || [];
  const barangays = [
    ...new Set(
      (patrol.routes || [])
        .filter((r) => (r.stop_order || 0) <= 0 && r.barangay)
        .map((r) => r.barangay)
        .filter(Boolean)
    ),
  ];

  return (
    <TouchableOpacity
      style={[styles.card, status === "active" && styles.cardActive]}
      onPress={() => onPress(patrol)}
      activeOpacity={0.75}
    >
      {/* Card top row */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {patrol.patrol_name}
        </Text>
        <StatusBadge status={status} />
      </View>

      {/* Unit */}
      <View style={styles.cardRow}>
        <Ionicons name="car-outline" size={14} color="#1e3a5f" />
        <Text style={styles.cardUnit} numberOfLines={1}>
          {patrol.mobile_unit_name || "No unit assigned"}
          {patrol.plate_number ? `  ·  ${patrol.plate_number}` : ""}
        </Text>
      </View>

      {/* Duration */}
      <View style={styles.cardRow}>
        <Ionicons name="calendar-outline" size={14} color="#6c757d" />
        <Text style={styles.cardDuration}>
          {formatDate(patrol.start_date)} — {formatDate(patrol.end_date)}
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.cardFooter}>
        <View style={styles.cardStat}>
          <Ionicons name="people-outline" size={13} color="#1e3a5f" />
          <Text style={styles.cardStatText}>
            {uniquePatrollers.length}{" "}
            {uniquePatrollers.length === 1 ? "Patroller" : "Patrollers"}
          </Text>
        </View>
        <View style={styles.cardStatDivider} />
        <View style={styles.cardStat}>
          <Ionicons name="location-outline" size={13} color="#166534" />
          <Text style={styles.cardStatText}>
            {barangays.length}{" "}
            {barangays.length === 1 ? "Barangay" : "Barangays"}
          </Text>
        </View>
        <View style={styles.cardArrow}>
          <Ionicons name="chevron-forward" size={16} color="#adb5bd" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Filter Pill ───────────────────────────────────────────────────
const FilterPill = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.pill, active && styles.pillActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.pillText, active && styles.pillTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ── Empty State ───────────────────────────────────────────────────
const EmptyState = ({ filtered }) => (
  <View style={styles.emptyWrap}>
    <Ionicons name="shield-outline" size={52} color="#dee2e6" />
    <Text style={styles.emptyTitle}>
      {filtered ? "No Results" : "No Patrols"}
    </Text>
    <Text style={styles.emptyText}>
      {filtered
        ? "Try adjusting your search or filters."
        : "No patrol assignments have been created yet."}
    </Text>
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────
export default function PatrolSchedulingScreen({ navigation }) {
  const [patrols, setPatrols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchPatrols = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/patrol/patrols`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPatrols(data.data);
    } catch (err) {
      console.error("fetchPatrols error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatrols();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPatrols(true);
  };

  // Filter + sort
  const filtered = patrols
    .filter((p) => {
      if (
        search &&
        !(
          (p.patrol_name || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.mobile_unit_name || "").toLowerCase().includes(search.toLowerCase())
        )
      )
        return false;
      if (statusFilter !== "all" && getPatrolStatus(p) !== statusFilter)
        return false;
      return true;
    })
    .sort((a, b) => {
      const sa = STATUS_ORDER[getPatrolStatus(a)] ?? 3;
      const sb = STATUS_ORDER[getPatrolStatus(b)] ?? 3;
      if (sa !== sb) return sa - sb;
      return (
        (parseLocalDate(a.start_date)?.getTime() ?? 0) -
        (parseLocalDate(b.start_date)?.getTime() ?? 0)
      );
    });

  const counts = {
    all: patrols.length,
    active: patrols.filter((p) => getPatrolStatus(p) === "active").length,
    upcoming: patrols.filter((p) => getPatrolStatus(p) === "upcoming").length,
    completed: patrols.filter((p) => getPatrolStatus(p) === "completed").length,
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1628" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Patrol Schedule</Text>
          <Text style={styles.headerSub}>
            {counts.all} total · {counts.active} active
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchPatrols()}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrap}>
        <Ionicons
          name="search-outline"
          size={16}
          color="#adb5bd"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search patrol or unit..."
          placeholderTextColor="#adb5bd"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && Platform.OS === "android" && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color="#adb5bd" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter Pills ── */}
      <View style={styles.pillRow}>
        {[
          { key: "all", label: `All (${counts.all})` },
          { key: "active", label: `Active (${counts.active})` },
          { key: "upcoming", label: `Upcoming (${counts.upcoming})` },
          { key: "completed", label: `Done (${counts.completed})` },
        ].map(({ key, label }) => (
          <FilterPill
            key={key}
            label={label}
            active={statusFilter === key}
            onPress={() => setStatusFilter(key)}
          />
        ))}
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1e3a5f" />
          <Text style={styles.loadingText}>Loading patrols...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.patrol_id)}
          renderItem={({ item }) => (
            <PatrolCard
              patrol={item}
            onPress={(patrol) =>
  navigation.navigate("PatrolDetail", { patrol, isAdmin: true })
}
            />
          )}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={<EmptyState filtered={search || statusFilter !== "all"} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1e3a5f"
              colors={["#1e3a5f"]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0a1628",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 12,
    color: "#93afc9",
    marginTop: 2,
    fontWeight: "500",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Search ──
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dee2e6",
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#212529",
    fontFamily: Platform.OS === "ios" ? "System" : "sans-serif",
  },

  // ── Filter Pills ──
  pillRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
    flexWrap: "nowrap",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  pillActive: {
    backgroundColor: "#1e3a5f",
    borderColor: "#1e3a5f",
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6c757d",
  },
  pillTextActive: {
    color: "#ffffff",
  },

  // ── Card ──
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  listEmpty: {
    flex: 1,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderLeftWidth: 4,
    borderLeftColor: "#dee2e6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardActive: {
    borderLeftColor: "#22c55e",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: "#0a1628",
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  cardUnit: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e3a5f",
    flex: 1,
  },
  cardDuration: {
    fontSize: 12,
    color: "#6c757d",
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f3f5",
  },
  cardStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardStatText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#495057",
  },
  cardStatDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#dee2e6",
    marginHorizontal: 10,
  },
  cardArrow: {
    marginLeft: "auto",
  },

  // ── Loading / Empty ──
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#495057",
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    color: "#adb5bd",
    textAlign: "center",
    lineHeight: 20,
  },
});