// ================================================================================
// FILE: screens/MapScreen.js
// CHANGES:
//   1. Teardrop crime pins (matching web version)
//   2. Map sits above tab bar (no overlap) via useSafeAreaInsets + flex layout
//   3. UserLocation blue dot removed — puck only (renderMode="normal")
//   4. Sidebar tabs: Legend, Recent, Incidence (mirrors web)
//   5. Heatmap mode — dark map style + heatmap layer + cluster rings
//   6. Incidence tab shows at-risk barangays (choropleth) or clusters (heatmap)
//   7. Date filter UI inside sidebar
//   8. Manual GPS activation with confirmation modal
// ================================================================================
import * as TaskManager from "expo-task-manager";
import { LOCATION_TASK_NAME } from "../tasks/locationTask";
import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Asset } from "expo-asset";
import Mapbox, {
  MapView,
  Camera,
  ShapeSource,
  FillLayer,
  LineLayer,
  SymbolLayer,
  MarkerView,
  HeatmapLayer,
  Images,
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
  d.setMonth(d.getMonth() - 12); // go back 12 months
  d.setDate(1); // snap to the 1st of that month
  return d.toISOString().slice(0, 10);
};

// ── Dynamic risk thresholds ──────────────────────────────────
const getRiskThresholds = (dateFrom, dateTo) => {
  const days =
    Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1;
  if (days <= 29) return { lowMax: 1, medMax: 2 };
  if (days <= 91) return { lowMax: 1, medMax: 3 };
  if (days <= 364) return { lowMax: 2, medMax: 5 };
  return { lowMax: 3, medMax: 8 };
};

const INCIDENT_COLORS = {
  ROBBERY: "#ef4444",
  THEFT: "#f97316",
  "PHYSICAL INJURIES": "#eab308",
  "PHYSICAL INJURY": "#eab308",
  HOMICIDE: "#8b5cf6",
  MURDER: "#7c3aed",
  RAPE: "#ec4899",
  "CARNAPPING - MC": "#3b82f6",
  "CARNAPPING - MV": "#0ea5e9",
  "SPECIAL COMPLEX CRIME": "#14b8a6",
};

const INDEX_CRIMES = [
  "MURDER",
  "HOMICIDE",
  "PHYSICAL INJURY",
  "RAPE",
  "ROBBERY",
  "THEFT",
  "CARNAPPING - MC",
  "CARNAPPING - MV",
  "SPECIAL COMPLEX CRIME",
];

const CRIME_DISPLAY = {
  MURDER: "Murder",
  HOMICIDE: "Homicide",
  "PHYSICAL INJURY": "Physical Injury",
  RAPE: "Rape",
  ROBBERY: "Robbery",
  THEFT: "Theft",
  "CARNAPPING - MC": "Carnapping - MC",
  "CARNAPPING - MV": "Carnapping - MV",
  "SPECIAL COMPLEX CRIME": "Special Complex Crime",
};

const WORLD_MASK_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-180, -90],
            [180, -90],
            [180, 90],
            [-180, 90],
            [-180, -90],
          ],
        ],
      },
      properties: {},
    },
  ],
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

const formatBarangayLabel = (name) => {
  const ROMAN = new Set([
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
  ]);
  return name.toLowerCase().replace(/\b\w+/g, (word) => {
    const upper = word.toUpperCase();
    if (ROMAN.has(upper)) return upper;
    if (upper === "P" || upper === "F") return upper;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
};

const isValidDate = (str) =>
  /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str));


const CRIME_ICONS = {
  MURDER: ({ color, size = 14 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2 L15 8 L12 22 L9 8 Z" fill={color} fillOpacity="0.25" />
      <Line x1="12" y1="2" x2="12" y2="18" />
      <Line x1="7" y1="8" x2="17" y2="8" />
      <Path d="M10 5 L12 2 L14 5" />
    </Svg>
  ),
  HOMICIDE: ({ color, size = 14 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3a7 7 0 0 1 7 7c0 3.5-2 5.5-2.5 7H7.5C7 17.5 5 15.5 5 10a7 7 0 0 1 7-7z" />
      <Line x1="9" y1="21" x2="9" y2="17" />
      <Line x1="15" y1="21" x2="15" y2="17" />
      <Line x1="9" y1="21" x2="15" y2="21" />
      <Circle cx="9.5" cy="11" r="1" fill={color} />
      <Circle cx="14.5" cy="11" r="1" fill={color} />
    </Svg>
  ),
  "PHYSICAL INJURY": ({ color, size = 14 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="18" height="18" rx="3" />
      <Line x1="12" y1="8" x2="12" y2="16" />
      <Line x1="8" y1="12" x2="16" y2="12" />
    </Svg>
  ),
  "PHYSICAL INJURIES": (props) => CRIME_ICONS["PHYSICAL INJURY"](props),
  RAPE: ({ color, size = 14 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3L4 6v6c0 5 4 8 8 9 4-1 8-4 8-9V6z" />
      <Line x1="9" y1="9" x2="15" y2="15" />
      <Line x1="15" y1="9" x2="9" y2="15" />
    </Svg>
  ),
  ROBBERY: ({ color, size = 14 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="2" x2="12" y2="22" />
      <Path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  ),
  THEFT: ({ color, size = 14 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9V7a6 6 0 0 1 12 0v2" />
      <Rect x="3" y="9" width="18" height="12" rx="3" />
      <Circle cx="12" cy="15" r="2" />
    </Svg>
  ),
  "CARNAPPING - MC": ({ color, size = 14 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="5.5" cy="17" r="2.5" />
      <Circle cx="18.5" cy="17" r="2.5" />
      <Path d="M8 17h7" />
      <Path d="M5.5 14.5L8 10h5l3 4.5" />
      <Path d="M13 10l1-3h3" />
      <Path d="M9 10h4" />
    </Svg>
  ),
  "CARNAPPING - MV": ({ color, size = 14 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 11l2-5h14l2 5" />
      <Rect x="2" y="11" width="20" height="5" rx="1" />
      <Circle cx="6.5" cy="16" r="2" />
      <Circle cx="17.5" cy="16" r="2" />
      <Path d="M5.5 11l1.5-3h10l1.5 3" />
      <Line x1="12" y1="8" x2="12" y2="11" />
    </Svg>
  ),
  "SPECIAL COMPLEX CRIME": ({ color, size = 14 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </Svg>
  ),
};

export default function MapScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  // Tab bar height = 55 + bottom inset (matches App.js tabBarStyle)
  const TAB_BAR_HEIGHT = 55 + insets.bottom;
  const watchRef = useRef(null);
  const intervalRef = useRef(null);
  const lastCoords = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const cameraRef = useRef(null);
  const officerPollRef = useRef(null);
  const isMounted = useRef(true);

  // ── Date filter ──────────────────────────────────────────
  const defaultDateFrom = getPHTOneYearAgo();
  const defaultDateTo = getPHTToday();

const [filterDateFrom, setFilterDateFrom] = useState(defaultDateFrom);
  const [filterDateTo, setFilterDateTo] = useState(defaultDateTo);
  const [appliedDateFrom, setAppliedDateFrom] = useState(defaultDateFrom);
  const [appliedDateTo, setAppliedDateTo] = useState(defaultDateTo);
  const [showDateFilter, setShowDateFilter] = useState(false);

// ── Crime type filter ─────────────────────────────────────
  const [filterIncidentTypes, setFilterIncidentTypes] = useState([]);
  const [appliedIncidentTypes, setAppliedIncidentTypes] = useState([]);
  const [showCrimeTypeFilter, setShowCrimeTypeFilter] = useState(false);

  // ── Barangay filter ────────────────────────────────────────
  const [filterBarangays, setFilterBarangays] = useState([]);
  const [appliedBarangays, setAppliedBarangays] = useState([]);
  const [showBarangayFilter, setShowBarangayFilter] = useState(false);
  const [barangaySearch, setBarangaySearch] = useState("");

  // ── Heatmap mode ────────────────────────────────────────
  const [heatmapMode, setHeatmapMode] = useState(false);
  const [heatGeoJSON, setHeatGeoJSON] = useState(null);
  const [clusterGeoJSON, setClusterGeoJSON] = useState(null);
const [heatLoading, setHeatLoading] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [mapZoom, setMapZoom] = useState(12);
  const [selectedOfficer, setSelectedOfficer] = useState(null);

  // ── GPS ─────────────────────────────────────────────────
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [showGpsConfirm, setShowGpsConfirm] = useState(false);

  // ── Map data ─────────────────────────────────────────────
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
  const [userRole, setUserRole] = useState(null);
  const [hasPatrolAssignment, setHasPatrolAssignment] = useState(false);
  const [patrolAssignedBarangays, setPatrolAssignedBarangays] = useState([]);
  const [patrolAssignmentLoading, setPatrolAssignmentLoading] = useState(true);

const [styleReady, setStyleReady] = useState(false);

// Get user role on mount
useEffect(() => {
  const getUserRole = async () => {
    try {
      const userStr = await AsyncStorage.getItem("auth_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user?.role || user?.role_name);
      } else {
        setUserRole(""); // no user found — resolve so patrol check doesn't hang forever
      }
    } catch (err) {
      console.warn("[Map] Failed to get user role:", err.message);
      setUserRole("");
    }
  };
  getUserRole();
}, []);

// Check today's patrol assignment — mirrors PatrollerScheduleScreen's logic.
// If the patrol user has an ongoing schedule today, lock the barangay filter
// to their assigned barangays. Admin/tech-admin/no-schedule → see everything.
useEffect(() => {
  if (userRole === null) return; // still resolving role, wait
  if (userRole !== "Patrol") {
    setPatrolAssignmentLoading(false);
    return;
  }

  const checkPatrolAssignment = async () => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const res = await fetch(`${API}/patrol/my-patrols`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success) {
        const today = new Date().toISOString().split("T")[0];
        const ongoingPatrol = data.data.find(
          (p) => p.start_date <= today && p.end_date >= today,
        );

        if (ongoingPatrol) {
          const assignedBarangays = [
            ...new Set(
              (ongoingPatrol.routes || [])
                .filter((r) => (r.stop_order || 0) <= 0 && r.barangay)
                .map((r) => r.barangay),
            ),
          ];
          setHasPatrolAssignment(true);
          setPatrolAssignedBarangays(assignedBarangays);
          setFilterBarangays(assignedBarangays);
          setAppliedBarangays(assignedBarangays);
        } else {
          setHasPatrolAssignment(false);
          setPatrolAssignedBarangays([]);
        }
      }
    } catch (err) {
      console.warn("[Map] patrol assignment check failed:", err.message);
      setHasPatrolAssignment(false);
      setPatrolAssignedBarangays([]);
    } finally {
      setPatrolAssignmentLoading(false);
    }
  };

  checkPatrolAssignment();
}, [userRole]);

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
    lookup[b.name_kml] = b.crime_count > 0 ? b.color : "#ffffff";
  });
  setGeoJSON({
    ...rawGeoJSON,
    features: rawGeoJSON.features.map((f) => {
      const known = f.properties.name_kml in lookup;
      const isSelected =
        !appliedBarangays.length ||
        appliedBarangays.includes(f.properties.name_db);
      return {
        ...f,
        properties: {
          ...f.properties,
          fillColor: heatmapMode
            ? "rgba(255,255,255,0.0)"
            : !isSelected
              ? "#e5e7eb" // faded grey for unselected barangays
              : known
                ? lookup[f.properties.name_kml]
                : "#9ca3af",
          isSelected,
        },
      };
    }),
  });
}, [rawGeoJSON, boundaries, heatmapMode, appliedBarangays]);

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

  const stopTracking = useCallback(async () => {
  // Stop foreground watcher
  if (watchRef.current) {
    watchRef.current.remove();
    watchRef.current = null;
  }
  if (intervalRef.current) {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }
  lastCoords.current = null;

  // Stop background task
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (err) {
    console.warn("[GPS] stopLocationUpdates failed:", err.message);
  }

  callOffDuty();
}, [callOffDuty]);

  const startTracking = useCallback(async () => {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== "granted") return;

  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  if (bg !== "granted") {
    console.warn("[GPS] Background permission denied — foreground only");
  }

  // Get initial position for camera — low accuracy for instant fix,
  // watchPositionAsync below immediately refines it
  try {
    const fast = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Lowest,
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
    console.warn("[GPS] Initial fix failed:", err.message);
  }

  // Start background task only if not already running
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
if (!isRegistered) {
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 5000,
    distanceInterval: 0,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
  notificationTitle: "BANTAY GPS Active",
  notificationBody: "Tap to open.",
  notificationColor: "#0a285c",
  killServiceOnDestroy: false,
  notificationChannelName: "BANTAY Location",  // must match above
  sticky: true,
},
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.Other,
  });
}

  // Foreground watch — only for updating the dot on map while app is open
  if (!watchRef.current) {
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
  }
}, []);

  // ── Data fetching ─────────────────────────────────────────
  const getToken = async () => await AsyncStorage.getItem("auth_token");

const fetchMapData = useCallback(async () => {
    try {
      if (isMounted.current) setLoading(true);
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      let q = `?date_from=${appliedDateFrom}&date_to=${appliedDateTo}`;
      if (appliedIncidentTypes.length) {
        q += `&incident_type=${appliedIncidentTypes.join(",")}`;
      }
      if (appliedBarangays.length) {
        q += `&barangays=${appliedBarangays.map((b) => b.toUpperCase()).join(",")}`;
      }
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
}, [appliedDateFrom, appliedDateTo, appliedIncidentTypes, appliedBarangays]);

  const fetchHeatmap = useCallback(async () => {
    try {
      if (isMounted.current) setHeatLoading(true);
      const token = await getToken();
      let q = `?date_from=${appliedDateFrom}&date_to=${appliedDateTo}`;
      if (appliedIncidentTypes.length) {
        q += `&incident_type=${appliedIncidentTypes.join(",")}`;
      }
      if (appliedBarangays.length) {
        q += `&barangays=${appliedBarangays.map((b) => b.toUpperCase()).join(",")}`;
      }
      const res = await fetch(`${API}/crime-map/heatmap${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!isMounted.current) return;
      if (data.success) {
        setHeatGeoJSON(data.points);
        setClusterGeoJSON(data.clusters);
      }
    } catch (err) {
      console.error("[Map] fetchHeatmap error:", err.message);
    } finally {
      if (isMounted.current) setHeatLoading(false);
    }
  }, [appliedDateFrom, appliedDateTo, appliedIncidentTypes, appliedBarangays]);

  const fetchOfficers = useCallback(async () => {
  try {
    const token = await getToken();
    const res = await fetch(`${API}/gps/officers?platform=mobile`, {  // ← add this
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (isMounted.current && data.success) {
      setOfficers(data.data); // self-exclusion now handled server-side, remove old filter
    }
  } catch (err) {
    console.warn("[Map] fetchOfficers error:", err.message);
  }
}, []);

  // ── Lifecycle ────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    fetchMapData();
    officerPollRef.current = setInterval(fetchOfficers, INTERVAL_MS);
    fetchOfficers();

    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev === "active" && next.match(/inactive|background/)) {
  // GPS background task keeps running — do NOT stop it here
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

  useEffect(() => {
    if (gpsEnabled) {
      startTracking();
    } else {
      stopTracking();
      setMyLocation(null);
    }
  }, [gpsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

useEffect(() => {
    fetchMapData();
    if (heatmapMode) fetchHeatmap();
  }, [appliedDateFrom, appliedDateTo, appliedIncidentTypes, appliedBarangays]); // eslint-disable-line react-hooks/exhaustive-deps

// When heatmap mode toggles
  useEffect(() => {
    if (heatmapMode) {
      fetchHeatmap(); // always refetch — filters/dates may have changed while in choropleth mode
    }
    setSelectedPin(null);
    setSelectedCluster(null);
    setStyleReady(false); // style is about to reload (styleURL changes) — wait for it again
  }, [heatmapMode]); // eslint-disable-line react-hooks/exhaustive-deps

// ── Layer styles ─────────────────────────────────────────
  const fillLayerStyle = {
    fillColor: ["get", "fillColor"],
    fillOpacity: heatmapMode
      ? 0
      : ["case", ["==", ["get", "isSelected"], false], 0.15, 0.55],
  };
  const outlineLayerStyle = {
    lineColor: heatmapMode ? "#96c8ff" : "#1e3a5f",
    lineWidth: ["case", ["==", ["get", "isSelected"], false], 0.4, 1.4],
    lineOpacity: heatmapMode
      ? ["case", ["==", ["get", "isSelected"], false], 0.08, 0.75]
      : ["case", ["==", ["get", "isSelected"], false], 0.15, 0.5],
  };
  const labelLayerStyle = {
    textField: ["get", "name_db"],
    textSize: 10,
    textColor: heatmapMode ? "rgba(220,235,255,0.9)" : "#0a1628",
    textHaloColor: heatmapMode ? "rgba(0,0,0,0.7)" : "rgba(255,255,255,0.85)",
    textHaloWidth: 1.5,
    textMaxWidth: 8,
    textAllowOverlap: false,
  };

  // Heatmap layer style — matches web CrimeMapping.jsx HEATMAP_LAYER exactly
  const heatmapLayerStyle = {
    heatmapWeight: [
      "interpolate",
      ["linear"],
      ["get", "weight"],
      0, 0,
      0.1, 0.2,
      0.2, 0.35,
      0.3, 0.45,
      0.5, 0.6,
      0.7, 0.8,
      1.0, 1.0,
    ],
    heatmapRadius: [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, 10,
      12, 18,
      14, 30,
      16, 45,
    ],
    heatmapIntensity: [
      "interpolate",
      ["linear"],
      ["zoom"],
      10, 1.0,
      13, 1.3,
      15, 1.8,
    ],
    heatmapColor: [
      "interpolate",
      ["linear"],
      ["heatmap-density"],
      0, "rgba(0,0,0,0)",
      0.05, "rgba(255,255,180,0.7)",
      0.2, "rgba(255,210,80,0.80)",
      0.4, "rgba(255,140,30,0.88)",
      0.6, "rgba(220,50,20,0.92)",
      0.8, "rgba(160,10,10,0.95)",
      1.0, "rgba(80,0,0,0.97)",
    ],
    heatmapOpacity: [
      "interpolate",
      ["linear"],
      ["zoom"],
      11, 0.9,
      14, 0.85,
      16, 0.8,
      18, 0.75,
    ],
  };

const isPatrol = userRole === "Patrol";
const thresholds = getRiskThresholds(appliedDateFrom, appliedDateTo);
  const dayCount =
    Math.round(
      (new Date(appliedDateTo) - new Date(appliedDateFrom)) / 86400000,
    ) + 1;

  const normalizeIconKey = (type) => {
    const t = type?.toUpperCase() || "THEFT";
    if (t === "PHYSICAL INJURIES") return "PHYSICAL INJURY";
    return t;
  };

  const pinsGeoJSON = React.useMemo(
    () => ({
      type: "FeatureCollection",
      features: pins.map((pin) => ({
        type: "Feature",
        id: pin.blotter_id,
        geometry: { type: "Point", coordinates: [pin.lng, pin.lat] },
        properties: {
          blotter_id: pin.blotter_id,
          iconKey: normalizeIconKey(pin.incident_type),
        },
      })),
    }),
    [pins],
  );

  const allBarangays = React.useMemo(() => {
    if (!rawGeoJSON?.features) return [];
    const names = rawGeoJSON.features
      .map((f) => f.properties.name_db)
      .filter(Boolean);
    return [...new Set(names)].sort();
  }, [rawGeoJSON]);

  const filteredBarangayOptions = React.useMemo(() => {
    if (!barangaySearch) return allBarangays;
    return allBarangays.filter((b) =>
      b.toLowerCase().includes(barangaySearch.toLowerCase()),
    );
  }, [allBarangays, barangaySearch]);

  // ── Render ────────────────────────────────────────────────
  return (
    // edges={[]} so SafeAreaView doesn't add top/bottom padding —
    // we handle bottom ourselves so the map doesn't overlap the tab bar
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Crime Map</Text>
        <View style={styles.headerRight}>
          {(loading || heatLoading) && (
            <ActivityIndicator
              size="small"
              color="#ffffff"
              style={{ marginRight: 8 }}
            />
          )}
          {/* Heatmap toggle */}
          <TouchableOpacity
            onPress={() => setHeatmapMode((v) => !v)}
            style={[styles.iconBtn, heatmapMode && styles.iconBtnActive]}
          >
            <Ionicons
              name="flame-outline"
              size={18}
              color={heatmapMode ? "#ff6b35" : "#ffffff"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowSidebar((v) => !v)}
            style={styles.iconBtn}
          >
            <Ionicons name="options-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              fetchMapData();
              if (heatmapMode) fetchHeatmap();
            }}
            style={styles.iconBtn}
          >
            <Ionicons name="refresh-outline" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* MAP — marginBottom pushes map above the absolute-positioned tab bar */}
      <View style={styles.mapContainer}>
        <MapView
  style={[styles.map, { marginBottom: TAB_BAR_HEIGHT }]}
  styleURL={
    heatmapMode
      ? "mapbox://styles/mapbox/dark-v11"
      : "mapbox://styles/mapbox/light-v11"
  }
  onDidFinishLoadingStyle={() => setStyleReady(true)}
  onPress={() => {
    setSelectedPin(null);
    setSelectedCluster(null);
    setSelectedOfficer(null);
  }}
  onRegionDidChange={(feature) => {
    const z = feature?.properties?.zoomLevel;
    if (typeof z === "number") setMapZoom(z);
  }}
  minZoomLevel={11.5}
>
          <Camera
            ref={cameraRef}
            zoomLevel={12}
            centerCoordinate={BACOOR_CENTER}
            animationMode="flyTo"
            animationDuration={800}
          />

          {styleReady && (
            <ShapeSource id="world-mask" shape={WORLD_MASK_GEOJSON}>
              <FillLayer
                id="world-mask-fill"
                style={{
                  fillColor: heatmapMode ? "#000000" : "#e5e7eb",
                  fillOpacity: heatmapMode ? 0.6 : 0.55,
                }}
              />
            </ShapeSource>
          )}

          {styleReady && geoJSON && (
  <ShapeSource id="barangays" shape={geoJSON}>
    <FillLayer id="barangay-fill" style={fillLayerStyle} />
    <LineLayer id="barangay-outline" style={outlineLayerStyle} />
    <SymbolLayer id="barangay-labels" style={labelLayerStyle} />
  </ShapeSource>
)}

          {/* Heatmap layer */}
          {styleReady && heatmapMode && heatGeoJSON && (
            <ShapeSource id="heat-points" shape={heatGeoJSON}>
              <HeatmapLayer id="crime-heat" style={heatmapLayerStyle} />
            </ShapeSource>
          )}

          {/* Cluster tap markers (invisible tap targets over cluster centers) */}
          {heatmapMode &&
            clusterGeoJSON?.features?.map((f, i) => (
              <MarkerView
                key={`cluster-${i}`}
                coordinate={f.geometry.coordinates}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <TouchableOpacity
                  style={styles.clusterTapTarget}
                  onPress={() => {
                    const p = f.properties;
                    setSelectedCluster({
                      lng: f.geometry.coordinates[0],
                      lat: f.geometry.coordinates[1],
                      count: p.count,
                      crime: p.dominant_crime,
                      barangay: p.dominant_barangay,
                      rank: p.rank,
                      modus: p.dominant_modus,
                    });
                  }}
                />
              </MarkerView>
            ))}

{/* Crime pin icons — native SymbolLayer, renders all at once, no mode-switch bugs */}
          {styleReady && (
          <Images
            images={{
              MURDER: require("../assets/pins/murder.png"),
              HOMICIDE: require("../assets/pins/homicide.png"),
              "PHYSICAL INJURY": require("../assets/pins/physical-injury.png"),
              RAPE: require("../assets/pins/rape.png"),
              ROBBERY: require("../assets/pins/robbery.png"),
              THEFT: require("../assets/pins/theft.png"),
              "CARNAPPING - MC": require("../assets/pins/carnapping-mc.png"),
              "CARNAPPING - MV": require("../assets/pins/carnapping-mv.png"),
              "SPECIAL COMPLEX CRIME": require("../assets/pins/special-complex.png"),
            }}
          />
          )}

          {styleReady && (
          <ShapeSource
            id="crime-pins"
            shape={pinsGeoJSON}
            onPress={(e) => {
              const id = e.features?.[0]?.properties?.blotter_id;
              const found = pins.find((p) => p.blotter_id === id);
              if (found) {
                setSelectedPin(found);
                setShowMorePopup(false);
              }
            }}
          >
            <SymbolLayer
              id="crime-pin-icons"
              aboveLayerID="barangay-labels"
              style={{
                iconImage: ["get", "iconKey"],
                iconSize: [
                  "interpolate",
                  ["linear"],
                  ["zoom"],
                  12, 0.14,
                  15, 0.2,
                  18, 0.28,
                ],
                iconAllowOverlap: true,
                iconIgnorePlacement: true,
                iconAnchor: "bottom",
                visibility: !heatmapMode && mapZoom >= 13 ? "visible" : "none",
              }}
            />
          </ShapeSource>
          )}
          
          {/* Officer dots — blue shield dot, tap to see name */}
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
              <TouchableOpacity
                onPress={() =>
                  setSelectedOfficer((prev) =>
                    prev?.user_id === officer.user_id ? null : officer,
                  )
                }
                activeOpacity={0.8}
              >
                <View style={styles.officerDot} />
              </TouchableOpacity>
            </MarkerView>
          ))}

          {/* Custom "my location" puck — MarkerView, not native UserLocation.
              Gated on styleReady + keyed on it so it force-remounts cleanly
              after every style reload (heatmap <-> choropleth switch). */}
          {styleReady && userRole === "Patrol" && gpsEnabled && myLocation && (
            <MarkerView
              key={`my-location-puck-${styleReady}`}
              id="my-location-puck"
              coordinate={myLocation}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.myLocationPuck} />
            </MarkerView>
          )}
        </MapView>

        {/* Map overlay buttons */}
{userRole === "Patrol" && (
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
)}

{userRole === "Patrol" && (
  <TouchableOpacity
    style={[styles.gpsToggleBtn, gpsEnabled && styles.gpsToggleBtnActive]}
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
)}

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

        {/* Risk legend (bottom-left) */}
        {!heatmapMode && (
  <View style={styles.riskLegend}>
    {[
      { color: "#b91c1c", label: `High (${thresholds.medMax + 1}+)` },
      {
        color: "#f97316",
        label: `Med (${thresholds.lowMax + 1}–${thresholds.medMax})`,
      },
      { color: "#eab308", label: `Low (1${thresholds.lowMax > 1 ? `–${thresholds.lowMax}` : ""})` },
      { color: "#ffffff", label: "None" },
    ].map((r) => (
      <View key={r.label} style={styles.riskRow}>
        <View style={[styles.riskDot, { backgroundColor: r.color }]} />
        <Text style={styles.riskLabel}>{r.label}</Text>
      </View>
    ))}
  </View>
)}

        {/* Officers online badge
        <View style={styles.officersBadge}>
          <View style={styles.officersBadgeDot} />
          <Text style={styles.officersBadgeText}>
            {officers.length} officer{officers.length !== 1 ? "s" : ""} online
          </Text>
        </View> */}

        {/* GPS status pill */}
        {userRole === "Patrol" && gpsEnabled && (
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
      <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 2 }} />
    ) : (
      <View style={styles.gpsStatusDot} />
    )}
    <Text style={styles.gpsStatusText}>
      {myLocation ? "GPS Active" : "Acquiring GPS..."}
    </Text>
  </View>
)}

        {/* Officer name tooltip */}
        {selectedOfficer && (
          <View style={styles.officerNameTooltip}>
            <Text style={styles.officerNameTooltipText}>
              {selectedOfficer.abbreviation
                ? `${selectedOfficer.abbreviation}. ${selectedOfficer.first_name || ""} ${selectedOfficer.last_name || ""}`.trim()
                : `${selectedOfficer.first_name || ""} ${selectedOfficer.last_name || ""}`.trim() ||
                  selectedOfficer.username ||
                  "Officer"}
            </Text>
          </View>
        )}

        {/* Cluster selected popup */}
        {heatmapMode && selectedCluster && (
          <View style={styles.popup}>
            <View style={[styles.popupHeader, { backgroundColor: "#1e3a5f" }]}>
              <Text style={styles.popupType}>
                Cluster #{selectedCluster.rank}
              </Text>
              <TouchableOpacity onPress={() => setSelectedCluster(null)}>
                <Ionicons name="close" size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <View style={styles.popupBody}>
              {[
                ["Incidents", selectedCluster.count],
                ["Top Crime", selectedCluster.crime || "N/A"],
                ["Barangay", selectedCluster.barangay || "N/A"],
                ["Modus", selectedCluster.modus || "N/A"],
              ].map(([lbl, val]) => (
                <View key={lbl} style={styles.popupRow}>
                  <Text style={styles.popupLbl}>{lbl}</Text>
                  <Text style={styles.popupVal} numberOfLines={2}>
                    {val}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* GPS CONFIRMATION MODAL */}
      {userRole === "Patrol" && (
  <Modal
    visible={showGpsConfirm}
    transparent
    animationType="fade"
    onRequestClose={() => setShowGpsConfirm(false)}
  >
    <View style={styles.confirmBackdrop}>
      <View style={styles.confirmBox}>
        <Ionicons name="location" size={32} color="#1e3a5f" style={{ marginBottom: 10 }} />
        <Text style={styles.confirmTitle}>Enable GPS Tracking</Text>
        <Text style={styles.confirmMsg}>
          Your location will be shared with the system and visible to
          dispatchers while GPS is active.
        </Text>
        <View style={styles.confirmBtns}>
          <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowGpsConfirm(false)}>
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
)}

      {/* CRIME PIN POPUP */}
      {!heatmapMode && selectedPin && (
        <View style={[styles.popup, { bottom: TAB_BAR_HEIGHT }]}>
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
        <View style={[styles.sidebar, { paddingBottom: insets.bottom }]}>
          <View style={styles.sidebarHandle} />

          {/* Tabs: Legend / Recent / Incidence */}
          <View style={styles.sidebarTabs}>
            {[
              { key: "legend", label: "Legend" },
              { key: "recent", label: "Recent" },
              {
                key: "incidence",
                label: heatmapMode ? "Clusters" : "Incidence",
              },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.sidebarTab,
                  activeTab === tab.key && styles.sidebarTabActive,
                ]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text
                  style={[
                    styles.sidebarTabText,
                    activeTab === tab.key && styles.sidebarTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={styles.sidebarBody}
            showsVerticalScrollIndicator={false}
          >
            {/* ── COMBINED FILTERS ── */}

            {/* Date section */}
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
                  style={styles.clearDateBtn}
                  onPress={() => {
                    const from = getPHTOneYearAgo();
                    const to = getPHTToday();
                    setFilterDateFrom(from);
                    setFilterDateTo(to);
                  }}
                >
                  <Text style={styles.clearDateBtnText}>Reset to 1 Year</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Crime type section */}
            <View style={styles.dateFilterRow}>
              <TouchableOpacity
                style={styles.dateFilterBtn}
                onPress={() => setShowCrimeTypeFilter((v) => !v)}
              >
                <Ionicons name="flag-outline" size={14} color="#1e3a5f" />
                <Text style={styles.dateFilterBtnText}>
                  {filterIncidentTypes.length === 0
                    ? "All Crime Types"
                    : `${filterIncidentTypes.length} Crime Type${filterIncidentTypes.length > 1 ? "s" : ""} Selected`}
                </Text>
                <Ionicons
                  name={showCrimeTypeFilter ? "chevron-up" : "chevron-down"}
                  size={12}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>

            {showCrimeTypeFilter && (
              <View style={styles.dateFilterPanel}>
                <View style={styles.crimeTypeActionsRow}>
                  <TouchableOpacity
                    onPress={() =>
                      setFilterIncidentTypes((prev) =>
                        prev.length === INDEX_CRIMES.length
                          ? []
                          : [...INDEX_CRIMES],
                      )
                    }
                  >
                    <Text style={styles.crimeTypeActionText}>
                      {filterIncidentTypes.length === INDEX_CRIMES.length
                        ? "Clear all"
                        : "Select all"}
                    </Text>
                  </TouchableOpacity>
                  {filterIncidentTypes.length > 0 && (
                    <TouchableOpacity onPress={() => setFilterIncidentTypes([])}>
                      <Text
                        style={[
                          styles.crimeTypeActionText,
                          { color: "#dc2626" },
                        ]}
                      >
                        Clear ({filterIncidentTypes.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {INDEX_CRIMES.map((c) => {
                  const checked = filterIncidentTypes.includes(c);
                  return (
                    <TouchableOpacity
                      key={c}
                      style={styles.crimeTypeItem}
                      onPress={() =>
                        setFilterIncidentTypes((prev) =>
                          checked
                            ? prev.filter((x) => x !== c)
                            : [...prev, c],
                        )
                      }
                    >
                      <View
                        style={[
                          styles.crimeTypeCheckbox,
                          checked && styles.crimeTypeCheckboxChecked,
                        ]}
                      >
                        {checked && (
                          <Ionicons name="checkmark" size={12} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.crimeTypeItemText}>
                        {CRIME_DISPLAY[c]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Barangay section — locked for patrol users with an ongoing schedule */}
            {isPatrol && hasPatrolAssignment ? (
              <View style={styles.dateFilterRow}>
                <View style={styles.lockedFilterBox}>
                  <Ionicons name="lock-closed-outline" size={14} color="#6b7280" />
                  <Text style={styles.lockedFilterText}>
                    {patrolAssignedBarangays.length} Assigned Barangay
                    {patrolAssignedBarangays.length !== 1 ? "s" : ""}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.dateFilterRow}>
                <TouchableOpacity
                  style={styles.dateFilterBtn}
                  onPress={() => setShowBarangayFilter((v) => !v)}
                >
                  <Ionicons name="location-outline" size={14} color="#1e3a5f" />
                  <Text style={styles.dateFilterBtnText}>
                    {filterBarangays.length === 0
                      ? "All Barangays"
                      : `${filterBarangays.length} Barangay${filterBarangays.length > 1 ? "s" : ""} Selected`}
                  </Text>
                  <Ionicons
                    name={showBarangayFilter ? "chevron-up" : "chevron-down"}
                    size={12}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
            )}

            {!(isPatrol && hasPatrolAssignment) && showBarangayFilter && (
              <View style={styles.dateFilterPanel}>
                <TextInput
                  style={styles.barangaySearchInput}
                  value={barangaySearch}
                  onChangeText={setBarangaySearch}
                  placeholder="Search barangay..."
                  placeholderTextColor="#adb5bd"
                />

                <View style={styles.crimeTypeActionsRow}>
                  <TouchableOpacity
                    onPress={() =>
                      setFilterBarangays((prev) =>
                        prev.length === allBarangays.length
                          ? []
                          : [...allBarangays],
                      )
                    }
                  >
                    <Text style={styles.crimeTypeActionText}>
                      {filterBarangays.length === allBarangays.length
                        ? "Clear all"
                        : "Select all"}
                    </Text>
                  </TouchableOpacity>
                  {filterBarangays.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setFilterBarangays([]);
                        setBarangaySearch("");
                      }}
                    >
                      <Text
                        style={[
                          styles.crimeTypeActionText,
                          { color: "#dc2626" },
                        ]}
                      >
                        Clear ({filterBarangays.length})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  style={styles.barangayListScroll}
                  nestedScrollEnabled
                >
                  {filteredBarangayOptions.map((b) => {
                    const checked = filterBarangays.includes(b);
                    return (
                      <TouchableOpacity
                        key={b}
                        style={styles.crimeTypeItem}
                        onPress={() =>
                          setFilterBarangays((prev) =>
                            checked
                              ? prev.filter((x) => x !== b)
                              : [...prev, b],
                          )
                        }
                      >
                        <View
                          style={[
                            styles.crimeTypeCheckbox,
                            checked && styles.crimeTypeCheckboxChecked,
                          ]}
                        >
                          {checked && (
                            <Ionicons name="checkmark" size={12} color="#fff" />
                          )}
                        </View>
                        <Text style={styles.crimeTypeItemText}>
                          {formatBarangayLabel(b)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  {filteredBarangayOptions.length === 0 && (
                    <Text style={styles.emptyText}>No barangays found.</Text>
                  )}
                </ScrollView>
              </View>
            )}

            {/* ── SINGLE APPLY / RESET ROW ── */}
            <View style={styles.filterActionsRow}>
              <TouchableOpacity
                style={[
                  styles.applyDateBtn,
                  { flex: 1 },
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
                  setAppliedIncidentTypes(filterIncidentTypes);
                  setAppliedBarangays(filterBarangays);
                  setShowDateFilter(false);
                  setShowCrimeTypeFilter(false);
                  setShowBarangayFilter(false);

                  if (filterBarangays.length > 0 && rawGeoJSON) {
                    const allCoords = [];
                    filterBarangays.forEach((name) => {
                      const feature = rawGeoJSON.features.find(
                        (f) => f.properties.name_db === name,
                      );
                      if (!feature) return;
                      const coords =
                        feature.geometry.type === "Polygon"
                          ? feature.geometry.coordinates[0]
                          : feature.geometry.coordinates[0][0];
                      allCoords.push(...coords);
                    });
                    if (allCoords.length > 0) {
                      const lngs = allCoords.map((c) => c[0]);
                      const lats = allCoords.map((c) => c[1]);
                      cameraRef.current?.fitBounds(
                        [Math.max(...lngs), Math.max(...lats)],
                        [Math.min(...lngs), Math.min(...lats)],
                        40,
                        800,
                      );
                    }
                  } else if (filterBarangays.length === 0) {
                    cameraRef.current?.setCamera({
                      centerCoordinate: BACOOR_CENTER,
                      zoomLevel: 12,
                      animationDuration: 800,
                    });
                  }
                }}
              >
                <Text style={styles.applyDateBtnText}>Apply Filters</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.clearDateBtn, { flex: 1 }]}
                onPress={() => {
                  const from = getPHTOneYearAgo();
                  const to = getPHTToday();
                  const lockedBarangays =
                    isPatrol && hasPatrolAssignment ? patrolAssignedBarangays : [];

                  setFilterDateFrom(from);
                  setFilterDateTo(to);
                  setAppliedDateFrom(from);
                  setAppliedDateTo(to);
                  setFilterIncidentTypes([]);
                  setAppliedIncidentTypes([]);
                  setFilterBarangays(lockedBarangays);
                  setAppliedBarangays(lockedBarangays);
                  setBarangaySearch("");
                  setShowDateFilter(false);
                  setShowCrimeTypeFilter(false);
                  setShowBarangayFilter(false);

                  if (!(isPatrol && hasPatrolAssignment)) {
                    cameraRef.current?.setCamera({
                      centerCoordinate: BACOOR_CENTER,
                      zoomLevel: 12,
                      animationDuration: 800,
                    });
                  }
                }}
              >
                <Text style={styles.clearDateBtnText}>Reset All</Text>
              </TouchableOpacity>
            </View>

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
                          {/* Teardrop legend icon */}
                          <View style={styles.legendPinWrap}>
                            <View
                              style={[
                                styles.legendPinBody,
                                { backgroundColor: color },
                              ]}
                            >
                              <View style={styles.legendPinInner} />
                            </View>
                            <View
                              style={[
                                styles.legendPinTip,
                                { borderTopColor: color },
                              ]}
                            />
                          </View>
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
{!heatmapMode && (
  <>
    <Text style={[styles.sectionLabel, { marginTop: 20 }]}>
      Barangay Crime Incidence
    </Text>
    <Text style={styles.dateRangeNote}>
      {`Thresholds for ${dayCount}-day range`}
    </Text>
    {[
      { color: "#ffffff", label: "No crimes", range: "0" },
      {
        color: "#eab308",
        label: "Low Incidence",
        range: thresholds.lowMax === 1 ? "1" : `1–${thresholds.lowMax}`,
      },
      {
        color: "#f97316",
        label: "Medium Incidence",
        range: `${thresholds.lowMax + 1}–${thresholds.medMax}`,
      },
      {
        color: "#b91c1c",
        label: "High Incidence",
        range: `${thresholds.medMax + 1}+`,
      },
    ].map((r) => (
      <View key={r.label} style={styles.riskLegendRow}>
        <View style={[styles.riskLegendDot, { backgroundColor: r.color }]} />
        <Text style={styles.riskLegendLabel}>{r.label}</Text>
        <Text style={styles.riskLegendRange}>{r.range} crimes</Text>
      </View>
    ))}
  </>
)}
              </View>
            )}

            {/* ── RECENT TAB ── */}
            {activeTab === "recent" && (
              <View style={styles.tabContent}>
                <Text style={styles.dateRangeNote}>
                  {appliedDateFrom} → {appliedDateTo}
                </Text>
                {stats?.recent_incidents?.length > 0 ? (
                  stats.recent_incidents.map((r, i) => {
                    const color =
                      INCIDENT_COLORS[r.incident_type?.toUpperCase()] ||
                      "#6b7280";
                    return (
                      <View key={i} style={styles.recentItem}>
                        <View
                          style={[styles.recentBar, { backgroundColor: color }]}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recentType}>
                            {r.incident_type}
                          </Text>
                          <Text style={styles.recentBrgy}>
                            📍 {r.place_barangay}
                          </Text>
                          <Text style={styles.recentDate}>
                            {formatDate(r.date_time_commission)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>
                    No recent incidents found.
                  </Text>
                )}
              </View>
            )}

            {/* ── INCIDENCE / CLUSTERS TAB ── */}
            {activeTab === "incidence" && (
              <View style={styles.tabContent}>
                <Text style={styles.dateRangeNote}>
                  {appliedDateFrom} → {appliedDateTo}
                </Text>

                {heatmapMode ? (
                  // Clusters list
                  clusterGeoJSON?.features?.length > 0 ? (
                    clusterGeoJSON.features.map((f, i) => {
                      const p = f.properties;
                      return (
                        <TouchableOpacity
                          key={`cluster-row-${i}`}
                          style={styles.clusterRow}
                          onPress={() => {
                            cameraRef.current?.setCamera({
                              centerCoordinate: f.geometry.coordinates,
                              zoomLevel: 14,
                              animationDuration: 800,
                            });
                            setShowSidebar(false);
                          }}
                        >
                          <View style={styles.clusterRowLeft}>
                            <Text style={styles.clusterCrime}>
                              Cluster #{p.rank}
                            </Text>
                          </View>
                          <View style={styles.clusterBadge}>
                            <Text style={styles.clusterBadgeText}>
                              {p.count}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyText}>
                      No clusters detected for this period.
                    </Text>
                  )
                ) : (
                  // Incidence list
                  (() => {
                    const incidenceList = boundaries
                      .filter((b) => b.crime_count >= 1)
                      .sort((a, b) => b.crime_count - a.crime_count);

                    return incidenceList.length > 0 ? (
                      incidenceList.map((h, i) => {
                        const barColor =
                          h.risk === "High Incidence"
                            ? "#b91c1c"
                            : h.risk === "Moderate Incidence"
                              ? "#f97316"
                              : "#eab308";
                        const maxCount = incidenceList[0].crime_count || 1;
                        return (
                          <View key={h.name_db} style={styles.hotspotRow}>
                            <Text style={styles.hotspotRank}>#{i + 1}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.hotspotName}>
                                {h.name_db}
                              </Text>
                              <Text
                                style={[
                                  styles.hotspotRisk,
                                  { color: barColor },
                                ]}
                              >
                                {h.risk}
                              </Text>
                              <View style={styles.hotspotBarBg}>
                                <View
                                  style={[
                                    styles.hotspotBarFill,
                                    {
                                      width: `${Math.min(100, (h.crime_count / maxCount) * 100)}%`,
                                      backgroundColor: barColor,
                                    },
                                  ]}
                                />
                              </View>
                            </View>
                            <Text style={styles.hotspotCount}>
                              {h.crime_count}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={styles.emptyText}>
                        No barangays with recorded incidents.
                      </Text>
                    );
                  })()
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
  container: {
    flex: 1,
    backgroundColor: "#0a285c",
  },
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
  iconBtnActive: {
    backgroundColor: "rgba(255,107,53,0.25)",
  },

  // Map container — flex:1 fills space between header and tab bar
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1 },
  
  // ── Legend teardrop icon (smaller) ────────────────────────
  legendPinWrap: {
    alignItems: "center",
    width: 14,
    height: 20,
    marginRight: 6,
  },
  legendPinBody: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  legendPinInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  legendPinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },

  myLocationPuck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1d4ed8",
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
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

  // Cluster tap target
  clusterTapTarget: {
    width: 44,
    height: 44,
  },

  recenterBtn: {
    position: "absolute",
    bottom: 240,
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
    bottom: 180,
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
  gpsToggleBtnActive: { backgroundColor: "#1e3a5f" },
  resetBtn: {
    position: "absolute",
    bottom: 120,
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
    bottom: 120,
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
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#ced4da",
  },
  riskLabel: { fontSize: 10, color: "#374151", fontWeight: "600" },

  officersBadge: {
    position: "absolute",
    top: 12,
    right: 12,
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

  officerNameTooltip: {
    position: "absolute",
    top: 56,
    alignSelf: "center",
    backgroundColor: "rgba(10,40,92,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  officerNameTooltipText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  // GPS confirm modal
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

  // Crime/cluster popup (bottom sheet)
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
  popupToggleBtn: {
    marginTop: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 6,
    alignItems: "center",
  },
  popupToggleText: { fontSize: 12, fontWeight: "600", color: "#1e3a5f" },

  // Sidebar
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
  sidebar: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "72%",
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

  filterActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },

  // Date filter
  dateFilterRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 4,
  },
  lockedFilterBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  lockedFilterText: {
    fontSize: 11,
    color: "#495057",
    fontWeight: "600",
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
  crimeTypeActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  crimeTypeActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e3a5f",
  },
  barangaySearchInput: {
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: "#111827",
    backgroundColor: "#ffffff",
    marginBottom: 8,
  },
  barangayListScroll: {
    maxHeight: 220,
  },
  crimeTypeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  crimeTypeCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#adb5bd",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  crimeTypeCheckboxChecked: {
    backgroundColor: "#1e3a5f",
    borderColor: "#1e3a5f",
  },
  crimeTypeItemText: {
    fontSize: 13,
    color: "#374151",
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

  // Legend rows
  legendRow: { gap: 5 },
  legendTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  legendLeft: { flexDirection: "row", alignItems: "center" },
  legendName: { fontSize: 12, color: "#374151", fontWeight: "500" },
  legendCount: { fontSize: 13, fontWeight: "700", color: "#0a285c" },
  barBg: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.07)",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 4 },

  // Risk legend in sidebar
  riskLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  riskLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#ced4da",
  },
  riskLegendLabel: { fontSize: 13, color: "#374151", flex: 1 },
  riskLegendRange: { fontSize: 11, color: "#6b7280" },

  // Recent tab
  recentItem: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  recentBar: { width: 4, borderRadius: 2 },
  recentType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  recentBrgy: { fontSize: 11, color: "#6b7280", marginBottom: 2 },
  recentDate: { fontSize: 11, color: "#9ca3af" },

  // Incidence / clusters tab
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
  hotspotRisk: { fontSize: 10, fontWeight: "700", marginBottom: 5 },
  hotspotBarBg: {
    height: 4,
    backgroundColor: "#fee2e2",
    borderRadius: 4,
    overflow: "hidden",
  },
  hotspotBarFill: { height: "100%", borderRadius: 4 },
  hotspotCount: { fontSize: 15, fontWeight: "700", color: "#c1272d" },

  clusterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    backgroundColor: "rgba(239,68,68,0.04)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.15)",
    borderLeftWidth: 3,
    borderLeftColor: "#ef4444",
    marginBottom: 8,
  },
  clusterRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  clusterRank: { fontSize: 14, fontWeight: "700", color: "#9ca3af", width: 28 },
  clusterCrime: { fontSize: 12, fontWeight: "700", color: "#111827" },
  clusterBrgy: { fontSize: 11, color: "#6b7280", marginTop: 2 },
  clusterBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clusterBadgeText: { fontSize: 11, color: "#ffffff", fontWeight: "700" },

  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 13,
    paddingVertical: 24,
  },
});
