// screens/PatrolLogScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { C, ScreenHeader, SectionLabel } from "./components/PatrolUI";

const HISTORY = [
  {
    date: "Jan 20, 2026",
    duration: "4h 30m",
    time: "08:00 AM – 12:30 PM",
    remarks: "Routine patrol completed",
  },
  {
    date: "Jan 19, 2026",
    duration: "3h 45m",
    time: "02:00 PM – 05:45 PM",
    remarks: "No incidents reported",
  },
  {
    date: "Jan 18, 2026",
    duration: "5h 15m",
    time: "09:00 AM – 02:15 PM",
    remarks: "Community engagement activities",
  },
];

export default function PatrolLogScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [isOnPatrol, setIsOnPatrol] = useState(false);
  const [patrolStartTime, setPatrolStartTime] = useState(null);
  const [remarks, setRemarks] = useState("");

  const handleStartPatrol = () => {
    Alert.alert("Start patrol", "Begin patrol duty now?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start",
        onPress: () => {
          setIsOnPatrol(true);
          setPatrolStartTime(new Date());
          Alert.alert("Patrol started", "GPS tracking active");
        },
      },
    ]);
  };

  const handleEndPatrol = () => {
    Alert.alert("End patrol", "End patrol duty now?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End",
        onPress: () => {
          setIsOnPatrol(false);
          setPatrolStartTime(null);
          setRemarks("");
          Alert.alert("Patrol ended", "Log saved successfully");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScreenHeader
        title="Patrol Log"
        subtitle="Duty status and recent logs"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={{
          padding: 14,
          paddingBottom: insets.bottom + 40,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Status */}
        <View style={[s.statusCard, isOnPatrol && s.statusCardOn]}>
          <View style={s.statusTop}>
            <View
              style={[s.statusIcon, isOnPatrol && { backgroundColor: C.red }]}
            >
              <Ionicons
                name={isOnPatrol ? "shield-checkmark" : "shield-outline"}
                size={24}
                color={isOnPatrol ? "#fff" : C.muted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.statusLbl}>Current status</Text>
              <Text style={[s.statusVal, isOnPatrol && { color: C.red }]}>
                {isOnPatrol ? "ON PATROL" : "OFF DUTY"}
              </Text>
            </View>
            <View
              style={[s.pulse, isOnPatrol && { backgroundColor: "#22c55e" }]}
            />
          </View>

          {isOnPatrol && (
            <View style={s.statusInfo}>
              <View style={s.infoRow}>
                <Ionicons name="navigate-circle" size={18} color="#16a34a" />
                <Text style={s.infoLbl}>GPS tracking</Text>
                <Text style={[s.infoVal, { color: "#16a34a" }]}>Active</Text>
              </View>
              <View style={s.infoRow}>
                <Ionicons name="time" size={18} color={C.muted} />
                <Text style={s.infoLbl}>Started</Text>
                <Text style={s.infoVal}>
                  {patrolStartTime?.toLocaleTimeString()}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Action */}
        {!isOnPatrol ? (
          <TouchableOpacity
            style={[s.bigBtn, { backgroundColor: C.red }]}
            onPress={handleStartPatrol}
            activeOpacity={0.85}
          >
            <Ionicons name="play-circle" size={22} color="#fff" />
            <Text style={s.bigBtnTxt}>START PATROL</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={s.card}>
              <Text style={s.label}>Remarks (optional)</Text>
              <TextInput
                style={s.textArea}
                placeholder="Add any notes or observations..."
                placeholderTextColor={C.faint}
                value={remarks}
                onChangeText={setRemarks}
                multiline
                textAlignVertical="top"
              />
            </View>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: C.dark }]}
              onPress={handleEndPatrol}
              activeOpacity={0.85}
            >
              <Ionicons name="stop-circle" size={22} color="#fff" />
              <Text style={s.bigBtnTxt}>END PATROL</Text>
            </TouchableOpacity>
          </>
        )}

        {/* History */}
        <View>
          <SectionLabel title="Recent patrol logs" count={HISTORY.length} />
          {HISTORY.map((h) => (
            <View key={h.date} style={s.hCard}>
              <View style={s.hTop}>
                <View style={s.hDateRow}>
                  <Ionicons name="calendar" size={15} color={C.navy} />
                  <Text style={s.hDate}>{h.date}</Text>
                </View>
                <View style={s.hDuration}>
                  <Ionicons name="time" size={12} color={C.navy} />
                  <Text style={s.hDurationTxt}> {h.duration}</Text>
                </View>
              </View>
              <Text style={s.hTime}>{h.time}</Text>
              <Text style={s.hRemarks}>{h.remarks}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.dark },
  statusCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  statusCardOn: { borderColor: "#fecaca", backgroundColor: "#fff8f8" },
  statusTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  statusIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#eef2f6",
    alignItems: "center",
    justifyContent: "center",
  },
  statusLbl: {
    fontSize: 11,
    fontWeight: "800",
    color: C.faint,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  statusVal: { fontSize: 20, fontWeight: "800", color: C.muted, marginTop: 2 },
  pulse: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#cbd5e1" },
  statusInfo: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#fee2e2",
    gap: 10,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLbl: { flex: 1, fontSize: 13, color: C.muted },
  infoVal: { fontSize: 13, fontWeight: "800", color: C.text },

  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 17,
    borderRadius: 14,
  },
  bigBtnTxt: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e8edf3",
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: C.text,
    backgroundColor: "#f8fafc",
    height: 100,
  },

  hCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e8edf3",
    borderLeftWidth: 4,
    borderLeftColor: C.navy,
  },
  hTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  hDateRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  hDate: { fontSize: 14, fontWeight: "800", color: C.dark },
  hDuration: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8eef6",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  hDurationTxt: { fontSize: 12, fontWeight: "800", color: C.navy },
  hTime: { fontSize: 12.5, color: C.muted, marginBottom: 4 },
  hRemarks: { fontSize: 12.5, color: "#475569", fontStyle: "italic" },
});
