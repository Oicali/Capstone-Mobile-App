// ================================================================================
// FILE: screens/CrimeMapScreen.js
// CHANGES:
//   1. Crime data filtered to last 365 days via ?date_from= query param
//   2. Officer markers = plain blue dot only, no name/label
//   3. Fast GPS init (Balanced first fix → BestForNavigation watch)
// ================================================================================

import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
  AppState,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Asset } from "expo-asset";
import Mapbox, {
  MapView,
  Camera,
  ShapeSource,
  FillLayer,
  LineLayer,
  SymbolLayer,
  MarkerView,
  UserLocation,
} from "@rnmapbox/maps";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL } from "./services/api";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

const API = BASE_URL;
const INTERVAL_MS = 5000;
const BACOOR_CENTER = [120.964, 14.4341];

// Computed once — last 365 days as "YYYY-MM-DD"
const DATE_FROM = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split("T")[0];

const INCIDENT_COLORS = {
  ROBBERY: "#ef4444",
  THEFT: "#f97316",
  "PHYSICAL INJURIES": "#eab308",
  HOMICIDE: "#8b5cf6",
  MURDER: "#7c3aed",
  RAPE: "#ec4899",
  "CARNAPPING - MC": "#3b82f6",
  "CARNAPPING - MV": "#0ea5e9",
  "SPECIAL COMPLEX CRIME": "#14b8a6",
};

const formatDate = (d) => {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
const formatTime = (d) => {
  if (!d) return "N/A";
  return new Date(d).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function MapScreen({ navigation }) {
  const watchRef = useRef(null);
  const intervalRef = useRef(null);
  const lastCoords = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const cameraRef = useRef(null);
  const officerPollRef = useRef(null);
  const isMounted = useRef(true);

  const [rawGeoJSON, setRawGeoJSON] = useState(null);
  const [geoJSON, setGeoJSON] = useState(null);
  const [boundaries, setBoundaries] = useState([]);
  const [pins, setPins] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPin, setSelectedPin] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState("legend");
  const [myLocation, setMyLocation] = useState(null);
  const [showMorePopup, setShowMorePopup] = useState(false);

  // ── GeoJSON ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(
          require("../assets/bacoor_barangays.geojson"),
        );
        await asset.downloadAsync();
        const data = await (await fetch(asset.localUri)).json();
        if (isMounted.current) setRawGeoJSON(data);
      } catch (err) {
        console.error("[Map] GeoJSON load error:", err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!rawGeoJSON || !boundaries.length) return;
    const lookup = {};
    boundaries.forEach((b) => {
      lookup[b.name_kml] = b.color;
    });
    setGeoJSON({
      ...rawGeoJSON,
      features: rawGeoJSON.features.map((f) => ({
        ...f,
        properties: {
          ...f.properties,
          fillColor: lookup[f.properties.name_kml] || "#adb5bd",
        },
      })),
    });
  }, [rawGeoJSON, boundaries]);

  // ── GPS ──────────────────────────────────────────────────────
  const pushLocation = useCallback(async () => {
    if (!lastCoords.current) return;
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) return;
      const { latitude, longitude, accuracy, heading, speed } =
        lastCoords.current;
      await fetch(`${API}/gps/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy: accuracy ?? null,
          heading: heading ?? 0,
          speed: speed ?? 0,
        }),
      });
    } catch (err) {
      console.warn("[GPS] push failed:", err.message);
    }
  }, []);

  const callOffDuty = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) return;
      await fetch(`${API}/gps/off-duty`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.warn("[GPS] off-duty failed:", err.message);
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    if (officerPollRef.current) {
      clearInterval(officerPollRef.current);
      officerPollRef.current = null;
    }
    lastCoords.current = null;
    callOffDuty(); // fire-and-forget
  }, [callOffDuty]);

  const startTracking = useCallback(async () => {
    if (intervalRef.current || watchRef.current) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    // Step 1: fast coarse fix so dot appears in ~1-2s
    try {
      const fast = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (isMounted.current) {
        lastCoords.current = fast.coords;
        setMyLocation([fast.coords.longitude, fast.coords.latitude]);
        cameraRef.current?.setCamera({
          centerCoordinate: [fast.coords.longitude, fast.coords.latitude],
          zoomLevel: 15,
          animationDuration: 800,
        });
      }
    } catch (err) {
      console.warn("[GPS] fast fix failed:", err.message);
    }

    // Step 2: high-accuracy watch refines continuously
    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 0,
      },
      (loc) => {
        lastCoords.current = loc.coords;
        if (isMounted.current)
          setMyLocation([loc.coords.longitude, loc.coords.latitude]);
      },
    );

    intervalRef.current = setInterval(pushLocation, INTERVAL_MS);
    pushLocation();
  }, [pushLocation]);

  // ── Data fetching ─────────────────────────────────────────────
  const getToken = async () => await AsyncStorage.getItem("auth_token");

  const fetchMapData = useCallback(async () => {
    try {
      if (isMounted.current) setLoading(true);
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const q = `?date_from=${DATE_FROM}`; // 365-day filter
      const [bRes, pRes, sRes] = await Promise.all([
        fetch(`${API}/crime-map/boundaries${q}`, { headers }),
        fetch(`${API}/crime-map/pins${q}`, { headers }),
        fetch(`${API}/crime-map/statistics${q}`, { headers }),
      ]);
      const [bData, pData, sData] = await Promise.all([
        bRes.json(),
        pRes.json(),
        sRes.json(),
      ]);
      if (!isMounted.current) return;
      if (bData.success) setBoundaries(bData.data);
      if (pData.success) setPins(pData.data);
      if (sData.success) setStats(sData.data);
    } catch (err) {
      console.error("[Map] fetchMapData error:", err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  const fetchOfficers = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/gps/officers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (isMounted.current && data.success) setOfficers(data.data);
    } catch (err) {
      console.warn("[Map] fetchOfficers error:", err.message);
    }
  }, []);

  // ── Lifecycle ─────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    fetchMapData();
    startTracking();
    officerPollRef.current = setInterval(fetchOfficers, INTERVAL_MS);
    fetchOfficers();

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev === "active" && next.match(/inactive|background/)) {
        stopTracking();
      } else if (prev.match(/inactive|background/) && next === "active") {
        startTracking();
        fetchMapData();
        if (!officerPollRef.current)
          officerPollRef.current = setInterval(fetchOfficers, INTERVAL_MS);
        fetchOfficers();
      }
    });

    return () => {
      isMounted.current = false;
      sub.remove();
      stopTracking();
    };
  }, []);

  // ── Layer styles ──────────────────────────────────────────────
  const fillLayerStyle = { fillColor: ["get", "fillColor"], fillOpacity: 0.4 };
  const outlineLayerStyle = {
    lineColor: "#1e3a5f",
    lineWidth: 1.2,
    lineOpacity: 0.5,
  };
  const labelLayerStyle = {
    textField: ["get", "name_db"],
    textSize: 10,
    textColor: "#0a1628",
    textHaloColor: "rgba(255,255,255,0.85)",
    textHaloWidth: 1.5,
    textMaxWidth: 8,
    textAllowOverlap: false,
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Crime Map</Text>
        <View style={styles.headerRight}>
          {loading && (
            <ActivityIndicator
              size="small"
              color="#ffffff"
              style={{ marginRight: 8 }}
            />
          )}
          <TouchableOpacity
            onPress={() => setShowSidebar((v) => !v)}
            style={styles.iconBtn}
          >
            <Ionicons name="layers-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={fetchMapData} style={styles.iconBtn}>
            <Ionicons name="refresh-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* MAP */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          styleURL="mapbox://styles/mapbox/light-v11"
          onPress={() => setSelectedPin(null)}
          minZoomLevel={11.5}
        >
          <Camera
            ref={cameraRef}
            zoomLevel={12}
            centerCoordinate={BACOOR_CENTER}
            animationMode="flyTo"
            animationDuration={800}
          />

          {geoJSON && (
            <ShapeSource id="barangays" shape={geoJSON}>
              <FillLayer id="barangay-fill" style={fillLayerStyle} />
              <LineLayer id="barangay-outline" style={outlineLayerStyle} />
              <SymbolLayer id="barangay-labels" style={labelLayerStyle} />
            </ShapeSource>
          )}

          {/* Crime pins */}
          {pins.map((pin) => (
            <MarkerView
              key={`pin-${pin.blotter_id}`}
              id={`pin-${pin.blotter_id}`}
              coordinate={[pin.lng, pin.lat]}
            >
              <TouchableOpacity
                onPress={() => {
                  setSelectedPin(pin);
                  setShowMorePopup(false);
                }}
                style={[
                  styles.crimePin,
                  {
                    backgroundColor:
                      INCIDENT_COLORS[pin.incident_type?.toUpperCase()] ||
                      "#6b7280",
                  },
                ]}
              />
            </MarkerView>
          ))}

          {/* Officer dots — blue only, no name */}
          {officers.map((officer) => (
            <MarkerView
              key={`officer-${officer.user_id}`}
              id={`officer-${officer.user_id}`}
              coordinate={[
                parseFloat(officer.longitude),
                parseFloat(officer.latitude),
              ]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.officerDot} />
            </MarkerView>
          ))}

          {/* My location — pulsing blue dot */}
          <UserLocation visible={true} />
        </MapView>

        {/* Recenter */}
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={() =>
            myLocation &&
            cameraRef.current?.setCamera({
              centerCoordinate: myLocation,
              zoomLevel: 15,
              animationDuration: 800,
            })
          }
        >
          <Ionicons name="navigate" size={20} color="#1e3a5f" />
        </TouchableOpacity>

        {/* Reset */}
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() =>
            cameraRef.current?.setCamera({
              centerCoordinate: BACOOR_CENTER,
              zoomLevel: 12,
              animationDuration: 800,
            })
          }
        >
          <Ionicons name="refresh" size={18} color="#1e3a5f" />
        </TouchableOpacity>

        {/* Risk legend */}
        <View style={styles.riskLegend}>
          {[
            { color: "#b91c1c", label: "High (4+)" },
            { color: "#f97316", label: "Medium (2–3)" },
            { color: "#eab308", label: "Low (1)" },
            { color: "#adb5bd", label: "None" },
          ].map((r) => (
            <View key={r.label} style={styles.riskRow}>
              <View style={[styles.riskDot, { backgroundColor: r.color }]} />
              <Text style={styles.riskLabel}>{r.label}</Text>
            </View>
          ))}
        </View>

        {/* Officers online badge */}
        <View style={styles.officersBadge}>
          <View style={styles.officersBadgeDot} />
          <Text style={styles.officersBadgeText}>
            {officers.length} officer{officers.length !== 1 ? "s" : ""} online
          </Text>
        </View>

        {/* GPS status */}
        <View
          style={[
            styles.gpsStatus,
            {
              backgroundColor: myLocation
                ? "rgba(34,197,94,0.88)"
                : "rgba(239,68,68,0.88)",
            },
          ]}
        >
          {!myLocation ? (
            <ActivityIndicator
              size="small"
              color="#ffffff"
              style={{ marginRight: 2 }}
            />
          ) : (
            <View style={styles.gpsStatusDot} />
          )}
          <Text style={styles.gpsStatusText}>
            {myLocation ? "GPS Active" : "Acquiring GPS..."}
          </Text>
        </View>
      </View>

      {/* CRIME PIN POPUP */}
      {selectedPin && (
        <View style={styles.popup}>
          <View
            style={[
              styles.popupHeader,
              {
                backgroundColor:
                  INCIDENT_COLORS[selectedPin.incident_type?.toUpperCase()] ||
                  "#495057",
              },
            ]}
          >
            <Text style={styles.popupType}>{selectedPin.incident_type}</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedPin(null);
                setShowMorePopup(false);
              }}
            >
              <Ionicons name="close" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View style={styles.popupBody}>
            {[
              ["Blotter #", selectedPin.blotter_entry_number],
              ["Barangay", selectedPin.place_barangay],
              ["Date", formatDate(selectedPin.date_time_commission)],
              ["Status", selectedPin.status || "N/A"],
            ].map(([lbl, val]) => (
              <View key={lbl} style={styles.popupRow}>
                <Text style={styles.popupLbl}>{lbl}</Text>
                <Text style={styles.popupVal} numberOfLines={2}>
                  {val}
                </Text>
              </View>
            ))}
            {showMorePopup &&
              [
                ["Street", selectedPin.place_street || "N/A"],
                ["Modus", selectedPin.modus || "N/A"],
                ["Time", formatTime(selectedPin.date_time_commission)],
                ["Day", selectedPin.day_of_week || "N/A"],
                ["Place Type", selectedPin.type_of_place || "N/A"],
              ].map(([lbl, val]) => (
                <View key={lbl} style={styles.popupRow}>
                  <Text style={styles.popupLbl}>{lbl}</Text>
                  <Text style={styles.popupVal} numberOfLines={2}>
                    {val}
                  </Text>
                </View>
              ))}
            <TouchableOpacity
              style={styles.popupToggleBtn}
              onPress={() => setShowMorePopup((v) => !v)}
            >
              <Text style={styles.popupToggleText}>
                {showMorePopup ? "▲ View Less" : "▼ View More"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SIDEBAR MODAL */}
      <Modal
        visible={showSidebar}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSidebar(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSidebar(false)}
        />
        <View style={styles.sidebar}>
          <View style={styles.sidebarHandle} />
          <View style={styles.sidebarTabs}>
            {["legend", "stats", "hotspots", "recent"].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.sidebarTab,
                  activeTab === tab && styles.sidebarTabActive,
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text
                  style={[
                    styles.sidebarTabText,
                    activeTab === tab && styles.sidebarTabTextActive,
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={styles.sidebarBody}
            showsVerticalScrollIndicator={false}
          >
            {/* LEGEND */}
            {activeTab === "legend" && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionLabel}>Crime Types</Text>
                {(stats?.by_incident_type?.length > 0
                  ? stats.by_incident_type
                  : Object.keys(INCIDENT_COLORS).map((k) => ({
                      incident_type: k,
                      count: 0,
                    }))
                ).map((item) => {
                  const name = item.incident_type;
                  const color =
                    INCIDENT_COLORS[name?.toUpperCase()] || "#6b7280";
                  const count = parseInt(item.count) || 0;
                  const max =
                    parseInt(stats?.by_incident_type?.[0]?.count) || 1;
                  const pct = Math.round((count / max) * 100);
                  return (
                    <View key={name} style={styles.legendRow}>
                      <View style={styles.legendTop}>
                        <View style={styles.legendLeft}>
                          <View
                            style={[
                              styles.legendDot,
                              { backgroundColor: color },
                            ]}
                          />
                          <Text style={styles.legendName}>{name}</Text>
                        </View>
                        <Text style={styles.legendCount}>{count}</Text>
                      </View>
                      <View style={styles.barBg}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${pct}%`, backgroundColor: color },
                          ]}
                        />
                      </View>
                    </View>
                  );
                })}
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                  Barangay Risk
                </Text>
                {[
                  { color: "#b91c1c", label: "High Risk — 4+ crimes" },
                  { color: "#f97316", label: "Medium Risk — 2–3 crimes" },
                  { color: "#eab308", label: "Low Risk — 1 crime" },
                  { color: "#adb5bd", label: "No Crimes" },
                ].map((r) => (
                  <View key={r.label} style={styles.riskLegendRow}>
                    <View
                      style={[
                        styles.riskLegendDot,
                        { backgroundColor: r.color },
                      ]}
                    />
                    <Text style={styles.riskLegendLabel}>{r.label}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* STATS */}
            {activeTab === "stats" && (
              <View style={styles.tabContent}>
                <Text style={styles.dateRangeNote}>Showing last 365 days</Text>
                <View style={styles.statsGrid}>
                  {[
                    {
                      label: "Mapped Incidents",
                      val: stats?.total_pins ?? 0,
                      color: "#1e3a5f",
                    },
                    {
                      label: "Total Blotters",
                      val: stats?.total_blotters ?? 0,
                      color: "#6b7280",
                    },
                    {
                      label: "Hotspot Areas",
                      val: stats?.high_risk_count ?? 0,
                      color: "#c1272d",
                    },
                    {
                      label: "Brgy. Affected",
                      val: boundaries.filter((b) => b.crime_count > 0).length,
                      color: "#f97316",
                    },
                  ].map((s) => (
                    <View key={s.label} style={styles.statCard}>
                      <View
                        style={[
                          styles.statAccent,
                          { backgroundColor: s.color },
                        ]}
                      />
                      <Text style={[styles.statVal, { color: s.color }]}>
                        {s.val}
                      </Text>
                      <Text style={styles.statLbl}>{s.label}</Text>
                    </View>
                  ))}
                </View>
                {stats?.by_incident_type?.[0] && (
                  <View style={styles.topCrime}>
                    <Text style={styles.topCrimeLabel}>
                      Most Reported Crime
                    </Text>
                    <Text
                      style={[
                        styles.topCrimeVal,
                        {
                          color:
                            INCIDENT_COLORS[
                              stats.by_incident_type[0].incident_type?.toUpperCase()
                            ] || "#fff",
                        },
                      ]}
                    >
                      {stats.by_incident_type[0].incident_type}
                    </Text>
                    <Text style={styles.topCrimeSub}>
                      {stats.by_incident_type[0].count} incidents
                    </Text>
                  </View>
                )}
                <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                  Officers Online
                </Text>
                <Text style={styles.officerCount}>
                  {officers.length} officer{officers.length !== 1 ? "s" : ""}{" "}
                  currently active
                </Text>
              </View>
            )}

            {/* HOTSPOTS */}
            {activeTab === "hotspots" && (
              <View style={styles.tabContent}>
                <Text style={styles.dateRangeNote}>Showing last 365 days</Text>
                {stats?.hotspots?.length > 0 ? (
                  stats.hotspots.map((h, i) => (
                    <View key={i} style={styles.hotspotRow}>
                      <Text style={styles.hotspotRank}>#{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.hotspotName}>{h.barangay}</Text>
                        <View style={styles.hotspotBarBg}>
                          <View
                            style={[
                              styles.hotspotBarFill,
                              {
                                width: `${Math.min(100, (h.count / stats.hotspots[0].count) * 100)}%`,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.hotspotCount}>{h.count}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No hotspots detected</Text>
                )}
              </View>
            )}

            {/* RECENT */}
            {activeTab === "recent" && (
              <View style={styles.tabContent}>
                {stats?.recent_incidents?.length > 0 ? (
                  stats.recent_incidents.map((r, i) => (
                    <View key={i} style={styles.recentItem}>
                      <View
                        style={[
                          styles.recentBar,
                          {
                            backgroundColor:
                              INCIDENT_COLORS[r.incident_type?.toUpperCase()] ||
                              "#6b7280",
                          },
                        ]}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recentType}>{r.incident_type}</Text>
                        <Text style={styles.recentBrgy}>
                          📍 {r.place_barangay}
                        </Text>
                        <Text style={styles.recentDate}>
                          {formatDate(r.date_time_commission)}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No recent incidents</Text>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a285c" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#0a285c",
    borderBottomWidth: 1,
    borderBottomColor: "#1e3a5f",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#ffffff" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1 },

  crimePin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },

  // Officer: simple blue dot only
  officerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#1d4ed8",
    borderWidth: 2,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },

  // My location: pulsing
  myLocationMarker: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  myLocationDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3b82f6",
    borderWidth: 2.5,
    borderColor: "#ffffff",
    position: "absolute",
    zIndex: 2,
    shadowColor: "#3b82f6",
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  myLocationRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(59,130,246,0.2)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.45)",
    position: "absolute",
  },

  recenterBtn: {
    position: "absolute",
    bottom: 130,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  resetBtn: {
    position: "absolute",
    bottom: 76,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  riskLegend: {
    position: "absolute",
    bottom: 16,
    left: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  riskDot: { width: 10, height: 10, borderRadius: 3 },
  riskLabel: { fontSize: 10, color: "#374151", fontWeight: "600" },

  officersBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(10,40,92,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  officersBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  officersBadgeText: { fontSize: 11, color: "#ffffff", fontWeight: "600" },

  gpsStatus: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    left: "50%",
    marginLeft: -56,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  gpsStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ffffff",
  },
  gpsStatusText: { fontSize: 11, color: "#ffffff", fontWeight: "700" },

  popup: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  popupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  popupType: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  popupBody: { padding: 16, gap: 8 },
  popupRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  popupLbl: { fontSize: 12, color: "#9ca3af", fontWeight: "600", minWidth: 70 },
  popupVal: {
    fontSize: 12,
    color: "#111827",
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sidebar: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
  },
  sidebarHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#dee2e6",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  sidebarTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  sidebarTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  sidebarTabActive: { borderBottomColor: "#0a285c" },
  sidebarTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9ca3af",
    textTransform: "uppercase",
  },
  sidebarTabTextActive: { color: "#0a285c" },
  sidebarBody: { paddingHorizontal: 16 },
  tabContent: { paddingVertical: 16, gap: 10 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },

  dateRangeNote: {
    fontSize: 11,
    color: "#9ca3af",
    fontStyle: "italic",
    marginBottom: 10,
    textAlign: "center",
  },

  legendRow: { gap: 5 },
  legendTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  legendLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { fontSize: 13, color: "#374151", fontWeight: "500" },
  legendCount: { fontSize: 13, fontWeight: "700", color: "#0a285c" },
  barBg: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.07)",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4 },

  riskLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  riskLegendDot: { width: 12, height: 12, borderRadius: 3 },
  riskLegendLabel: { fontSize: 13, color: "#374151" },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "47%",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
    padding: 14,
    position: "relative",
    overflow: "hidden",
  },
  statAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 10,
  },
  statVal: { fontSize: 26, fontWeight: "700", marginTop: 8 },
  statLbl: {
    fontSize: 11,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "600",
    marginTop: 4,
  },

  topCrime: {
    backgroundColor: "#0a285c",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  topCrimeLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  topCrimeVal: { fontSize: 15, fontWeight: "700" },
  topCrimeSub: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 },

  officerCount: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
    paddingVertical: 4,
  },

  hotspotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  hotspotRank: { fontSize: 13, fontWeight: "700", color: "#9ca3af", width: 28 },
  hotspotName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 5,
  },
  hotspotBarBg: {
    height: 4,
    backgroundColor: "#fee2e2",
    borderRadius: 4,
    overflow: "hidden",
  },
  hotspotBarFill: {
    height: "100%",
    backgroundColor: "#c1272d",
    borderRadius: 4,
  },
  hotspotCount: { fontSize: 15, fontWeight: "700", color: "#c1272d" },

  recentItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  recentBar: { width: 3, borderRadius: 4, minHeight: 40 },
  recentType: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 3,
  },
  recentBrgy: { fontSize: 12, color: "#6b7280", marginBottom: 2 },
  recentDate: { fontSize: 11, color: "#9ca3af" },

  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 13,
    paddingVertical: 24,
  },

  popupToggleBtn: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 6,
    alignItems: "center",
  },
  popupToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e3a5f",
  },
});
