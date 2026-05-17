// screens/PatrollerScheduleScreen.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, StatusBar, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapboxGL from "@rnmapbox/maps";
import { Asset } from "expo-asset";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const API_BASE = process.env.EXPO_PUBLIC_API_URL;

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

// ── Date helpers ──────────────────────────────────────────────────────────────
const parseLocalDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const toLocalDateStr = (d) => {
  const dt = parseLocalDate(d);
  if (!dt) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

const todayStr = () => toLocalDateStr(new Date());

const generateDateRange = (start, end) => {
  if (!start || !end) return [];
  const dates = [];
  const cur = parseLocalDate(start);
  const last = parseLocalDate(end);
  if (!cur || !last) return [];
  while (cur <= last) {
    dates.push(toLocalDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

const formatDate = (d) => {
  const dt = parseLocalDate(d);
  return dt
    ? dt.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
    : "—";
};

const formatTabDate = (d) => {
  const dt = parseLocalDate(d);
  return dt ? dt.toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : "—";
};

const formatTime = (t) => (t ? t.substring(0, 5) : "—");

const getPatrolStatus = (patrol) => {
  const t = parseLocalDate(new Date());
  const start = parseLocalDate(patrol.start_date);
  const end = parseLocalDate(patrol.end_date);
  if (!start || !end) return "unknown";
  if (t < start) return "upcoming";
  if (t > end) return "completed";
  return "active";
};

const STATUS_ORDER = { active: 0, upcoming: 1, completed: 2, unknown: 3 };

const STATUS_CONFIG = {
  active:    { label: "Active",    bg: "#dcfce7", color: "#166534", border: "#86efac" },
  upcoming:  { label: "Upcoming",  bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  completed: { label: "Completed", bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  unknown:   { label: "Unknown",   bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
};

const getMyShiftsForPatrol = (patrol, myUserId) => {
  if (!myUserId || !patrol?.patrollers) return [];
  return [...new Set(
    patrol.patrollers
      .filter((p) => String(p.officer_id) === String(myUserId) && p.shift)
      .map((p) => p.shift)
  )].sort();
};

// ── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  return (
    <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

// ── Shift Pill ────────────────────────────────────────────────────────────────
const ShiftPill = ({ shift }) => {
  if (!shift) return null;
  const isAM = shift === "AM";
  return (
    <View style={[styles.shiftPill, isAM ? styles.shiftAM : styles.shiftPM]}>
      <Text style={[styles.shiftPillText, isAM ? styles.shiftAMText : styles.shiftPMText]}>
        {shift}
      </Text>
    </View>
  );
};

// ── Filter Pill ───────────────────────────────────────────────────────────────
const FilterPill = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.pill, active && styles.pillActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
  </TouchableOpacity>
);

// ── Ongoing Shift Map ─────────────────────────────────────────────────────────
const OngoingMap = ({ geoJSONData, barangays }) => {
  const cameraRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  const coloredGeo = geoJSONData
    ? {
        ...geoJSONData,
        features: geoJSONData.features.map((f) => ({
          ...f,
          properties: {
            ...f.properties,
            fillColor: barangays.includes(f.properties.name_db) ? "#1e3a5f" : "#e9ecef",
            fillOpacity: barangays.includes(f.properties.name_db) ? 0.55 : 0.25,
          },
        })),
      }
    : null;

  useEffect(() => {
    if (!mapReady || !geoJSONData || barangays.length === 0) return;
    const coords = [];
    for (const f of geoJSONData.features) {
      if (barangays.includes(f.properties.name_db)) {
        const rings =
          f.geometry.type === "Polygon"
            ? [f.geometry.coordinates[0]]
            : f.geometry.coordinates.map((p) => p[0]);
        for (const ring of rings) coords.push(...ring);
      }
    }
    if (coords.length === 0) return;
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    cameraRef.current?.fitBounds(
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
      [40, 40, 40, 40],
      500
    );
  }, [mapReady, geoJSONData, barangays]);

  return (
    <MapboxGL.MapView
      style={StyleSheet.absoluteFillObject}
      styleURL="mapbox://styles/mapbox/light-v11"
      onDidFinishLoadingMap={() => setMapReady(true)}
      zoomEnabled
      scrollEnabled
      rotateEnabled={false}
      pitchEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
    >
      <MapboxGL.Camera
        ref={cameraRef}
        centerCoordinate={[120.964, 14.4341]}
        zoomLevel={11.5}
        animationDuration={0}
      />
      {coloredGeo && (
        <MapboxGL.ShapeSource id="pss-barangays" shape={coloredGeo}>
          <MapboxGL.FillLayer
            id="pss-fill"
            style={{ fillColor: ["get", "fillColor"], fillOpacity: ["get", "fillOpacity"] }}
          />
          <MapboxGL.LineLayer
            id="pss-outline"
            style={{ lineColor: "#1e3a5f", lineWidth: 1.5, lineOpacity: 0.7 }}
          />
          <MapboxGL.SymbolLayer
            id="pss-labels"
            style={{
              textField: ["get", "name_db"],
              textSize: 9,
              textColor: "#1e3a5f",
              textHaloColor: "rgba(255,255,255,0.85)",
              textHaloWidth: 1.5,
              textAllowOverlap: false,
            }}
          />
        </MapboxGL.ShapeSource>
      )}
    </MapboxGL.MapView>
  );
};

// ── Ongoing Shift Card ────────────────────────────────────────────────────────
const OngoingShiftCard = ({ patrol, geoJSONData, myShifts }) => {
  const dateRange = generateDateRange(patrol?.start_date, patrol?.end_date);
  const today = todayStr();
  const [activeDate, setActiveDate] = useState(
    dateRange.includes(today) ? today : dateRange[0] || null
  );
  const [activeShift, setActiveShift] = useState(myShifts[0] || "AM");

  const barangays = [...new Set(
    (patrol?.routes || [])
      .filter((r) => (r.stop_order || 0) <= 0 && r.barangay)
      .map((r) => r.barangay)
  )];

  const routesForDateShift = (patrol?.routes || [])
    .filter(
      (r) =>
        toLocalDateStr(r.route_date) === activeDate &&
        r.shift === activeShift &&
        (r.stop_order || 0) > 0
    )
    .sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0));

  return (
    <View style={styles.ongoingCard}>
      <View style={styles.ongoingHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ongoingName} numberOfLines={1}>{patrol.patrol_name}</Text>
          <View style={styles.ongoingMeta}>
            <Ionicons name="calendar-outline" size={12} color="#1e3a5f" />
            <Text style={styles.ongoingDates}>
              {formatDate(patrol.start_date)} — {formatDate(patrol.end_date)}
            </Text>
          </View>
          <View style={styles.ongoingMeta}>
            <Ionicons name="car-outline" size={12} color="#6c757d" />
            <Text style={styles.ongoingUnit}>{patrol.mobile_unit_name || "No unit"}</Text>
            {myShifts.map((s) => <ShiftPill key={s} shift={s} />)}
          </View>
        </View>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <View style={styles.ongoingMap}>
        <OngoingMap geoJSONData={geoJSONData} barangays={barangays} />
        {barangays.length === 0 && (
          <View style={styles.noAreaOverlay}>
            <Text style={styles.noAreaText}>No area of responsibility set</Text>
          </View>
        )}
      </View>

      <View style={styles.schedulePanel}>
        {dateRange.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dateTabs}
            contentContainerStyle={styles.dateTabsInner}
          >
            {dateRange.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.dateTab, activeDate === d && styles.dateTabActive]}
                onPress={() => setActiveDate(d)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateTabText, activeDate === d && styles.dateTabTextActive]}>
                  {formatTabDate(d)}
                </Text>
                {d === today && <View style={styles.todayDot} />}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.shiftTabRow}>
          {myShifts.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.shiftTab, activeShift === s && styles.shiftTabActive]}
              onPress={() => setActiveShift(s)}
              activeOpacity={0.7}
            >
              <Text style={[styles.shiftTabText, activeShift === s && styles.shiftTabTextActive]}>
                {s} Shift
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.timetableLabel}>
          <Text style={styles.timetableLabelText}>
            {activeShift} SHIFT — {formatTabDate(activeDate)}
          </Text>
        </View>

        {routesForDateShift.length === 0 ? (
          <Text style={styles.emptyNote}>No tasks scheduled for this shift.</Text>
        ) : (
          routesForDateShift.map((r, i) => (
            <View key={r.route_id} style={[styles.routeRow, i === 0 && { borderTopWidth: 0 }]}>
              <View style={styles.routeTimeCol}>
                <Text style={styles.routeTimeText}>{formatTime(r.time_start)}</Text>
                <View style={styles.routeTimeLine} />
                <Text style={styles.routeTimeText}>{formatTime(r.time_end)}</Text>
              </View>
              <Text style={styles.routeTask}>
                {r.notes || <Text style={styles.routeNoTask}>No task set</Text>}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
};

// ── Patrol Card ───────────────────────────────────────────────────────────────
const PatrolCard = ({ patrol, myUserId, onPress }) => {
  const status = getPatrolStatus(patrol);
  const myShifts = getMyShiftsForPatrol(patrol, myUserId);
  const barangays = [...new Set(
    (patrol.routes || [])
      .filter((r) => (r.stop_order || 0) <= 0 && r.barangay)
      .map((r) => r.barangay)
      .filter(Boolean)
  )];

  return (
    <TouchableOpacity
      style={[styles.patrolCard, status === "active" && styles.patrolCardActive]}
      onPress={() => onPress(patrol)}
      activeOpacity={0.75}
    >
      <View style={styles.patrolCardHeader}>
        <Text style={styles.patrolCardTitle} numberOfLines={1}>{patrol.patrol_name}</Text>
        <StatusBadge status={status} />
      </View>
      <View style={styles.patrolCardRow}>
        <Ionicons name="car-outline" size={13} color="#1e3a5f" />
        <Text style={styles.patrolCardUnit} numberOfLines={1}>
          {patrol.mobile_unit_name || "No unit"}
          {patrol.plate_number ? `  ·  ${patrol.plate_number}` : ""}
        </Text>
      </View>
      <View style={styles.patrolCardRow}>
        <Ionicons name="calendar-outline" size={13} color="#6c757d" />
        <Text style={styles.patrolCardDuration}>
          {formatDate(patrol.start_date)} — {formatDate(patrol.end_date)}
        </Text>
      </View>
      {myShifts.length > 0 && (
        <View style={styles.patrolCardRow}>
          <Ionicons name="time-outline" size={13} color="#6c757d" />
          <Text style={styles.patrolCardLabel}>My shift: </Text>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {myShifts.map((s) => <ShiftPill key={s} shift={s} />)}
          </View>
        </View>
      )}
      <View style={styles.patrolCardFooter}>
        <View style={styles.patrolCardStat}>
          <Ionicons name="location-outline" size={12} color="#166534" />
          <Text style={styles.patrolCardStatText}>
            {barangays.length} {barangays.length === 1 ? "Barangay" : "Barangays"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={15} color="#adb5bd" style={{ marginLeft: "auto" }} />
      </View>
    </TouchableOpacity>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function PatrollerScheduleScreen({ navigation }) {
  const [patrols, setPatrols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [geoJSONData, setGeoJSONData] = useState(null);
  const [myUserId, setMyUserId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // ← filter state

  useEffect(() => {
    const init = async () => {
      try {
        const raw = await AsyncStorage.getItem("auth_user");
        if (raw) {
          const user = JSON.parse(raw);
          setMyUserId(user?.user_id ?? null);
        }
      } catch { /* ignore */ }

      try {
        const asset = Asset.fromModule(require("../assets/bacoor_barangays.geojson"));
        await asset.downloadAsync();
        const data = await (await fetch(asset.localUri)).json();
        setGeoJSONData(data);
      } catch (err) {
        console.warn("GeoJSON load failed:", err);
      }
    };
    init();
  }, []);

  const fetchPatrols = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE}/patrol/my-patrols`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPatrols(data.data);
    } catch (err) {
      console.error("fetchMyPatrols error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchPatrols(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchPatrols(true); };

  const ongoingPatrol = patrols.find((p) => getPatrolStatus(p) === "active");
  const myShifts = ongoingPatrol ? getMyShiftsForPatrol(ongoingPatrol, myUserId) : [];

  // ── Sorted + filtered patrols ─────────────────────────────────────────────
  const sortedPatrols = [...patrols].sort((a, b) => {
    const sa = STATUS_ORDER[getPatrolStatus(a)] ?? 3;
    const sb = STATUS_ORDER[getPatrolStatus(b)] ?? 3;
    if (sa !== sb) return sa - sb;
    return new Date(b.start_date) - new Date(a.start_date);
  });

  const filteredPatrols = statusFilter === "all"
    ? sortedPatrols
    : sortedPatrols.filter((p) => getPatrolStatus(p) === statusFilter);

  // ── Counts for filter pills ───────────────────────────────────────────────
  const counts = {
    all:       patrols.length,
    active:    patrols.filter((p) => getPatrolStatus(p) === "active").length,
    upcoming:  patrols.filter((p) => getPatrolStatus(p) === "upcoming").length,
    completed: patrols.filter((p) => getPatrolStatus(p) === "completed").length,
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a5f" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Patrol Schedule</Text>
          <Text style={styles.headerSub}>Your patrol assignments</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => fetchPatrols()}>
          <Ionicons name="refresh-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1e3a5f" />
          <Text style={styles.loadingText}>Loading patrols...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1e3a5f"
              colors={["#1e3a5f"]}
            />
          }
        >
          {/* ── ONGOING SHIFT ── */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionLabel}>ONGOING SHIFT</Text>
          </View>

          {ongoingPatrol && geoJSONData ? (
            <OngoingShiftCard
              patrol={ongoingPatrol}
              geoJSONData={geoJSONData}
              myShifts={myShifts.length > 0 ? myShifts : ["AM"]}
            />
          ) : ongoingPatrol && !geoJSONData ? (
            <View style={styles.ongoingCard}>
              <View style={styles.ongoingHeader}>
                <Text style={styles.ongoingName}>{ongoingPatrol.patrol_name}</Text>
                <View style={styles.livePill}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>
              <View style={styles.mapLoadingBox}>
                <ActivityIndicator size="small" color="#1e3a5f" />
                <Text style={styles.mapLoadingText}>Loading map...</Text>
              </View>
            </View>
          ) : (
            <View style={styles.noOngoingCard}>
              <Ionicons name="shield-outline" size={36} color="#dee2e6" />
              <View>
                <Text style={styles.noOngoingTitle}>No active patrol today</Text>
                <Text style={styles.noOngoingSub}>
                  You have no patrol assignment for today's date.
                </Text>
              </View>
            </View>
          )}

          {/* ── MY PATROLS ── */}
          <View style={[styles.sectionHeader, { marginTop: 8 }]}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionLabel}>MY PATROLS</Text>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{filteredPatrols.length}</Text>
            </View>
          </View>

          {/* ── Filter Pills ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
          >
            {[
              { key: "all",       label: `All (${counts.all})` },
              { key: "active",    label: `Active (${counts.active})` },
              { key: "upcoming",  label: `Upcoming (${counts.upcoming})` },
              { key: "completed", label: `Done (${counts.completed})` },
            ].map(({ key, label }) => (
              <FilterPill
                key={key}
                label={label}
                active={statusFilter === key}
                onPress={() => setStatusFilter(key)}
              />
            ))}
          </ScrollView>

          {/* ── Patrols List ── */}
          {filteredPatrols.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="shield-outline" size={48} color="#dee2e6" />
              <Text style={styles.emptyTitle}>No Patrols Found</Text>
              <Text style={styles.emptyText}>
                {statusFilter === "all"
                  ? "You have no patrol assignments yet."
                  : `No ${statusFilter} patrols found.`}
              </Text>
            </View>
          ) : (
            filteredPatrols.map((patrol) => (
              <PatrolCard
                key={String(patrol.patrol_id)}
                patrol={patrol}
                myUserId={myUserId}
               onPress={(p) => navigation.navigate("PatrolDetail", { patrol: p, myUserId, isAdmin: false })}
              />
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e3a5f",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#ffffff", letterSpacing: 0.3 },
  headerSub: { fontSize: 12, color: "#93afc9", marginTop: 2, fontWeight: "500" },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#6c757d", fontWeight: "500" },
  scrollBody: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6,
  },
  sectionAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: "#c1272d" },
  sectionLabel: {
    fontSize: 12, fontWeight: "800", color: "#1e3a5f",
    letterSpacing: 1.2, textTransform: "uppercase", flex: 1,
  },
  sectionBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: "#1e3a5f",
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6,
  },
  sectionBadgeText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },

  // Filter pills
  pillRow: {
    flexDirection: "row", gap: 6,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: "#ffffff",
    borderWidth: 1, borderColor: "#dee2e6",
  },
  pillActive: { backgroundColor: "#1e3a5f", borderColor: "#1e3a5f" },
  pillText: { fontSize: 11, fontWeight: "600", color: "#6c757d" },
  pillTextActive: { color: "#ffffff" },

  // Ongoing card
  ongoingCard: {
    backgroundColor: "#ffffff", borderRadius: 12,
    borderWidth: 1, borderColor: "#dee2e6",
    overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, marginBottom: 4,
  },
  ongoingHeader: {
    flexDirection: "row", alignItems: "flex-start",
    justifyContent: "space-between", padding: 16,
    borderBottomWidth: 1, borderBottomColor: "#f1f3f5",
    backgroundColor: "rgba(30,58,95,0.03)",
  },
  ongoingName: {
    fontSize: 17, fontWeight: "800", color: "#1e3a5f",
    letterSpacing: -0.3, marginBottom: 6, flex: 1,
  },
  ongoingMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  ongoingDates: { fontSize: 12, fontWeight: "600", color: "#1e3a5f" },
  ongoingUnit: { fontSize: 12, color: "#6c757d", fontWeight: "500", flex: 1 },

  livePill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    backgroundColor: "rgba(22,163,74,0.1)",
    borderWidth: 1, borderColor: "#86efac",
    flexShrink: 0, marginLeft: 8,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#16a34a" },
  liveText: { fontSize: 10, fontWeight: "800", color: "#16a34a", letterSpacing: 1 },

  ongoingMap: {
    height: 220, position: "relative",
    borderBottomWidth: 1, borderBottomColor: "#dee2e6",
  },
  noAreaOverlay: {
    position: "absolute", bottom: 10, left: 10, right: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8, padding: 10, alignItems: "center",
  },
  noAreaText: { fontSize: 12, color: "#6c757d", fontStyle: "italic" },
  mapLoadingBox: {
    height: 180, alignItems: "center", justifyContent: "center",
    gap: 10, backgroundColor: "#f8f9fa",
  },
  mapLoadingText: { fontSize: 13, color: "#6c757d" },

  schedulePanel: { paddingBottom: 4 },
  dateTabs: {
    borderBottomWidth: 1, borderBottomColor: "#dee2e6", backgroundColor: "#f8f9fa",
  },
  dateTabsInner: { flexDirection: "row", paddingHorizontal: 12, gap: 2 },
  dateTab: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  dateTabActive: { borderBottomColor: "#1e3a5f" },
  dateTabText: { fontSize: 12, fontWeight: "500", color: "#6c757d" },
  dateTabTextActive: { color: "#1e3a5f", fontWeight: "700" },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#c1272d" },

  shiftTabRow: {
    flexDirection: "row", borderBottomWidth: 1,
    borderBottomColor: "#dee2e6", paddingHorizontal: 16,
  },
  shiftTab: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -1,
  },
  shiftTabActive: { borderBottomColor: "#1e3a5f" },
  shiftTabText: { fontSize: 13, fontWeight: "600", color: "#6c757d" },
  shiftTabTextActive: { color: "#1e3a5f" },

  timetableLabel: {
    paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: "#f8f9fa",
    borderBottomWidth: 1, borderBottomColor: "#f1f3f5",
  },
  timetableLabelText: {
    fontSize: 10, fontWeight: "800", color: "#adb5bd",
    textTransform: "uppercase", letterSpacing: 1,
  },
  routeRow: {
    flexDirection: "row", paddingHorizontal: 16, paddingVertical: 11,
    borderTopWidth: 1, borderTopColor: "#f1f3f5", gap: 12,
  },
  routeTimeCol: { alignItems: "center", width: 55, flexShrink: 0 },
  routeTimeText: { fontSize: 11, fontWeight: "700", color: "#1e3a5f" },
  routeTimeLine: {
    width: 1, flex: 1, minHeight: 8, backgroundColor: "#dee2e6", marginVertical: 3,
  },
  routeTask: { fontSize: 13, color: "#212529", lineHeight: 19, flex: 1 },
  routeNoTask: { fontStyle: "italic", color: "#adb5bd" },
  emptyNote: {
    fontSize: 13, color: "#adb5bd", fontStyle: "italic",
    paddingHorizontal: 16, paddingVertical: 14,
  },

  noOngoingCard: {
    backgroundColor: "#ffffff", borderRadius: 12,
    borderWidth: 1, borderColor: "#dee2e6",
    padding: 28, flexDirection: "row", alignItems: "center", gap: 18, marginBottom: 4,
  },
  noOngoingTitle: { fontSize: 15, fontWeight: "700", color: "#495057", marginBottom: 4 },
  noOngoingSub: { fontSize: 13, color: "#adb5bd" },

  patrolCard: {
    backgroundColor: "#ffffff", borderRadius: 12, padding: 15, marginBottom: 10,
    borderWidth: 1, borderColor: "#dee2e6",
    borderLeftWidth: 4, borderLeftColor: "#dee2e6",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  patrolCardActive: { borderLeftColor: "#22c55e" },
  patrolCardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 9, gap: 8,
  },
  patrolCardTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1e3a5f" },
  patrolCardRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 5 },
  patrolCardUnit: { fontSize: 13, fontWeight: "600", color: "#1e3a5f", flex: 1 },
  patrolCardDuration: { fontSize: 12, color: "#6c757d", fontWeight: "500" },
  patrolCardLabel: { fontSize: 12, color: "#6c757d" },
  patrolCardFooter: {
    flexDirection: "row", alignItems: "center",
    marginTop: 9, paddingTop: 9,
    borderTopWidth: 1, borderTopColor: "#f1f3f5",
  },
  patrolCardStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  patrolCardStatText: { fontSize: 11, fontWeight: "600", color: "#495057" },

  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },

  shiftPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, flexShrink: 0 },
  shiftAM: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fcd34d" },
  shiftPM: { backgroundColor: "#e0e7f0", borderWidth: 1, borderColor: "#93afc9" },
  shiftPillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  shiftAMText: { color: "#92400e" },
  shiftPMText: { color: "#1e3a5f" },

  emptyWrap: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 40, paddingVertical: 50, gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#495057", marginTop: 4 },
  emptyText: { fontSize: 13, color: "#adb5bd", textAlign: "center", lineHeight: 20 },
});