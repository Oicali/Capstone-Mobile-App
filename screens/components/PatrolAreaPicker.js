// screens/components/PatrolAreaPicker.js
import React, { useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapboxGL from "@rnmapbox/maps";
import { C } from "./PatrolUI";

// Same token setup as PatrolDetailScreen, so this file works if loaded first
MapboxGL.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

export default function PatrolAreaPicker({
  geoJSONData,
  geoLoading,
  barangays,
  onToggle,
}) {
  const cameraRef = useRef(null);

  // Tag each feature with a fill color based on selection; memoized so the source isn't rebuilt on unrelated renders
  const coloredGeo = useMemo(() => {
    if (!geoJSONData) return null;
    return {
      ...geoJSONData,
      features: geoJSONData.features.map((f) => {
        const on = barangays.includes(f.properties.name_db);
        return {
          ...f,
          properties: {
            ...f.properties,
            fillColor: on ? "#1e3a5f" : "#e9ecef",
            fillOpacity: on ? 0.55 : 0.3,
          },
        };
      }),
    };
  }, [geoJSONData, barangays]);

  // Native hit-test result: first feature under the finger is the tapped barangay
  const handlePress = (e) => {
    const name = e?.features?.[0]?.properties?.name_db;
    if (name) onToggle(name);
  };

  // Zoom the camera to the bounding box of all selected barangays
  const fitToSelected = () => {
    if (!geoJSONData || barangays.length === 0) return;
    const coords = [];
    for (const f of geoJSONData.features) {
      if (!barangays.includes(f.properties.name_db)) continue;
      const rings =
        f.geometry.type === "Polygon"
          ? [f.geometry.coordinates[0]]
          : f.geometry.coordinates.map((p) => p[0]);
      for (const ring of rings) coords.push(...ring);
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
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Map card (fixed height, outside the ScrollView so drag gestures don't conflict) */}
      <View style={s.mapWrap}>
        {geoLoading ? (
          <View style={s.mapCenter}>
            <ActivityIndicator size="large" color={C.navy} />
          </View>
        ) : (
          <MapboxGL.MapView
            style={StyleSheet.absoluteFillObject}
            styleURL="mapbox://styles/mapbox/light-v11"
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
              <MapboxGL.ShapeSource
                id="add-patrol-barangays"
                shape={coloredGeo}
                onPress={handlePress}
              >
                <MapboxGL.FillLayer
                  id="apa-fill"
                  style={{
                    fillColor: ["get", "fillColor"],
                    fillOpacity: ["get", "fillOpacity"],
                  }}
                />
                <MapboxGL.LineLayer
                  id="apa-outline"
                  style={{ lineColor: "#1e3a5f", lineWidth: 1.5, lineOpacity: 0.7 }}
                />
                <MapboxGL.SymbolLayer
                  id="apa-labels"
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
        )}

        {/* Hint chip */}
        <View style={s.hint} pointerEvents="none">
          <Text style={s.hintTxt}>Tap a barangay to add or remove</Text>
        </View>

        {/* Fit-to-selection button */}
        {barangays.length > 0 && (
          <TouchableOpacity style={s.fitBtn} onPress={fitToSelected} activeOpacity={0.85}>
            <Ionicons name="scan-outline" size={18} color={C.navy} />
          </TouchableOpacity>
        )}
      </View>

      {/* Selected areas list */}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.card}>
          <View style={s.cardHead}>
            <View style={s.cardIcon}>
              <Ionicons name="location" size={14} color="#fff" />
            </View>
            <Text style={s.cardTitle}>Area of responsibility</Text>
            {barangays.length > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeTxt}>{barangays.length}</Text>
              </View>
            )}
          </View>

          {barangays.length === 0 ? (
            <Text style={s.empty}>No barangay selected yet. Tap the map.</Text>
          ) : (
            barangays.map((b, i) => (
              <View key={b} style={[s.row, i === 0 && { borderTopWidth: 0 }]}>
                <View style={s.idx}>
                  <Text style={s.idxTxt}>{i + 1}</Text>
                </View>
                <Ionicons name="location" size={15} color={C.red} />
                <Text style={s.name}>{b}</Text>
                <TouchableOpacity
                  onPress={() => onToggle(b)}
                  style={s.removeBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close" size={16} color="#475569" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  mapWrap: {
    height: 320,
    margin: 14,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f4f6f8",
  },
  mapCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  hintTxt: { fontSize: 11.5, fontWeight: "700", color: "#334155" },
  fitBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8edf3",
    overflow: "hidden",
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fafbfd",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cardIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: C.navy,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgeTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  empty: { fontSize: 13, color: C.faint, fontStyle: "italic", padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  idx: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#e8edf4",
    alignItems: "center",
    justifyContent: "center",
  },
  idxTxt: { fontSize: 11.5, fontWeight: "800", color: C.navy },
  name: { flex: 1, fontSize: 14, fontWeight: "700", color: C.text },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
});