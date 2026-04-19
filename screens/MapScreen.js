// ================================================================================
// FILE: screens/CrimeMapScreen.js
// CHANGES:
//   1. Crime data filtered by dynamic date range (default last 365 days)
//   2. Dynamic risk thresholds matching web version (based on date range)
//   3. Officer markers = plain blue dot only, no name/label
//   4. Manual GPS activation with confirmation modal (no auto-start)
//   5. Sidebar tabs: Legend, Stats, Hotspots (no Patrol/Recent)
//   6. Date filter UI inside sidebar
//   7. UserLocation only renders when GPS is manually enabled
// ================================================================================

import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  // SafeAreaView,
  Platform,
  AppState,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { SafeAreaView } from "react-native-safe-area-context";
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

// ── Date helpers ────────────────────────────────────────────
const getPHTToday = () => {
  const phtMs = Date.now() + 8 * 60 * 60 * 1000;
  return new Date(phtMs).toISOString().slice(0, 10);
};

const getPHTOneYearAgo = () => {
  const phtMs = Date.now() + 8 * 60 * 60 * 1000;
  const d = new Date(phtMs);
  d.setFullYear(d.getFullYear() - 1);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
};

// ── Dynamic risk thresholds — mirrors web + backend exactly ─
const getRiskThresholds = (dateFrom, dateTo) => {
  const days =
    Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1;
  if (days <= 29) return { lowMax: 1, medMax: 2 };
  if (days <= 91) return { lowMax: 2, medMax: 4 };
  if (days <= 364) return { lowMax: 3, medMax: 6 };
  return { lowMax: 4, medMax: 8 };
};

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

// Simple YYYY-MM-DD validator
const isValidDate = (str) =>
  /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str));

export default function MapScreen({ navigation }) {
  const watchRef = useRef(null);
  const intervalRef = useRef(null);
  const lastCoords = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const cameraRef = useRef(null);
  const officerPollRef = useRef(null);
  const isMounted = useRef(true);

  // ── Date filter state ──────────────────────────────────────
  const defaultDateFrom = getPHTOneYearAgo();
  const defaultDateTo = getPHTToday();

  const [filterDateFrom, setFilterDateFrom] = useState(defaultDateFrom);
  const [filterDateTo, setFilterDateTo] = useState(defaultDateTo);
  const [appliedDateFrom, setAppliedDateFrom] = useState(defaultDateFrom);
  const [appliedDateTo, setAppliedDateTo] = useState(defaultDateTo);
  const [showDateFilter, setShowDateFilter] = useState(false);

  // ── GPS state — manual only ────────────────────────────────
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [showGpsConfirm, setShowGpsConfirm] = useState(false);

  // ── Map data state ─────────────────────────────────────────
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

  // ── GeoJSON ──────────────────────────────────────────────
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

  // ── GPS helpers ───────────────────────────────────────────
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
    lastCoords.current = null;
    callOffDuty();
  }, [callOffDuty]);

  const startTracking = useCallback(async () => {
    if (intervalRef.current || watchRef.current) return;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    // Fast coarse fix so dot appears quickly
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

    // High-accuracy watch refines continuously
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

  // ── Data fetching ─────────────────────────────────────────
  const getToken = async () => await AsyncStorage.getItem("auth_token");

  const fetchMapData = useCallback(async () => {
    try {
      if (isMounted.current) setLoading(true);
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const q = `?date_from=${appliedDateFrom}&date_to=${appliedDateTo}`;
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
  }, [appliedDateFrom, appliedDateTo]);

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

  // ── Lifecycle — no GPS auto-start ─────────────────────────
  useEffect(() => {
    isMounted.current = true;
    fetchMapData();
    officerPollRef.current = setInterval(fetchOfficers, INTERVAL_MS);
    fetchOfficers();

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev === "active" && next.match(/inactive|background/)) {
        if (gpsEnabled) stopTracking();
        if (officerPollRef.current) {
          clearInterval(officerPollRef.current);
          officerPollRef.current = null;
        }
      } else if (prev.match(/inactive|background/) && next === "active") {
        fetchMapData();
        if (!officerPollRef.current)
          officerPollRef.current = setInterval(fetchOfficers, INTERVAL_MS);
        fetchOfficers();
        if (gpsEnabled) startTracking();
      }
    });

    return () => {
      isMounted.current = false;
      sub.remove();
      if (officerPollRef.current) clearInterval(officerPollRef.current);
      stopTracking();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS toggle effect ──────────────────────────────────────
  useEffect(() => {
    if (gpsEnabled) {
      startTracking();
    } else {
      stopTracking();
      setMyLocation(null);
    }
  }, [gpsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-fetch when applied dates change ────────────────────
  useEffect(() => {
    fetchMapData();
  }, [appliedDateFrom, appliedDateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Layer styles ──────────────────────────────────────────
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

  // ── Computed risk thresholds for current applied range ────
  const thresholds = getRiskThresholds(appliedDateFrom, appliedDateTo);
  const dayCount =
    Math.round(
      (new Date(appliedDateTo) - new Date(appliedDateFrom)) / 86400000,
    ) + 1;

  // ── Render ────────────────────────────────────────────────
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

          {/* User location — only visible when GPS is manually enabled */}
          {gpsEnabled && <UserLocation visible={true} />}
        </MapView>

        {/* Recenter — only useful when GPS active */}
        <TouchableOpacity
          style={[styles.recenterBtn, !gpsEnabled && { opacity: 0.4 }]}
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

        {/* GPS Toggle Button — below recenter */}
        <TouchableOpacity
          style={[
            styles.gpsToggleBtn,
            gpsEnabled && styles.gpsToggleBtnActive,
          ]}
          onPress={() => {
            if (gpsEnabled) {
              setGpsEnabled(false);
            } else {
              setShowGpsConfirm(true);
            }
          }}
        >
          <Ionicons
            name={gpsEnabled ? "location" : "location-outline"}
            size={20}
            color={gpsEnabled ? "#ffffff" : "#1e3a5f"}
          />
        </TouchableOpacity>

        {/* Reset view */}
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

        {/* Risk legend — dynamic thresholds */}
        <View style={styles.riskLegend}>
          {[
            {
              color: "#b91c1c",
              label: `High (${thresholds.medMax + 1}+)`,
            },
            {
              color: "#f97316",
              label: `Med (${thresholds.lowMax + 1}–${thresholds.medMax})`,
            },
            {
              color: "#eab308",
              label: `Low (1${thresholds.lowMax > 1 ? `–${thresholds.lowMax}` : ""})`,
            },
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

        {/* GPS status pill — only shown when GPS is enabled */}
        {gpsEnabled && (
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
        )}
      </View>

      {/* GPS CONFIRMATION MODAL */}
      <Modal
        visible={showGpsConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGpsConfirm(false)}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmBox}>
            <Ionicons
              name="location"
              size={32}
              color="#1e3a5f"
              style={{ marginBottom: 10 }}
            />
            <Text style={styles.confirmTitle}>Enable GPS Tracking</Text>
            <Text style={styles.confirmMsg}>
              Your location will be shared with the system and visible to
              dispatchers while GPS is active.
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity
                style={styles.confirmCancel}
                onPress={() => setShowGpsConfirm(false)}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmOk}
                onPress={() => {
                  setShowGpsConfirm(false);
                  setGpsEnabled(true);
                }}
              >
                <Text style={styles.confirmOkText}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

          {/* Tabs: Legend / Stats / Hotspots */}
          <View style={styles.sidebarTabs}>
            {["legend", "stats", "hotspots"].map((tab) => (
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
            {/* DATE FILTER ROW */}
            <View style={styles.dateFilterRow}>
              <TouchableOpacity
                style={styles.dateFilterBtn}
                onPress={() => setShowDateFilter((v) => !v)}
              >
                <Ionicons name="calendar-outline" size={14} color="#1e3a5f" />
                <Text style={styles.dateFilterBtnText}>
                  {appliedDateFrom} → {appliedDateTo}
                </Text>
                <Ionicons
                  name={showDateFilter ? "chevron-up" : "chevron-down"}
                  size={12}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>

            {showDateFilter && (
              <View style={styles.dateFilterPanel}>
                <Text style={styles.dateFilterLabel}>From (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.dateInput}
                  value={filterDateFrom}
                  onChangeText={setFilterDateFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#adb5bd"
                  maxLength={10}
                  keyboardType="numeric"
                />
                <Text style={styles.dateFilterLabel}>To (YYYY-MM-DD)</Text>
                <TextInput
                  style={styles.dateInput}
                  value={filterDateTo}
                  onChangeText={setFilterDateTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#adb5bd"
                  maxLength={10}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={[
                    styles.applyDateBtn,
                    (!isValidDate(filterDateFrom) ||
                      !isValidDate(filterDateTo) ||
                      filterDateFrom >= filterDateTo) && { opacity: 0.5 },
                  ]}
                  onPress={() => {
                    if (
                      !isValidDate(filterDateFrom) ||
                      !isValidDate(filterDateTo) ||
                      filterDateFrom >= filterDateTo
                    )
                      return;
                    setAppliedDateFrom(filterDateFrom);
                    setAppliedDateTo(filterDateTo);
                    setShowDateFilter(false);
                  }}
                >
                  <Text style={styles.applyDateBtnText}>Apply</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.clearDateBtn}
                  onPress={() => {
                    const from = getPHTOneYearAgo();
                    const to = getPHTToday();
                    setFilterDateFrom(from);
                    setFilterDateTo(to);
                    setAppliedDateFrom(from);
                    setAppliedDateTo(to);
                    setShowDateFilter(false);
                  }}
                >
                  <Text style={styles.clearDateBtnText}>Reset to 1 Year</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── LEGEND TAB ── */}
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

                {/* Dynamic risk scale */}
                <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
                  Barangay Risk Scale
                </Text>
                <Text style={styles.dateRangeNote}>
                  Thresholds for {dayCount}-day range
                </Text>
                {[
                  { color: "#adb5bd", label: "No crimes", range: "0" },
                  {
                    color: "#eab308",
                    label: "Low Risk",
                    range:
                      thresholds.lowMax === 1 ? "1" : `1–${thresholds.lowMax}`,
                  },
                  {
                    color: "#f97316",
                    label: "Medium Risk",
                    range: `${thresholds.lowMax + 1}–${thresholds.medMax}`,
                  },
                  {
                    color: "#b91c1c",
                    label: "High Risk",
                    range: `${thresholds.medMax + 1}+`,
                  },
                ].map((r) => (
                  <View key={r.label} style={styles.riskLegendRow}>
                    <View
                      style={[
                        styles.riskLegendDot,
                        { backgroundColor: r.color },
                      ]}
                    />
                    <Text style={styles.riskLegendLabel}>{r.label}</Text>
                    <Text style={styles.riskLegendRange}>
                      {r.range} crimes
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* ── STATS TAB ── */}
            {activeTab === "stats" && (
              <View style={styles.tabContent}>
                <Text style={styles.dateRangeNote}>
                  {appliedDateFrom} → {appliedDateTo}
                </Text>
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
                      label: "At-Risk Areas",
                      val: stats?.at_risk_count ?? 0,
                      color: "#f97316",
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

            {/* ── HOTSPOTS TAB ── */}
            {activeTab === "hotspots" && (
              <View style={styles.tabContent}>
                <Text style={styles.dateRangeNote}>
                  {appliedDateFrom} → {appliedDateTo}
                </Text>
                {stats?.at_risk_barangays?.length > 0 ? (
                  stats.at_risk_barangays.map((h, i) => (
                    <View key={i} style={styles.hotspotRow}>
                      <Text style={styles.hotspotRank}>#{i + 1}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.hotspotName}>{h.barangay}</Text>
                        <Text
                          style={[
                            styles.hotspotRisk,
                            {
                              color:
                                h.risk === "High"
                                  ? "#b91c1c"
                                  : h.risk === "Medium"
                                    ? "#f97316"
                                    : "#eab308",
                            },
                          ]}
                        >
                          {h.risk} Risk
                        </Text>
                        <View style={styles.hotspotBarBg}>
                          <View
                            style={[
                              styles.hotspotBarFill,
                              {
                                width: `${Math.min(
                                  100,
                                  (h.count /
                                    stats.at_risk_barangays[0].count) *
                                    100,
                                )}%`,
                                backgroundColor:
                                  h.risk === "High"
                                    ? "#b91c1c"
                                    : h.risk === "Medium"
                                      ? "#f97316"
                                      : "#eab308",
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.hotspotCount}>{h.count}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    No at-risk barangays detected
                  </Text>
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

  recenterBtn: {
    position: "absolute",
    bottom: 184,
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

  gpsToggleBtn: {
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
  gpsToggleBtnActive: {
    backgroundColor: "#1e3a5f",
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

  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBox: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    width: "80%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0a285c",
    marginBottom: 8,
  },
  confirmMsg: {
    fontSize: 13,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  confirmBtns: { flexDirection: "row", gap: 12, width: "100%" },
  confirmCancel: {
    flex: 1,
    padding: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dee2e6",
    alignItems: "center",
  },
  confirmCancelText: { color: "#6b7280", fontWeight: "600", fontSize: 14 },
  confirmOk: {
    flex: 1,
    padding: 11,
    borderRadius: 8,
    backgroundColor: "#1e3a5f",
    alignItems: "center",
  },
  confirmOkText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },

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
    maxHeight: "80%",
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
    marginBottom: 4,
    textAlign: "center",
  },

  dateFilterRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 4,
  },
  dateFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dateFilterBtnText: {
    fontSize: 11,
    color: "#1e3a5f",
    fontWeight: "600",
    flex: 1,
  },
  dateFilterPanel: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  dateFilterLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
    marginTop: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#ffffff",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  applyDateBtn: {
    marginTop: 8,
    backgroundColor: "#1e3a5f",
    borderRadius: 6,
    padding: 10,
    alignItems: "center",
  },
  applyDateBtnText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  clearDateBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
  },
  clearDateBtnText: { color: "#6b7280", fontSize: 12 },

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
  riskLegendLabel: { fontSize: 13, color: "#374151", flex: 1 },
  riskLegendRange: { fontSize: 11, color: "#6b7280" },

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
    marginBottom: 2,
  },
  hotspotRisk: {
    fontSize: 10,
    fontWeight: "700",
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
    borderRadius: 4,
  },
  hotspotCount: { fontSize: 15, fontWeight: "700", color: "#c1272d" },

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