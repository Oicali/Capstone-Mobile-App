// screens/components/TimePickerBtn.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Modal,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { C } from "./PatrolUI";
import { fmt12, hhmm, timeToDate } from "./patrolTime";

// Compact time button (Android clock dialog / iOS spinner sheet); value is "HH:MM"
export default function TimePickerBtn({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  const [temp, setTemp] = useState(new Date());

  const trigger = (
    <TouchableOpacity
      style={s.btn}
      activeOpacity={0.8}
      accessibilityLabel={`${label} time`}
      onPress={() => {
        setTemp(timeToDate(value));
        setShow(true);
      }}
    >
      <Text style={s.txt}>{fmt12(value)}</Text>
    </TouchableOpacity>
  );

  if (Platform.OS === "ios") {
    return (
      <>
        {trigger}
        <Modal
          visible={show}
          transparent
          animationType="slide"
          onRequestClose={() => setShow(false)}
        >
          <View style={s.ov}>
            <View style={s.sheet}>
              <View style={s.hdr}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={s.cancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={s.title}>{label} time</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(hhmm(temp));
                    setShow(false);
                  }}
                >
                  <Text style={s.done}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={temp}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={(_, d) => d && setTemp(d)}
                style={{ height: 180 }}
              />
            </View>
          </View>
        </Modal>
      </>
    );
  }

  return (
    <>
      {trigger}
      {show && (
        <DateTimePicker
          value={timeToDate(value)}
          mode="time"
          display="default"
          is24Hour={false}
          onChange={(e, d) => {
            setShow(false);
            if (e.type !== "dismissed" && d) onChange(hhmm(d));
          }}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  btn: {
    minWidth: 84,
    height: 32,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  txt: { fontSize: 12, fontWeight: "800", color: C.navy },
  ov: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 34,
  },
  hdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cancel: { fontSize: 15, color: C.muted, fontWeight: "600" },
  title: { fontSize: 15, fontWeight: "800", color: C.navy },
  done: { fontSize: 15, color: C.navy, fontWeight: "800" },
});