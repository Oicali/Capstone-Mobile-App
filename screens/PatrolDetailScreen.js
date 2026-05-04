// screens/PatrolDetailScreen.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Platform,
  Image,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapboxGL from "@rnmapbox/maps";
import { Asset } from 'expo-asset';

const { width: SCREEN_WIDTH } = Dimensions.get("window");

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

// ── Date / Format helpers ─────────────────────────────────────────
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

const formatTabDate = (d) => {
  const dt = parseLocalDate(d);
  return dt
    ? dt.toLocaleDateString("en-PH", { month: "short", day: "numeric" })
    : "—";
};

const formatFullDate = (d) => {
  const dt = parseLocalDate(d);
  return dt
    ? dt.toLocaleDateString("en-PH", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";
};

const formatDate = (d) => {
  const dt = parseLocalDate(d);
  return dt
    ? dt.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
};

const formatTime = (t) => (t ? t.substring(0, 5) : "—");

// ── Section Header ────────────────────────────────────────────────
const SectionHeader = ({ title, badge }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {badge != null && (
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{badge}</Text>
      </View>
    )}
  </View>
);

// ── Shift Tab Button ──────────────────────────────────────────────
const ShiftTab = ({ label, active, count, onPress }) => (
  <TouchableOpacity
    style={[styles.shiftTab, active && styles.shiftTabActive]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.shiftTabText, active && styles.shiftTabTextActive]}>
      {label}
    </Text>
    {count > 0 && (
      <View style={[styles.shiftBadge, active && styles.shiftBadgeActive]}>
        <Text style={[styles.shiftBadgeText, active && styles.shiftBadgeTextActive]}>
          {count}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

// ── Patroller Row ─────────────────────────────────────────────────
const PatrollerRow = ({ patroller, index }) => {
  const initials = (patroller.officer_name || "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "??";

  return (
    <View style={[styles.patrollerRow, index === 0 && { borderTopWidth: 0 }]}>
      {patroller.profile_picture ? (
        <Image
          source={{ uri: patroller.profile_picture }}
          style={styles.avatar}
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      )}
      <View style={styles.patrollerInfo}>
        <Text style={styles.patrollerName} numberOfLines={1}>
          {patroller.officer_name}
        </Text>
        {patroller.contact_number ? (
          <Text style={styles.patrollerContact}>{patroller.contact_number}</Text>
        ) : null}
      </View>
      <View style={[styles.shiftPill, patroller.shift === "AM" ? styles.shiftAM : styles.shiftPM]}>
        <Text style={[styles.shiftPillText, patroller.shift === "AM" ? styles.shiftAMText : styles.shiftPMText]}>
          {patroller.shift}
        </Text>
      </View>
    </View>
  );
};

// ── Route Row ─────────────────────────────────────────────────────
const RouteRow = ({ route, index }) => (
  <View style={[styles.routeRow, index === 0 && { borderTopWidth: 0 }]}>
    <View style={styles.routeTimeCol}>
      <Text style={styles.routeTimeStart}>{formatTime(route.time_start)}</Text>
      <View style={styles.routeTimeLine} />
      <Text style={styles.routeTimeEnd}>{formatTime(route.time_end)}</Text>
    </View>
    <View style={styles.routeContent}>
      <Text style={styles.routeTask}>
        {route.notes || <Text style={styles.routeNoTask}>No task set</Text>}
      </Text>
    </View>
  </View>
);

// ── Barangay Chip ─────────────────────────────────────────────────
const BarangayChip = ({ name }) => (
  <View style={styles.brgyChip}>
    <Ionicons name="location" size={10} color="#166534" />
    <Text style={styles.brgyChipText}>{name}</Text>
  </View>
);

// ── Map Section ───────────────────────────────────────────────────
const PatrolMap = ({ geoJSONData, barangays }) => {
  const cameraRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);


  const coloredGeoJSON = useCallback(() => {
    if (!geoJSONData) return null;
    return {
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
    };
  }, [geoJSONData, barangays]);

  // Fit to highlighted barangays once map is ready
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
      [60, 60, 60, 60],
      500
    );
  }, [mapReady, geoJSONData, barangays]);

  const geo = coloredGeoJSON();

  return (
    <View style={styles.mapContainer}>
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
        {geo && (
          <MapboxGL.ShapeSource id="barangays" shape={geo}>
            <MapboxGL.FillLayer
              id="brgy-fill"
              style={{
                fillColor: ["get", "fillColor"],
                fillOpacity: ["get", "fillOpacity"],
              }}
            />
            <MapboxGL.LineLayer
              id="brgy-outline"
              style={{
                lineColor: "#1e3a5f",
                lineWidth: 1.5,
                lineOpacity: 0.7,
              }}
            />
            <MapboxGL.SymbolLayer
              id="brgy-labels"
              style={{
                textField: ["get", "name_db"],
                textSize: 10,
                textColor: "#0a1628",
                textHaloColor: "rgba(255,255,255,0.85)",
                textHaloWidth: 1.5,
                textAllowOverlap: false,
              }}
            />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      {barangays.length === 0 && (
        <View style={styles.mapNoArea}>
          <Text style={styles.mapNoAreaText}>No area of responsibility set</Text>
        </View>
      )}
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────
export default function PatrolDetailScreen({ route, navigation }) {
 const { patrol, myUserId, isAdmin } = route.params;

const dateRange = generateDateRange(patrol?.start_date, patrol?.end_date);

const myShifts = isAdmin
  ? ["AM", "PM"]
  : myUserId
    ? [...new Set(
        (patrol?.patrollers || [])
          .filter((p) => String(p.officer_id) === String(myUserId) && p.shift)
          .map((p) => p.shift)
      )].sort()
    : ["AM", "PM"];

// Only these — no duplicates below
const [activeDate, setActiveDate] = useState(dateRange[0] || null);
const [activeShift, setActiveShift] = useState(myShifts[0] || "AM");
const [geoJSONData, setGeoJSONData] = useState(null);
const [geoLoading, setGeoLoading] = useState(true);
const [activeTab, setActiveTab] = useState("schedule");
  const [toastMsg, setToastMsg] = useState(null);

useEffect(() => {
  const loadGeo = async () => {
    try {
      const asset = Asset.fromModule(require('../assets/bacoor_barangays.geojson'));
      await asset.downloadAsync();
      const data = await (await fetch(asset.localUri)).json();
      setGeoJSONData(data);
    } catch (err) {
      console.warn("GeoJSON load failed:", err);
    } finally {
      setGeoLoading(false);
    }
  };
  loadGeo();
}, []);

  // Derived data
  const barangays = [
    ...new Set(
      (patrol?.routes || [])
        .filter((r) => (r.stop_order || 0) <= 0 && r.barangay)
        .map((r) => r.barangay)
        .filter(Boolean)
    ),
  ];

  const patrollersForDate = (shift) =>
    (patrol?.patrollers_detail || patrol?.patrollers || []).filter(
      (p) =>
        p.shift === shift &&
        (activeDate ? toLocalDateStr(p.route_date) === activeDate : true)
    );

  const amPatrollers = myShifts.includes("AM") ? patrollersForDate("AM") : [];
const pmPatrollers = myShifts.includes("PM") ? patrollersForDate("PM") : [];
const currentPatrollers = activeShift === "AM" ? amPatrollers : pmPatrollers;

  const routesForDateShift = (patrol?.routes || [])
    .filter(
      (r) =>
        toLocalDateStr(r.route_date) === activeDate &&
        r.shift === activeShift &&
        (r.stop_order || 0) > 0
    )
    .sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0));

  // Status
  const today = (() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  })();
  const start = parseLocalDate(patrol?.start_date);
  const end = parseLocalDate(patrol?.end_date);
  const status =
    !start || !end
      ? "unknown"
      : today < start
      ? "upcoming"
      : today > end
      ? "completed"
      : "active";

  const statusLabels = {
    active: { label: "Active", color: "#166534", bg: "#dcfce7" },
    upcoming: { label: "Upcoming", color: "#854d0e", bg: "#fef9c3" },
    completed: { label: "Completed", color: "#475569", bg: "#f1f5f9" },
    unknown: { label: "Unknown", color: "#475569", bg: "#f1f5f9" },
  };
  const statusCfg = statusLabels[status];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1628" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {patrol.patrol_name}
          </Text>
          <Text style={styles.headerSub}>
            {formatDate(patrol.start_date)} — {formatDate(patrol.end_date)}
          </Text>
        </View>
        <View style={[styles.headerStatus, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.headerStatusText, { color: statusCfg.color }]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* ── Unit banner ── */}
      <View style={styles.unitBanner}>
        <Ionicons name="car-outline" size={14} color="#93afc9" />
        <Text style={styles.unitText}>
          {patrol.mobile_unit_name || "No unit"}{patrol.plate_number ? `  ·  ${patrol.plate_number}` : ""}
        </Text>
      </View>

      {/* ── Tab switcher ── */}
      <View style={styles.tabBar}>
        {[
          { key: "schedule", label: "Schedule", icon: "time-outline" },
          { key: "map", label: "Map", icon: "map-outline" },
          { key: "barangays", label: "Areas", icon: "location-outline" },
        ].map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, activeTab === key && styles.tabBtnActive]}
            onPress={() => setActiveTab(key)}
            activeOpacity={0.75}
          >
            <Ionicons
              name={icon}
              size={15}
              color={activeTab === key ? "#1e3a5f" : "#6c757d"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === key && styles.tabBtnTextActive,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ══ SCHEDULE TAB ══════════════════════════════════════════ */}
      {activeTab === "schedule" && (
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Date tabs */}
          {dateRange.length > 1 && (
            <View style={styles.dateTabs}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.dateTabsInner}>
                  {dateRange.map((date) => (
                    <TouchableOpacity
                      key={date}
                      style={[
                        styles.dateTab,
                        activeDate === date && styles.dateTabActive,
                      ]}
                      onPress={() => setActiveDate(date)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dateTabText,
                          activeDate === date && styles.dateTabTextActive,
                        ]}
                      >
                        {formatTabDate(date)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {dateRange.length === 1 && (
            <View style={styles.singleDateBanner}>
              <Ionicons name="calendar" size={13} color="#1e3a5f" />
              <Text style={styles.singleDateText}>
                {formatFullDate(activeDate)}
              </Text>
            </View>
          )}

          {/* Shift tabs */}
        <View style={styles.shiftTabRow}>
  {myShifts.map((s) => {
    const count = s === "AM" ? amPatrollers.length : pmPatrollers.length;
    return (
      <ShiftTab
        key={s}
        label={`${s} Shift`}
        active={activeShift === s}
        count={count}
        onPress={() => setActiveShift(s)}
      />
    );
  })}
</View>
{/* After Report button — Patrol role only */}

{!isAdmin && (
  <>
    <TouchableOpacity
      style={[
        styles.afterReportBtn,
        status === "upcoming" && styles.afterReportBtnDisabled,
      ]}
      activeOpacity={0.8}
      onPress={() => {
        if (status === "upcoming") {
          setToastMsg("Patrol has not started yet. After patrol report is unavailable.");
          setTimeout(() => setToastMsg(null), 3000);
          return;
        }
        navigation.navigate("AfterPatrolReport", {
          patrol,
          myShift: activeShift,
          existingReport: null,
        });
      }}
    >
      <Ionicons name="clipboard-outline" size={16} color="#ffffff" />
      <Text style={styles.afterReportBtnText}>After Patrol Report</Text>
    </TouchableOpacity>

    {toastMsg && (
      <View style={styles.afterReportToast}>
        <Ionicons name="information-circle-outline" size={14} color="#92400e" />
        <Text style={styles.afterReportToastText}>{toastMsg}</Text>
      </View>
    )}
  </>
)}

          {/* Patrollers */}
          <View style={styles.card}>
            <SectionHeader
              title={`${activeShift} Shift Patrollers`}
              badge={currentPatrollers.length || undefined}
            />
            {currentPatrollers.length > 0 ? (
              currentPatrollers.map((p, i) => (
                <PatrollerRow key={`${p.active_patroller_id}-${i}`} patroller={p} index={i} />
              ))
            ) : (
              <Text style={styles.emptyNote}>
                No patrollers assigned to {activeShift} shift
                {activeDate ? ` on ${formatTabDate(activeDate)}` : ""}.
              </Text>
            )}
          </View>

          {/* Timetable */}
          <View style={styles.card}>
            <SectionHeader
              title={`${activeShift} Tasks — ${formatTabDate(activeDate)}`}
              badge={routesForDateShift.length || undefined}
            />
            {routesForDateShift.length > 0 ? (
              routesForDateShift.map((r, i) => (
                <RouteRow key={r.route_id} route={r} index={i} />
              ))
            ) : (
              <Text style={styles.emptyNote}>
                No tasks scheduled for this date and shift.
              </Text>
            )}
          </View>
        </ScrollView>
      )}

      {/* ══ MAP TAB ═══════════════════════════════════════════════ */}
      {activeTab === "map" && (
        <View style={styles.mapTab}>
          {geoLoading ? (
            <View style={styles.mapLoading}>
              <ActivityIndicator size="large" color="#1e3a5f" />
              <Text style={styles.mapLoadingText}>Loading map...</Text>
            </View>
          ) : (
            <PatrolMap geoJSONData={geoJSONData} barangays={barangays} />
          )}
          {/* Map legend */}
          {!geoLoading && barangays.length > 0 && (
            <View style={styles.mapLegend}>
              <View style={styles.mapLegendItem}>
                <View style={[styles.mapLegendDot, { backgroundColor: "#1e3a5f" }]} />
                <Text style={styles.mapLegendText}>Area of Responsibility</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ══ BARANGAYS TAB ═════════════════════════════════════════ */}
      {activeTab === "barangays" && (
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <SectionHeader
              title="Area of Responsibility"
              badge={barangays.length || undefined}
            />
            {barangays.length > 0 ? (
              <View style={styles.brgyList}>
                {barangays.map((b, i) => (
                  <View key={b} style={[styles.brgyRow, i === 0 && { borderTopWidth: 0 }]}>
                    <View style={styles.brgyIndex}>
                      <Text style={styles.brgyIndexText}>{i + 1}</Text>
                    </View>
                    <Ionicons name="location" size={15} color="#c1272d" />
                    <Text style={styles.brgyName}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyNote}>
                No areas of responsibility have been assigned to this patrol.
              </Text>
            )}
          </View>
        </ScrollView>
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
    alignItems: "center",
    backgroundColor: "#0a1628",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 11,
    color: "#93afc9",
    marginTop: 2,
    fontWeight: "500",
  },
  headerStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    flexShrink: 0,
  },
  headerStatusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // ── Unit banner ──
  unitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#122040",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  unitText: {
    fontSize: 12,
    color: "#93afc9",
    fontWeight: "500",
  },

  // ── Tab bar ──
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#dee2e6",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {
    borderBottomColor: "#1e3a5f",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6c757d",
  },
  tabBtnTextActive: {
    color: "#1e3a5f",
    fontWeight: "700",
  },

  // ── Scroll body ──
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    gap: 12,
  },

  // ── Date tabs ──
  dateTabs: {
    marginBottom: 4,
  },
  dateTabsInner: {
    flexDirection: "row",
    gap: 6,
  },
  dateTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  dateTabActive: {
    backgroundColor: "#1e3a5f",
    borderColor: "#1e3a5f",
  },
  dateTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6c757d",
  },
  dateTabTextActive: {
    color: "#ffffff",
  },

  // ── Single date banner ──
  singleDateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e8edf4",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  singleDateText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e3a5f",
  },

  // ── Shift tabs ──
  shiftTabRow: {
    flexDirection: "row",
    gap: 8,
  },
  shiftTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  shiftTabActive: {
    backgroundColor: "#1e3a5f",
    borderColor: "#1e3a5f",
  },
  shiftTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6c757d",
  },
  shiftTabTextActive: {
    color: "#ffffff",
  },
  shiftBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#dee2e6",
    alignItems: "center",
    justifyContent: "center",
  },
  shiftBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  shiftBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#495057",
  },
  shiftBadgeTextActive: {
    color: "#ffffff",
  },

  // ── Card ──
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dee2e6",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  // ── Section header ──
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f3f5",
    backgroundColor: "#f8f9fa",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6c757d",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    flex: 1,
  },
  sectionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1e3a5f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  sectionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#ffffff",
  },

  // ── Patroller row ──
  patrollerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f3f5",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e3a5f",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  patrollerInfo: {
    flex: 1,
    minWidth: 0,
  },
  patrollerName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#212529",
  },
  patrollerContact: {
    fontSize: 11,
    color: "#6c757d",
    marginTop: 1,
  },
  shiftPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    flexShrink: 0,
  },
  shiftAM: {
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  shiftPM: {
    backgroundColor: "#e0e7f0",
    borderWidth: 1,
    borderColor: "#93afc9",
  },
  shiftPillText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  shiftAMText: {
    color: "#92400e",
  },
  shiftPMText: {
    color: "#1e3a5f",
  },

  // ── Route row ──
  routeRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f3f5",
  },
  routeTimeCol: {
    alignItems: "center",
    width: 60,
    flexShrink: 0,
  },
  routeTimeStart: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1e3a5f",
  },
  routeTimeLine: {
    width: 1,
    flex: 1,
    minHeight: 8,
    backgroundColor: "#dee2e6",
    marginVertical: 3,
  },
  routeTimeEnd: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1e3a5f",
  },
  routeContent: {
    flex: 1,
  },
  routeTask: {
    fontSize: 13,
    color: "#212529",
    lineHeight: 19,
  },
  routeNoTask: {
    fontStyle: "italic",
    color: "#adb5bd",
  },

  // ── Empty state ──
  emptyNote: {
    fontSize: 13,
    color: "#adb5bd",
    fontStyle: "italic",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  // ── Map tab ──
  mapTab: {
    flex: 1,
    position: "relative",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  mapLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  mapLoadingText: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "500",
  },
  mapNoArea: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  mapNoAreaText: {
    fontSize: 13,
    color: "#6c757d",
    fontStyle: "italic",
  },
  mapLegend: {
    position: "absolute",
    bottom: 16,
    left: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#dee2e6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  mapLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  mapLegendText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#212529",
  },

  // ── Barangays tab ──
  brgyList: {},
  brgyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f3f5",
  },
  brgyIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e8edf4",
    alignItems: "center",
    justifyContent: "center",
  },
  brgyIndexText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1e3a5f",
  },
  brgyName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#212529",
  },
  brgyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#86efac",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  brgyChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#166534",
  },
 afterReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#c1272d",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  afterReportBtnDisabled: {
    backgroundColor: "#adb5bd",
  },
  afterReportBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  afterReportToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  afterReportToastText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
  },
});