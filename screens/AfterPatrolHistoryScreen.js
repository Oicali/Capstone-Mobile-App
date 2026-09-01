// screens/AfterPatrolHistoryScreen.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Modal, Pressable,
  StatusBar, RefreshControl, Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Dimensions } from "react-native";
const API_BASE = process.env.EXPO_PUBLIC_API_URL;

// ── Helpers (mirrors AfterPatrolScreen.jsx) ─────────────────────────────────
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

const formatDateTime = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
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

const token = async () => AsyncStorage.getItem("auth_token");

const getMyRole = async () => {
  const raw = await AsyncStorage.getItem("auth_user");
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    return u.role ?? u.user_role ?? null;
  } catch {
    return null;
  }
};

const isAdminRole = (role) => role === "Administrator" || role === "Technical Administrator";

const getOfficerNameById = (patrol, id) => {
  if (id == null) return null;
  const match = (patrol?.patrollers || []).find(
    (p) => String(p.officer_id) === String(id)
  );
  return match?.officer_name || null;
};

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

  const colors = { success: "#16a34a", error: "#dc2626", warning: "#d97706", info: "#1e3a5f" };
  const bg = colors[type] || colors.success;

  return (
    <Animated.View style={[styles.toast, { backgroundColor: bg, opacity }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
};

// ── Shift Badge ───────────────────────────────────────────────────────────────
const ShiftBadge = ({ shift }) => {
  if (!shift) return null;
  const isAM   = shift === "AM";
  const isBoth = shift === "AM & PM";
  return (
    <View style={[styles.shiftBadge, isAM ? styles.shiftAM : isBoth ? styles.shiftBoth : styles.shiftPM]}>
      <Text style={[styles.shiftBadgeText, isAM ? styles.shiftAMText : isBoth ? styles.shiftBothText : styles.shiftPMText]}>
        {shift}
      </Text>
    </View>
  );
};

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
const DeleteConfirmModal = ({ visible, reportDate, onConfirm, onCancel }) => {
  if (!visible) return null;
  const { width: SW, height: SH } = Dimensions.get("window");
  return (
    <View style={{
      position: "absolute",
      top: 0, left: 0,
      width: SW,
      height: SH,
      zIndex: 9999,
    }}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.confirmBox} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.confirmTitle}>Delete Report</Text>
          <Text style={styles.confirmText}>
            Are you sure you want to delete the report for{" "}
            <Text style={{ fontWeight: "700", color: "#212529" }}>{reportDate}</Text>?
            This action cannot be undone.
          </Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity style={styles.confirmCancelBtn} onPress={onCancel}>
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmDeleteBtn} onPress={onConfirm}>
              <Text style={styles.confirmDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </View>
  );
};

// ── Read-only field row ─────────────────────────────────────────────────────
const ViewField = ({ label, value }) => (
  <View style={styles.viewField}>
    <Text style={styles.viewFieldLabel}>{label}</Text>
    <Text style={[styles.viewFieldValue, !value && styles.viewFieldEmpty]}>
      {value || "Not reported"}
    </Text>
  </View>
);

const ViewSectionHeader = ({ children }) => (
  <View style={styles.viewSectionHeader}>
    <Text style={styles.viewSectionHeaderText}>{children}</Text>
  </View>
);

// ── Full Report View (read-only) ─────────────────────────────────────────────
const ViewReportModal = ({ visible, patrol, report, onClose, confirmDelete, onConfirmDelete, onCancelDelete }) => {
  const insets = useSafeAreaInsets();
  if (!report) return null;
  const photos = report.photo_urls || [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
     <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="#1e3a5f" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle} numberOfLines={1}>After Patrol Report</Text>
              {report.shift && <ShiftBadge shift={report.shift} />}
            </View>
            <Text style={styles.headerSub} numberOfLines={1}>
              {patrol?.patrol_name} · {formatDate(report.patrol_date)}
            </Text>
            <Text style={styles.headerAnnex}>ANNEX D · PNPM-DO-DS-3-3-15 (DO) · READ-ONLY</Text>
          </View>
        </View>

        <ScrollView style={styles.scrollBody} contentContainerStyle={styles.scrollContent}>
          <ViewSectionHeader>Patrol Date &amp; Time</ViewSectionHeader>
          <View style={styles.viewCard}>
            <ViewField label="Date" value={formatDate(report.patrol_date)} />
            <ViewField
              label="Time"
              value={report.time_from && report.time_to ? `${report.time_from} – ${report.time_to}` : null}
            />
            <ViewField label="Credit Hours" value={report.credit_hours} />
          </View>

          <ViewSectionHeader>Patrol Information</ViewSectionHeader>
          <View style={styles.viewCard}>
            <ViewField label="Mobile Unit Used" value={report.sector_beat} />
            <ViewField label="Patrolled MUST DOs" value={report.must_dos} />
          </View>

          <ViewSectionHeader>Pre-Deployment Instructions</ViewSectionHeader>
          <View style={styles.viewCard}>
            <ViewField label="Specific Instructions Received" value={report.pre_deployment} />
            <ViewField label="Action Taken" value={report.action_pre_deployment} />
          </View>

          <ViewSectionHeader>Incidents &amp; Unusual Events</ViewSectionHeader>
          <View style={styles.viewCard}>
            <ViewField label="Incidents / Unusual Situations" value={report.incidents} />
            <ViewField label="Action Taken" value={report.action_incidents} />
          </View>

          <ViewSectionHeader>Public Safety Concerns</ViewSectionHeader>
          <View style={styles.viewCard}>
            <ViewField label="Safety Concerns Observed" value={report.safety_concerns} />
            <ViewField label="Action Taken" value={report.action_safety} />
          </View>

          <ViewSectionHeader>Other Services &amp; Visited Areas</ViewSectionHeader>
          <View style={styles.viewCard}>
            <ViewField label="Other Public Safety Services Rendered" value={report.other_services} />
            <ViewField label="Visited Areas" value={report.visited_areas} />
          </View>

          <ViewSectionHeader>Persons Visited</ViewSectionHeader>
          <View style={styles.viewCard}>
            <ViewField label="Name of Persons Visited / Local Officials" value={report.persons_visited} />
            <ViewField
              label="No. of Officials Visited"
              value={report.num_officials != null ? String(report.num_officials) : null}
            />
            <ViewField
              label="Total Gov't Officials in Area"
              value={report.num_govt_officials != null ? String(report.num_govt_officials) : null}
            />
          </View>

          <ViewSectionHeader>Remarks &amp; Recommendations</ViewSectionHeader>
          <View style={styles.viewCard}>
            <ViewField label="Remarks / Recommendations" value={report.remarks} />
          </View>

          <ViewSectionHeader>Signatures</ViewSectionHeader>
          <View style={styles.viewCard}>
            <ViewField label="Officer 1" value={report.sig_officer_1} />
            <ViewField label="Officer 2" value={report.sig_officer_2} />
            <ViewField label="Supervisor" value={report.sig_supervisor} />
          </View>

          <ViewSectionHeader>Photo Documentation</ViewSectionHeader>
          <View style={styles.viewCard}>
            {photos.length === 0 ? (
              <Text style={styles.emptyNote}>No photos were attached to this report.</Text>
            ) : (
              <View style={styles.photoGrid}>
                {photos.map((url, i) => (
                  <View key={url} style={styles.photoThumb}>
                    <Image source={{ uri: url }} style={styles.photoImg} />
                    <View style={styles.photoBadge}>
                      <Text style={styles.photoBadgeText}>{i + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
         <DeleteConfirmModal
        visible={!!confirmDelete}
        reportDate={confirmDelete?.reportDate}
        onConfirm={() => {
          const id = confirmDelete.reportId;
          setConfirmDelete(null);
          handleDelete(id);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
      </View>
    </Modal>
  );
};

// ── Report Card ───────────────────────────────────────────────────────────────
const ReportCard = ({ report: r, patrol, isAdmin, deleting, onView, onEdit, onDelete }) => (
  <View style={styles.reportCard}>
    <View style={styles.reportCardHeader}>
      <View style={styles.reportCardHeaderLeft}>
        <Text style={styles.reportCardDate}>{formatDate(r.patrol_date)}</Text>
        {r.time_from && r.time_to && (
          <View style={styles.reportTimePill}>
            <Text style={styles.reportTimePillText}>{r.time_from} – {r.time_to}</Text>
          </View>
        )}
      </View>
      {r.shift && <ShiftBadge shift={r.shift} />}
    </View>

    {r.credit_hours ? (
      <View style={styles.reportCreditRow}>
        <Ionicons name="time-outline" size={12} color="#16a34a" />
        <Text style={styles.reportCreditText}>{r.credit_hours}</Text>
      </View>
    ) : null}

    <View style={styles.reportFlagsRow}>
      {r.must_dos && (
        <View style={styles.flagPill}><Text style={styles.flagPillText}>MUST DOs logged</Text></View>
      )}
      {r.incidents && (
        <View style={[styles.flagPill, styles.flagPillWarn]}>
          <Text style={[styles.flagPillText, styles.flagPillWarnText]}>Incident reported</Text>
        </View>
      )}
      {r.safety_concerns && (
        <View style={[styles.flagPill, styles.flagPillDanger]}>
          <Text style={[styles.flagPillText, styles.flagPillDangerText]}>Safety concern flagged</Text>
        </View>
      )}
      {(r.photo_urls || []).length > 0 && (
        <View style={styles.flagPill}>
          <Text style={styles.flagPillText}>
            {r.photo_urls.length} photo{r.photo_urls.length !== 1 ? "s" : ""}
          </Text>
        </View>
      )}
    </View>

    <View style={styles.reportMetaRow}>
      <Ionicons name="time-outline" size={11} color="#9ca3af" />
      <Text style={styles.reportMetaText} numberOfLines={1}>
        {formatDateTime(r.submitted_at)} by{" "}
        {r.submitted_by_name || r.officer_name || getOfficerNameById(patrol, r.submitted_by) || "Unknown officer"}
      </Text>
    </View>

    <View style={styles.reportCardActions}>
      <TouchableOpacity onPress={onView}>
        <Text style={styles.reportViewLinkText}>View full report →</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {isAdmin ? (
          <TouchableOpacity style={styles.reportActionBtn} onPress={onView}>
            <Ionicons name="eye-outline" size={13} color="#1e3a5f" />
            <Text style={styles.reportActionBtnText}>View</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.reportActionBtn} onPress={onEdit}>
            <Ionicons name="create-outline" size={13} color="#1e3a5f" />
            <Text style={styles.reportActionBtnText}>Edit</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.reportActionBtn, styles.reportDeleteBtn]}
          disabled={deleting}
          onPress={onDelete}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={13} color="#dc2626" />
              <Text style={[styles.reportActionBtnText, styles.reportDeleteBtnText]}>Delete</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function AfterPatrolHistoryScreen({ route, navigation }) {
  const { patrol, myShift } = route.params;
  const patrolDates = getPatrolDateRange(patrol?.start_date, patrol?.end_date);

  const [isAdmin,    setIsAdmin]    = useState(false);
  const [reports,    setReports]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeDate, setActiveDate] = useState(patrolDates[0] || null);
  const [deleting,   setDeleting]   = useState(null);
  const [confirmDelete,  setConfirmDelete]  = useState(null); // { reportId, reportDate }
  const [viewingReport,  setViewingReport]  = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, key: Date.now() });
  }, []);

  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const tok    = await token();
      const role   = await getMyRole();
      const adminOk = isAdminRole(role);
      setIsAdmin(adminOk);

      const endpoint = adminOk
        ? `${API_BASE}/patrol/patrols/${patrol.patrol_id}/after-reports`
        : `${API_BASE}/patrol/patrols/${patrol.patrol_id}/after-reports/mine`;

      const res  = await fetch(endpoint, { headers: { Authorization: `Bearer ${tok}` } });
      const data = await res.json();
      if (data.success) {
        setReports(data.data);
        setActiveDate((prev) => prev || (data.data[0] ? toInputDate(data.data[0].patrol_date) : patrolDates[0] || null));
      }
    } catch {
      showToast("Failed to load reports.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patrol.patrol_id]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const onRefresh = () => { setRefreshing(true); fetchReports(true); };

  const reportsByDate = {};
  reports.forEach((r) => {
    const key = toInputDate(r.patrol_date);
    if (!reportsByDate[key]) reportsByDate[key] = [];
    reportsByDate[key].push(r);
  });
  const activeReports = activeDate ? (reportsByDate[activeDate] || []) : [];

  const handleDelete = async (reportId) => {
    setDeleting(reportId);
    try {
      const tok = await token();
      const res = await fetch(`${API_BASE}/patrol/after-reports/${reportId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tok}` },
      });
      const data = await res.json();
      if (data.success) {
        showToast("Report deleted successfully.", "success");
        setReports((prev) => prev.filter((r) => r.report_id !== reportId));
      } else {
        showToast(data.message || "Failed to delete report.", "error");
      }
    } catch {
      showToast("Server error while deleting.", "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (report) => {
    navigation.navigate("AfterPatrolReport", { patrol, myShift, existingReport: report });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor="#1e3a5f" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isAdmin ? "All Shift Reports" : "My Submitted Reports"}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {patrol?.patrol_name} · {formatDate(patrol?.start_date)} – {formatDate(patrol?.end_date)}
          </Text>
        </View>
      </View>

      {/* Date tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dateTabsBar}
        contentContainerStyle={styles.dateTabsInner}
      >
        {patrolDates.map((d) => {
          const count    = (reportsByDate[d] || []).length;
          const isActive = activeDate === d;
          const pillDate = parseLocalDate(d);
          const isFuture = getPatrolStatus(patrol) === "active" && pillDate > todayDate();
          const isDone   = count > 0;
          const isMissed = !isAdmin && !isFuture && !isDone;

          return (
            <TouchableOpacity
              key={d}
              style={[styles.dateTab, isActive && styles.dateTabActive]}
              onPress={() => setActiveDate(d)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dateTabText, isActive && styles.dateTabTextActive]}>
                {formatDateShort(d)}
              </Text>
              {isAdmin ? (
                count > 0 && (
                  <View style={[styles.dateTabBadge, isActive && styles.dateTabBadgeActive]}>
                    <Text style={[styles.dateTabBadgeText, isActive && styles.dateTabBadgeTextActive]}>
                      {count}
                    </Text>
                  </View>
                )
              ) : loading ? null : isDone ? (
                <View style={styles.dateTabDoneDot}>
                  <Ionicons name="checkmark" size={9} color="#fff" />
                </View>
              ) : isMissed ? (
                <View style={styles.dateTabMissedDot}>
                  <Text style={styles.dateTabMissedMark}>!</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.dateBanner}>
        <Text style={styles.dateBannerText}>{activeDate ? formatDate(activeDate) : "Select a date"}</Text>
        <Text style={styles.dateBannerCount}>
          {activeReports.length} submission{activeReports.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#1e3a5f" />
          <Text style={styles.loadingText}>Loading reports...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a5f" colors={["#1e3a5f"]} />
          }
        >
          {activeReports.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>
                No report submitted for {activeDate ? formatDate(activeDate) : "this date"}
              </Text>
              <Text style={styles.emptyText}>
                Use the "After Report" button to submit a report for this date.
              </Text>
            </View>
          ) : (
            activeReports.map((r) => (
              <ReportCard
                key={r.report_id}
                report={r}
                patrol={patrol}
                isAdmin={isAdmin}
                deleting={deleting === r.report_id}
                onView={() => setViewingReport(r)}
                onEdit={() => handleEdit(r)}
                onDelete={() => setConfirmDelete({ reportId: r.report_id, reportDate: formatDate(r.patrol_date) })}
              />
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}


      <ViewReportModal
  visible={!!viewingReport}
  patrol={patrol}
  report={viewingReport}
  onClose={() => setViewingReport(null)}
  confirmDelete={confirmDelete}
  onConfirmDelete={() => {
    const id = confirmDelete.reportId;
    setConfirmDelete(null);
    handleDelete(id);
  }}
  onCancelDelete={() => setConfirmDelete(null)}
/>

      {toast && (
        <Toast key={toast.key} message={toast.message} type={toast.type} onHide={() => setToast(null)} />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa", position: "relative" },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#1e3a5f",
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
  headerAnnex:   { fontSize: 9,  color: "rgba(255,255,255,0.5)", marginTop: 1 },

  // Date tabs
  dateTabsBar: {
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#dee2e6",
    flexGrow: 0,
  },
  dateTabsInner: { flexDirection: "row", paddingHorizontal: 12 },
  dateTab: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  dateTabActive: { borderBottomColor: "#1e3a5f" },
  dateTabText: { fontSize: 12.5, fontWeight: "600", color: "#6c757d" },
  dateTabTextActive: { color: "#1e3a5f", fontWeight: "700" },
  dateTabBadge: {
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: "#d1d5db", alignItems: "center", justifyContent: "center",
  },
  dateTabBadgeActive: { backgroundColor: "#1e3a5f" },
  dateTabBadgeText: { fontSize: 9, fontWeight: "700", color: "#374151" },
  dateTabBadgeTextActive: { color: "#fff" },
  dateTabDoneDot: {
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center",
  },
  dateTabMissedDot: {
    width: 15, height: 15, borderRadius: 8,
    backgroundColor: "#dc2626", alignItems: "center", justifyContent: "center",
  },
  dateTabMissedMark: { fontSize: 10, fontWeight: "900", color: "#fff" },

  // Date banner
  dateBanner: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#1e3a5f", paddingHorizontal: 16, paddingVertical: 9,
  },
  dateBannerText: { fontSize: 12.5, fontWeight: "700", color: "#fff" },
  dateBannerCount: { fontSize: 11, color: "rgba(255,255,255,0.65)" },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: "#6c757d", fontWeight: "500" },

  scrollBody: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },

  emptyBox: {
    alignItems: "center", padding: 28, gap: 6, marginTop: 8,
    backgroundColor: "#fff", borderRadius: 10,
    borderWidth: 1, borderColor: "#e5e7eb", borderStyle: "dashed",
  },
  emptyTitle: { fontSize: 13.5, fontWeight: "700", color: "#495057", textAlign: "center" },
  emptyText:  { fontSize: 12, color: "#9ca3af", textAlign: "center" },
  emptyNote:  { fontSize: 13, color: "#9ca3af", fontStyle: "italic", textAlign: "center", paddingVertical: 8 },

  // Report card
  reportCard: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#dee2e6",
    padding: 14, gap: 8,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  reportCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  reportCardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" },
  reportCardDate: { fontSize: 14, fontWeight: "700", color: "#1e3a5f" },
  reportTimePill: { backgroundColor: "#f1f3f5", borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  reportTimePillText: { fontSize: 10.5, fontWeight: "600", color: "#495057" },

  reportCreditRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  reportCreditText: { fontSize: 11.5, fontWeight: "700", color: "#16a34a" },

  reportFlagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  flagPill: { backgroundColor: "rgba(30,58,95,0.06)", borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  flagPillText: { fontSize: 10.5, fontWeight: "600", color: "#1e3a5f" },
  flagPillWarn: { backgroundColor: "rgba(245,158,11,0.12)", borderWidth: 1, borderColor: "#fcd34d" },
  flagPillWarnText: { color: "#92400e", fontWeight: "700" },
  flagPillDanger: { backgroundColor: "rgba(220,38,38,0.08)", borderWidth: 1, borderColor: "#fca5a5" },
  flagPillDangerText: { color: "#b91c1c", fontWeight: "700" },

  reportMetaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  reportMetaText: { fontSize: 10.5, color: "#9ca3af", flex: 1 },

  reportCardActions: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f3f5",
  },
  reportViewLinkText: { fontSize: 11.5, fontWeight: "700", color: "#1e3a5f" },
  reportActionBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
    backgroundColor: "rgba(30,58,95,0.06)",
  },
  reportActionBtnText: { fontSize: 11, fontWeight: "700", color: "#1e3a5f" },
  reportDeleteBtn: { backgroundColor: "rgba(220,38,38,0.08)" },
  reportDeleteBtnText: { color: "#dc2626" },

  // Delete confirm modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  confirmBox: {
    width: "84%", backgroundColor: "#fff", borderRadius: 14,
    padding: 22, gap: 12,
  },
  confirmTitle: { fontSize: 16, fontWeight: "700", color: "#0a1628" },
  confirmText:  { fontSize: 13, color: "#6c757d", lineHeight: 19 },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  confirmCancelBtn: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: "#ced4da",
  },
  confirmCancelText: { fontSize: 13, fontWeight: "600", color: "#495057" },
  confirmDeleteBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, backgroundColor: "#dc2626" },
  confirmDeleteText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // View report modal
  viewSectionHeader: {
    backgroundColor: "#1e3a5f", paddingHorizontal: 16, paddingVertical: 9,
    marginTop: 4,
  },
  viewSectionHeaderText: {
    fontSize: 11, fontWeight: "700", color: "#fff",
    textTransform: "uppercase", letterSpacing: 0.6,
  },
  viewCard: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#dee2e6",
    borderRadius: 0, padding: 4,
  },
  viewField: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f3f5" },
  viewFieldLabel: {
    fontSize: 10, fontWeight: "700", color: "#9ca3af",
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3,
  },
  viewFieldValue: { fontSize: 13, color: "#212529", lineHeight: 18 },
  viewFieldEmpty: { color: "#9ca3af", fontStyle: "italic" },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 10 },
  photoThumb: {
    width: 88, height: 88, borderRadius: 8,
    borderWidth: 1, borderColor: "#dee2e6",
    overflow: "hidden", position: "relative",
  },
  photoImg: { width: "100%", height: "100%", resizeMode: "cover" },
  photoBadge: {
    position: "absolute", top: 4, left: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  photoBadgeText: { fontSize: 9, fontWeight: "700", color: "#1e3a5f" },

  // Shift badge
  shiftBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1, flexShrink: 0 },
  shiftAM:   { backgroundColor: "#fef3c7", borderColor: "#fcd34d" },
  shiftPM:   { backgroundColor: "#e0e7f0", borderColor: "#93afc9" },
  shiftBoth: { backgroundColor: "#fffbeb", borderColor: "#93afc9" },
  shiftBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  shiftAMText:   { color: "#92400e" },
  shiftPMText:   { color: "#1e3a5f" },
  shiftBothText: { color: "#1e3a5f" },

  // Toast
  toast: {
    position: "absolute", bottom: 30, left: 20, right: 20,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 8,
  },
  toastText: { fontSize: 13, fontWeight: "600", color: "#fff", textAlign: "center" },
});