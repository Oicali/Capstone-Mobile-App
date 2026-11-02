// screens/PatrollerScheduleScreen.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapboxGL from "@rnmapbox/maps";
import { Asset } from "expo-asset";
import {
  C,
  ScreenHeader,
  HeaderButton,
  StatusPill,
  ShiftPill,
  Segmented,
  Chip,
  SectionLabel,
  EmptyState,
  parseLocalDate,
  toLocalDateStr,
  todayStr,
  generateDateRange,
  formatDate,
  formatDateShort,
  formatTime,
  getPatrolStatus,
  STATUS_ORDER,
  STATUS_META,
} from "./components/PatrolUI";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

const getMyShiftsForPatrol = (patrol, myUserId) => {
  if (!myUserId || !patrol?.patrollers) return [];
  return [
    ...new Set(
      patrol.patrollers
        .filter((p) => String(p.officer_id) === String(myUserId) && p.shift)
        .map((p) => p.shift),
    ),
  ].sort();
};

const getAreaBarangays = (patrol) => [
  ...new Set(
    (patrol?.routes || [])
      .filter((r) => (r.stop_order || 0) <= 0 && r.barangay)
      .map((r) => r.barangay)
      .filter(Boolean),
  ),
];

// ── Map of the area of responsibility ───────────────────────────────────────
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
            fillColor: barangays.includes(f.properties.name_db)
              ? "#1e3a5f"
              : "#e9ecef",
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
      500,
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
            style={{
              fillColor: ["get", "fillColor"],
              fillOpacity: ["get", "fillOpacity"],
            }}
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

// ── Featured (ongoing / upcoming) shift card ────────────────────────────────
const OngoingShiftCard = ({ patrol, geoJSONData, myShifts, isUpcoming }) => {
  const dateRange = generateDateRange(patrol?.start_date, patrol?.end_date);
  const today = todayStr();
  const [activeDate, setActiveDate] = useState(
    dateRange.includes(today) ? today : dateRange[0] || null,
  );
  const [activeShift, setActiveShift] = useState(myShifts[0] || "AM");
  const [showTasks, setShowTasks] = useState(true);

  const barangays = getAreaBarangays(patrol);
  const routesForDateShift = (patrol?.routes || [])
    .filter(
      (r) =>
        toLocalDateStr(r.route_date) === activeDate &&
        r.shift === activeShift &&
        (r.stop_order || 0) > 0,
    )
    .sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0));

  return (
    <View style={s.featured}>
      {/* Header */}
      <View style={s.featHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.featName} numberOfLines={1}>
            {patrol.patrol_name}
          </Text>
          <View style={s.featMeta}>
            <Ionicons
              name="calendar-outline"
              size={12}
              color="rgba(255,255,255,0.7)"
            />
            <Text style={s.featMetaTxt}>
              {formatDate(patrol.start_date)} — {formatDate(patrol.end_date)}
            </Text>
          </View>
          <View style={s.featMeta}>
            <Ionicons
              name="car-sport-outline"
              size={12}
              color="rgba(255,255,255,0.7)"
            />
            <Text style={s.featMetaTxt}>
              {patrol.mobile_unit_name || "No unit"}
            </Text>
            {myShifts.map((sh) => (
              <ShiftPill key={sh} shift={sh} />
            ))}
          </View>
        </View>
        <View
          style={[
            s.livePill,
            isUpcoming && { backgroundColor: "rgba(245,158,11,0.2)" },
          ]}
        >
          <View
            style={[s.liveDot, isUpcoming && { backgroundColor: "#f59e0b" }]}
          />
          <Text style={[s.liveTxt, isUpcoming && { color: "#fcd34d" }]}>
            {isUpcoming ? "UPCOMING" : "LIVE"}
          </Text>
        </View>
      </View>

      {/* Map */}
      <View style={s.featMap}>
        <OngoingMap geoJSONData={geoJSONData} barangays={barangays} />
        {barangays.length === 0 && (
          <View style={s.noArea}>
            <Text style={s.noAreaTxt}>No area of responsibility set</Text>
          </View>
        )}
        {barangays.length > 0 && (
          <View style={s.areaBadge}>
            <Ionicons name="location" size={12} color={C.navy} />
            <Text style={s.areaBadgeTxt}>
              {barangays.length}{" "}
              {barangays.length === 1 ? "barangay" : "barangays"}
            </Text>
          </View>
        )}
      </View>

      {/* Schedule */}
      <View style={s.schedule}>
        {dateRange.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dateChips}
          >
            {dateRange.map((d) => (
              <TouchableOpacity
                key={d}
                style={[s.dateChip, activeDate === d && s.dateChipOn]}
                onPress={() => setActiveDate(d)}
                activeOpacity={0.8}
              >
                <Text
                  style={[s.dateChipTxt, activeDate === d && { color: "#fff" }]}
                >
                  {formatDateShort(d)}
                </Text>
                {d === today && (
                  <View
                    style={[
                      s.todayDot,
                      activeDate === d && { backgroundColor: "#fff" },
                    ]}
                  />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {myShifts.length > 1 && (
          <View style={{ paddingHorizontal: 14, marginBottom: 6 }}>
            <Segmented
              variant="light"
              value={activeShift}
              onChange={setActiveShift}
              items={myShifts.map((sh) => ({
                key: sh,
                label: `${sh} Shift`,
                icon: sh === "AM" ? "sunny" : "moon",
              }))}
            />
          </View>
        )}

        <TouchableOpacity
          style={s.taskToggle}
          onPress={() => setShowTasks((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={s.taskToggleLbl}>
            {activeShift} SHIFT · {formatDateShort(activeDate)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={s.taskToggleTxt}>
              {showTasks
                ? "Hide tasks"
                : `Show tasks${routesForDateShift.length ? ` (${routesForDateShift.length})` : ""}`}
            </Text>
            <Ionicons
              name={showTasks ? "chevron-up" : "chevron-down"}
              size={13}
              color={C.navy}
            />
          </View>
        </TouchableOpacity>

        {showTasks &&
          (routesForDateShift.length === 0 ? (
            <Text style={s.emptyNote}>No tasks scheduled for this shift.</Text>
          ) : (
            routesForDateShift.map((r, i) => (
              <View key={r.route_id} style={s.taskRow}>
                <View style={s.taskTime}>
                  <Text style={s.timeMain}>{formatTime(r.time_start)}</Text>
                  <View style={s.rail} />
                  <Text style={s.timeSub}>{formatTime(r.time_end)}</Text>
                </View>
                <View
                  style={[
                    s.taskBody,
                    i === routesForDateShift.length - 1 && { marginBottom: 4 },
                  ]}
                >
                  <Text style={s.taskTxt}>
                    {r.notes || <Text style={s.noTask}>No task set</Text>}
                  </Text>
                </View>
              </View>
            ))
          ))}
      </View>
    </View>
  );
};

// ── Patrol list card ────────────────────────────────────────────────────────
const PatrolCard = ({ patrol, myUserId, onPress }) => {
  const status = getPatrolStatus(patrol);
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const myShifts = getMyShiftsForPatrol(patrol, myUserId);
  const barangays = getAreaBarangays(patrol);

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
          {patrol.mobile_unit_name || "No unit"}
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
        {myShifts.length > 0 && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={s.myShiftLbl}>My shift</Text>
            {myShifts.map((sh) => (
              <ShiftPill key={sh} shift={sh} />
            ))}
          </View>
        )}
        <View style={[s.stat, myShifts.length > 0 && { marginLeft: 12 }]}>
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
export default function PatrollerScheduleScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const TAB_H = 55 + Math.max(insets.bottom, 25);

  const [patrols, setPatrols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [geoJSONData, setGeoJSONData] = useState(null);
  const [myUserId, setMyUserId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("auth_user");
        if (raw) setMyUserId(JSON.parse(raw)?.user_id ?? null);
      } catch {}
      try {
        const asset = Asset.fromModule(
          require("../assets/bacoor_barangays.geojson"),
        );
        await asset.downloadAsync();
        setGeoJSONData(await (await fetch(asset.localUri)).json());
      } catch (err) {
        console.warn("GeoJSON load failed:", err);
      }
    })();
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
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPatrols();
  }, []);

  const ongoingPatrol = patrols.find((p) => getPatrolStatus(p) === "active");
  const upcomingPatrol = !ongoingPatrol
    ? patrols
        .filter((p) => getPatrolStatus(p) === "upcoming")
        .sort(
          (a, b) => parseLocalDate(a.start_date) - parseLocalDate(b.start_date),
        )[0] || null
    : null;
  const featuredPatrol = ongoingPatrol || upcomingPatrol;
  const isUpcoming = !ongoingPatrol && !!upcomingPatrol;
  const myShifts = featuredPatrol
    ? getMyShiftsForPatrol(featuredPatrol, myUserId)
    : [];

  const sortedPatrols = [...patrols].sort((a, b) => {
    const sa = STATUS_ORDER[getPatrolStatus(a)] ?? 3;
    const sb = STATUS_ORDER[getPatrolStatus(b)] ?? 3;
    if (sa !== sb) return sa - sb;
    return new Date(b.start_date) - new Date(a.start_date);
  });
  const filteredPatrols =
    statusFilter === "all"
      ? sortedPatrols
      : sortedPatrols.filter((p) => getPatrolStatus(p) === statusFilter);

  const counts = {
    all: patrols.length,
    active: patrols.filter((p) => getPatrolStatus(p) === "active").length,
    upcoming: patrols.filter((p) => getPatrolStatus(p) === "upcoming").length,
    completed: patrols.filter((p) => getPatrolStatus(p) === "completed").length,
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title="Patrol Assignment"
        subtitle="Your patrol schedule"
        right={
          <HeaderButton icon="refresh-outline" onPress={() => fetchPatrols()} />
        }
      />

      <View style={s.body}>
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={C.navy} />
            <Text style={s.loadTxt}>Loading patrols...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 14, paddingBottom: TAB_H + 24 }}
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
          >
            <SectionLabel
              title={
                ongoingPatrol
                  ? "Ongoing shift"
                  : upcomingPatrol
                    ? "Upcoming shift"
                    : "Ongoing shift"
              }
            />

            {featuredPatrol && geoJSONData ? (
              <OngoingShiftCard
                key={featuredPatrol.patrol_id}
                patrol={featuredPatrol}
                geoJSONData={geoJSONData}
                myShifts={myShifts.length > 0 ? myShifts : ["AM"]}
                isUpcoming={isUpcoming}
              />
            ) : featuredPatrol ? (
              <View style={s.featured}>
                <View style={s.featHead}>
                  <Text style={s.featName}>{featuredPatrol.patrol_name}</Text>
                </View>
                <View style={s.mapLoading}>
                  <ActivityIndicator size="small" color={C.navy} />
                  <Text style={s.loadTxt}>Loading map...</Text>
                </View>
              </View>
            ) : (
              <View style={s.noOngoing}>
                <View style={s.noOngoingIcon}>
                  <Ionicons name="shield-outline" size={26} color={C.faint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.noOngoingTitle}>
                    No active or upcoming patrol
                  </Text>
                  <Text style={s.noOngoingSub}>
                    You have no patrol assignment scheduled.
                  </Text>
                </View>
              </View>
            )}

            <View style={{ height: 14 }} />
            <SectionLabel title="My patrols" count={filteredPatrols.length} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.chipRow}
            >
              {[
                { key: "all", label: "All" },
                { key: "active", label: "Active" },
                { key: "upcoming", label: "Upcoming" },
                { key: "completed", label: "Done" },
              ].map(({ key, label }) => (
                <Chip
                  key={key}
                  label={label}
                  count={counts[key]}
                  active={statusFilter === key}
                  onPress={() => setStatusFilter(key)}
                />
              ))}
            </ScrollView>

            {filteredPatrols.length === 0 ? (
              <EmptyState
                title="No patrols found"
                text={
                  statusFilter === "all"
                    ? "You have no patrol assignments yet."
                    : `No ${statusFilter} patrols found.`
                }
              />
            ) : (
              filteredPatrols.map((patrol) => (
                <PatrolCard
                  key={String(patrol.patrol_id)}
                  patrol={patrol}
                  myUserId={myUserId}
                  onPress={(p) =>
                    navigation.navigate("PatrolDetail", {
                      patrol: p,
                      myUserId,
                      isAdmin: false,
                    })
                  }
                />
              ))
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.dark },
  body: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadTxt: { fontSize: 13, color: C.muted },

  // featured card
  featured: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e8edf3",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  featHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: C.navy,
    padding: 14,
  },
  featName: { fontSize: 17, fontWeight: "800", color: "#fff", marginBottom: 6 },
  featMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  featMetaTxt: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(34,197,94,0.2)",
    marginLeft: 8,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22c55e" },
  liveTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: "#86efac",
    letterSpacing: 1,
  },
  featMap: { height: 210, position: "relative" },
  noArea: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  noAreaTxt: { fontSize: 12, color: C.muted, fontStyle: "italic" },
  areaBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  areaBadgeTxt: { fontSize: 11, fontWeight: "800", color: C.navy },
  mapLoading: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  schedule: { paddingVertical: 10 },
  dateChips: { paddingHorizontal: 14, gap: 6, paddingBottom: 10 },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: C.border,
  },
  dateChipOn: { backgroundColor: C.navy, borderColor: C.navy },
  dateChipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.red },
  taskToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  taskToggleLbl: {
    fontSize: 10.5,
    fontWeight: "800",
    color: C.faint,
    letterSpacing: 1,
  },
  taskToggleTxt: { fontSize: 11.5, fontWeight: "800", color: C.navy },
  emptyNote: {
    fontSize: 13,
    color: C.faint,
    fontStyle: "italic",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  taskRow: { flexDirection: "row", paddingHorizontal: 14, gap: 12 },
  taskTime: { alignItems: "center", width: 48 },
  timeMain: { fontSize: 12, fontWeight: "800", color: C.navy },
  timeSub: { fontSize: 11, fontWeight: "700", color: C.faint },
  rail: {
    width: 2,
    flex: 1,
    minHeight: 10,
    backgroundColor: "#dbe3ee",
    marginVertical: 3,
    borderRadius: 1,
  },
  taskBody: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eef2f6",
    padding: 12,
    marginBottom: 8,
  },
  taskTxt: { fontSize: 13, color: C.text, lineHeight: 19 },
  noTask: { fontStyle: "italic", color: C.faint },

  noOngoing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  noOngoingIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#eef2f6",
    alignItems: "center",
    justifyContent: "center",
  },
  noOngoingTitle: { fontSize: 14.5, fontWeight: "800", color: "#475569" },
  noOngoingSub: { fontSize: 12, color: C.faint, marginTop: 2 },

  chipRow: { gap: 8, paddingBottom: 12 },

  // patrol card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8edf3",
    borderLeftWidth: 4,
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
  myShiftLbl: { fontSize: 11, color: C.muted, fontWeight: "600" },
  stat: { flexDirection: "row", alignItems: "center", gap: 5 },
  statTxt: { fontSize: 11.5, fontWeight: "700", color: "#475569" },
});
