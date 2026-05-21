import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, StatusBar,
  Animated, Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "./services/api";
import { useFocusEffect } from '@react-navigation/native';
const NAVY   = "#0a1628";
const NAVY_M = "#1e3a5f";
const WHITE  = "#ffffff";
const G50    = "#f8f9fa";
const G100   = "#e9ecef";
const G200   = "#dee2e6";
const G400   = "#adb5bd";
const G600   = "#6c757d";
const G700   = "#495057";
const G900   = "#212529";

const TYPE_CONFIG = {
  NEW_REFERRAL:      { icon: "alert-circle",     color: "#ef4444", label: "Referral" },
  REFERRAL_ACCEPTED: { icon: "checkmark-circle", color: "#22c55e", label: "Accepted" },
  REFERRAL_DELETED:  { icon: "trash",            color: "#6b7280", label: "Deleted"  },
  PATROL_ASSIGNED:   { icon: "shield-checkmark", color: "#3b82f6", label: "Patrol"  },
  CASE_ASSIGNED:     { icon: "document-text",    color: "#f59e0b", label: "Case"    },
  USER_REGISTERED:   { icon: "person-add",       color: "#8b5cf6", label: "User"    },
  ACCOUNT_LOCKED:    { icon: "lock-closed",      color: "#dc2626", label: "Security"},
};
const DEFAULT_CONFIG = { icon: "notifications", color: NAVY_M, label: "Info" };

// ─── GROUPING LOGIC ───────────────────────────────────────────────────────────
const getGroup = (dateStr) => {
  const now  = new Date();
  const date = new Date(dateStr);
  const diffMs   = now - date;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (date.toDateString() === now.toDateString()) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  if (diffDays < 7)  return "This Week";
  if (diffDays < 30) return "This Month";
  if (diffDays < 365) return "This Year";
  return "Older";
};

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "This Year", "Older"];

const GROUP_META = {
  Today:       { icon: "sunny-outline",          color: "#f59e0b", bg: "#fffbeb" },
  Yesterday:   { icon: "partly-sunny-outline",   color: "#f97316", bg: "#fff7ed" },
  "This Week": { icon: "calendar-outline",       color: "#3b82f6", bg: "#eff6ff" },
  "This Month":{ icon: "calendar-clear-outline", color: "#8b5cf6", bg: "#f5f3ff" },
  "This Year": { icon: "time-outline",           color: "#22c55e", bg: "#f0fdf4" },
  Older:       { icon: "archive-outline",        color: "#6b7280", bg: "#f9fafb" },
};

const groupNotifications = (notifs) => {
  const map = {};
  notifs.forEach((n) => {
    const g = getGroup(n.created_at);
    if (!map[g]) map[g] = [];
    map[g].push(n);
  });
  return GROUP_ORDER
    .filter((g) => map[g])
    .map((g) => ({ title: g, data: map[g] }));
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  const wk = Math.floor(d / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(dateStr).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
};

// ─── ANIMATED NOTIFICATION ITEM ───────────────────────────────────────────────
function NotifItem({ item, index, onPress }) {
  const config = TYPE_CONFIG[item.type] || DEFAULT_CONFIG;
  const anim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 380,
      delay: Math.min(index * 45, 400),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <Animated.View style={{ opacity: anim, transform: [{ translateY }] }}>
      <TouchableOpacity
        style={[s.item, !item.is_read && s.itemUnread]}
        onPress={() => onPress(item)}
        activeOpacity={0.72}
      >
        {!item.is_read && <View style={s.unreadBar} />}

        <View style={[s.avatar, { backgroundColor: config.color + "18", borderColor: config.color + "44" }]}>
          {item.sender_avatar
            ? <Image source={{ uri: item.sender_avatar }} style={s.avatarImg} />
            : <Ionicons name={config.icon} size={20} color={config.color} />
          }
        </View>

        <View style={s.content}>
          <View style={s.titleRow}>
            <Text style={[s.title, !item.is_read && s.titleUnread]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[s.typePill, { backgroundColor: config.color + "18" }]}>
              <Text style={[s.typePillTxt, { color: config.color }]}>{config.label}</Text>
            </View>
          </View>

          <Text style={s.message} numberOfLines={2}>{item.message}</Text>

          <View style={s.metaRow}>
            {item.sender_name && (
              <>
                <Ionicons name="person-outline" size={10} color={G400} />
                <Text style={s.sender}>{item.sender_name}</Text>
                <View style={s.metaDot} />
              </>
            )}
            <Ionicons name="time-outline" size={10} color={G400} />
            <Text style={s.time}>{timeAgo(item.created_at)}</Text>
          </View>
        </View>

        {!item.is_read
          ? <View style={s.unreadDot} />
          : <Ionicons name="checkmark-done" size={14} color={G200} style={{ flexShrink: 0 }} />
        }
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ title, count }) {
  const meta = GROUP_META[title] || GROUP_META["Older"];
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 300,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[s.sectionHdr, { opacity: anim }]}>
  <Text style={s.sectionTitle}>{title}</Text>
  <View style={s.sectionLine} />
  <Text style={s.sectionCountTxt}>{count}</Text>
</Animated.View>
  );
}

// ─── STATS STRIP ─────────────────────────────────────────────────────────────
function StatsStrip({ total, unread }) {
  return (
    <View style={s.statsStrip}>
      <View style={s.statBox}>
        <Text style={s.statNum}>{total}</Text>
        <Text style={s.statLbl}>Total</Text>
      </View>
      <View style={s.statDiv} />
      <View style={s.statBox}>
        <Text style={[s.statNum, { color: "#60a5fa" }]}>{unread}</Text>
        <Text style={s.statLbl}>Unread</Text>
      </View>
      <View style={s.statDiv} />
      <View style={s.statBox}>
        <Text style={[s.statNum, { color: "#4ade80" }]}>{total - unread}</Text>
        <Text style={s.statLbl}>Read</Text>
      </View>
    </View>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────
function EmptyState() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, speed: 10, bounciness: 8, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[s.center, { opacity: anim, transform: [{ scale: anim }] }]}>
      <View style={s.emptyCircle}>
        <Ionicons name="notifications-off-outline" size={38} color={NAVY_M} />
      </View>
      <Text style={s.emptyTitle}>All caught up!</Text>
      <Text style={s.emptyTxt}>No notifications yet. Check back later.</Text>
    </Animated.View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const [notifs, setNotifs]      = useState([]);
  const [unread, setUnread]      = useState(0);
  const [loading, setLoading]    = useState(true);
  const [refreshing, setRefresh] = useState(false);

  const headerAnim = useRef(new Animated.Value(-90)).current;
  useEffect(() => {
    Animated.spring(headerAnim, { toValue: 0, speed: 14, bounciness: 5, useNativeDriver: true }).start();
  }, []);

  const fetchNotifs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefresh(true); else setLoading(true);
    try {
      const data = await getNotifications();
      if (data.success) { setNotifs(data.data || []); setUnread(data.unread || 0); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefresh(false); }
  }, []);

  useEffect(() => { fetchNotifs(); }, []);
useFocusEffect(
  useCallback(() => {
    fetchNotifs();
  }, [])
);
const handleMarkOne = (notif) => {
    if (notif.is_read) return;
    setNotifs((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    markNotificationRead(notif.id).catch(console.error);
  };

  const handleMarkAll = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
    markAllNotificationsRead().catch(console.error);
  };

  const sections = groupNotifications(notifs);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <Animated.View style={[s.header, { transform: [{ translateY: headerAnim }] }]}>
        <View style={s.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={20} color={WHITE} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Notifications</Text>
            <Text style={s.headerSub}>PNP Bacoor · Activity Feed</Text>
          </View>
          {unread > 0 && (
            <TouchableOpacity onPress={handleMarkAll} style={s.markAllBtn}>
              <Ionicons name="checkmark-done-outline" size={14} color={WHITE} />
              <Text style={s.markAllTxt}>Mark all</Text>
            </TouchableOpacity>
          )}
        </View>
        {!loading && <StatsStrip total={notifs.length} unread={unread} />}
      </Animated.View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={NAVY_M} />
          <Text style={{ marginTop: 10, fontSize: 13, color: G600 }}>Loading notifications…</Text>
        </View>
      ) : notifs.length === 0 ? (
        <EmptyState />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <NotifItem item={item} index={index} onPress={handleMarkOne} />
          )}
          renderSectionHeader={({ section }) => (
            <SectionHeader title={section.title} count={section.data.length} />
          )}
          renderSectionFooter={() => <View style={{ height: 6 }} />}
          ItemSeparatorComponent={() => <View style={s.sep} />}
          stickySectionHeadersEnabled={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifs(true)}
              colors={[NAVY_M]}
              tintColor={NAVY_M}
            />
          }
          contentContainerStyle={{ paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: G50 },

  header: {
    backgroundColor: NAVY,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: WHITE },
  headerSub:   { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 1 },
  markAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  markAllTxt: { fontSize: 12, fontWeight: "600", color: WHITE },

  statsStrip: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)",
  },
  statBox:  { flex: 1, alignItems: "center" },
  statNum:  { fontSize: 18, fontWeight: "700", color: WHITE },
  statLbl:  { fontSize: 10, color: "rgba(255,255,255,0.45)", fontWeight: "600", marginTop: 1 },
  statDiv:  { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.1)" },

  // Section header — sticky
  sectionHdr: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 9,
    backgroundColor: G50,
    borderBottomWidth: 1, borderBottomColor: G100,
  },
  sectionIconWrap: {
    width: 24, height: 24, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7, color: G900 },
  sectionLine:     { flex: 1, height: 1, backgroundColor: G200 },
  sectionCount:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  sectionCountTxt: { fontSize: 11, fontWeight: "700", color: G700 },

  // Items
  item: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    backgroundColor: WHITE, position: "relative",
  },
  itemUnread: { backgroundColor: "#f0f5ff" },
  unreadBar: {
    position: "absolute", left: 0, top: 0, bottom: 0,
    width: 3, backgroundColor: "#3b82f6",
    borderTopRightRadius: 3, borderBottomRightRadius: 3,
  },

  avatar: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },

  content:     { flex: 1, minWidth: 0 },
  titleRow:    { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" },
  title:       { fontSize: 13, fontWeight: "500", color: G900, flex: 1 },
  titleUnread: { fontWeight: "700", color: NAVY },

  typePill:    { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  typePillTxt: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },

  message: { fontSize: 12, color: G600, lineHeight: 18, marginBottom: 6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  sender:  { fontSize: 11, fontWeight: "600", color: G700 },
  time:    { fontSize: 11, color: G400 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: G400, marginHorizontal: 2 },

  unreadDot: {
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: "#3b82f6", flexShrink: 0, marginTop: 5,
  },

  sep: { height: 1, backgroundColor: G100, marginLeft: 72 },

  center: {
    flex: 1, backgroundColor: G50,
    alignItems: "center", justifyContent: "center", gap: 10, padding: 32,
  },
  emptyCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: WHITE, borderWidth: 2, borderColor: G200,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: NAVY },
  emptyTxt:   { fontSize: 13, color: G600, textAlign: "center", lineHeight: 20 },
});