// screens/AfterPatrolScreen.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
  KeyboardAvoidingView, StatusBar, Image, Modal,
  FlatList, Pressable, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;

// ── Helpers ───────────────────────────────────────────────────────────────────
const parseLocalDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const todayDate = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};

const toInputDate = (d) => {
  if (!d) return "";
  const dt = typeof d === "string" ? parseLocalDate(d) : d;
  if (!dt) return "";
  const y  = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${y}-${mo}-${dd}`;
};

const formatDate = (d) => {
  const dt = parseLocalDate(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
};

const formatDateShort = (d) => {
  const dt = parseLocalDate(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

const getPatrolDateRange = (startDate, endDate) => {
  const dates = [];
  const start = parseLocalDate(startDate);
  const end   = parseLocalDate(endDate);
  if (!start || !end) return dates;
  const cur = new Date(start);
  while (cur <= end) {
    const y  = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    dates.push(`${y}-${mo}-${dd}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

const getPatrolStatus = (patrol) => {
  const t     = todayDate();
  const start = parseLocalDate(patrol.start_date);
  const end   = parseLocalDate(patrol.end_date);
  if (!start || !end) return "unknown";
  if (t < start) return "upcoming";
  if (t > end)   return "completed";
  return "active";
};

const calcCreditHours = (from, to) => {
  if (!from || !to) return "";
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  if (isNaN(fh) || isNaN(th)) return "";
  let fromMins = fh * 60 + fm;
  let toMins   = th * 60 + tm;
  if (toMins <= fromMins) toMins += 24 * 60;
  const totalMins = toMins - fromMins;
  const hrs  = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) return `${hrs} hrs`;
  return `${hrs} hrs ${mins} min`;
};

const DEFAULT_TIMES = {
  AM:        { timeFrom: "08:00", timeTo: "20:00" },
  PM:        { timeFrom: "20:00", timeTo: "08:00" },
  "AM & PM": { timeFrom: "08:00", timeTo: "08:00" },
};

const token = async () => AsyncStorage.getItem("auth_token");

const getAuth = async () => {
  const raw = await AsyncStorage.getItem("auth_user");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
};

// ── Empty form factory ────────────────────────────────────────────────────────
const emptyForm = (patrol, shift) => {
  const times = (shift && DEFAULT_TIMES[shift]) || { timeFrom: "", timeTo: "" };
  const creditHours = calcCreditHours(times.timeFrom, times.timeTo);
  return {
    date:           toInputDate(patrol?.start_date) || "",
    timeFrom:       times.timeFrom,
    timeTo:         times.timeTo,
    preDeployment:  "",
    action1:        "",
    incidents:      "",
    action2:        "",
    safetyConcerns: "",
    action3:        "",
    otherServices:  "",
    visitedAreas:   "",
    personsVisited: "",
    numOfficials:   "",
    numGovt:        "",
    sector:         patrol?.mobile_unit_name || "",
    mustDos:        "",
    remarks:        "",
    creditHours,
    sigOfficer1:    "",
    sigOfficer2:    "",
    sigSupervisor:  "",
  };
};

const dbRowToForm = (row) => ({
  date:           toInputDate(row.patrol_date),
  timeFrom:       row.time_from             || "",
  timeTo:         row.time_to               || "",
  preDeployment:  row.pre_deployment        || "",
  action1:        row.action_pre_deployment || "",
  incidents:      row.incidents             || "",
  action2:        row.action_incidents      || "",
  safetyConcerns: row.safety_concerns       || "",
  action3:        row.action_safety         || "",
  otherServices:  row.other_services        || "",
  visitedAreas:   row.visited_areas         || "",
  personsVisited: row.persons_visited       || "",
  numOfficials:   row.num_officials  != null ? String(row.num_officials)      : "",
  numGovt:        row.num_govt_officials != null ? String(row.num_govt_officials) : "",
  sector:         row.sector_beat    || "",
  mustDos:        row.must_dos       || "",
  remarks:        row.remarks        || "",
  creditHours:    row.credit_hours   || "",
  sigOfficer1:    row.sig_officer_1  || "",
  sigOfficer2:    row.sig_officer_2  || "",
  sigSupervisor:  row.sig_supervisor || "",
});

// ── Toast ─────────────────────────────────────────────────────────────────────
const Toast = ({ message, type, onHide }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onHide?.());
  }, []);

  const colors = {
    success: "#16a34a",
    error:   "#dc2626",
    warning: "#d97706",
    info:    "#1e3a5f",
  };
  const bg = colors[type] || colors.success;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

// ── Native Time Picker Modal ──────────────────────────────────────────────────
const TimePickerModal = ({ visible, value, onConfirm, onClose, label }) => {
  const parse24 = (v) => {
    if (!v) return { h: 8, m: 0, period: "AM" };
    const [hh, mm] = v.split(":").map(Number);
    const period = hh < 12 ? "AM" : "PM";
    const h12    = hh % 12 === 0 ? 12 : hh % 12;
    return { h: h12, m: mm, period };
  };

  const to24 = (h12, min, p) => {
    let hh = h12 % 12;
    if (p === "PM") hh += 12;
    return `${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };

  const init       = parse24(value);
  const [h, setH]  = useState(init.h);
  const [m, setM]  = useState(init.m);
  const [period, setPeriod] = useState(init.period);

  useEffect(() => {
    if (visible) {
      const p = parse24(value);
      setH(p.h); setM(p.m); setPeriod(p.period);
    }
  }, [visible, value]);

  const hours   = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.tpOverlay} onPress={onClose}>
        <Pressable style={styles.tpSheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.tpHeader}>
            <Text style={styles.tpTitle}>{label || "Select Time"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#6c757d" />
            </TouchableOpacity>
          </View>

          <View style={styles.tpBody}>
            {/* Hour */}
            <View style={styles.tpCol}>
              <Text style={styles.tpColLabel}>HR</Text>
              <ScrollView style={styles.tpScroll} showsVerticalScrollIndicator={false}>
                {hours.map((hv) => (
                  <TouchableOpacity
                    key={hv}
                    style={[styles.tpItem, h === hv && styles.tpItemActive]}
                    onPress={() => setH(hv)}
                  >
                    <Text style={[styles.tpItemText, h === hv && styles.tpItemTextActive]}>
                      {String(hv).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <Text style={styles.tpSep}>:</Text>

            {/* Minute */}
            <View style={styles.tpCol}>
              <Text style={styles.tpColLabel}>MIN</Text>
              <ScrollView style={styles.tpScroll} showsVerticalScrollIndicator={false}>
                {minutes.map((mv) => (
                  <TouchableOpacity
                    key={mv}
                    style={[styles.tpItem, m === mv && styles.tpItemActive]}
                    onPress={() => setM(mv)}
                  >
                    <Text style={[styles.tpItemText, m === mv && styles.tpItemTextActive]}>
                      {String(mv).padStart(2, "0")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* AM/PM */}
            <View style={styles.tpPeriodCol}>
              <Text style={styles.tpColLabel}> </Text>
              {["AM", "PM"].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.tpPeriodItem, period === p && styles.tpPeriodActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[styles.tpPeriodText, period === p && styles.tpPeriodTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.tpFooter}>
            <TouchableOpacity style={styles.tpCancelBtn} onPress={onClose}>
              <Text style={styles.tpCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tpConfirmBtn}
              onPress={() => { onConfirm(to24(h, m, period)); onClose(); }}
            >
              <Text style={styles.tpConfirmText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

// ── Time Field ────────────────────────────────────────────────────────────────
const TimeField = ({ label, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const display = value
    ? (() => {
        const [hh, mm] = value.split(":").map(Number);
        const p  = hh < 12 ? "AM" : "PM";
        const h12 = hh % 12 === 0 ? 12 : hh % 12;
        return `${String(h12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${p}`;
      })()
    : "— : —";

  return (
    <View style={styles.formGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.timeBtn, disabled && styles.timeBtnDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={disabled ? 1 : 0.7}
      >
        <Ionicons name="time-outline" size={15} color={disabled ? "#adb5bd" : "#1e3a5f"} />
        <Text style={[styles.timeBtnText, disabled && { color: "#adb5bd" }]}>{display}</Text>
        {!disabled && <Ionicons name="chevron-down" size={13} color="#adb5bd" />}
      </TouchableOpacity>
      <TimePickerModal
        visible={open}
        value={value}
        label={label}
        onConfirm={onChange}
        onClose={() => setOpen(false)}
      />
    </View>
  );
};

// ── Toggle Field ──────────────────────────────────────────────────────────────
const ToggleField = ({ fieldKey, label, children, shown, onShow, onHide, required }) => (
  <View style={styles.toggleWrap}>
    {!shown ? (
      <TouchableOpacity style={styles.addFieldBtn} onPress={() => onShow(fieldKey)} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={15} color="#1e3a5f" />
        <Text style={styles.addFieldText}>Add {label}</Text>
      </TouchableOpacity>
    ) : (
      <View>
        <View style={styles.toggleHeader}>
          <Text style={styles.fieldLabel}>
            {label}
            {required && <Text style={{ color: "#dc2626" }}> *</Text>}
          </Text>
          <TouchableOpacity onPress={() => onHide(fieldKey)}>
            <Text style={styles.removeFieldBtn}>− Remove</Text>
          </TouchableOpacity>
        </View>
        {children}
      </View>
    )}
  </View>
);

// ── Signature Select ──────────────────────────────────────────────────────────
const SignatureSelect = ({ label, value, onChange, patrollers, shift }) => {
  const [open, setOpen] = useState(false);
  const names = patrollers
    .filter((p) => !shift || p.shift === shift || shift === "AM & PM")
    .map((p) => p.officer_name)
    .filter(Boolean);
  const [custom, setCustom] = useState(false);

  const display = value || "— Select officer —";

  return (
    <View style={styles.formGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {!custom ? (
        <>
          <TouchableOpacity style={styles.selectBtn} onPress={() => setOpen(true)} activeOpacity={0.7}>
            <Text style={[styles.selectBtnText, !value && { color: "#adb5bd" }]} numberOfLines={1}>
              {display}
            </Text>
            <Ionicons name="chevron-down" size={13} color="#adb5bd" />
          </TouchableOpacity>
          <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
            <Pressable style={styles.tpOverlay} onPress={() => setOpen(false)}>
              <View style={[styles.tpSheet, { maxHeight: 400 }]}>
                <View style={styles.tpHeader}>
                  <Text style={styles.tpTitle}>{label}</Text>
                  <TouchableOpacity onPress={() => setOpen(false)}>
                    <Ionicons name="close" size={22} color="#6c757d" />
                  </TouchableOpacity>
                </View>
                <ScrollView>
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => { onChange(""); setOpen(false); }}
                  >
                    <Text style={[styles.optionText, { color: "#adb5bd" }]}>— Select officer —</Text>
                  </TouchableOpacity>
                  {names.map((n) => (
                    <TouchableOpacity
                      key={n}
                      style={[styles.optionRow, value === n && styles.optionRowActive]}
                      onPress={() => { onChange(n); setOpen(false); }}
                    >
                      <Text style={[styles.optionText, value === n && styles.optionTextActive]}>{n}</Text>
                      {value === n && <Ionicons name="checkmark" size={16} color="#1e3a5f" />}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => { setCustom(true); setOpen(false); }}
                  >
                    <Text style={[styles.optionText, { color: "#1e3a5f", fontWeight: "700" }]}>
                      + Add officer manually…
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </Pressable>
          </Modal>
        </>
      ) : (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Rank and name"
            placeholderTextColor="#adb5bd"
            value={value}
            onChangeText={onChange}
          />
          <TouchableOpacity
            style={styles.revertBtn}
            onPress={() => { setCustom(false); onChange(""); }}
          >
            <Ionicons name="arrow-undo" size={16} color="#6c757d" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ── Section Header ────────────────────────────────────────────────────────────
const SectionTitle = ({ number, title }) => (
  <View style={styles.sectionTitle}>
    <View style={styles.sectionAccent} />
    <Text style={styles.sectionTitleText}>{number}. {title}</Text>
  </View>
);

// ── Shift Badge ───────────────────────────────────────────────────────────────
const ShiftBadge = ({ shift }) => {
  if (!shift) return null;
  const isAM   = shift === "AM";
  const isBoth = shift === "AM & PM";
  return (
    <View style={[
      styles.shiftBadge,
      isAM   ? styles.shiftAM :
      isBoth ? styles.shiftBoth : styles.shiftPM,
    ]}>
      <Text style={[
        styles.shiftBadgeText,
        isAM   ? styles.shiftAMText :
        isBoth ? styles.shiftBothText : styles.shiftPMText,
      ]}>
        {shift}
      </Text>
    </View>
  );
};

// ── Photo Grid ────────────────────────────────────────────────────────────────
const PhotoGrid = ({
  images, existingPhotos,
  onAddCamera, onAddGallery, onRemoveNew, onRemoveExisting,
}) => {
  const total = images.length + existingPhotos.length;
  const canAdd = total < 10;

  return (
    <View style={styles.photoGrid}>
      {/* Existing photos */}
      {existingPhotos.map((url, i) => (
        <View key={url} style={styles.photoThumb}>
          <Image source={{ uri: url }} style={styles.photoImg} />
          <View style={styles.photoBadge}>
            <Text style={styles.photoBadgeText}>{i + 1}</Text>
          </View>
          <TouchableOpacity
            style={styles.photoRemoveBtn}
            onPress={() => onRemoveExisting(url)}
          >
            <Ionicons name="close-circle" size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>
      ))}

      {/* New photos */}
      {images.map((img, i) => (
        <View key={img.id} style={[styles.photoThumb, styles.photoThumbNew]}>
          <Image source={{ uri: img.uri }} style={styles.photoImg} />
          <View style={[styles.photoBadge, { backgroundColor: "#16a34a" }]}>
            <Text style={styles.photoBadgeText}>NEW</Text>
          </View>
          <TouchableOpacity
            style={styles.photoRemoveBtn}
            onPress={() => onRemoveNew(img.id)}
          >
            <Ionicons name="close-circle" size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>
      ))}

      {/* Add buttons */}
      {canAdd && (
        <>
          <TouchableOpacity style={styles.photoAddBtn} onPress={onAddCamera} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={24} color="#1e3a5f" />
            <Text style={styles.photoAddText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoAddBtn} onPress={onAddGallery} activeOpacity={0.7}>
            <Ionicons name="image-outline" size={24} color="#1e3a5f" />
            <Text style={styles.photoAddText}>Gallery</Text>
          </TouchableOpacity>
        </>
      )}

      {!canAdd && (
        <View style={styles.photoMaxBanner}>
          <Ionicons name="information-circle-outline" size={15} color="#92400e" />
          <Text style={styles.photoMaxText}>Max 10 photos reached</Text>
        </View>
      )}
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AfterPatrolScreen({ route, navigation }) {
  const { patrol, myShift, existingReport: initialReport } = route.params;

  const patrolDates   = getPatrolDateRange(patrol?.start_date, patrol?.end_date);
  const isEditing     = !!initialReport;

  const [form, setForm] = useState(
    initialReport ? dbRowToForm(initialReport) : emptyForm(patrol, myShift)
  );
  const [shown, setShown] = useState(() => {
    const src = initialReport || {};
    return {
      preDeployment:  !!(src.pre_deployment),
      action1:        !!(src.action_pre_deployment),
      incidents:      !!(src.incidents),
      action2:        !!(src.action_incidents),
      safetyConcerns: !!(src.safety_concerns),
      action3:        !!(src.action_safety),
      otherServices:  !!(src.other_services),
      visitedAreas:   !!(src.visited_areas),
      personsVisited: !!(src.persons_visited),
      numOfficials:   !!(src.num_officials != null && src.num_officials !== ""),
      numGovt:        !!(src.num_govt_officials != null && src.num_govt_officials !== ""),
      mustDos:        !!(src.must_dos),
    };
  });

  const [images,         setImages]         = useState([]);
  const [existingPhotos, setExistingPhotos] = useState(initialReport?.photo_urls || []);
  const [submitting,     setSubmitting]     = useState(false);
  const [toast,          setToast]          = useState(null);

  const patrollers = patrol?.patrollers || [];

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  // ── Form helpers ────────────────────────────────────────────────────────────
  const set    = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setEv  = (key) => (e)   => setForm((f) => ({ ...f, [key]: e.nativeEvent?.text ?? e }));
  const setTime = (key) => (v)  => {
    setForm((f) => {
      const next = { ...f, [key]: v };
      next.creditHours = calcCreditHours(next.timeFrom, next.timeTo);
      return next;
    });
  };

  const toggleShow = (key) => setShown((s) => ({ ...s, [key]: true }));
  const toggleHide = (key) => {
    setShown((s) => ({ ...s, [key]: false }));
    setForm((f)  => ({ ...f, [key]: "" }));
  };

  // ── Image picker ─────────────────────────────────────────────────────────────
  const requestPermission = async (type) => {
    if (type === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === "granted";
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === "granted";
    }
  };

  const pickFromCamera = async () => {
    const total = images.length + existingPhotos.length;
    if (total >= 10) { showToast("Maximum 10 photos allowed.", "error"); return; }
    const ok = await requestPermission("camera");
    if (!ok) { showToast("Camera permission denied.", "error"); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setImages((prev) => [
        ...prev,
        { id: Math.random().toString(36).slice(2), uri: asset.uri, name: `photo_${Date.now()}.jpg` },
      ]);
    }
  };

  const pickFromGallery = async () => {
    const total = images.length + existingPhotos.length;
    if (total >= 10) { showToast("Maximum 10 photos allowed.", "error"); return; }
    const ok = await requestPermission("gallery");
    if (!ok) { showToast("Gallery permission denied.", "error"); return; }
    const remaining = 10 - total;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const newImgs = result.assets.map((a) => ({
        id: Math.random().toString(36).slice(2),
        uri: a.uri,
        name: a.fileName || `photo_${Date.now()}.jpg`,
      }));
      setImages((prev) => [...prev, ...newImgs].slice(0, 10 - existingPhotos.length));
    }
  };

  const removeNewImage = (id) => setImages((prev) => prev.filter((i) => i.id !== id));

  const removeExistingPhoto = async (photoUrl) => {
    if (!initialReport?.report_id) return;
    Alert.alert("Remove Photo", "Remove this photo? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            const tok = await token();
            const res = await fetch(
              `${API_BASE}/patrol/after-reports/${initialReport.report_id}/photos`,
              {
                method: "DELETE",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
                body: JSON.stringify({ photo_url: photoUrl }),
              }
            );
            const data = await res.json();
            if (data.success) {
              setExistingPhotos(data.photo_urls);
              showToast("Photo removed.", "success");
            } else {
              showToast(data.message || "Failed to remove photo.", "error");
            }
          } catch {
            showToast("Server error.", "error");
          }
        },
      },
    ]);
  };

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Date validation
    if (!form.date) { showToast("Patrol date is required.", "error"); return; }
    const chosen = parseLocalDate(form.date);
    const start  = parseLocalDate(patrol?.start_date);
    const end    = parseLocalDate(patrol?.end_date);
    if (chosen < start || chosen > end) {
      showToast(
        `Date must be within patrol: ${formatDate(patrol?.start_date)} – ${formatDate(patrol?.end_date)}`,
        "error"
      );
      return;
    }

    const status = getPatrolStatus(patrol);
    if (status === "active" && chosen > todayDate()) {
      showToast("You can only report for today or a past date.", "error");
      return;
    }

    // Required-when-shown validation
    const requiredWhenShown = {
      preDeployment:  "Specific instructions received",
      action1:        "Action Taken (Pre-Deployment)",
      incidents:      "Incidents / Unusual situations",
      action2:        "Action Taken (Incidents)",
      safetyConcerns: "Safety concerns observed",
      action3:        "Action Taken (Safety)",
      otherServices:  "Other public safety services rendered",
      visitedAreas:   "Visited areas",
      personsVisited: "Name of persons visited",
      numOfficials:   "No. of officials visited",
      numGovt:        "Total gov't officials in area",
      mustDos:        "Patrolled MUST DOs",
    };

    for (const [key, label] of Object.entries(requiredWhenShown)) {
      if (shown[key] && !String(form[key] ?? "").trim()) {
        showToast(`"${label}" is required once added. Please fill it in or remove it.`, "error");
        return;
      }
    }

    if (!form.remarks.trim()) {
      showToast("Remarks / Recommendations is required.", "error");
      return;
    }

    // Check for existing report on same date (new submissions only)
    if (!isEditing) {
      try {
        const tok = await token();
        const res = await fetch(
          `${API_BASE}/patrol/patrols/${patrol.patrol_id}/after-reports/mine`,
          { headers: { Authorization: `Bearer ${tok}` } }
        );
        const data = await res.json();
        if (data.success) {
          const existing = data.data.find(
            (r) => toInputDate(r.patrol_date) === form.date &&
                   (r.shift === myShift || !myShift)
          );
          if (existing) {
            Alert.alert(
              "Report Already Exists",
              `A report was already submitted for ${formatDate(form.date)}. Do you want to overwrite it?`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Overwrite", style: "destructive", onPress: () => doSubmit() },
              ]
            );
            return;
          }
        }
      } catch { /* proceed */ }
    }

    doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const tok = await token();
      const cleaned = {
        ...form,
        numOfficials: form.numOfficials !== "" && form.numOfficials != null
          ? Number(form.numOfficials) : null,
        numGovt: form.numGovt !== "" && form.numGovt != null
          ? Number(form.numGovt) : null,
        shift: myShift,
      };

      const res  = await fetch(`${API_BASE}/patrol/patrols/${patrol.patrol_id}/after-report`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body:    JSON.stringify(cleaned),
      });
      const data = await res.json();

      if (data.success) {
        // Upload photos if any
        if (images.length > 0) {
          const formData = new FormData();
          images.forEach((img) => {
            formData.append("photos", {
              uri:  img.uri,
              name: img.name || "photo.jpg",
              type: "image/jpeg",
            });
          });
          try {
            await fetch(`${API_BASE}/patrol/after-reports/${data.report_id}/photos`, {
              method:  "POST",
              headers: { Authorization: `Bearer ${tok}` },
              body:    formData,
            });
          } catch { /* photo upload failure is non-critical */ }
        }
        showToast(
          isEditing ? "Report updated successfully!" : "After Patrol Report submitted!",
          "success"
        );
        setTimeout(() => navigation.goBack(), 1200);
      } else {
        showToast(data.message || "Something went wrong.", "error");
      }
    } catch {
      showToast("Server error while submitting.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#0a1628" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isEditing ? "Edit After Patrol Report" : "After Patrol Report"}
            </Text>
            {myShift && <ShiftBadge shift={myShift} />}
          </View>
          <Text style={styles.headerSub} numberOfLines={1}>
            {patrol?.patrol_name} · {formatDate(patrol?.start_date)} – {formatDate(patrol?.end_date)}
          </Text>
          <Text style={styles.headerAnnex}>ANNEX D · PNPM-DO-DS-3-3-15 (DO)</Text>
        </View>
      </View>

      {isEditing && (
        <View style={styles.editingBanner}>
          <Ionicons name="create-outline" size={13} color="#92400e" />
          <Text style={styles.editingBannerText}>EDITING EXISTING REPORT</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Shift info banner */}
          {myShift && (
            <View style={[
              styles.shiftBanner,
              myShift === "AM" ? styles.shiftBannerAM :
              myShift === "AM & PM" ? styles.shiftBannerBoth : styles.shiftBannerPM,
            ]}>
              <View>
                <Text style={[
                  styles.shiftBannerLabel,
                  { color: myShift === "PM" ? "#1e3a5f" : "#92400e" },
                ]}>
                  {myShift === "AM & PM" ? "AM & PM SHIFT" : `${myShift} SHIFT`}
                </Text>
                <Text style={styles.shiftBannerSub}>
                  You are assigned to this shift for this patrol
                </Text>
              </View>
            </View>
          )}

          {myShift && (
            <View style={styles.sharedNotice}>
              <Ionicons name="people-outline" size={14} color="#1e3a5f" style={{ marginTop: 1 }} />
              <Text style={styles.sharedNoticeText}>
                This report is <Text style={{ fontWeight: "700" }}>shared</Text> with all officers in the{" "}
                <Text style={{ fontWeight: "700" }}>{myShift} shift</Text>. Any shift-mate can view and edit it.
              </Text>
            </View>
          )}

          {/* ── 1. Date & Time ─────────────────────────────────────────────── */}
          <SectionTitle number="1" title="Patrol Date & Time" />

          <View style={styles.card}>
            <Text style={styles.dateRangeInfo}>
              Allowed dates: {formatDate(patrol?.start_date)} – {formatDate(patrol?.end_date)}
            </Text>

            {/* Date pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.datePillsRow}
            >
              {patrolDates.map((d) => {
                const isSelected = form.date === d;
                const pillDate   = parseLocalDate(d);
                const isFuture   = getPatrolStatus(patrol) === "active" && pillDate > todayDate();
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.datePill,
                      isSelected && styles.datePillSelected,
                      isFuture   && styles.datePillDisabled,
                    ]}
                    onPress={() => !isFuture && set("date")(d)}
                    activeOpacity={isFuture ? 1 : 0.7}
                    disabled={isFuture}
                  >
                    <Text style={[
                      styles.datePillText,
                      isSelected && styles.datePillTextSelected,
                      isFuture   && styles.datePillTextDisabled,
                    ]}>
                      {formatDateShort(d)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Selected Date</Text>
                <View style={styles.readOnlyField}>
                  <Ionicons name="calendar-outline" size={14} color="#1e3a5f" />
                  <Text style={styles.readOnlyText}>
                    {form.date ? formatDate(form.date) : "— tap a date above —"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.formRow}>
              <TimeField
                label="Time From"
                value={form.timeFrom}
                onChange={setTime("timeFrom")}
                disabled={!!myShift && myShift !== "AM & PM"}
              />
              <TimeField
                label="Time To"
                value={form.timeTo}
                onChange={setTime("timeTo")}
                disabled={!!myShift && myShift !== "AM & PM"}
              />
            </View>
          </View>

          {/* ── 2. Patrol Information ──────────────────────────────────────── */}
          <SectionTitle number="2" title="Patrol Information" />

          <View style={styles.card}>
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Sector / Beat Patrolled</Text>
                <View style={[styles.readOnlyField, { backgroundColor: "rgba(30,58,95,0.05)" }]}>
                  <Text style={[styles.readOnlyText, { color: "#6b7280" }]}>{form.sector || "—"}</Text>
                </View>
              </View>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Total Credit Hours</Text>
                <View style={[
                  styles.readOnlyField,
                  form.creditHours ? { backgroundColor: "rgba(34,197,94,0.05)" } : {},
                ]}>
                  <Ionicons name="time-outline" size={14} color={form.creditHours ? "#16a34a" : "#adb5bd"} />
                  <Text style={[
                    styles.readOnlyText,
                    form.creditHours ? { color: "#16a34a", fontWeight: "700" } : { color: "#adb5bd" },
                  ]}>
                    {form.creditHours || "Auto-calculated"}
                  </Text>
                </View>
              </View>
            </View>

            <ToggleField fieldKey="mustDos" label="Patrolled MUST DOs"
              shown={shown.mustDos} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="List MUST DOs patrolled..."
                placeholderTextColor="#adb5bd"
                multiline
                numberOfLines={3}
                value={form.mustDos}
                onChangeText={set("mustDos")}
              />
            </ToggleField>
          </View>

          {/* ── 3. Pre-Deployment ──────────────────────────────────────────── */}
          <SectionTitle number="3" title="Pre-Deployment Instructions" />
          <View style={styles.card}>
            <ToggleField fieldKey="preDeployment" label="Specific instructions received"
              shown={shown.preDeployment} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Enter pre-deployment instructions..."
                placeholderTextColor="#adb5bd"
                multiline numberOfLines={3}
                value={form.preDeployment}
                onChangeText={set("preDeployment")}
              />
            </ToggleField>
            <ToggleField fieldKey="action1" label="Action Taken"
              shown={shown.action1} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={styles.input}
                placeholder="Action taken..."
                placeholderTextColor="#adb5bd"
                value={form.action1}
                onChangeText={set("action1")}
              />
            </ToggleField>
          </View>

          {/* ── 4. Incidents ───────────────────────────────────────────────── */}
          <SectionTitle number="4" title="Incidents & Unusual Events" />
          <Text style={styles.sectionHint}>Crime incidents, public disturbance, major events, etc.</Text>
          <View style={styles.card}>
            <ToggleField fieldKey="incidents" label="Incidents / Unusual situations"
              shown={shown.incidents} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Describe incidents or unusual events..."
                placeholderTextColor="#adb5bd"
                multiline numberOfLines={3}
                value={form.incidents}
                onChangeText={set("incidents")}
              />
            </ToggleField>
            <ToggleField fieldKey="action2" label="Action Taken"
              shown={shown.action2} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={styles.input}
                placeholder="Action taken..."
                placeholderTextColor="#adb5bd"
                value={form.action2}
                onChangeText={set("action2")}
              />
            </ToggleField>
          </View>

          {/* ── 5. Safety Concerns ─────────────────────────────────────────── */}
          <SectionTitle number="5" title="Public Safety Concerns" />
          <Text style={styles.sectionHint}>Uncovered manholes, busted lights, fire hazards, etc.</Text>
          <View style={styles.card}>
            <ToggleField fieldKey="safetyConcerns" label="Safety concerns observed"
              shown={shown.safetyConcerns} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Describe public safety concerns..."
                placeholderTextColor="#adb5bd"
                multiline numberOfLines={3}
                value={form.safetyConcerns}
                onChangeText={set("safetyConcerns")}
              />
            </ToggleField>
            <ToggleField fieldKey="action3" label="Action Taken"
              shown={shown.action3} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={styles.input}
                placeholder="Action taken..."
                placeholderTextColor="#adb5bd"
                value={form.action3}
                onChangeText={set("action3")}
              />
            </ToggleField>
          </View>

          {/* ── 6. Other Services ──────────────────────────────────────────── */}
          <SectionTitle number="6" title="Other Services & Visited Areas" />
          <View style={styles.card}>
            <ToggleField fieldKey="otherServices" label="Other public safety services rendered"
              shown={shown.otherServices} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Area security, PWD assistance, recovered property, etc."
                placeholderTextColor="#adb5bd"
                multiline numberOfLines={2}
                value={form.otherServices}
                onChangeText={set("otherServices")}
              />
            </ToggleField>
            <ToggleField fieldKey="visitedAreas" label="Visited areas"
              shown={shown.visitedAreas} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="House, school, church, business, barangay, etc."
                placeholderTextColor="#adb5bd"
                multiline numberOfLines={2}
                value={form.visitedAreas}
                onChangeText={set("visitedAreas")}
              />
            </ToggleField>
          </View>

          {/* ── 7. Persons Visited ─────────────────────────────────────────── */}
          <SectionTitle number="7" title="Persons Visited" />
          <View style={styles.card}>
            <ToggleField fieldKey="personsVisited" label="Name of persons visited / local officials"
              shown={shown.personsVisited} onShow={toggleShow} onHide={toggleHide} required>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="List persons visited..."
                placeholderTextColor="#adb5bd"
                multiline numberOfLines={2}
                value={form.personsVisited}
                onChangeText={set("personsVisited")}
              />
            </ToggleField>
            <View style={styles.formRow}>
              <ToggleField fieldKey="numOfficials" label="No. of officials visited"
                shown={shown.numOfficials} onShow={toggleShow} onHide={toggleHide} required>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#adb5bd"
                  keyboardType="numeric"
                  value={form.numOfficials}
                  onChangeText={set("numOfficials")}
                />
              </ToggleField>
              <ToggleField fieldKey="numGovt" label="Total gov't officials in area"
                shown={shown.numGovt} onShow={toggleShow} onHide={toggleHide} required>
                <TextInput
                  style={styles.input}
                  placeholder="0"
                  placeholderTextColor="#adb5bd"
                  keyboardType="numeric"
                  value={form.numGovt}
                  onChangeText={set("numGovt")}
                />
              </ToggleField>
            </View>
          </View>

          {/* ── 8. Remarks ─────────────────────────────────────────────────── */}
          <SectionTitle number="8" title="Remarks & Recommendations" />
          <View style={styles.card}>
            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>
                Remarks / Recommendations <Text style={{ color: "#dc2626" }}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Best practices, traffic assistance rendered, etc."
                placeholderTextColor="#adb5bd"
                multiline numberOfLines={4}
                value={form.remarks}
                onChangeText={set("remarks")}
              />
            </View>
          </View>

        
          {/* ── 9. Photo Documentation ────────────────────────────────────── */}
          <SectionTitle number="9" title="Photo Documentation" />
          <View style={styles.card}>
            <Text style={styles.photoCountText}>
              {images.length + existingPhotos.length}/10 photos
            </Text>
            <PhotoGrid
              images={images}
              existingPhotos={existingPhotos}
              onAddCamera={pickFromCamera}
              onAddGallery={pickFromGallery}
              onRemoveNew={removeNewImage}
              onRemoveExisting={removeExistingPhoto}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {isEditing ? "Update After Patrol Report" : "Submit After Patrol Report"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#0a1628",
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  headerTitle:   { fontSize: 15, fontWeight: "700", color: "#fff", letterSpacing: 0.2 },
  headerSub:     { fontSize: 11, color: "#93afc9", marginTop: 2 },
  headerAnnex:   { fontSize: 9,  color: "rgba(255,255,255,0.35)", marginTop: 1 },

  editingBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderBottomWidth: 1, borderBottomColor: "#fcd34d",
    paddingHorizontal: 16, paddingVertical: 7,
  },
  editingBannerText: {
    fontSize: 11, fontWeight: "800", color: "#92400e", letterSpacing: 0.8,
  },

  scrollBody: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },

  // Shift banner
  shiftBanner: {
    padding: "12px 16px", borderRadius: 8, marginBottom: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1,
  },
  shiftBannerAM:   { backgroundColor: "#fef3c7", borderColor: "#fcd34d" },
  shiftBannerPM:   { backgroundColor: "#e0e7f0", borderColor: "#93afc9" },
  shiftBannerBoth: { backgroundColor: "#fffbeb", borderColor: "#93afc9" },
  shiftBannerLabel:{ fontSize: 12, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  shiftBannerSub:  { fontSize: 11, color: "#6b7280", marginTop: 2 },

  sharedNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "rgba(30,58,95,0.05)",
    borderWidth: 1, borderColor: "rgba(30,58,95,0.12)",
    borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9,
    marginBottom: 4,
  },
  sharedNoticeText: { flex: 1, fontSize: 12, color: "#374151", lineHeight: 18 },

  // Section
  sectionTitle: {
    flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6,
  },
  sectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: "#c1272d" },
  sectionTitleText: {
    fontSize: 12, fontWeight: "800", color: "#0a1628",
    textTransform: "uppercase", letterSpacing: 0.8,
  },
  sectionHint: { fontSize: 12, color: "#adb5bd", fontStyle: "italic", marginBottom: 4 },

  // Card
  card: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#dee2e6",
    padding: 14, gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },

  // Form
  formRow:   { flexDirection: "row", gap: 10 },
  formGroup: { flex: 1, gap: 5 },
  fieldLabel:{ fontSize: 12, fontWeight: "600", color: "#495057" },

  input: {
    borderWidth: 1, borderColor: "#ced4da", borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 9,
    fontSize: 13, color: "#212529",
    backgroundColor: "#fff",
  },
  inputMulti: {
    minHeight: 80, textAlignVertical: "top",
  },

  readOnlyField: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderWidth: 1, borderColor: "#ced4da", borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: "rgba(30,58,95,0.03)",
  },
  readOnlyText: { fontSize: 13, color: "#495057", flex: 1 },

  // Toggle field
  toggleWrap: { gap: 5 },
  toggleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  addFieldBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 6, borderWidth: 1, borderStyle: "dashed", borderColor: "#93afc9",
    backgroundColor: "rgba(30,58,95,0.04)", alignSelf: "flex-start",
  },
  addFieldText:   { fontSize: 12, fontWeight: "700", color: "#1e3a5f" },
  removeFieldBtn: { fontSize: 11, fontWeight: "600", color: "#dc2626" },

  // Time button
  timeBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    borderWidth: 1, borderColor: "#ced4da", borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: "#fff",
  },
  timeBtnDisabled: { backgroundColor: "rgba(30,58,95,0.04)", borderColor: "#e9ecef" },
  timeBtnText:     { flex: 1, fontSize: 13, color: "#1e3a5f", fontWeight: "600" },

  // Time picker modal
  tpOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  tpSheet:    {
    backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  tpHeader:   {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "#f1f3f5",
  },
  tpTitle:    { fontSize: 16, fontWeight: "700", color: "#0a1628" },
  tpBody:     { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 12 },
  tpCol:      { flex: 1, alignItems: "center" },
  tpColLabel: { fontSize: 10, fontWeight: "700", color: "#adb5bd", letterSpacing: 0.8, marginBottom: 6 },
  tpScroll:   { height: 180 },
  tpItem:     { paddingVertical: 9, alignItems: "center", borderRadius: 6 },
  tpItemActive:{ backgroundColor: "#1e3a5f", borderRadius: 6 },
  tpItemText: { fontSize: 16, color: "#495057", fontWeight: "500" },
  tpItemTextActive: { color: "#fff", fontWeight: "700" },
  tpSep:      { fontSize: 22, fontWeight: "700", color: "#adb5bd", paddingTop: 28, paddingHorizontal: 4 },
  tpPeriodCol:{ width: 56, alignItems: "center" },
  tpPeriodItem: {
    width: 44, paddingVertical: 10, alignItems: "center",
    borderRadius: 6, borderWidth: 1, borderColor: "#dee2e6", marginBottom: 6,
  },
  tpPeriodActive: { backgroundColor: "#1e3a5f", borderColor: "#1e3a5f" },
  tpPeriodText:   { fontSize: 13, fontWeight: "700", color: "#495057" },
  tpPeriodTextActive: { color: "#fff" },
  tpFooter: {
    flexDirection: "row", gap: 12,
    paddingHorizontal: 20, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: "#f1f3f5",
  },
  tpCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    borderWidth: 1, borderColor: "#dee2e6", alignItems: "center",
  },
  tpCancelText: { fontSize: 14, fontWeight: "600", color: "#6c757d" },
  tpConfirmBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#1e3a5f", alignItems: "center" },
  tpConfirmText:{ fontSize: 14, fontWeight: "700", color: "#fff" },

  // Select
  selectBtn: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: "#ced4da", borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 10,
    backgroundColor: "#fff",
  },
  selectBtnText: { flex: 1, fontSize: 13, color: "#212529" },
  optionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: "#f1f3f5",
  },
  optionRowActive: { backgroundColor: "rgba(30,58,95,0.05)" },
  optionText:      { fontSize: 14, color: "#212529" },
  optionTextActive:{ color: "#1e3a5f", fontWeight: "700" },
  revertBtn: {
    width: 40, height: 42, borderRadius: 6,
    borderWidth: 1, borderColor: "#ced4da",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff",
  },

  // Date pills
  dateRangeInfo: {
    fontSize: 11, color: "#1e3a5f", fontWeight: "600", marginBottom: 4,
  },
  datePillsRow: { flexDirection: "row", gap: 6, paddingBottom: 4 },
  datePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: "#93afc9", backgroundColor: "#fff",
  },
  datePillSelected: { backgroundColor: "#1e3a5f", borderColor: "#1e3a5f" },
  datePillDisabled: { backgroundColor: "#f3f4f6", borderColor: "#e5e7eb", opacity: 0.5 },
  datePillText:         { fontSize: 12, fontWeight: "700", color: "#1e3a5f" },
  datePillTextSelected: { color: "#fff" },
  datePillTextDisabled: { color: "#d1d5db" },

  // Shift badge
  shiftBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20,
    borderWidth: 1, flexShrink: 0,
  },
  shiftAM:        { backgroundColor: "#fef3c7", borderColor: "#fcd34d" },
  shiftPM:        { backgroundColor: "#e0e7f0", borderColor: "#93afc9" },
  shiftBoth:      { backgroundColor: "#fffbeb", borderColor: "#93afc9" },
  shiftBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  shiftAMText:    { color: "#92400e" },
  shiftPMText:    { color: "#1e3a5f" },
  shiftBothText:  { color: "#1e3a5f" },

  // Photos
  photoCountText: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 4 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoThumb: {
    width: 88, height: 88, borderRadius: 8,
    borderWidth: 1, borderColor: "#dee2e6",
    overflow: "hidden", position: "relative",
  },
  photoThumbNew: { borderWidth: 2, borderColor: "#86efac" },
  photoImg:      { width: "100%", height: "100%", resizeMode: "cover" },
  photoBadge: {
    position: "absolute", top: 4, left: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  photoBadgeText: { fontSize: 9, fontWeight: "700", color: "#1e3a5f" },
  photoRemoveBtn: {
    position: "absolute", top: 2, right: 2,
    backgroundColor: "#fff", borderRadius: 10,
  },
  photoAddBtn: {
    width: 88, height: 88, borderRadius: 8,
    borderWidth: 2, borderStyle: "dashed", borderColor: "#93afc9",
    alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "rgba(30,58,95,0.03)",
  },
  photoAddText: { fontSize: 10, fontWeight: "700", color: "#1e3a5f" },
  photoMaxBanner: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(245,158,11,0.08)",
    borderWidth: 1, borderColor: "#fcd34d",
    borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9,
    width: "100%",
  },
  photoMaxText: { fontSize: 12, fontWeight: "600", color: "#92400e" },

  // Submit button
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#1e3a5f", borderRadius: 10,
    paddingVertical: 15, marginTop: 8,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Toast
  toast: {
    position: "absolute", bottom: 30, left: 20, right: 20,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
  },
  toastText: { fontSize: 13, fontWeight: "600", color: "#fff", textAlign: "center" },
});