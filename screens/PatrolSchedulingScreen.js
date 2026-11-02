// screens/PatrolSchedulingScreen.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Modal,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  C,
  ScreenHeader,
  HeaderButton,
  StatusPill,
  Chip,
  EmptyState,
  parseLocalDate,
  formatDate,
  getPatrolStatus,
  STATUS_ORDER,
  STATUS_META,
} from "./components/PatrolUI";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
const getToken = async () => AsyncStorage.getItem("auth_token");
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (iso) => (iso ? new Date(iso + "T00:00:00") : new Date());
const fmtISODate = (d) =>
  d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";

// ── Date picker button (Android calendar / iOS spinner sheet) ───────────────
const DatePickerBtn = React.memo(function DatePickerBtn({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}) {
  const [show, setShow] = useState(false);
  const [temp, setTemp] = useState(new Date());
  const disp = value
    ? (() => {
        const d = isoDate(value);
        return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
      })()
    : "";
  const current = useMemo(() => {
    const base = value ? isoDate(value) : new Date();
    return maximumDate && base > maximumDate ? maximumDate : base;
  }, [value, maximumDate]);

  const trigger = (
    <TouchableOpacity
      style={s.dateBtn}
      activeOpacity={0.8}
      onPress={() => {
        setTemp(current);
        setShow(true);
      }}
    >
      <Ionicons
        name="calendar-outline"
        size={15}
        color={value ? C.navy : C.faint}
      />
      <Text style={[s.dateBtnTxt, !value && { color: C.faint }]}>
        {disp || "Select date"}
      </Text>
    </TouchableOpacity>
  );

  if (Platform.OS === "ios") {
    return (
      <View style={{ flex: 1 }}>
        <Text style={s.lbl}>{label}</Text>
        {trigger}
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={s.iosOv}>
            <View style={s.iosSheet}>
              <View style={s.iosHdr}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={s.iosCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={s.iosTitle}>{label}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(temp);
                    setShow(false);
                  }}
                >
                  <Text style={s.iosDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={temp}
                mode="date"
                display="spinner"
                onChange={(_, d) =>
                  d && setTemp(maximumDate && d > maximumDate ? maximumDate : d)
                }
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={{ height: 180 }}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={s.lbl}>{label}</Text>
      {trigger}
      {show && (
        <DateTimePicker
          value={current}
          mode="date"
          display="calendar"
          onChange={(e, d) => {
            setShow(false);
            if (e.type !== "dismissed" && d) onChange(d);
          }}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
});

// ── Patrol card ─────────────────────────────────────────────────────────────
const PatrolCard = ({ patrol, onPress }) => {
  const status = getPatrolStatus(patrol);
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const patrollers = patrol.patrollers || [];
  const barangays = [
    ...new Set(
      (patrol.routes || [])
        .filter((r) => (r.stop_order || 0) <= 0 && r.barangay)
        .map((r) => r.barangay)
        .filter(Boolean),
    ),
  ];

  return (
    <TouchableOpacity
      style={[s.card, { borderLeftColor: meta.accent }]}
      onPress={() => onPress(patrol)}
      activeOpacity={0.75}
    >
      <View style={s.cardTop}>
        <Text style={s.cardTitle} numberOfLines={1}>
          {patrol.patrol_name}
        </Text>
        <StatusPill status={status} />
      </View>

      <View style={s.infoRow}>
        <View style={s.infoIcon}>
          <Ionicons name="car-sport-outline" size={14} color={C.navy} />
        </View>
        <Text style={s.infoTxt} numberOfLines={1}>
          {patrol.mobile_unit_name || "No unit assigned"}
          {patrol.plate_number ? `  ·  ${patrol.plate_number}` : ""}
        </Text>
      </View>
      <View style={s.infoRow}>
        <View style={s.infoIcon}>
          <Ionicons name="calendar-outline" size={14} color={C.navy} />
        </View>
        <Text style={s.infoTxtMuted}>
          {formatDate(patrol.start_date)} — {formatDate(patrol.end_date)}
        </Text>
      </View>

      <View style={s.cardFoot}>
        <View style={s.stat}>
          <Ionicons name="people" size={13} color={C.navy} />
          <Text style={s.statTxt}>
            {patrollers.length}{" "}
            {patrollers.length === 1 ? "Patroller" : "Patrollers"}
          </Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.stat}>
          <Ionicons name="location" size={13} color="#166534" />
          <Text style={s.statTxt}>
            {barangays.length}{" "}
            {barangays.length === 1 ? "Barangay" : "Barangays"}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={16}
          color="#cbd5e1"
          style={{ marginLeft: "auto" }}
        />
      </View>
    </TouchableOpacity>
  );
};

// ── Screen ──────────────────────────────────────────────────────────────────
export default function PatrolSchedulingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const TAB_H = 55 + Math.max(insets.bottom, 25); // matches the tab bar in App.js

  const [patrols, setPatrols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const todayMax = useMemo(() => new Date(), []);
  const maxFrom = useMemo(
    () => (dateTo ? isoDate(dateTo) : todayMax),
    [dateTo, todayMax],
  );
  const minTo = useMemo(
    () => (dateFrom ? isoDate(dateFrom) : undefined),
    [dateFrom],
  );

  const fetchPatrols = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/patrol/patrols`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPatrols(data.data);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatrols();
  }, []);

  const extraCount =
    (barangayFilter ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const hasQuery = !!search || statusFilter !== "all" || extraCount > 0;
  const resetExtra = () => {
    setBarangayFilter("");
    setDateFrom("");
    setDateTo("");
  };
  const clearAll = () => {
    setSearch("");
    setStatusFilter("all");
    resetExtra();
  };

  const filtered = patrols
    .filter((p) => {
      if (
        search &&
        !(
          (p.patrol_name || "").toLowerCase().includes(search.toLowerCase()) ||
          (p.mobile_unit_name || "")
            .toLowerCase()
            .includes(search.toLowerCase())
        )
      )
        return false;
      if (statusFilter !== "all" && getPatrolStatus(p) !== statusFilter)
        return false;
      if (barangayFilter) {
        const bgs = (p.routes || [])
          .filter((r) => (r.stop_order || 0) <= 0 && r.barangay)
          .map((r) => r.barangay.toLowerCase());
        if (!bgs.some((b) => b.includes(barangayFilter.toLowerCase())))
          return false;
      }
      if (dateFrom && parseLocalDate(p.start_date) < parseLocalDate(dateFrom))
        return false;
      if (dateTo && parseLocalDate(p.end_date) > parseLocalDate(dateTo))
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
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title="Patrol Schedule"
        subtitle={`${counts.all} total · ${counts.active} active · ${counts.upcoming} upcoming`}
        right={
          <HeaderButton icon="sync-outline" onPress={() => fetchPatrols()} />
        }
      />

      <View style={s.body}>
        {/* Search + filter toggle */}
        <View style={s.searchRow}>
          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={17} color={C.faint} />
            <TextInput
              style={s.searchInput}
              placeholder="Search patrol or unit..."
              placeholderTextColor={C.faint}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {!!search && (
              <TouchableOpacity
                onPress={() => setSearch("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={17} color={C.faint} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[s.filterBtn, showFilters && { backgroundColor: C.dark }]}
            onPress={() => setShowFilters((v) => !v)}
            activeOpacity={0.85}
          >
            <Ionicons name="options-outline" size={20} color="#fff" />
            {extraCount > 0 && (
              <View style={s.filterBadge}>
                <Text style={s.filterBadgeTxt}>{extraCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Collapsible filter panel */}
        {showFilters && (
          <View style={s.panel}>
            <Text style={s.lbl}>Barangay</Text>
            <View style={s.panelInput}>
              <Ionicons name="location-outline" size={15} color={C.faint} />
              <TextInput
                style={s.panelInputTxt}
                placeholder="Filter by barangay..."
                placeholderTextColor={C.faint}
                value={barangayFilter}
                onChangeText={setBarangayFilter}
              />
            </View>

            <View style={s.dateRow}>
              <DatePickerBtn
                label="From"
                value={dateFrom}
                onChange={(d) => setDateFrom(fmtISODate(d))}
                maximumDate={maxFrom}
              />
              <Ionicons
                name="arrow-forward"
                size={14}
                color={C.faint}
                style={{ marginTop: 26 }}
              />
              <DatePickerBtn
                label="To"
                value={dateTo}
                onChange={(d) => setDateTo(fmtISODate(d))}
                minimumDate={minTo}
                maximumDate={todayMax}
              />
            </View>

            {extraCount > 0 && (
              <TouchableOpacity style={s.resetLink} onPress={resetExtra}>
                <Ionicons name="refresh" size={13} color="#dc2626" />
                <Text style={s.resetLinkTxt}> Reset filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Status chips */}
        <View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[
              { key: "all", label: "All" },
              { key: "active", label: "Active" },
              { key: "upcoming", label: "Upcoming" },
              { key: "completed", label: "Done" },
            ]}
            keyExtractor={(i) => i.key}
            contentContainerStyle={s.chipRow}
            renderItem={({ item }) => (
              <Chip
                label={item.label}
                count={counts[item.key]}
                active={statusFilter === item.key}
                onPress={() => setStatusFilter(item.key)}
              />
            )}
          />
        </View>

        {/* List */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.navy} />
            <Text style={s.loadTxt}>Loading patrols...</Text>
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
            contentContainerStyle={{
              paddingHorizontal: 14,
              paddingBottom: TAB_H + 24,
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchPatrols(true);
                }}
                tintColor={C.navy}
                colors={[C.navy]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title={hasQuery ? "No patrols found" : "No patrols yet"}
                text={
                  hasQuery
                    ? "Try adjusting your search or filters."
                    : "No patrol assignments have been created yet."
                }
                action={
                  hasQuery ? (
                    <TouchableOpacity style={s.emptyBtn} onPress={clearAll}>
                      <Text style={s.emptyBtnTxt}>Clear search & filters</Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.dark },
  body: { flex: 1, backgroundColor: C.bg },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, padding: 0 },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: C.bg,
    paddingHorizontal: 3,
  },
  filterBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },

  panel: {
    backgroundColor: "#fff",
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  lbl: {
    fontSize: 10.5,
    fontWeight: "800",
    color: C.faint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  panelInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    backgroundColor: "#f8fafc",
    marginBottom: 12,
  },
  panelInputTxt: { flex: 1, fontSize: 13, color: C.text, padding: 0 },
  dateRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
  },
  dateBtnTxt: { fontSize: 13, color: C.text, fontWeight: "600", flex: 1 },
  resetLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 12,
  },
  resetLinkTxt: { color: "#dc2626", fontSize: 12, fontWeight: "800" },

  chipRow: { paddingHorizontal: 14, paddingVertical: 12, gap: 8 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8edf3",
    borderLeftWidth: 4,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: C.dark },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  infoIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "#e8eef6",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: C.navy },
  infoTxtMuted: { flex: 1, fontSize: 12.5, color: C.muted, fontWeight: "500" },
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  stat: { flexDirection: "row", alignItems: "center", gap: 5 },
  statTxt: { fontSize: 11.5, fontWeight: "700", color: "#475569" },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: C.border,
    marginHorizontal: 12,
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadTxt: { fontSize: 13, color: C.muted },
  emptyBtn: {
    marginTop: 14,
    backgroundColor: C.navy,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },

  iosOv: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  iosSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 34,
  },
  iosHdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  iosCancel: { fontSize: 15, color: C.muted, fontWeight: "600" },
  iosTitle: { fontSize: 15, fontWeight: "800", color: C.navy },
  iosDone: { fontSize: 15, color: C.navy, fontWeight: "800" },
});
