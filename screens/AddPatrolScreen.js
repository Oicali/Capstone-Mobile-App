// screens/AddPatrolScreen.js
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { C, ScreenHeader, Segmented, formatDate } from "./components/PatrolUI";
import DatePickerBtn, { isoDate, fmtISODate } from "./components/DatePickerBtn";
// GeoJSON asset loader + the Area tab component
import { Asset } from "expo-asset";
import PatrolAreaPicker from "./components/PatrolAreaPicker";
// Task timetable: time picker button + shared time rules
import TimePickerBtn from "./components/TimePickerBtn";
import {
  toMin,
  shiftMin,
  addMinutes,
  badRange,
  overlaps,
} from "./components/patrolTime";


const API_BASE = process.env.EXPO_PUBLIC_API_URL;
const getToken = async () => AsyncStorage.getItem("auth_token");

// Same 7-day cap as the web AddPatrolModal
const MAX_PATROL_DAYS = 7;

// Inclusive day count between two "YYYY-MM-DD" strings
const diffDaysInclusive = (start, end) => {
  if (!start || !end) return 0;
  return Math.round((isoDate(end) - isoDate(start)) / 86400000) + 1;
};

// Two-letter avatar text from a full name
const initialsOf = (name) =>
  (name || "")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "??";

// ── Card with title bar (same look as PatrolDetailScreen's Block) ───────────
const Block = ({ title, badge, icon, children }) => (
  <View style={s.block}>
    <View style={s.blockHead}>
      <View style={s.blockIcon}>
        <Ionicons name={icon} size={14} color="#fff" />
      </View>
      <Text style={s.blockTitle}>{title}</Text>
      {badge != null && (
        <View style={s.blockBadge}>
          <Text style={s.blockBadgeTxt}>{badge}</Text>
        </View>
      )}
    </View>
    {children}
  </View>
);

export default function AddPatrolScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState("details");
  // Core fields; dates are "YYYY-MM-DD" strings like the web modal
  const [form, setForm] = useState({
    patrol_name: "",
    mobile_unit_id: "",
    start_date: "",
    end_date: "",
  });
  const [availableUnits, setAvailableUnits] = useState(null); // null = no valid dates yet
  const [loadingUnits, setLoadingUnits] = useState(false);
  // Area tab: selected barangay names (same shape the web modal sends) + map data
  const [barangays, setBarangays] = useState([]);
  // Schedule tab: which shift is shown + chosen patrollers per shift (objects, not just IDs)
  const [activeShift, setActiveShift] = useState("AM");
  const [amPatrollers, setAmPatrollers] = useState([]);
  const [pmPatrollers, setPmPatrollers] = useState([]);
  // Timetable tasks for both shifts: { _id, shift, time_start, time_end, notes }
  const [tasks, setTasks] = useState([]);
  const taskSeq = useRef(0);
  // True while the POST is in flight (blocks double taps)
  const [saving, setSaving] = useState(false);
  const [geoJSONData, setGeoJSONData] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);

  // End date window: start .. start + 6 days
  const minEnd = useMemo(
    () => (form.start_date ? isoDate(form.start_date) : undefined),
    [form.start_date],
  );
  const maxEnd = useMemo(() => {
    if (!form.start_date) return undefined;
    const d = isoDate(form.start_date);
    d.setDate(d.getDate() + MAX_PATROL_DAYS - 1);
    return d;
  }, [form.start_date]);

  // Reload available units whenever the date range changes
  useEffect(() => {
    setAvailableUnits(null);
    setLoadingUnits(false);
    // Availability depends on the dates, so earlier patroller picks are no longer valid
    setAmPatrollers([]);
    setPmPatrollers([]);
    setForm((p) => ({ ...p, mobile_unit_id: "" }));
    const { start_date, end_date } = form;
    if (!start_date || !end_date || end_date < start_date) return;

    let cancelled = false;
    setLoadingUnits(true);
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API_BASE}/patrol/available-mobile-units?start=${start_date}&end=${end_date}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.success) setAvailableUnits(data.data);
        else
          Alert.alert("Error", "Could not check mobile unit availability.");
      } catch {
        if (!cancelled)
          Alert.alert("Error", "Could not check mobile unit availability.");
      } finally {
        if (!cancelled) setLoadingUnits(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.start_date, form.end_date]);

  // New start date: clear the end date if it falls outside the 7-day window
  const handleStartChange = (d) => {
    const newStart = fmtISODate(d);
    const endInvalid =
      form.end_date &&
      (form.end_date < newStart ||
        diffDaysInclusive(newStart, form.end_date) > MAX_PATROL_DAYS);
    if (endInvalid)
      Alert.alert(
        "End date cleared",
        `Patrol length is limited to ${MAX_PATROL_DAYS} days. Please pick the end date again.`,
      );
    setForm((p) => ({
      ...p,
      start_date: newStart,
      end_date: endInvalid ? "" : p.end_date,
    }));
  };

  // End date needs a start date first (picker bounds do the rest)
  const handleEndChange = (d) => {
    if (!form.start_date) {
      Alert.alert("Start date needed", "Please select a start date first.");
      return;
    }
    setForm((p) => ({ ...p, end_date: fmtISODate(d) }));
  };

  // Load the barangay polygons once (same asset PatrolDetailScreen uses)
  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(
          require("../assets/bacoor_barangays.geojson"),
        );
        await asset.downloadAsync();
        setGeoJSONData(await (await fetch(asset.localUri)).json());
      } catch (err) {
        console.warn("GeoJSON load failed:", err);
      } finally {
        setGeoLoading(false);
      }
    })();
  }, []);

  // Active shift's tasks in time order (PM-aware); recomputed only when tasks or shift change
  const shiftTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.shift === activeShift)
        .sort(
          (a, b) =>
            shiftMin(a.time_start, activeShift) -
            shiftMin(b.time_start, activeShift),
        ),
    [tasks, activeShift],
  );
  const hasTimeProblem = shiftTasks.some(
    (t, i) => badRange(t) || overlaps(t, shiftTasks[i - 1]),
  );

  // Append a task right after the last one, with web-modal defaults and shift limits
  const addTask = () => {
    const last = shiftTasks[shiftTasks.length - 1];
    if (last?.time_end) {
      if (activeShift === "AM" && toMin(last.time_end) >= 20 * 60) {
        Alert.alert("Limit reached", "AM shift tasks cannot go past 8:00 PM.");
        return;
      }
      if (
        activeShift === "PM" &&
        shiftMin(last.time_end, "PM") - 20 * 60 >= 12 * 60
      ) {
        Alert.alert("Limit reached", "PM shift tasks cannot go past 8:00 AM.");
        return;
      }
    }
    const first = !last;
    const start = first
      ? activeShift === "AM"
        ? "08:00"
        : "20:00"
      : last.time_end
        ? addMinutes(last.time_end, 1)
        : last.time_start;
    const end = addMinutes(start, first ? 60 : 59);
    taskSeq.current += 1;
    setTasks((prev) => [
      ...prev,
      { _id: taskSeq.current, shift: activeShift, time_start: start, time_end: end, notes: "" },
    ]);
  };

  // Change one field of one task
  const updateTask = (id, field, v) =>
    setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, [field]: v } : t)));

  const removeTask = (id) => setTasks((prev) => prev.filter((t) => t._id !== id));

  // Apply the picker's result once, then clear the params so it can't re-apply
  useEffect(() => {
    const { pickedShift, pickedPatrollers } = route.params || {};
    if (!pickedShift || !pickedPatrollers) return;
    if (pickedShift === "AM") setAmPatrollers(pickedPatrollers);
    else setPmPatrollers(pickedPatrollers);
    navigation.setParams({ pickedShift: undefined, pickedPatrollers: undefined });
  }, [route.params?.pickedShift, route.params?.pickedPatrollers]);

  // Open the full-screen picker for the active shift
  const openPicker = () => {
    const mine = activeShift === "AM" ? amPatrollers : pmPatrollers;
    const other = activeShift === "AM" ? pmPatrollers : amPatrollers;
    navigation.navigate("PickPatrollers", {
      shift: activeShift,
      startDate: form.start_date,
      endDate: form.end_date,
      selectedIds: mine.map((p) => p.active_patroller_id),
      otherShiftIds: other.map((p) => p.active_patroller_id),
      returnKey: route.key,
    });
  };

  // Add the barangay if absent, remove it if present
  const toggleBarangay = (name) =>
    setBarangays((prev) =>
      prev.includes(name) ? prev.filter((b) => b !== name) : [...prev, name],
    );

  // One shift's tasks in time order (PM-aware), used for validation and the payload
  const tasksForShift = (shift) =>
    tasks
      .filter((t) => t.shift === shift)
      .sort((a, b) => shiftMin(a.time_start, shift) - shiftMin(b.time_start, shift));

  // First problem as { tab, message } so we can jump to the right tab, or null if valid
  const validate = () => {
    if (
      !form.patrol_name.trim() ||
      !form.mobile_unit_id ||
      !form.start_date ||
      !form.end_date
    )
      return { tab: "details", message: "Please fill in the patrol name, dates, and mobile unit." };
    if (form.end_date < form.start_date)
      return { tab: "details", message: "End date must be on or after the start date." };
    if (diffDaysInclusive(form.start_date, form.end_date) > MAX_PATROL_DAYS)
      return { tab: "details", message: `Patrol length cannot exceed ${MAX_PATROL_DAYS} days.` };
    if (barangays.length === 0)
      return { tab: "area", message: "Select at least one barangay on the map." };
    if (amPatrollers.length === 0 && pmPatrollers.length === 0)
      return { tab: "schedule", message: "Assign at least one patroller to the AM or PM shift." };

    for (const shift of ["AM", "PM"]) {
      const list = tasksForShift(shift);
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.time_start || !t.time_end)
          return { tab: "schedule", message: `A ${shift} task is missing its start or end time.` };
        if (badRange(t))
          return { tab: "schedule", message: `A ${shift} task's end time must be after its start time.` };
        if (overlaps(t, list[i - 1]))
          return { tab: "schedule", message: `${shift} shift tasks overlap. Adjust their times.` };
      }
    }
    return null;
  };

  // Validate, POST in the same shape the web modal sends, then return to the list
  const handleCreate = async () => {
    if (saving) return;
    const problem = validate();
    if (problem) {
      setActiveTab(problem.tab);
      Alert.alert("Check the form", problem.message);
      return;
    }

    // AM tasks then PM tasks, each in time order, numbered 1..n (always > 0)
    const routes = [...tasksForShift("AM"), ...tasksForShift("PM")].map((t, i) => ({
      shift: t.shift,
      time_start: t.time_start,
      time_end: t.time_end,
      notes: t.notes.trim() || null,
      stop_order: i + 1,
    }));

    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/patrol/patrols`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patrol_name: form.patrol_name.trim(),
          mobile_unit_id: form.mobile_unit_id,
          start_date: form.start_date,
          end_date: form.end_date,
          patroller_ids_am: amPatrollers.map((p) => p.active_patroller_id),
          patroller_ids_pm: pmPatrollers.map((p) => p.active_patroller_id),
          barangays,
          routes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Not cancelable, so the user can't dismiss it and tap Create a second time
        Alert.alert("Patrol created", "The schedule has been saved.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ], { cancelable: false });
      } else {
        Alert.alert("Could not create patrol", data.message || "Something went wrong.");
      }
    } catch {
      Alert.alert("Server error", "Could not reach the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const days = diffDaysInclusive(form.start_date, form.end_date);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title="New Patrol"
        subtitle="Create a patrol schedule"
        onBack={() => navigation.goBack()}
      >
        <View style={{ marginTop: 12 }}>
          <Segmented
            value={activeTab}
            onChange={setActiveTab}
            items={[
              { key: "details", label: "Details", icon: "document-text-outline" },
              { key: "area", label: "Area", icon: "location-outline", count: barangays.length },
              { key: "schedule", label: "Schedule", icon: "time-outline", count: amPatrollers.length + pmPatrollers.length },
            ]}
          />
        </View>
      </ScreenHeader>

      <View style={s.body}>
        {/* DETAILS */}
        {activeTab === "details" && (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 12 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Block title="Patrol details" icon="list">
              <View style={s.blockPad}>
                <Text style={s.lbl}>Patrol name *</Text>
                <TextInput
                  style={s.input}
                  placeholder="e.g. Sector 6 Beat 2"
                  placeholderTextColor={C.faint}
                  value={form.patrol_name}
                  onChangeText={(v) => setForm((p) => ({ ...p, patrol_name: v }))}
                />

                <View style={s.dateRow}>
                  <DatePickerBtn
                    label="From *"
                    value={form.start_date}
                    onChange={handleStartChange}
                  />
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={C.faint}
                    style={{ marginTop: 26 }}
                  />
                  <DatePickerBtn
                    label="To *"
                    value={form.end_date}
                    onChange={handleEndChange}
                    minimumDate={minEnd}
                    maximumDate={maxEnd}
                  />
                </View>

                <Text style={s.hint}>
                  {days > 0
                    ? `${days} of ${MAX_PATROL_DAYS} days`
                    : `Maximum patrol length is ${MAX_PATROL_DAYS} days`}
                </Text>
              </View>
            </Block>

            <Block
              title="Mobile unit"
              icon="car-sport"
              badge={availableUnits?.length || undefined}
            >
              {!form.start_date || !form.end_date ? (
                <Text style={s.emptyNote}>Select the dates first.</Text>
              ) : loadingUnits ? (
                <View style={s.unitLoading}>
                  <ActivityIndicator color={C.navy} />
                </View>
              ) : availableUnits?.length === 0 ? (
                <Text style={s.emptyNote}>
                  No mobile units available for these dates.
                </Text>
              ) : (
                (availableUnits || []).map((mu, i) => {
                  const selected = form.mobile_unit_id === mu.mobile_unit_id;
                  return (
                    <TouchableOpacity
                      key={mu.mobile_unit_id}
                      style={[
                        s.unitRow,
                        i === 0 && { borderTopWidth: 0 },
                        selected && { backgroundColor: "#eef3f9" },
                      ]}
                      activeOpacity={0.8}
                      onPress={() =>
                        setForm((p) => ({ ...p, mobile_unit_id: mu.mobile_unit_id }))
                      }
                    >
                      <View style={s.unitIcon}>
                        <Ionicons name="car-sport-outline" size={14} color={C.navy} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.unitName}>{mu.mobile_unit_name}</Text>
                        {!!mu.plate_number && (
                          <Text style={s.unitPlate}>Plate {mu.plate_number}</Text>
                        )}
                      </View>
                      <View style={[s.radio, selected && s.radioOn]}>
                        {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </Block>
          </ScrollView>
        )}

        {/* AREA tab */}
        {activeTab === "area" && (
          <PatrolAreaPicker
            geoJSONData={geoJSONData}
            geoLoading={geoLoading}
            barangays={barangays}
            onToggle={toggleBarangay}
          />
        )}

        {/* SCHEDULE tab */}
        {activeTab === "schedule" && (
          <ScrollView
            contentContainerStyle={{ padding: 14, gap: 12 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {!form.start_date || !form.end_date ? (
              <View style={s.infoChip}>
                <Ionicons name="information-circle-outline" size={15} color={C.navy} />
                <Text style={s.infoChipTxt}>
                  Pick the patrol dates on the Details tab first.
                </Text>
              </View>
            ) : (
              <>
                <View style={s.infoChip}>
                  <Ionicons name="calendar" size={14} color={C.navy} />
                  <Text style={s.infoChipTxt}>
                    {formatDate(form.start_date)} — {formatDate(form.end_date)}
                  </Text>
                </View>

                <Segmented
                  variant="light"
                  value={activeShift}
                  onChange={setActiveShift}
                  items={[
                    { key: "AM", label: "AM Shift", icon: "sunny", count: amPatrollers.length },
                    { key: "PM", label: "PM Shift", icon: "moon", count: pmPatrollers.length },
                  ]}
                />

                <Block
                  title={`${activeShift} shift patrollers`}
                  icon="people"
                  badge={(activeShift === "AM" ? amPatrollers : pmPatrollers).length || undefined}
                >
                  {(activeShift === "AM" ? amPatrollers : pmPatrollers).map((p, i) => (
                    <View key={p.active_patroller_id} style={[s.pRow, i === 0 && { borderTopWidth: 0 }]}>
                      <View style={s.pAvatar}>
                        <Text style={s.pAvatarTxt}>{initialsOf(p.officer_name)}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={s.pName} numberOfLines={1}>{p.officer_name}</Text>
                        {!!p.rank && <Text style={s.pRank}>{p.rank}</Text>}
                      </View>
                    </View>
                  ))}
                  <TouchableOpacity style={s.assignBtn} onPress={openPicker} activeOpacity={0.8}>
                    <Text style={s.assignTxt}>
                      {(activeShift === "AM" ? amPatrollers : pmPatrollers).length
                        ? "Edit patrollers"
                        : "Assign patrollers"}
                    </Text>
                  </TouchableOpacity>
                </Block>

                <Block
                  title={`${activeShift} tasks`}
                  icon="list"
                  badge={shiftTasks.length || undefined}
                >
                  <View style={{ padding: 14, paddingBottom: 6 }}>
                    {shiftTasks.length === 0 && (
                      <Text style={s.emptyInline}>
                        No tasks yet. Tap "Add task" below.
                      </Text>
                    )}
                    {shiftTasks.map((t, i) => {
                      const problem = badRange(t) || overlaps(t, shiftTasks[i - 1]);
                      return (
                        <View key={t._id} style={[s.taskRow, problem && s.taskRowBad]}>
                          <View style={s.taskTime}>
                            <TimePickerBtn
                              label="Start"
                              value={t.time_start}
                              onChange={(v) => updateTask(t._id, "time_start", v)}
                            />
                            <View style={s.rail} />
                            <TimePickerBtn
                              label="End"
                              value={t.time_end}
                              onChange={(v) => updateTask(t._id, "time_end", v)}
                            />
                          </View>
                          <TextInput
                            style={s.taskInput}
                            multiline
                            placeholder="Enter task or comment..."
                            placeholderTextColor={C.faint}
                            value={t.notes}
                            onChangeText={(v) => updateTask(t._id, "notes", v)}
                          />
                          <TouchableOpacity
                            style={s.removeBtn}
                            onPress={() => removeTask(t._id)}
                            accessibilityLabel="Remove task"
                          >
                            <Ionicons name="close" size={16} color="#475569" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                    {hasTimeProblem && (
                      <Text style={s.warnTxt}>
                        Fix the highlighted times: end must be after start, and tasks can't overlap.
                      </Text>
                    )}
                    <TouchableOpacity style={s.addTaskBtn} onPress={addTask} activeOpacity={0.8}>
                      <Ionicons name="add" size={16} color={C.navy} />
                      <Text style={s.addTaskTxt}>Add task</Text>
                    </TouchableOpacity>
                  </View>
                </Block>
              </>
            )}
          </ScrollView>
        )}

        {/* Sticky bottom bar */}
        <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={s.cancelBtn}
            onPress={() => navigation.goBack()}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.createBtn, saving && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.createTxt}>Create Patrol</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  taskRow: {
    flexDirection: "row",
    gap: 10,
    padding: 6,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  taskRowBad: { backgroundColor: "#fffbeb", borderColor: "#f59e0b" },
  taskTime: { alignItems: "center", gap: 3 },
  rail: { width: 2, flex: 1, minHeight: 8, backgroundColor: "#dbe3ee", borderRadius: 1 },
  taskInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#eef2f6",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: C.text,
    textAlignVertical: "top",
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  addTaskBtn: {
    height: 44,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#94a3b8",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 8,
  },
  addTaskTxt: { fontSize: 13, fontWeight: "800", color: C.navy },
  emptyInline: { fontSize: 13, color: C.faint, fontStyle: "italic", marginBottom: 12 },
  warnTxt: { fontSize: 12, fontWeight: "700", color: "#92400e", marginBottom: 10 },
  infoChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e8edf4",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  infoChipTxt: { fontSize: 12.5, fontWeight: "700", color: C.navy, flex: 1 },
  pRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  pAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  pAvatarTxt: { fontSize: 13, fontWeight: "800", color: "#fff" },
  pName: { fontSize: 13.5, fontWeight: "700", color: C.text },
  pRank: { fontSize: 11.5, color: C.muted, marginTop: 1 },
  assignBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  assignTxt: { fontSize: 13, fontWeight: "800", color: C.navy },
  safe: { flex: 1, backgroundColor: C.dark },
  body: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadTxt: { fontSize: 13, color: C.muted },

  block: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e8edf3",
    overflow: "hidden",
  },
  blockHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fafbfd",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  blockIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  blockTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: C.navy,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  blockBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  blockBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  blockPad: { padding: 14 },

  lbl: {
    fontSize: 10.5,
    fontWeight: "800",
    color: C.faint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
    fontSize: 13,
    color: C.text,
    marginBottom: 14,
  },
  dateRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  hint: { fontSize: 12, color: C.muted, fontWeight: "600", marginTop: 12 },
  emptyNote: { fontSize: 13, color: C.faint, fontStyle: "italic", padding: 16 },
  unitLoading: { padding: 20, alignItems: "center" },

  unitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  unitIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "#e8eef6",
    alignItems: "center",
    justifyContent: "center",
  },
  unitName: { fontSize: 13.5, fontWeight: "700", color: C.text },
  unitPlate: { fontSize: 11.5, color: C.muted },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { backgroundColor: C.navy, borderColor: C.navy },

  bar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelTxt: { fontSize: 14, fontWeight: "800", color: "#334155" },
  createBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
  },
  createTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
});