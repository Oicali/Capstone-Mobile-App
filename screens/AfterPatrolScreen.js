// screens/AfterPatrolScreen.js
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  Modal,
  Pressable,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import {
  C,
  ScreenHeader,
  HeaderButton,
  ShiftPill,
  Toast,
  parseLocalDate,
  todayDate,
  toLocalDateStr,
  generateDateRange,
  formatDate,
  formatDateShort,
  getPatrolStatus,
} from "./components/PatrolUI";

const API_BASE = process.env.EXPO_PUBLIC_API_URL;
const HISTORY_SCREEN_NAME = "AfterPatrolHistory";
const token = async () => AsyncStorage.getItem("auth_token");

// ── helpers ─────────────────────────────────────────────────────────────────
const calcCreditHours = (from, to) => {
  if (!from || !to) return "";
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  if (isNaN(fh) || isNaN(th)) return "";
  const fromMins = fh * 60 + fm;
  let toMins = th * 60 + tm;
  if (toMins <= fromMins) toMins += 24 * 60;
  const total = toMins - fromMins;
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  return mins === 0 ? `${hrs} hrs` : `${hrs} hrs ${mins} min`;
};

const DEFAULT_TIMES = {
  AM: { timeFrom: "08:00", timeTo: "20:00" },
  PM: { timeFrom: "20:00", timeTo: "08:00" },
  "AM & PM": { timeFrom: "08:00", timeTo: "08:00" },
};

const smartDefaultDate = (patrol) => {
  const start = parseLocalDate(patrol?.start_date);
  const end = parseLocalDate(patrol?.end_date);
  const today = todayDate();
  if (start && end && today >= start && today <= end)
    return toLocalDateStr(today);
  return toLocalDateStr(patrol?.start_date) || "";
};

const emptyForm = (patrol, shift, dateOverride) => {
  const times = (shift && DEFAULT_TIMES[shift]) || { timeFrom: "", timeTo: "" };
  return {
    date: dateOverride || smartDefaultDate(patrol),
    timeFrom: times.timeFrom,
    timeTo: times.timeTo,
    preDeployment: "",
    action1: "",
    incidents: "",
    action2: "",
    safetyConcerns: "",
    action3: "",
    otherServices: "",
    visitedAreas: "",
    personsVisited: "",
    numOfficials: "",
    numGovt: "",
    sector: patrol?.mobile_unit_name || "",
    mustDos: "",
    remarks: "",
    creditHours: calcCreditHours(times.timeFrom, times.timeTo),
    sigOfficer1: "",
    sigOfficer2: "",
    sigSupervisor: "",
  };
};

const dbRowToForm = (row) => ({
  date: toLocalDateStr(row.patrol_date) || "",
  timeFrom: row.time_from || "",
  timeTo: row.time_to || "",
  preDeployment: row.pre_deployment || "",
  action1: row.action_pre_deployment || "",
  incidents: row.incidents || "",
  action2: row.action_incidents || "",
  safetyConcerns: row.safety_concerns || "",
  action3: row.action_safety || "",
  otherServices: row.other_services || "",
  visitedAreas: row.visited_areas || "",
  personsVisited: row.persons_visited || "",
  numOfficials: row.num_officials != null ? String(row.num_officials) : "",
  numGovt: row.num_govt_officials != null ? String(row.num_govt_officials) : "",
  sector: row.sector_beat || "",
  mustDos: row.must_dos || "",
  remarks: row.remarks || "",
  creditHours: row.credit_hours || "",
  sigOfficer1: row.sig_officer_1 || "",
  sigOfficer2: row.sig_officer_2 || "",
  sigSupervisor: row.sig_supervisor || "",
});

const shownFlagsFor = (row = {}) => ({
  preDeployment: !!row.pre_deployment,
  action1: !!row.action_pre_deployment,
  incidents: !!row.incidents,
  action2: !!row.action_incidents,
  safetyConcerns: !!row.safety_concerns,
  action3: !!row.action_safety,
  otherServices: !!row.other_services,
  visitedAreas: !!row.visited_areas,
  personsVisited: !!row.persons_visited,
  numOfficials: !!(row.num_officials != null && row.num_officials !== ""),
  numGovt: !!(row.num_govt_officials != null && row.num_govt_officials !== ""),
  mustDos: !!row.must_dos,
});

// ── Time picker ─────────────────────────────────────────────────────────────
const TimePickerModal = ({ visible, value, onConfirm, onClose, label }) => {
  const insets = useSafeAreaInsets();
  const parse24 = (v) => {
    if (!v) return { h: 8, m: 0, period: "AM" };
    const [hh, mm] = v.split(":").map(Number);
    return {
      h: hh % 12 === 0 ? 12 : hh % 12,
      m: mm,
      period: hh < 12 ? "AM" : "PM",
    };
  };
  const to24 = (h12, min, p) => {
    let hh = h12 % 12;
    if (p === "PM") hh += 12;
    return `${String(hh).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  };
  const init = parse24(value);
  const [h, setH] = useState(init.h);
  const [m, setM] = useState(init.m);
  const [period, setPeriod] = useState(init.period);

  useEffect(() => {
    if (visible) {
      const p = parse24(value);
      setH(p.h);
      setM(p.m);
      setPeriod(p.period);
    }
  }, [visible, value]);

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const Col = ({ title, data, current, onPick }) => (
    <View style={s.tpCol}>
      <Text style={s.tpColLbl}>{title}</Text>
      <ScrollView style={{ height: 190 }} showsVerticalScrollIndicator={false}>
        {data.map((v) => (
          <TouchableOpacity
            key={v}
            style={[s.tpItem, current === v && s.tpItemOn]}
            onPress={() => onPick(v)}
          >
            <Text
              style={[
                s.tpItemTxt,
                current === v && { color: "#fff", fontWeight: "800" },
              ]}
            >
              {String(v).padStart(2, "0")}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.overlay} onPress={onClose}>
        <Pressable
          style={[s.sheet, { paddingBottom: Math.max(insets.bottom + 12, 20) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={s.handle} />
          <View style={s.sheetTop}>
            <Text style={s.sheetTitle}>{label || "Select time"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={C.navy} />
            </TouchableOpacity>
          </View>
          <View style={s.tpBody}>
            <Col title="HOUR" data={hours} current={h} onPick={setH} />
            <Text style={s.tpSep}>:</Text>
            <Col title="MIN" data={minutes} current={m} onPick={setM} />
            <View style={s.tpPeriodCol}>
              <Text style={s.tpColLbl}> </Text>
              {["AM", "PM"].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[s.tpPeriod, period === p && s.tpPeriodOn]}
                  onPress={() => setPeriod(p)}
                >
                  <Text
                    style={[s.tpPeriodTxt, period === p && { color: "#fff" }]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.sheetFoot}>
            <TouchableOpacity style={s.btnGhost} onPress={onClose}>
              <Text style={s.btnGhostTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.btnPrimary}
              onPress={() => {
                onConfirm(to24(h, m, period));
                onClose();
              }}
            >
              <Text style={s.btnPrimaryTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const TimeField = ({ label, value, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const display = value
    ? (() => {
        const [hh, mm] = value.split(":").map(Number);
        const p = hh < 12 ? "AM" : "PM";
        const h12 = hh % 12 === 0 ? 12 : hh % 12;
        return `${String(h12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${p}`;
      })()
    : "— : —";
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity
        style={[s.timeBtn, disabled && { backgroundColor: "#eef2f7" }]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={disabled ? 1 : 0.8}
      >
        <Ionicons
          name="time-outline"
          size={16}
          color={disabled ? C.faint : C.navy}
        />
        <Text style={[s.timeBtnTxt, disabled && { color: C.faint }]}>
          {display}
        </Text>
        {!disabled && (
          <Ionicons name="chevron-down" size={14} color={C.faint} />
        )}
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

// ── Layout pieces ───────────────────────────────────────────────────────────
const Section = ({ number, title, hint, children }) => (
  <View style={s.section}>
    <View style={s.secHead}>
      <View style={s.secNum}>
        <Text style={s.secNumTxt}>{number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.secTitle}>{title}</Text>
        {!!hint && <Text style={s.secHint}>{hint}</Text>}
      </View>
    </View>
    <View style={s.secBody}>{children}</View>
  </View>
);

const ToggleField = ({
  fieldKey,
  label,
  children,
  shown,
  onShow,
  onHide,
  required,
  inRow,
}) => (
  <View style={inRow ? { flex: 1 } : null}>
    {!shown ? (
      <TouchableOpacity
        style={s.addBtn}
        onPress={() => onShow(fieldKey)}
        activeOpacity={0.8}
      >
        <Ionicons name="add-circle" size={16} color={C.navy} />
        <Text style={s.addTxt} numberOfLines={2}>
          Add {label}
        </Text>
      </TouchableOpacity>
    ) : (
      <View>
        <View style={s.toggleHead}>
          <Text style={[s.label, { marginBottom: 0, flex: 1 }]}>
            {label}
            {required && <Text style={{ color: C.red }}> *</Text>}
          </Text>
          <TouchableOpacity
            onPress={() => onHide(fieldKey)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.removeTxt}>Remove</Text>
          </TouchableOpacity>
        </View>
        {children}
      </View>
    )}
  </View>
);

const PhotoGrid = ({
  images,
  existingPhotos,
  onAddCamera,
  onAddGallery,
  onRemoveNew,
  onRemoveExisting,
}) => {
  const total = images.length + existingPhotos.length;
  return (
    <View style={s.photoGrid}>
      {existingPhotos.map((url, i) => (
        <View key={url} style={s.photo}>
          <Image source={{ uri: url }} style={s.photoImg} />
          <View style={s.photoBadge}>
            <Text style={s.photoBadgeTxt}>{i + 1}</Text>
          </View>
          <TouchableOpacity
            style={s.photoX}
            onPress={() => onRemoveExisting(url)}
          >
            <Ionicons name="close" size={13} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
      {images.map((img) => (
        <View
          key={img.id}
          style={[s.photo, { borderColor: "#86efac", borderWidth: 2 }]}
        >
          <Image source={{ uri: img.uri }} style={s.photoImg} />
          <View style={[s.photoBadge, { backgroundColor: "#16a34a" }]}>
            <Text style={[s.photoBadgeTxt, { color: "#fff" }]}>NEW</Text>
          </View>
          <TouchableOpacity
            style={s.photoX}
            onPress={() => onRemoveNew(img.id)}
          >
            <Ionicons name="close" size={13} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
      {total < 10 ? (
        <>
          <TouchableOpacity
            style={s.photoAdd}
            onPress={onAddCamera}
            activeOpacity={0.8}
          >
            <Ionicons name="camera" size={22} color={C.navy} />
            <Text style={s.photoAddTxt}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.photoAdd}
            onPress={onAddGallery}
            activeOpacity={0.8}
          >
            <Ionicons name="images" size={22} color={C.navy} />
            <Text style={s.photoAddTxt}>Gallery</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={s.maxBanner}>
          <Ionicons name="information-circle" size={15} color="#92400e" />
          <Text style={s.maxTxt}>Max 10 photos reached</Text>
        </View>
      )}
    </View>
  );
};

// ── Screen ──────────────────────────────────────────────────────────────────
export default function AfterPatrolScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { patrol, myShift, existingReport: initialReport } = route.params;
  const patrolDates = generateDateRange(patrol?.start_date, patrol?.end_date);

  const [activeReport, setActiveReport] = useState(initialReport || null);
  const [form, setForm] = useState(
    initialReport ? dbRowToForm(initialReport) : null,
  );
  const [shown, setShown] = useState(shownFlagsFor(initialReport || {}));
  const [images, setImages] = useState([]);
  const [existingPhotos, setExistingPhotos] = useState(
    initialReport?.photo_urls || [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [existingReports, setExistingReports] = useState(
    initialReport ? [initialReport] : [],
  );
  const [existingReportsLoaded, setExistingReportsLoaded] = useState(false);

  const autoSelectedRef = useRef(false);
  const showToast = useCallback(
    (message, type = "success") => setToast({ message, type, key: Date.now() }),
    [],
  );

  const existingByDate = {};
  existingReports.forEach((rep) => {
    existingByDate[toLocalDateStr(rep.patrol_date)] = rep;
  });

  const fetchExistingReports = useCallback(async () => {
    try {
      const tok = await token();
      const res = await fetch(
        `${API_BASE}/patrol/patrols/${patrol.patrol_id}/after-reports/mine`,
        {
          headers: { Authorization: `Bearer ${tok}` },
        },
      );
      const data = await res.json();
      setExistingReports(data.success ? data.data || [] : []);
    } catch {
      setExistingReports((prev) => prev);
    } finally {
      setExistingReportsLoaded(true);
    }
  }, [patrol.patrol_id]);

  useEffect(() => {
    fetchExistingReports();
  }, [fetchExistingReports]);

  // Auto-select first unreported allowed date on a fresh open
  useEffect(() => {
    if (initialReport) return;
    if (!existingReportsLoaded) return;
    if (autoSelectedRef.current) return;
    autoSelectedRef.current = true;

    const status = getPatrolStatus(patrol);
    const allowedDates = patrolDates.filter(
      (key) => !(status === "active" && parseLocalDate(key) > todayDate()),
    );
    const unreportedDate = allowedDates.find((key) => !existingByDate[key]);
    if (!unreportedDate) return;

    setForm(emptyForm(patrol, myShift, unreportedDate));
    setActiveReport(null);
    setShown(shownFlagsFor());
    setExistingPhotos([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingReportsLoaded]);

  const handleSelectDate = (key) => {
    const isFuture =
      getPatrolStatus(patrol) === "active" && parseLocalDate(key) > todayDate();
    if (isFuture) return;
    const existingForDate = existingByDate[key];
    if (existingForDate) {
      setActiveReport(existingForDate);
      setForm(dbRowToForm(existingForDate));
      setShown(shownFlagsFor(existingForDate));
      setExistingPhotos(existingForDate.photo_urls || []);
    } else {
      setActiveReport(null);
      setForm(emptyForm(patrol, myShift, key));
      setShown(shownFlagsFor());
      setExistingPhotos([]);
    }
    setImages([]);
  };

  const isEditing = !!activeReport;

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setTime = (key) => (v) =>
    setForm((f) => {
      const next = { ...f, [key]: v };
      next.creditHours = calcCreditHours(next.timeFrom, next.timeTo);
      return next;
    });
  const toggleShow = (key) => setShown((sh) => ({ ...sh, [key]: true }));
  const toggleHide = (key) => {
    setShown((sh) => ({ ...sh, [key]: false }));
    setForm((f) => ({ ...f, [key]: "" }));
  };

  // ── images ──
  const requestPermission = async (type) => {
    const { status } =
      type === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  };

  const pickFromCamera = async () => {
    if (images.length + existingPhotos.length >= 10)
      return showToast("Maximum 10 photos allowed.", "error");
    if (!(await requestPermission("camera")))
      return showToast("Camera permission denied.", "error");
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const asset = result.assets[0];
      setImages((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          uri: asset.uri,
          name: `photo_${Date.now()}.jpg`,
        },
      ]);
    }
  };

  const pickFromGallery = async () => {
    const total = images.length + existingPhotos.length;
    if (total >= 10) return showToast("Maximum 10 photos allowed.", "error");
    if (!(await requestPermission("gallery")))
      return showToast("Gallery permission denied.", "error");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10 - total,
    });
    if (!result.canceled && result.assets?.length > 0) {
      const newImgs = result.assets.map((a) => ({
        id: Math.random().toString(36).slice(2),
        uri: a.uri,
        name: a.fileName || `photo_${Date.now()}.jpg`,
      }));
      setImages((prev) =>
        [...prev, ...newImgs].slice(0, 10 - existingPhotos.length),
      );
    }
  };

  const removeNewImage = (id) =>
    setImages((prev) => prev.filter((i) => i.id !== id));

  const removeExistingPhoto = async (photoUrl) => {
    if (!activeReport?.report_id) return;
    Alert.alert("Remove photo", "Remove this photo? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const tok = await token();
            const res = await fetch(
              `${API_BASE}/patrol/after-reports/${activeReport.report_id}/photos`,
              {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${tok}`,
                },
                body: JSON.stringify({ photo_url: photoUrl }),
              },
            );
            const data = await res.json();
            if (data.success) {
              setExistingPhotos(data.photo_urls);
              showToast("Photo removed.", "success");
            } else
              showToast(data.message || "Failed to remove photo.", "error");
          } catch {
            showToast("Server error.", "error");
          }
        },
      },
    ]);
  };

  // ── submit ──
  const handleSubmit = async () => {
    if (!form) return;
    if (!form.date) return showToast("Patrol date is required.", "error");

    const chosen = parseLocalDate(form.date);
    const start = parseLocalDate(patrol?.start_date);
    const end = parseLocalDate(patrol?.end_date);
    if (chosen < start || chosen > end) {
      return showToast(
        `Date must be within patrol: ${formatDate(patrol?.start_date)} – ${formatDate(patrol?.end_date)}`,
        "error",
      );
    }
    if (getPatrolStatus(patrol) === "active" && chosen > todayDate()) {
      return showToast(
        "You can only report for today or a past date.",
        "error",
      );
    }

    const requiredWhenShown = {
      preDeployment: "Specific instructions received",
      action1: "Action Taken (Pre-Deployment)",
      incidents: "Incidents / Unusual situations",
      action2: "Action Taken (Incidents)",
      safetyConcerns: "Safety concerns observed",
      action3: "Action Taken (Safety)",
      otherServices: "Other public safety services rendered",
      visitedAreas: "Visited areas",
      personsVisited: "Name of persons visited",
      numOfficials: "No. of officials visited",
      numGovt: "Total gov't officials in area",
      mustDos: "Patrolled MUST DOs",
    };
    for (const [key, label] of Object.entries(requiredWhenShown)) {
      if (shown[key] && !String(form[key] ?? "").trim()) {
        return showToast(
          `"${label}" is required once added. Fill it in or remove it.`,
          "error",
        );
      }
    }
    if (!form.remarks.trim())
      return showToast("Remarks / Recommendations is required.", "error");

    if (isEditing) {
      Alert.alert(
        "Save changes",
        "Do you want to save the changes made to this report?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Save changes", onPress: () => doSubmit() },
        ],
      );
      return;
    }

    try {
      const tok = await token();
      const res = await fetch(
        `${API_BASE}/patrol/patrols/${patrol.patrol_id}/after-reports/mine`,
        {
          headers: { Authorization: `Bearer ${tok}` },
        },
      );
      const data = await res.json();
      if (data.success) {
        const existing = data.data.find(
          (r) =>
            toLocalDateStr(r.patrol_date) === form.date &&
            (r.shift === myShift || !myShift),
        );
        if (existing) {
          Alert.alert(
            "Report already exists",
            `A report was already submitted for ${formatDate(form.date)}. Overwrite it?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Overwrite",
                style: "destructive",
                onPress: () => doSubmit(),
              },
            ],
          );
          return;
        }
      }
    } catch {
      /* proceed — backend upsert handles deduplication */
    }
    doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const tok = await token();
      const cleaned = {
        ...form,
        numOfficials:
          form.numOfficials !== "" && form.numOfficials != null
            ? Number(form.numOfficials)
            : null,
        numGovt:
          form.numGovt !== "" && form.numGovt != null
            ? Number(form.numGovt)
            : null,
        shift: myShift,
      };
      const res = await fetch(
        `${API_BASE}/patrol/patrols/${patrol.patrol_id}/after-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tok}`,
          },
          body: JSON.stringify(cleaned),
        },
      );
      const data = await res.json();

      if (data.success) {
        const reportId = data.report_id ?? data.data?.report_id;
        if (images.length > 0 && reportId) {
          try {
            const photoForm = new FormData();
            images.forEach((img) => {
              photoForm.append("photos", {
                uri: img.uri,
                type: "image/jpeg",
                name: img.name || `photo_${Date.now()}.jpg`,
              });
            });
            const uploadRes = await fetch(
              `${API_BASE}/patrol/after-reports/${reportId}/photos`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${tok}` },
                body: photoForm,
              },
            );
            const uploadData = await uploadRes.json();
            if (!uploadData.success)
              console.error("Photo upload failed:", uploadData.message);
          } catch (err) {
            console.error("Photo upload error:", err.message);
          }
        }
        showToast(
          isEditing
            ? "Report updated successfully!"
            : "After Patrol Report submitted!",
          "success",
        );
        setTimeout(() => navigation.goBack(), 1200);
      } else showToast(data.message || "Something went wrong.", "error");
    } catch {
      showToast("Server error while submitting.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    if (form && !submitting) {
      Alert.alert("Leave report?", "Any unsaved changes will be lost.", [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ]);
    } else navigation.goBack();
  };

  // Multi-line input helper
  const multi = (key, placeholder, lines = 3) => (
    <TextInput
      style={[
        s.input,
        { minHeight: 20 + lines * 20, textAlignVertical: "top" },
      ]}
      placeholder={placeholder}
      placeholderTextColor={C.faint}
      multiline
      value={form[key]}
      onChangeText={set(key)}
    />
  );
  const single = (key, placeholder) => (
    <TextInput
      style={s.input}
      placeholder={placeholder}
      placeholderTextColor={C.faint}
      value={form[key]}
      onChangeText={set(key)}
    />
  );

  const tg = (fieldKey, label, children, inRow) => (
    <ToggleField
      fieldKey={fieldKey}
      label={label}
      shown={shown[fieldKey]}
      onShow={toggleShow}
      onHide={toggleHide}
      required
      inRow={inRow}
    >
      {children}
    </ToggleField>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title={isEditing ? "Edit After Patrol Report" : "After Patrol Report"}
        subtitle={`${patrol?.patrol_name} · ${formatDate(patrol?.start_date)} – ${formatDate(patrol?.end_date)}`}
        onBack={handleBack}
        badge={myShift ? <ShiftPill shift={myShift} /> : null}
        right={
          <HeaderButton
            icon="time-outline"
            onPress={() =>
              navigation.navigate(HISTORY_SCREEN_NAME, { patrol, myShift })
            }
          />
        }
      >
        <Text style={s.annex}>ANNEX D · PNPM-DO-DS-3-3-15 (DO)</Text>
      </ScreenHeader>

      {isEditing && (
        <View style={s.editBanner}>
          <Ionicons name="create" size={14} color="#92400e" />
          <Text style={s.editBannerTxt}>EDITING EXISTING REPORT</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 14,
            paddingBottom: insets.bottom + 60,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!!myShift && (
            <View style={s.infoCard}>
              <View
                style={[
                  s.infoIcon,
                  { backgroundColor: myShift === "AM" ? "#fef3c7" : "#e0e7f0" },
                ]}
              >
                <Ionicons
                  name={myShift === "AM" ? "sunny" : "moon"}
                  size={18}
                  color={myShift === "AM" ? "#92400e" : C.navy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.infoTitle}>
                  {myShift === "AM & PM" ? "AM & PM shift" : `${myShift} shift`}
                </Text>
                <Text style={s.infoText}>
                  This report is{" "}
                  <Text style={{ fontWeight: "800" }}>shared</Text> with
                  everyone on your shift. Any shift-mate can view and edit it.
                </Text>
              </View>
            </View>
          )}

          {/* 1. Date & time */}
          <Section
            number="1"
            title="Patrol date & time"
            hint={`Allowed: ${formatDate(patrol?.start_date)} – ${formatDate(patrol?.end_date)}`}
          >
            {existingReportsLoaded ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
              >
                {patrolDates.map((d) => {
                  const isSelected = form?.date === d;
                  const isFuture =
                    getPatrolStatus(patrol) === "active" &&
                    parseLocalDate(d) > todayDate();
                  const done = existingByDate[d];
                  const missed = !isFuture && !done;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        s.datePill,
                        !isSelected && done && s.pillDone,
                        !isSelected && missed && s.pillMissed,
                        isSelected && s.pillOn,
                        isFuture && { opacity: 0.4 },
                      ]}
                      onPress={() => handleSelectDate(d)}
                      disabled={isFuture}
                      activeOpacity={0.8}
                    >
                      {done && !isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={13}
                          color="#15803d"
                          style={{ marginRight: 4 }}
                        />
                      )}
                      {missed && !isSelected && (
                        <Ionicons
                          name="alert-circle"
                          size={13}
                          color="#b91c1c"
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text
                        style={[
                          s.datePillTxt,
                          isSelected && { color: "#fff" },
                          !isSelected && done && { color: "#15803d" },
                          !isSelected && missed && { color: "#b91c1c" },
                        ]}
                      >
                        {formatDateShort(d)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={s.loadingRow}>
                <ActivityIndicator size="small" color={C.navy} />
                <Text style={s.loadingTxt}>Loading dates…</Text>
              </View>
            )}

            {existingReportsLoaded && (
              <View style={s.legendRow}>
                <View style={s.legendItem}>
                  <Ionicons name="checkmark-circle" size={12} color="#15803d" />
                  <Text style={s.legendTxt}> Reported</Text>
                </View>
                <View style={s.legendItem}>
                  <Ionicons name="alert-circle" size={12} color="#b91c1c" />
                  <Text style={s.legendTxt}> Missed</Text>
                </View>
              </View>
            )}

            {form && (
              <>
                <View>
                  <Text style={s.label}>Selected date</Text>
                  <View style={s.readOnly}>
                    <Ionicons name="calendar" size={15} color={C.navy} />
                    <Text style={s.readOnlyTxt}>
                      {form.date ? formatDate(form.date) : "Tap a date above"}
                    </Text>
                  </View>
                </View>
                <View style={s.row}>
                  <TimeField
                    label="Time from"
                    value={form.timeFrom}
                    onChange={setTime("timeFrom")}
                    disabled={!!myShift && myShift !== "AM & PM"}
                  />
                  <TimeField
                    label="Time to"
                    value={form.timeTo}
                    onChange={setTime("timeTo")}
                    disabled={!!myShift && myShift !== "AM & PM"}
                  />
                </View>
              </>
            )}
          </Section>

          {!form ? (
            existingReportsLoaded && (
              <View style={s.doneBox}>
                <View style={s.doneIcon}>
                  <Ionicons name="checkmark-circle" size={30} color="#16a34a" />
                </View>
                <Text style={s.doneTitle}>No reports to do for today</Text>
                <Text style={s.doneText}>
                  All available dates for this patrol already have a submitted
                  report. Select a date above to view or edit it.
                </Text>
              </View>
            )
          ) : (
            <>
              {/* 2. Patrol information */}
              <Section number="2" title="Patrol information">
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Sector / beat</Text>
                    <View style={[s.readOnly, { backgroundColor: "#f1f5f9" }]}>
                      <Text
                        style={[s.readOnlyTxt, { color: C.muted }]}
                        numberOfLines={1}
                      >
                        {form.sector || "—"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>Credit hours</Text>
                    <View
                      style={[
                        s.readOnly,
                        form.creditHours
                          ? {
                              backgroundColor: "#f0fdf4",
                              borderColor: "#bbf7d0",
                            }
                          : null,
                      ]}
                    >
                      <Ionicons
                        name="time"
                        size={14}
                        color={form.creditHours ? "#16a34a" : C.faint}
                      />
                      <Text
                        style={[
                          s.readOnlyTxt,
                          form.creditHours
                            ? { color: "#16a34a", fontWeight: "800" }
                            : { color: C.faint },
                        ]}
                      >
                        {form.creditHours || "Auto"}
                      </Text>
                    </View>
                  </View>
                </View>
                {tg(
                  "mustDos",
                  "Patrolled MUST DOs",
                  multi("mustDos", "List MUST DOs patrolled..."),
                )}
              </Section>

              {/* 3. Pre-deployment */}
              <Section number="3" title="Pre-deployment instructions">
                {tg(
                  "preDeployment",
                  "Specific instructions received",
                  multi(
                    "preDeployment",
                    "Enter pre-deployment instructions...",
                  ),
                )}
                {tg(
                  "action1",
                  "Action taken",
                  single("action1", "Action taken..."),
                )}
              </Section>

              {/* 4. Incidents */}
              <Section
                number="4"
                title="Incidents & unusual events"
                hint="Crime incidents, public disturbance, major events, etc."
              >
                {tg(
                  "incidents",
                  "Incidents / unusual situations",
                  multi("incidents", "Describe incidents or unusual events..."),
                )}
                {tg(
                  "action2",
                  "Action taken",
                  single("action2", "Action taken..."),
                )}
              </Section>

              {/* 5. Safety */}
              <Section
                number="5"
                title="Public safety concerns"
                hint="Uncovered manholes, busted lights, fire hazards, etc."
              >
                {tg(
                  "safetyConcerns",
                  "Safety concerns observed",
                  multi("safetyConcerns", "Describe public safety concerns..."),
                )}
                {tg(
                  "action3",
                  "Action taken",
                  single("action3", "Action taken..."),
                )}
              </Section>

              {/* 6. Other services */}
              <Section number="6" title="Other services & visited areas">
                {tg(
                  "otherServices",
                  "Other public safety services rendered",
                  multi(
                    "otherServices",
                    "Area security, PWD assistance, recovered property, etc.",
                    2,
                  ),
                )}
                {tg(
                  "visitedAreas",
                  "Visited areas",
                  multi(
                    "visitedAreas",
                    "House, school, church, business, barangay, etc.",
                    2,
                  ),
                )}
              </Section>

              {/* 7. Persons visited */}
              <Section number="7" title="Persons visited">
                {tg(
                  "personsVisited",
                  "Name of persons visited / local officials",
                  multi("personsVisited", "List persons visited...", 2),
                )}
                <View style={s.row}>
                  {tg(
                    "numOfficials",
                    "No. of officials visited",
                    <TextInput
                      style={s.input}
                      placeholder="0"
                      placeholderTextColor={C.faint}
                      keyboardType="numeric"
                      value={form.numOfficials}
                      onChangeText={set("numOfficials")}
                    />,
                    true,
                  )}
                  {tg(
                    "numGovt",
                    "Total gov't officials in area",
                    <TextInput
                      style={s.input}
                      placeholder="0"
                      placeholderTextColor={C.faint}
                      keyboardType="numeric"
                      value={form.numGovt}
                      onChangeText={set("numGovt")}
                    />,
                    true,
                  )}
                </View>
              </Section>

              {/* 8. Remarks */}
              <Section number="8" title="Remarks & recommendations">
                <Text style={s.label}>
                  Remarks / recommendations{" "}
                  <Text style={{ color: C.red }}>*</Text>
                </Text>
                {multi(
                  "remarks",
                  "Best practices, traffic assistance rendered, etc.",
                  4,
                )}
              </Section>

              {/* 9. Photos */}
              <Section
                number="9"
                title="Photo documentation"
                hint={`${images.length + existingPhotos.length}/10 photos`}
              >
                <PhotoGrid
                  images={images}
                  existingPhotos={existingPhotos}
                  onAddCamera={pickFromCamera}
                  onAddGallery={pickFromGallery}
                  onRemoveNew={removeNewImage}
                  onRemoveExisting={removeExistingPhoto}
                />
              </Section>

              <TouchableOpacity
                style={[s.submit, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={isEditing ? "save" : "paper-plane"}
                      size={17}
                      color="#fff"
                    />
                    <Text style={s.submitTxt}>
                      {" "}
                      {isEditing ? "Update report" : "Submit report"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

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

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.dark },
  annex: {
    fontSize: 9.5,
    color: "rgba(255,255,255,0.4)",
    marginTop: 10,
    letterSpacing: 0.5,
  },
  editBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#fef3c7",
    borderBottomWidth: 1,
    borderBottomColor: "#fcd34d",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  editBannerTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: "#92400e",
    letterSpacing: 0.8,
  },

  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8edf3",
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: C.navy,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoText: { fontSize: 12, color: C.muted, lineHeight: 17, marginTop: 2 },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e8edf3",
    overflow: "hidden",
  },
  secHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#fafbfd",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  secNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  secNumTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  secTitle: { fontSize: 14.5, fontWeight: "800", color: C.navy },
  secHint: { fontSize: 11, color: C.faint, marginTop: 1 },
  secBody: { padding: 14, gap: 14 },

  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: C.text,
    backgroundColor: "#f8fafc",
  },
  row: { flexDirection: "row", gap: 10 },
  readOnly: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  readOnlyTxt: { flex: 1, fontSize: 13.5, color: C.text, fontWeight: "600" },

  timeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: "#f8fafc",
  },
  timeBtnTxt: { flex: 1, fontSize: 13.5, color: C.navy, fontWeight: "700" },

  datePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: "#f8fafc",
  },
  datePillTxt: { fontSize: 12.5, fontWeight: "700", color: C.navy },
  pillOn: { backgroundColor: C.navy, borderColor: C.navy },
  pillDone: { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  pillMissed: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingTxt: { fontSize: 12, color: C.faint },
  legendRow: { flexDirection: "row", gap: 14, marginTop: -4 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendTxt: { fontSize: 11, color: C.muted, fontWeight: "600" },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#b6c3d4",
    backgroundColor: "#f8fafc",
  },
  addTxt: { flex: 1, fontSize: 12.5, fontWeight: "800", color: C.navy },
  toggleHead: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  removeTxt: { fontSize: 11.5, fontWeight: "800", color: "#dc2626" },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
  },
  photoImg: { width: "100%", height: "100%", resizeMode: "cover" },
  photoBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  photoBadgeTxt: { fontSize: 9, fontWeight: "800", color: C.navy },
  photoX: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  photoAdd: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#b6c3d4",
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  photoAddTxt: { fontSize: 11, fontWeight: "800", color: C.navy },
  maxBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
  },
  maxTxt: { fontSize: 12, fontWeight: "700", color: "#92400e" },

  doneBox: {
    alignItems: "center",
    padding: 28,
    gap: 8,
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#86efac",
    borderStyle: "dashed",
  },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  doneTitle: { fontSize: 15, fontWeight: "800", color: C.navy },
  doneText: {
    fontSize: 12.5,
    color: C.muted,
    textAlign: "center",
    lineHeight: 18,
  },

  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.red,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: C.red,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },

  // sheets
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#dee2e6",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: C.navy },
  sheetFoot: { flexDirection: "row", gap: 10, marginTop: 16 },
  btnGhost: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhostTxt: { fontSize: 14, fontWeight: "700", color: "#475569" },
  btnPrimary: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryTxt: { fontSize: 15, fontWeight: "800", color: "#fff" },

  tpBody: { flexDirection: "row", alignItems: "flex-start", marginTop: 12 },
  tpCol: { flex: 1, alignItems: "stretch" },
  tpColLbl: {
    fontSize: 10,
    fontWeight: "800",
    color: C.faint,
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 6,
  },
  tpItem: { paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tpItemOn: { backgroundColor: C.navy },
  tpItemTxt: { fontSize: 17, color: "#475569", fontWeight: "600" },
  tpSep: {
    fontSize: 24,
    fontWeight: "800",
    color: C.faint,
    paddingTop: 30,
    paddingHorizontal: 4,
  },
  tpPeriodCol: { width: 62, alignItems: "center", marginLeft: 6 },
  tpPeriod: {
    width: 54,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    marginBottom: 8,
  },
  tpPeriodOn: { backgroundColor: C.navy, borderColor: C.navy },
  tpPeriodTxt: { fontSize: 14, fontWeight: "800", color: "#475569" },
});
