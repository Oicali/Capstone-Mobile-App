// Shared date picker button (Android calendar / iOS spinner sheet), moved out of PatrolSchedulingScreen
import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { C } from "./PatrolUI";

// Date helpers (also used by screens that hold dates as "YYYY-MM-DD" strings)
export const pad = (n) => String(n).padStart(2, "0");
export const isoDate = (iso) => (iso ? new Date(iso + "T00:00:00") : new Date());
export const fmtISODate = (d) =>
  d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";

const DatePickerBtn = React.memo(function DatePickerBtn({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
}) {
  const [show, setShow] = useState(false);
  const [temp, setTemp] = useState(new Date());

  // Keep any date inside [minimumDate, maximumDate]; fixes value < min on Android
  const clamp = (d) => {
    if (maximumDate && d > maximumDate) return maximumDate;
    if (minimumDate && d < minimumDate) return minimumDate;
    return d;
  };

  const disp = value
    ? (() => {
        const d = isoDate(value);
        return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
      })()
    : "";
  const current = useMemo(
    () => clamp(value ? isoDate(value) : new Date()),
    [value, minimumDate, maximumDate],
  );

  const trigger = (
    <TouchableOpacity
      style={s.dateBtn}
      activeOpacity={0.8}
      onPress={() => {
        setTemp(current);
        setShow(true);
      }}
    >
      <Ionicons name="calendar-outline" size={15} color={value ? C.navy : C.faint} />
      <Text style={[s.dateBtnTxt, !value && { color: C.faint }]}>
        {disp || "Select date"}
      </Text>
    </TouchableOpacity>
  );

  if (Platform.OS === "ios") {
    return (
      <View style={{ flex: 1 }}>
        <Text style={s.lbl}>{label}</Text>
        {trigger}
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={s.iosOv}>
            <View style={s.iosSheet}>
              <View style={s.iosHdr}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={s.iosCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={s.iosTitle}>{label}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(temp);
                    setShow(false);
                  }}
                >
                  <Text style={s.iosDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={temp}
                mode="date"
                display="spinner"
                onChange={(_, d) => d && setTemp(clamp(d))}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={{ height: 180 }}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={s.lbl}>{label}</Text>
      {trigger}
      {show && (
        <DateTimePicker
          value={current}
          mode="date"
          display="calendar"
          onChange={(e, d) => {
            setShow(false);
            if (e.type !== "dismissed" && d) onChange(d);
          }}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
});

export default DatePickerBtn;

const s = StyleSheet.create({
  lbl: {
    fontSize: 10.5,
    fontWeight: "800",
    color: C.faint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 12,
  },
  dateBtnTxt: { fontSize: 13, color: C.text, fontWeight: "600", flex: 1 },
  iosOv: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  iosSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 34,
  },
  iosHdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  iosCancel: { fontSize: 15, color: C.muted, fontWeight: "600" },
  iosTitle: { fontSize: 15, fontWeight: "800", color: C.navy },
  iosDone: { fontSize: 15, color: C.navy, fontWeight: "800" },
});