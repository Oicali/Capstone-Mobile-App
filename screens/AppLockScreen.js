// screens/AppLockScreen.js
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authenticate } from "./services/appLock";

export default function AppLockScreen({ visible, onUnlock, onLogout }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");

  const tryUnlock = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await authenticate("Unlock BANTAY");
    setBusy(false);
    if (ok) onUnlock();
    else setFailed(true);
  };

  useEffect(() => {
    if (!visible) return;
    setFailed(false);
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("auth_user");
        if (raw) setName(JSON.parse(raw)?.first_name || "");
      } catch {}
    })();
    // small delay so the modal is fully shown before the system prompt opens
    const t = setTimeout(tryUnlock, 500);
    return () => clearTimeout(t);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        /* the Android back button cannot dismiss the lock */
      }}
    >
      <View style={s.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0a1628" />

        <View style={s.iconOuter}>
          <View style={s.iconInner}>
            <Ionicons name="lock-closed" size={34} color="#fff" />
          </View>
        </View>

        <Text style={s.title}>B.A.N.T.A.Y. is locked</Text>
        <Text style={s.sub}>
          {name ? `Welcome back, ${name}. ` : ""}Verify it's you to continue.
        </Text>

        <TouchableOpacity
          style={[s.btn, busy && { opacity: 0.6 }]}
          onPress={tryUnlock}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="finger-print" size={22} color="#fff" />
              <Text style={s.btnTxt}> Unlock</Text>
            </>
          )}
        </TouchableOpacity>

        {failed && (
          <View style={s.failBox}>
            <Ionicons name="alert-circle" size={15} color="#fca5a5" />
            <Text style={s.failTxt}> Couldn't verify. Please try again.</Text>
          </View>
        )}

        <TouchableOpacity
          style={s.logout}
          onPress={onLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={16} color="#93c5fd" />
          <Text style={s.logoutTxt}> Log out instead</Text>
        </TouchableOpacity>

        <Text style={s.foot}>
          Protected by your phone's fingerprint or screen lock
        </Text>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a1628",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  iconOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(59,130,246,0.1)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
  },
  iconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1e3a5f",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  sub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
    lineHeight: 20,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#c1272d",
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    minWidth: 220,
  },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  failBox: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  failTxt: { color: "#fca5a5", fontSize: 13, fontWeight: "600" },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 26,
    padding: 8,
  },
  logoutTxt: { color: "#93c5fd", fontSize: 14, fontWeight: "700" },
  foot: {
    position: "absolute",
    bottom: 36,
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
    textAlign: "center",
  },
});
