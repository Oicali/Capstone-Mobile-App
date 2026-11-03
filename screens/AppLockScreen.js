// ===== FILE: screens/AppLockScreen.js (replace the whole file) =====
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
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

        {/* decorative background circles (no gradient module needed) */}
        <View style={s.bgCircleTop} />
        <View style={s.bgCircleBottom} />

        {/* logo */}
        <View style={s.logoRing}>
          <View style={s.logoInner}>
            <Image
              source={require("../assets/Bantay-logo.png")}
              style={s.logo}
              resizeMode="contain"
            />
          </View>
          <View style={s.lockBadge}>
            <Ionicons name="lock-closed" size={14} color="#fff" />
          </View>
        </View>

        <Text style={s.brand}>BANTAY</Text>
        <Text style={s.title}>Secure Access</Text>
        <Text style={s.sub}>
          {name ? `Welcome back, ${name}. ` : ""}
          Verify it's you to continue.
        </Text>

        {/* unlock button */}
        <TouchableOpacity
          style={[s.btn, busy && { opacity: 0.7 }]}
          onPress={tryUnlock}
          disabled={busy}
          activeOpacity={0.85}
        >
          {busy ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={s.btnTxt}> Verifying...</Text>
            </>
          ) : (
            <>
              <Ionicons name="finger-print" size={22} color="#fff" />
              <Text style={s.btnTxt}> UNLOCK</Text>
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

        {/* security notice, styled like the login screen */}
        <View style={s.notice}>
          <Ionicons name="shield-checkmark" size={16} color="#93c5fd" />
          <Text style={s.noticeTxt}>
            <Text style={s.noticeBold}>Security Notice: </Text>
            BANTAY locks itself when you leave the app. Your phone's fingerprint
            or screen lock is required to continue.
          </Text>
        </View>
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
    overflow: "hidden",
  },
  bgCircleTop: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(30,58,95,0.55)",
  },
  bgCircleBottom: {
    position: "absolute",
    bottom: -140,
    left: -120,
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(193,39,45,0.10)",
  },

  logoRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(59,130,246,0.10)",
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  logoInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#122a4a",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: 64, height: 64 },
  lockBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#c1272d",
    borderWidth: 3,
    borderColor: "#0a1628",
    alignItems: "center",
    justifyContent: "center",
  },

  brand: {
    color: "#93c5fd",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 4,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 6,
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
    alignSelf: "stretch",
    elevation: 4,
  },
  btnTxt: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
  },

  failBox: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  failTxt: { color: "#fca5a5", fontSize: 13, fontWeight: "600" },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    padding: 8,
  },
  logoutTxt: { color: "#93c5fd", fontSize: 14, fontWeight: "700" },

  notice: {
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(30,58,95,0.45)",
    borderLeftWidth: 3,
    borderLeftColor: "#3b82f6",
    borderRadius: 8,
    padding: 12,
  },
  noticeTxt: {
    flex: 1,
    marginLeft: 10,
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    lineHeight: 16,
  },
  noticeBold: { color: "#fff", fontWeight: "700" },
});
