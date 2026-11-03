// screens/eblotter/Dialogs.js
import React, { memo, useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C, PAGE_SIZE } from "./constants";
import { FormHeader } from "./FormSteps";
import { Pagination } from "./ListUI";

export const cm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
  },
  box: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 24,
    width: "100%",
    maxWidth: 340,
  },
  title: { fontSize: 17, fontWeight: "800", color: C.text, marginBottom: 10 },
  msg: { fontSize: 14, color: C.sub, lineHeight: 22, marginBottom: 24 },
  row: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
  },
  cancelTxt: { fontSize: 14, fontWeight: "600", color: C.sub },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmTxt: { fontSize: 14, fontWeight: "700", color: C.white },
});

/* ------------------------------ ConfirmModal ------------------------------ */
export const ConfirmModal = memo(function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  confirmColor,
  onConfirm,
  onCancel,
}) {
  if (!visible) return null;
  const tone = confirmColor || C.red;
  return (
    <View
      style={[
        cm.overlay,
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        },
      ]}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onCancel}
      />
      <View style={cm.box}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: tone + "1A",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <Ionicons name="alert-circle" size={24} color={tone} />
        </View>
        <Text style={cm.title}>{title}</Text>
        <Text style={cm.msg}>{message}</Text>
        <View style={cm.row}>
          <TouchableOpacity style={cm.cancelBtn} onPress={onCancel}>
            <Text style={cm.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[cm.confirmBtn, { backgroundColor: tone }]}
            onPress={onConfirm}
          >
            <Text style={cm.confirmTxt}>{confirmText || "Confirm"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

/* ---------------------------- ViewReferralModal ---------------------------- */
export const ViewReferralModal = memo(function ViewReferralModal({
  visible,
  item,
  onClose,
  onViewFull,
  fmt,
}) {
  if (!visible || !item) return null;
  const Row = ({ icon, children }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Ionicons name={icon} size={13} color={C.muted} />
      <Text style={{ fontSize: 13, color: C.sub, flex: 1 }}>{children}</Text>
    </View>
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={cm.overlay}>
        <View style={[cm.box, { maxWidth: 360 }]}>
          <Text
            style={[
              cm.title,
              { fontSize: 13, color: C.navyMid, letterSpacing: 0.3 },
            ]}
          >
            {item.blotter_entry_number}
          </Text>
          <View style={{ gap: 8, marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: C.text }}>
              {item.incident_type}
            </Text>
            <Row icon="location-outline">
              Brgy. {item.place_barangay}, {item.place_city_municipality}
            </Row>
            <Row icon="time-outline">
              Referred:{" "}
              {fmt ? fmt(item.date_time_reported) : item.date_time_reported}
            </Row>
            {item.responder && (
              <Row icon="person-outline">
                Responder: {item.responder.first_name}{" "}
                {item.responder.last_name}
              </Row>
            )}
          </View>
          <View style={cm.row}>
            <TouchableOpacity style={cm.cancelBtn} onPress={onClose}>
              <Text style={cm.cancelTxt}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[cm.confirmBtn, { backgroundColor: C.navyMid }]}
              onPress={() => onViewFull(item.blotter_id)}
            >
              <Text style={cm.confirmTxt}>View Full</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

/* ---------------------------- RemindPatrolModal ---------------------------- */
export const RemindPatrolModal = memo(function RemindPatrolModal({
  visible,
  blotterId,
  blotterNumber,
  onClose,
  api,
  onSent,
}) {
  const [patrols, setPatrols] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (visible) {
      setSelected([]);
      setSearch("");
      (async () => {
        setLoading(true);
        const data = await api("/blotters/patrols");
        setPatrols(data?.success ? data.data || [] : []);
        setLoading(false);
      })();
    }
  }, [visible]);

  if (!visible) return null;

  const filteredPatrols = patrols.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const fullName = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase();
    return fullName.includes(q) || (p.email || "").toLowerCase().includes(q);
  });

  const toggle = (id) =>
    setSelected((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  const toggleAll = () =>
    setSelected(
      selected.length === filteredPatrols.length
        ? []
        : filteredPatrols.map((p) => p.user_id),
    );

  const submit = async () => {
    if (!selected.length) return;
    setSubmitting(true);
    const data = await api(`/blotters/${blotterId}/remind`, "POST", {
      patrol_ids: selected,
    });
    setSubmitting(false);
    if (data?.success) {
      onSent?.(selected.length);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={cm.overlay}>
        <View
          style={[cm.box, { maxWidth: 400, padding: 0, overflow: "hidden" }]}
        >
          <View
            style={{
              flexDirection: "row",
              padding: 18,
              backgroundColor: C.navy,
              alignItems: "flex-start",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.white, fontSize: 16, fontWeight: "800" }}>
                Remind Patrol Officers
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 12,
                  marginTop: 3,
                }}
              >
                Select officers to remind about #{blotterNumber}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={18} color={C.white} />
            </TouchableOpacity>
          </View>

          <View style={{ backgroundColor: C.bg, padding: 16 }}>
            {!loading && patrols.length > 0 && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: C.white,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderWidth: 1,
                  borderColor: C.border,
                  marginBottom: 12,
                }}
              >
                <Ionicons name="search-outline" size={15} color={C.muted} />
                <TextInput
                  style={{ flex: 1, fontSize: 14, color: C.text }}
                  placeholder="Search officer name or email…"
                  placeholderTextColor={C.faint}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
                {search.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSearch("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={15} color={C.muted} />
                  </TouchableOpacity>
                )}
              </View>
            )}
            {loading ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <ActivityIndicator color={C.navyMid} />
              </View>
            ) : patrols.length === 0 ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <Ionicons name="people-outline" size={32} color={C.muted} />
                <Text style={{ color: C.muted, marginTop: 8 }}>
                  No patrol officers found
                </Text>
              </View>
            ) : filteredPatrols.length === 0 ? (
              <View style={{ padding: 30, alignItems: "center" }}>
                <Ionicons name="search-outline" size={32} color={C.muted} />
                <Text style={{ color: C.muted, marginTop: 8 }}>
                  No officers match "{search}"
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingBottom: 10,
                    marginBottom: 8,
                    borderBottomWidth: 1,
                    borderBottomColor: C.border,
                  }}
                  onPress={toggleAll}
                >
                  <Ionicons
                    name={
                      selected.length === filteredPatrols.length
                        ? "checkbox"
                        : "square-outline"
                    }
                    size={18}
                    color={C.navyMid}
                  />
                  <Text
                    style={{
                      flex: 1,
                      fontWeight: "700",
                      fontSize: 13,
                      color: C.text,
                    }}
                  >
                    Select All
                    {search ? ` (${filteredPatrols.length} shown)` : ""}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: C.sub,
                      backgroundColor: "#e9ecef",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                    }}
                  >
                    {selected.length} selected
                  </Text>
                </TouchableOpacity>
                <FlatList
                  data={filteredPatrols}
                  keyExtractor={(item) => String(item.user_id)}
                  style={{ maxHeight: 320 }}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const isSel = selected.includes(item.user_id);
                    return (
                      <TouchableOpacity
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          backgroundColor: C.white,
                          borderWidth: 1,
                          borderColor: isSel ? C.navyMid : C.border,
                          borderRadius: 10,
                          padding: 10,
                          marginBottom: 8,
                        }}
                        onPress={() => toggle(item.user_id)}
                      >
                        <Ionicons
                          name={isSel ? "checkbox" : "square-outline"}
                          size={18}
                          color={C.navyMid}
                        />
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: C.navyMid,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: C.white,
                              fontWeight: "700",
                              fontSize: 12,
                            }}
                          >
                            {item.first_name?.[0]}
                            {item.last_name?.[0]}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontWeight: "700",
                              fontSize: 13,
                              color: C.text,
                            }}
                            numberOfLines={1}
                          >
                            {item.rank_abbreviation
                              ? `${item.rank_abbreviation}. `
                              : ""}
                            {item.first_name} {item.last_name}
                          </Text>
                          <Text
                            style={{ fontSize: 11, color: C.muted }}
                            numberOfLines={1}
                          >
                            {item.email}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              </>
            )}
          </View>

          <View
            style={{
              flexDirection: "row",
              gap: 10,
              padding: 14,
              borderTopWidth: 1,
              borderTopColor: C.border,
            }}
          >
            <TouchableOpacity style={cm.cancelBtn} onPress={onClose}>
              <Text style={cm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                cm.confirmBtn,
                { flex: 1.4, backgroundColor: C.navyMid },
                (submitting || !selected.length) && { opacity: 0.5 },
              ]}
              onPress={submit}
              disabled={submitting || !selected.length}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Text style={cm.confirmTxt}>
                  Send Reminder ({selected.length})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});

/* ------------------------------ SuccessModal ------------------------------ */
export function SuccessModal({ visible, message, reportId, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: C.white,
            borderRadius: 20,
            width: "100%",
            maxWidth: 400,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              backgroundColor: "#16a34a",
              padding: 24,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Ionicons name="checkmark-circle" size={48} color="white" />
            </View>
            <Text
              style={{
                color: "white",
                fontSize: 20,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              {message}
            </Text>
          </View>
          <View style={{ padding: 24 }}>
            <View
              style={{
                backgroundColor: "#f0fdf4",
                borderRadius: 10,
                padding: 16,
                borderWidth: 1,
                borderColor: "#86efac",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: "#166534",
                  marginBottom: 8,
                  textTransform: "uppercase",
                }}
              >
                Report ID
              </Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "700",
                  color: "#15803d",
                  fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                }}
              >
                {reportId}
              </Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: "#64748b",
                lineHeight: 20,
                textAlign: "center",
              }}
            >
              Your report has been successfully recorded.
            </Text>
          </View>
          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: "#e5e7eb",
              backgroundColor: "#f8fafc",
            }}
          >
            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: "#16a34a",
                paddingVertical: 14,
                borderRadius: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontSize: 15, fontWeight: "700" }}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------- Lightbox -------------------------------- */
export function Lightbox({ item, onClose }) {
  if (!item) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.9)",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        {item.isVideo ? (
          <Video
            source={{ uri: item.url }}
            style={{ width: "100%", height: 300, borderRadius: 10 }}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
          />
        ) : (
          <Image
            source={{ uri: item.url }}
            style={{ width: "100%", height: 300, borderRadius: 10 }}
            resizeMode="contain"
          />
        )}
        {item.caption ? (
          <Text
            style={{
              color: C.white,
              marginTop: 10,
              fontSize: 14,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            {item.caption}
          </Text>
        ) : null}
        <TouchableOpacity
          onPress={onClose}
          style={{
            position: "absolute",
            top: 50,
            right: 20,
            backgroundColor: C.red,
            borderRadius: 16,
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={18} color={C.white} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/* ------------------------------- TrashModal ------------------------------- */
const tr = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: C.white,
    borderRadius: 18,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  stripe: { width: 5, backgroundColor: C.red },
  top: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  id: {
    fontSize: 11,
    fontWeight: "700",
    color: C.navyMid,
    marginBottom: 3,
    opacity: 0.8,
  },
  inc: { fontSize: 16, fontWeight: "800", color: C.text },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.redBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red },
  pillTxt: { fontSize: 11, fontWeight: "700", color: C.red },
  mr: { flexDirection: "row", alignItems: "center", gap: 5 },
  mt: { fontSize: 12, color: C.sub, flex: 1 },
  restore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.greenBg,
    borderRadius: 11,
    paddingVertical: 11,
  },
});

export function TrashModal({
  visible,
  onClose,
  list,
  loading,
  page,
  onPage,
  onRestore,
  fmt,
  confirm,
  onCancelConfirm,
}) {
  const insets = useSafeAreaInsets();
  const paged = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View
        style={{ flex: 1, backgroundColor: C.navy, paddingTop: insets.top }}
      >
        <StatusBar barStyle="light-content" backgroundColor={C.navy} />
        <ConfirmModal {...confirm} onCancel={onCancelConfirm} />
        <FormHeader title="Deleted Records" onClose={onClose} />
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {loading ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator size="large" color={C.navyMid} />
            </View>
          ) : (
            <FlatList
              data={paged}
              keyExtractor={(item) => String(item.blotter_id)}
              contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <View style={tr.card}>
                  <View style={tr.stripe} />
                  <View style={{ flex: 1, padding: 14 }}>
                    <View style={tr.top}>
                      <View style={{ flex: 1 }}>
                        <Text style={tr.id}>{item.blotter_entry_number}</Text>
                        <Text style={tr.inc}>{item.incident_type}</Text>
                      </View>
                      <View style={tr.pill}>
                        <View style={tr.pillDot} />
                        <Text style={tr.pillTxt}>Deleted</Text>
                      </View>
                    </View>
                    <View style={{ gap: 5, marginBottom: 12 }}>
                      <View style={tr.mr}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color={C.muted}
                        />
                        <Text style={tr.mt}>
                          Brgy. {item.place_barangay},{" "}
                          {item.place_city_municipality}
                        </Text>
                      </View>
                      <View style={tr.mr}>
                        <Ionicons
                          name="calendar-outline"
                          size={12}
                          color={C.muted}
                        />
                        <Text style={tr.mt}>
                          Incident: {fmt(item.date_time_commission)}
                        </Text>
                      </View>
                      <View style={tr.mr}>
                        <Ionicons
                          name="time-outline"
                          size={12}
                          color={C.muted}
                        />
                        <Text style={tr.mt}>
                          Deleted: {fmt(item.deleted_at)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={tr.restore}
                      onPress={() => onRestore(item.blotter_id)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name="refresh-outline"
                        size={14}
                        color={C.green}
                      />
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: C.green,
                        }}
                      >
                        Restore Record
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 64 }}>
                  <View
                    style={{
                      width: 76,
                      height: 76,
                      borderRadius: 38,
                      backgroundColor: C.border,
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 14,
                    }}
                  >
                    <Ionicons name="trash-outline" size={32} color={C.muted} />
                  </View>
                  <Text
                    style={{ fontSize: 16, fontWeight: "800", color: C.sub }}
                  >
                    No deleted records
                  </Text>
                </View>
              }
              ListFooterComponent={
                list.length > PAGE_SIZE ? (
                  <Pagination
                    page={page}
                    total={list.length}
                    pageSize={PAGE_SIZE}
                    onChange={onPage}
                  />
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
