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
import {
  registerForPushNotifications,
  savePushToken,
} from "./services/pushNotifications";

const C = {
  navy: "#0B2D6B",
  navyDark: "#071D47",
  red: "#C1272D",
  white: "#FFFFFF",
  text: "#0F172A",
  textSub: "#64748B",
};

export default function NotificationsPermissionScreen({ navigation, route }) {
  const isLoggedIn = route.params?.isLoggedIn ?? false;
  const [busy, setBusy] = useState(false);

  const goNext = () => {
    navigation.replace("LocationPermission", { isLoggedIn });
  };

  const handleEnable = async () => {
    setBusy(true);
    try {
      const token = await registerForPushNotifications();
      if (token) await savePushToken(token);
    } catch {
      // Permission denied or unavailable — proceed regardless, this
      // screen never blocks the user from continuing into the app.
    } finally {
      setBusy(false);
      goNext();
    }
  };

  return (
    <LinearGradient colors={["#1e293b", "#0f172a", "#1e3a8a"]} style={{ flex: 1 }}>
      <SafeAreaView style={s.safe}>
        <View style={s.iconOuter}>
          <View style={s.iconInner}>
            <Ionicons name="notifications" size={36} color="#60a5fa" />
          </View>
        </View>

        <Text style={s.title}>Stay Informed</Text>
        <Text style={s.subtitle}>
          Turn on notifications to get alerted about new referrals, patrol
          assignments, and account login activity as they happen.
        </Text>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={s.primaryBtn} onPress={handleEnable} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={s.primaryTxt}>Enable Notifications</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={goNext} disabled={busy}>
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