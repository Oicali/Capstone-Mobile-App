// screens/components/LoginApprovalModal.js
import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  DeviceEventEmitter,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  approveLoginNotification,
  denyLoginNotification,
  getDeviceId,
  getSession,
} from "./services/api";

export default function LoginApprovalModal() {
  const [visible, setVisible] = useState(false);
  const [request, setRequest] = useState(null);
  const [trustChecked, setTrustChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resolved, setResolved] = useState(null); // 'approved' | 'denied' | null

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("loginApprovalRequest", async (data) => {
      if (!data?.notificationId) return;

      // Only a logged-in device can approve anything
      const session = await getSession();
      if (!session?.token) return;

      // Never show the prompt on the device that is asking for approval
      const myDeviceId = await getDeviceId();
      const requester =
        data.requesting_device_id || data.metadata?.requesting_device_id;
      if (requester && requester === myDeviceId) return;
      setRequest(data);
      setTrustChecked(false);
      setResolved(null);
      setVisible(true);
    });
    return () => sub.remove();
  }, []);

  const close = () => {
    setVisible(false);
    setRequest(null);
  };

  const handleApprove = async () => {
    if (!request?.notificationId) return;
    setLoading(true);
    const res = await approveLoginNotification(request.notificationId, trustChecked);
    setLoading(false);
    if (res.success) {
      setResolved("approved");
      setTimeout(close, 1500);
    }
  };

  const handleDeny = async () => {
    if (!request?.notificationId) return;
    setLoading(true);
    const res = await denyLoginNotification(request.notificationId);
    setLoading(false);
    if (res.success) {
      setResolved("denied");
      setTimeout(close, 1500);
    }
  };

  if (!request) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={s.overlay}>
        <View style={s.card}>
          <TouchableOpacity
            style={s.closeBtn}
            onPress={close}
            disabled={loading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Ionicons name="shield-checkmark" size={28} color="#1e3a8a" />
          </View>

          {resolved ? (
            <>
              <Text style={s.title}>
                {resolved === "approved" ? "Login Approved" : "Login Denied"}
              </Text>
              <Text style={s.sub}>
                {resolved === "approved"
                  ? "The other device can now sign in."
                  : "The login attempt was blocked."}
              </Text>
            </>
          ) : (
            <>
              <Text style={s.title}>Approve This Login?</Text>
              <Text style={s.sub}>
                A login attempt on{" "}
                <Text style={{ fontWeight: "700" }}>{request.device_label || "another device"}</Text>{" "}
                is waiting for your approval.
              </Text>
              {!!request.ip_address && <Text style={s.meta}>IP: {request.ip_address}</Text>}

              <TouchableOpacity
                style={s.checkboxRow}
                onPress={() => setTrustChecked((v) => !v)}
                disabled={loading}
              >
                <Ionicons
                  name={trustChecked ? "checkbox" : "square-outline"}
                  size={20}
                  color="#1e3a8a"
                />
                <Text style={s.checkboxTxt}>Also trust that new device for 30 days</Text>
              </TouchableOpacity>

              <View style={s.btnRow}>
                <TouchableOpacity style={[s.btn, s.denyBtn]} onPress={handleDeny} disabled={loading}>
                  {loading ? <ActivityIndicator color="#dc2626" /> : <Text style={s.denyTxt}>Deny</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.approveBtn]} onPress={handleApprove} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.approveTxt}>Approve</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(7,29,71,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, alignItems: "center" },
  iconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#EEF3FF", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontSize: 17, fontWeight: "800", color: "#0F172A", textAlign: "center", marginBottom: 8 },
  sub: { fontSize: 13, color: "#475569", textAlign: "center", lineHeight: 19, marginBottom: 6 },
  meta: { fontSize: 12, color: "#94A3B8", marginBottom: 12 },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 18 },
  checkboxTxt: { fontSize: 12, color: "#475569", flex: 1 },
  btnRow: { flexDirection: "row", gap: 10, width: "100%" },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  denyBtn: { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#DC2626" },
  denyTxt: { color: "#DC2626", fontWeight: "700" },
  approveBtn: { backgroundColor: "#1e3a8a" },
  approveTxt: { color: "#fff", fontWeight: "700" },
});