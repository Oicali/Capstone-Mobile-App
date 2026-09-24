import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

const C = { white: "#FFFFFF", red: "#C1272D" };

export default function LocationPermissionScreen({ navigation, route }) {
  const isLoggedIn = route.params?.isLoggedIn ?? false;
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    await AsyncStorage.setItem("onboarding_permissions_done", "1");
    navigation.reset({
      index: 0,
      routes: [{ name: isLoggedIn ? "Main" : "Login" }],
    });
  };

  const handleEnable = async () => {
    setBusy(true);
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status === "granted") {
        // Background permission powers patrol tracking while the app is
        // backgrounded (see tasks/locationTask.js). Requested here too,
        // but a foreground-only grant still lets the user continue —
        // background tracking simply won't start until it's granted,
        // likely re-prompted later when patrol tracking is first used.
        await Location.requestBackgroundPermissionsAsync();
      }
    } catch {
      // Denied or unavailable — never block continuing into the app.
    } finally {
      setBusy(false);
      finish();
    }
  };

  return (
    <LinearGradient colors={["#1e293b", "#0f172a", "#1e3a8a"]} style={{ flex: 1 }}>
      <SafeAreaView style={s.safe}>
        <View style={s.iconOuter}>
          <View style={s.iconInner}>
            <Ionicons name="location" size={36} color="#60a5fa" />
          </View>
        </View>

        <Text style={s.title}>Enable Location</Text>
        <Text style={s.subtitle}>
          BANTAY uses your location for patrol tracking and to show your
          position on the map while you're on duty.
        </Text>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={s.primaryBtn} onPress={handleEnable} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={s.primaryTxt}>Enable Location</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={finish} disabled={busy}>
          <Text style={s.skipTxt}>Not Now</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, padding: 24 },
  iconOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(59, 130, 246, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    marginBottom: 28,
    alignSelf: "center",
  },
  iconInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: C.white,
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#cbd5e1",
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  primaryBtn: {
    backgroundColor: C.red,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  primaryTxt: {
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  skipTxt: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
    marginBottom: 10,
  },
});