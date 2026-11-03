// screens/components/Toast.js
import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// Hook: one toast at a time; a new message replaces the old one and restarts the timer (5s default, like ProfileScreen)
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const showToast = useCallback((message, type = "error", ms = 5000) => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);

  // Stop the pending timer if the screen unmounts first
  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, showToast };
}

// Bar styled like ProfileScreen's toasts; `bottom` lifts it above the screen's own bottom bar
export default function Toast({ toast, bottom = 28 }) {
  if (!toast) return null;
  const ok = toast.type === "success";
  return (
    <View
      style={[s.wrap, { bottom }]}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
    >
      <View style={ok ? s.ok : s.err}>
        <View style={s.iconWrap}>
          <Ionicons
            name={ok ? "checkmark-circle" : "close-circle"}
            size={18}
            color="#FFFFFF"
          />
        </View>
        <Text style={s.txt}>{toast.message}</Text>
      </View>
    </View>
  );
}

const bar = {
  flexDirection: "row",
  paddingHorizontal: 16,
  paddingVertical: 13,
  borderRadius: 16,
  alignItems: "center",
  gap: 10,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.14,
  shadowRadius: 12,
  elevation: 8,
};

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16 },
  ok: { ...bar, backgroundColor: "#059669" },
  err: { ...bar, backgroundColor: "#DC2626" },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  txt: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", flex: 1 },
});