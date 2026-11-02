// screens/components/PatrolUI.js
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const C = {
  dark: "#0a1628",
  navy: "#1e3a5f",
  red: "#c1272d",
  bg: "#f1f5f9",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  green: "#16a34a",
};

// ── date helpers ────────────────────────────────────────────────────────────
export const parseLocalDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};
export const toLocalDateStr = (d) => {
  const dt = parseLocalDate(d);
  if (!dt) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
export const todayDate = () => {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
};
export const todayStr = () => toLocalDateStr(new Date());
export const generateDateRange = (start, end) => {
  if (!start || !end) return [];
  const dates = [];
  const cur = parseLocalDate(start);
  const last = parseLocalDate(end);
  if (!cur || !last) return [];
  while (cur <= last) {
    dates.push(toLocalDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};
export const formatDate = (d) => {
  const dt = parseLocalDate(d);
  return dt
    ? dt.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
};
export const formatDateShort = (d) => {
  const dt = parseLocalDate(d);
  return dt
    ? dt.toLocaleDateString("en-PH", { month: "short", day: "numeric" })
    : "—";
};
export const formatFullDate = (d) => {
  const dt = parseLocalDate(d);
  return dt
    ? dt.toLocaleDateString("en-PH", {
        weekday: "short",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";
};
export const formatTime = (t) => (t ? t.substring(0, 5) : "—");

export const getPatrolStatus = (patrol) => {
  const t = todayDate();
  const start = parseLocalDate(patrol.start_date);
  const end = parseLocalDate(patrol.end_date);
  if (!start || !end) return "unknown";
  if (t < start) return "upcoming";
  if (t > end) return "completed";
  return "active";
};
export const STATUS_ORDER = {
  active: 0,
  upcoming: 1,
  completed: 2,
  unknown: 3,
};
export const STATUS_META = {
  active: {
    label: "Active",
    bg: "#dcfce7",
    fg: "#166534",
    accent: "#22c55e",
    icon: "radio-button-on",
  },
  upcoming: {
    label: "Upcoming",
    bg: "#fef9c3",
    fg: "#854d0e",
    accent: "#f59e0b",
    icon: "time-outline",
  },
  completed: {
    label: "Completed",
    bg: "#f1f5f9",
    fg: "#475569",
    accent: "#cbd5e1",
    icon: "checkmark-circle-outline",
  },
  unknown: {
    label: "Unknown",
    bg: "#f1f5f9",
    fg: "#475569",
    accent: "#cbd5e1",
    icon: "help-circle-outline",
  },
};

// ── components ──────────────────────────────────────────────────────────────
export function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.unknown;
  return (
    <View style={[u.status, { backgroundColor: m.bg }]}>
      <Ionicons name={m.icon} size={11} color={m.fg} />
      <Text style={[u.statusTxt, { color: m.fg }]}> {m.label}</Text>
    </View>
  );
}

export function ShiftPill({ shift }) {
  if (!shift) return null;
  const isAM = shift === "AM";
  const both = shift === "AM & PM";
  const bg = isAM ? "#fef3c7" : both ? "#ede9fe" : "#e0e7f0";
  const fg = isAM ? "#92400e" : both ? "#5b21b6" : "#1e3a5f";
  const icon = isAM ? "sunny" : both ? "time" : "moon";
  return (
    <View style={[u.shift, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={10} color={fg} />
      <Text style={[u.shiftTxt, { color: fg }]}> {shift}</Text>
    </View>
  );
}

export function HeaderButton({ icon, onPress, active, badge }) {
  return (
    <TouchableOpacity
      style={[u.hBtn, active && { backgroundColor: "rgba(255,255,255,0.25)" }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={19} color="#fff" />
      {!!badge && (
        <View style={u.hBadge}>
          <Text style={u.hBadgeTxt}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  badge,
  children,
}) {
  return (
    <View style={u.header}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />
      <View style={u.headerRow}>
        {!!onBack && <HeaderButton icon="arrow-back" onPress={onBack} />}
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={u.titleRow}>
            <Text style={u.hTitle} numberOfLines={1}>
              {title}
            </Text>
            {badge}
          </View>
          {!!subtitle && (
            <Text style={u.hSub} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

// Pill-style tabs. variant="dark" sits inside the dark header; "light" sits on the page.
export function Segmented({ items, value, onChange, variant = "dark" }) {
  const dark = variant === "dark";
  return (
    <View style={[u.seg, dark ? u.segDark : u.segLight]}>
      {items.map((it) => {
        const on = value === it.key;
        const fg = on
          ? dark
            ? C.dark
            : C.navy
          : dark
            ? "rgba(255,255,255,0.7)"
            : C.muted;
        return (
          <TouchableOpacity
            key={it.key}
            style={[u.segBtn, on && u.segBtnOn]}
            onPress={() => onChange(it.key)}
            activeOpacity={0.85}
          >
            {!!it.icon && (
              <Ionicons
                name={it.icon}
                size={14}
                color={fg}
                style={{ marginRight: 5 }}
              />
            )}
            <Text style={[u.segTxt, { color: fg }]}>{it.label}</Text>
            {it.count != null && it.count > 0 && (
              <View
                style={[
                  u.segCount,
                  on
                    ? { backgroundColor: C.red }
                    : {
                        backgroundColor: dark
                          ? "rgba(255,255,255,0.2)"
                          : "#cbd5e1",
                      },
                ]}
              >
                <Text
                  style={[
                    u.segCountTxt,
                    { color: on ? "#fff" : dark ? "#fff" : "#475569" },
                  ]}
                >
                  {it.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Chip({ label, count, active, onPress }) {
  return (
    <TouchableOpacity
      style={[u.chip, active && u.chipOn]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[u.chipTxt, active && { color: "#fff" }]}>{label}</Text>
      {count != null && (
        <View
          style={[
            u.chipCount,
            active && { backgroundColor: "rgba(255,255,255,0.25)" },
          ]}
        >
          <Text style={[u.chipCountTxt, active && { color: "#fff" }]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function SectionLabel({ title, count, right }) {
  return (
    <View style={u.secRow}>
      <View style={u.secAccent} />
      <Text style={u.secTxt}>{title}</Text>
      {count != null && (
        <View style={u.secCount}>
          <Text style={u.secCountTxt}>{count}</Text>
        </View>
      )}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

export function EmptyState({ icon = "shield-outline", title, text, action }) {
  return (
    <View style={u.empty}>
      <View style={u.emptyIcon}>
        <Ionicons name={icon} size={32} color={C.faint} />
      </View>
      <Text style={u.emptyTitle}>{title}</Text>
      {!!text && <Text style={u.emptyText}>{text}</Text>}
      {action}
    </View>
  );
}

export function Toast({ message, type = "success", onHide, bottom = 30 }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onHide?.());
  }, []);
  const colors = {
    success: "#16a34a",
    error: "#dc2626",
    warning: "#d97706",
    info: C.navy,
  };
  const icons = {
    success: "checkmark-circle",
    error: "alert-circle",
    warning: "warning",
    info: "information-circle",
  };
  return (
    <Animated.View
      style={[
        u.toast,
        { backgroundColor: colors[type] || colors.success, opacity, bottom },
      ]}
    >
      <Ionicons name={icons[type] || icons.success} size={17} color="#fff" />
      <Text style={u.toastTxt}>{message}</Text>
    </Animated.View>
  );
}

const u = StyleSheet.create({
  header: {
    backgroundColor: C.dark,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  hTitle: { color: "#fff", fontSize: 19, fontWeight: "800", flexShrink: 1 },
  hSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 },
  hBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  hBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: C.dark,
  },
  hBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },

  status: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTxt: { fontSize: 10, fontWeight: "800" },
  shift: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  shiftTxt: { fontSize: 10, fontWeight: "800" },

  seg: { flexDirection: "row", borderRadius: 12, padding: 4, marginTop: 14 },
  segDark: { backgroundColor: "rgba(255,255,255,0.08)" },
  segLight: { backgroundColor: "#e5eaf0", marginTop: 0 },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 9,
  },
  segBtnOn: { backgroundColor: "#fff" },
  segTxt: { fontSize: 12.5, fontWeight: "800" },
  segCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    marginLeft: 6,
  },
  segCountTxt: { fontSize: 10, fontWeight: "800" },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: C.border,
  },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 6,
  },
  chipCountTxt: { fontSize: 11, fontWeight: "800", color: "#475569" },

  secRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  secAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: C.red },
  secTxt: {
    fontSize: 12,
    fontWeight: "800",
    color: C.navy,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  secCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  secCountTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },

  empty: { alignItems: "center", paddingVertical: 50, paddingHorizontal: 30 },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#374151",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 12,
    color: C.faint,
    textAlign: "center",
    marginTop: 5,
    lineHeight: 18,
  },

  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  toastTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: "#fff" },
});
