// screens/components/AppLockToggle.js
import React, { useEffect, useState } from "react";
import { View, Text, Switch, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getLockEnabled,
  setLockEnabled,
  isBiometricAvailable,
  authenticate,
  isNativeReady,
} from "../services/appLock";

export default function AppLockToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    getLockEnabled().then(setEnabled);
  }, []);

  const toggle = async (next) => {
    if (!isNativeReady()) {
      Alert.alert(
        "Update required",
        "App lock needs the latest version of the app. Install the newest build to use it.",
      );
      return;
    }
    if (next) {
      if (!(await isBiometricAvailable())) {
        Alert.alert(
          "Set up a screen lock first",
          "Add a fingerprint, PIN, or pattern in your phone's Settings, then try again. If you already did, install the newest version of the app.",
        );
        return;
      }
      if (!(await authenticate("Confirm to turn on app lock"))) return;
      await setLockEnabled(true);
      setEnabled(true);
    } else {
      if (!(await authenticate("Confirm to turn off app lock"))) return;
      await setLockEnabled(false);
      setEnabled(false);
    }
  };

  return (
    <View style={s.row}>
      <View style={s.icon}>
        <Ionicons name="finger-print" size={20} color="#1e3a5f" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>App lock</Text>
        <Text style={s.sub}>
          Ask for fingerprint or screen lock when you return to the app
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={toggle}
        trackColor={{ false: "#cbd5e1", true: "#1e3a5f" }}
        thumbColor="#fff"
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8edf3",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#e8eef6",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14.5, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 11.5, color: "#64748b", marginTop: 2, lineHeight: 16 },
});
