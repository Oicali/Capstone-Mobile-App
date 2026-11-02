// screens/PatrolDetailScreen.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapboxGL from "@rnmapbox/maps";
import { Asset } from "expo-asset";
import {
  C,
  ScreenHeader,
  StatusPill,
  ShiftPill,
  Segmented,
  EmptyState,
  parseLocalDate,
  toLocalDateStr,
  generateDateRange,
  formatDate,
  formatDateShort,
  formatFullDate,
  formatTime,
  getPatrolStatus,
} from "./components/PatrolUI";

MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

// ── Card with title bar ─────────────────────────────────────────────────────
const Block = ({ title, badge, icon, children }) => (
  <View style={s.block}>
    <View style={s.blockHead}>
      {!!icon && (
        <View style={s.blockIcon}>
          <Ionicons name={icon} size={14} color="#fff" />
        </View>
      )}
      <Text style={s.blockTitle}>{title}</Text>
      {badge != null && (
        <View style={s.blockBadge}>
          <Text style={s.blockBadgeTxt}>{badge}</Text>
        </View>
      )}
    </View>
    {children}
  </View>
);

const PatrollerRow = ({ patroller, first }) => {
  const initials =
    (patroller.officer_name || "")
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "??";
  return (
    <View style={[s.pRow, first && { borderTopWidth: 0 }]}>
      {patroller.profile_picture ? (
        <Image source={{ uri: patroller.profile_picture }} style={s.avatar} />
      ) : (
        <View style={[s.avatar, s.avatarPh]}>
          <Text style={s.avatarTxt}>{initials}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.pName} numberOfLines={1}>
          {patroller.officer_name}
        </Text>
        {!!patroller.contact_number && (
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}
          >
            <Ionicons name="call-outline" size={11} color={C.faint} />
            <Text style={s.pContact}> {patroller.contact_number}</Text>
          </View>
        )}
      </View>
      <ShiftPill shift={patroller.shift} />
    </View>
  );
};

// ── Map ─────────────────────────────────────────────────────────────────────
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
      500,
    );
  }, [mapReady, geoJSONData, barangays]);

  const geo = coloredGeoJSON();

  return (
    <View style={{ flex: 1 }}>
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
              style={{ lineColor: "#1e3a5f", lineWidth: 1.5, lineOpacity: 0.7 }}
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
        <View style={s.mapNoArea}>
          <Text style={s.mapNoAreaTxt}>No area of responsibility set</Text>
        </View>
      )}
    </View>
  );
};

// ── Screen ──────────────────────────────────────────────────────────────────
export default function PatrolDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { patrol, myUserId, isAdmin } = route.params;

  const dateRange = generateDateRange(patrol?.start_date, patrol?.end_date);
  const myShifts = isAdmin
    ? ["AM", "PM"]
    : myUserId
      ? [
          ...new Set(
            (patrol?.patrollers || [])
              .filter(
                (p) => String(p.officer_id) === String(myUserId) && p.shift,
              )
              .map((p) => p.shift),
          ),
        ].sort()
      : ["AM", "PM"];

  const [activeDate, setActiveDate] = useState(dateRange[0] || null);
  const [activeShift, setActiveShift] = useState(myShifts[0] || "AM");
  const [geoJSONData, setGeoJSONData] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("schedule");
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(
          require("../assets/bacoor_barangays.geojson"),
        );
        await asset.downloadAsync();
        setGeoJSONData(await (await fetch(asset.localUri)).json());
      } catch (err) {
        console.warn("GeoJSON load failed:", err);
      } finally {
        setGeoLoading(false);
      }
    })();
  }, []);

  const barangays = [
    ...new Set(
      (patrol?.routes || [])
        .filter((r) => (r.stop_order || 0) <= 0 && r.barangay)
        .map((r) => r.barangay)
        .filter(Boolean),
    ),
  ];

  const patrollersForDate = (shift) =>
    (patrol?.patrollers_detail || patrol?.patrollers || []).filter(
      (p) =>
        p.shift === shift &&
        (activeDate ? toLocalDateStr(p.route_date) === activeDate : true),
    );

  const amPatrollers = myShifts.includes("AM") ? patrollersForDate("AM") : [];
  const pmPatrollers = myShifts.includes("PM") ? patrollersForDate("PM") : [];
  const currentPatrollers = activeShift === "AM" ? amPatrollers : pmPatrollers;

  const routesForDateShift = (patrol?.routes || [])
    .filter(
      (r) =>
        toLocalDateStr(r.route_date) === activeDate &&
        r.shift === activeShift &&
        (r.stop_order || 0) > 0,
    )
    .sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0));

  const status = getPatrolStatus(patrol);
  const botPad = insets.bottom + 24;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title={patrol.patrol_name}
        subtitle={`${formatDate(patrol.start_date)} — ${formatDate(patrol.end_date)}`}
        onBack={() => navigation.goBack()}
        right={<StatusPill status={status} />}
      >
        <View style={s.unitRow}>
          <Ionicons name="car-sport-outline" size={14} color="#93c5fd" />
          <Text style={s.unitTxt}>
            {patrol.mobile_unit_name || "No unit"}
            {patrol.plate_number ? `  ·  ${patrol.plate_number}` : ""}
          </Text>
        </View>
        <Segmented
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { key: "schedule", label: "Schedule", icon: "time-outline" },
            { key: "map", label: "Map", icon: "map-outline" },
            {
              key: "barangays",
              label: "Areas",
              icon: "location-outline",
              count: barangays.length,
            },
          ]}
        />
      </ScreenHeader>

      <View style={s.body}>
        {/* SCHEDULE */}
        {activeTab === "schedule" && (
          <ScrollView
            contentContainerStyle={{
              padding: 14,
              paddingBottom: botPad,
              gap: 12,
            }}
            showsVerticalScrollIndicator={false}
          >
            {dateRange.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {dateRange.map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[s.dateChip, activeDate === d && s.dateChipOn]}
                    onPress={() => setActiveDate(d)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        s.dateChipTxt,
                        activeDate === d && { color: "#fff" },
                      ]}
                    >
                      {formatDateShort(d)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <View style={s.singleDate}>
                <Ionicons name="calendar" size={14} color={C.navy} />
                <Text style={s.singleDateTxt}>
                  {formatFullDate(activeDate)}
                </Text>
              </View>
            )}

            <Segmented
              variant="light"
              value={activeShift}
              onChange={setActiveShift}
              items={myShifts.map((sh) => ({
                key: sh,
                label: `${sh} Shift`,
                icon: sh === "AM" ? "sunny" : "moon",
                count: sh === "AM" ? amPatrollers.length : pmPatrollers.length,
              }))}
            />

            {/* After patrol report actions */}
            {!isAdmin && (
              <>
                <TouchableOpacity
                  style={[
                    s.actionBtn,
                    status === "upcoming" && { backgroundColor: "#cbd5e1" },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (status === "upcoming") {
                      setToastMsg(
                        "Patrol has not started yet. After patrol report is unavailable.",
                      );
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
                  <Ionicons name="clipboard-outline" size={17} color="#fff" />
                  <Text style={s.actionTxt}>After Patrol Report</Text>
                </TouchableOpacity>
                {!!toastMsg && (
                  <View style={s.notice}>
                    <Ionicons
                      name="information-circle"
                      size={16}
                      color="#92400e"
                    />
                    <Text style={s.noticeTxt}>{toastMsg}</Text>
                  </View>
                )}
              </>
            )}
            {isAdmin && (
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: C.navy }]}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate("AfterPatrolHistory", {
                    patrol,
                    myShift: null,
                  })
                }
              >
                <Ionicons name="documents-outline" size={17} color="#fff" />
                <Text style={s.actionTxt}>View After Patrol Reports</Text>
              </TouchableOpacity>
            )}

            {/* Patrollers */}
            <Block
              title={`${activeShift} shift patrollers`}
              icon="people"
              badge={currentPatrollers.length || undefined}
            >
              {currentPatrollers.length > 0 ? (
                currentPatrollers.map((p, i) => (
                  <PatrollerRow
                    key={`${p.active_patroller_id}-${i}`}
                    patroller={p}
                    first={i === 0}
                  />
                ))
              ) : (
                <Text style={s.emptyNote}>
                  No patrollers assigned to {activeShift} shift
                  {activeDate ? ` on ${formatDateShort(activeDate)}` : ""}.
                </Text>
              )}
            </Block>

            {/* Tasks */}
            <Block
              title={`${activeShift} tasks · ${formatDateShort(activeDate)}`}
              icon="list"
              badge={routesForDateShift.length || undefined}
            >
              {routesForDateShift.length > 0 ? (
                <View style={{ padding: 14, paddingBottom: 6 }}>
                  {routesForDateShift.map((r) => (
                    <View key={r.route_id} style={s.taskRow}>
                      <View style={s.taskTime}>
                        <Text style={s.timeMain}>
                          {formatTime(r.time_start)}
                        </Text>
                        <View style={s.rail} />
                        <Text style={s.timeSub}>{formatTime(r.time_end)}</Text>
                      </View>
                      <View style={s.taskBody}>
                        <Text style={s.taskTxt}>
                          {r.notes || <Text style={s.noTask}>No task set</Text>}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={s.emptyNote}>
                  No tasks scheduled for this date and shift.
                </Text>
              )}
            </Block>
          </ScrollView>
        )}

        {/* MAP */}
        {activeTab === "map" && (
          <View style={{ flex: 1, paddingBottom: insets.bottom }}>
            {geoLoading ? (
              <View style={s.center}>
                <ActivityIndicator size="large" color={C.navy} />
                <Text style={s.loadTxt}>Loading map...</Text>
              </View>
            ) : (
              <PatrolMap geoJSONData={geoJSONData} barangays={barangays} />
            )}
            {!geoLoading && barangays.length > 0 && (
              <View style={s.legend}>
                <View style={s.legendDot} />
                <Text style={s.legendTxt}>Area of responsibility</Text>
              </View>
            )}
          </View>
        )}

        {/* AREAS */}
        {activeTab === "barangays" && (
          <ScrollView
            contentContainerStyle={{ padding: 14, paddingBottom: botPad }}
            showsVerticalScrollIndicator={false}
          >
            <Block
              title="Area of responsibility"
              icon="location"
              badge={barangays.length || undefined}
            >
              {barangays.length > 0 ? (
                barangays.map((b, i) => (
                  <View
                    key={b}
                    style={[s.brgyRow, i === 0 && { borderTopWidth: 0 }]}
                  >
                    <View style={s.brgyIdx}>
                      <Text style={s.brgyIdxTxt}>{i + 1}</Text>
                    </View>
                    <Ionicons name="location" size={15} color={C.red} />
                    <Text style={s.brgyName}>{b}</Text>
                  </View>
                ))
              ) : (
                <EmptyState
                  icon="location-outline"
                  title="No areas assigned"
                  text="No areas of responsibility have been assigned to this patrol."
                />
              )}
            </Block>
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

  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    backgroundColor: "rgba(147,197,253,0.12)",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    marginTop: 12,
  },
  unitTxt: { color: "#dbeafe", fontSize: 11.5, fontWeight: "600" },

  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: C.border,
  },
  dateChipOn: { backgroundColor: C.navy, borderColor: C.navy },
  dateChipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  singleDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e8edf4",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  singleDateTxt: { fontSize: 13, fontWeight: "700", color: C.navy },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.red,
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionTxt: { fontSize: 14.5, fontWeight: "800", color: "#fff" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fcd34d",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  noticeTxt: { flex: 1, fontSize: 12, fontWeight: "700", color: "#92400e" },

  block: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8edf3",
    overflow: "hidden",
  },
  blockHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fafbfd",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  blockIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  blockTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: C.navy,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  blockBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  blockBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  emptyNote: { fontSize: 13, color: C.faint, fontStyle: "italic", padding: 16 },

  pRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPh: {
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 13, fontWeight: "800", color: "#fff" },
  pName: { fontSize: 13.5, fontWeight: "700", color: C.text },
  pContact: { fontSize: 11.5, color: C.muted },

  taskRow: { flexDirection: "row", gap: 12 },
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

  mapNoArea: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  mapNoAreaTxt: { fontSize: 13, color: C.muted, fontStyle: "italic" },
  legend: {
    position: "absolute",
    bottom: 16 + 0,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: C.border,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.navy,
  },
  legendTxt: { fontSize: 11.5, fontWeight: "700", color: C.text },

  brgyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  brgyIdx: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#e8edf4",
    alignItems: "center",
    justifyContent: "center",
  },
  brgyIdxTxt: { fontSize: 11.5, fontWeight: "800", color: C.navy },
  brgyName: { flex: 1, fontSize: 14, fontWeight: "700", color: C.text },
});
