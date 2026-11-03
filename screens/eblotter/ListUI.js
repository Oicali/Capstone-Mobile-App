// screens/eblotter/ListUI.js
import React, { memo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  C,
  STATUS_CFG,
  INCIDENT_COLORS,
  INCIDENTS,
  STATUSES,
  BACOOR_BARANGAYS,
  LEGACY_BARANGAYS,
  titleCase,
} from "./constants";
import { PickerModal, DatePickerBtn, sx } from "./FormShared";

/* ------------------------------- StatusPill ------------------------------- */
const sp = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    maxWidth: 170,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  txt: { fontSize: 11, fontWeight: "700" },
});
export const StatusPill = memo(function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.Pending;
  return (
    <View style={[sp.wrap, { backgroundColor: cfg.bg }]}>
      <View style={[sp.dot, { backgroundColor: cfg.dot }]} />
      <Text style={[sp.txt, { color: cfg.fg }]} numberOfLines={1}>
        {status}
      </Text>
    </View>
  );
});

/* ------------------------------- BlotterCard ------------------------------- */
const HIT = { top: 6, bottom: 6, left: 6, right: 6 };
const TONES = {
  navy: { bg: C.navy50, fg: C.navyMid },
  green: { bg: C.greenBg, fg: C.green },
  blue: { bg: "#DBEAFE", fg: "#2563EB" },
  amber: { bg: C.amberBg, fg: C.amber },
  red: { bg: C.redBg, fg: C.red },
  ghost: { bg: C.white, fg: C.sub, border: C.border },
};
const bc = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: C.white,
    borderRadius: 18,
    marginBottom: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  stripe: { width: 5 },
  body: { flex: 1, padding: 14 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 12,
  },
  idTag: {
    flexShrink: 1,
    backgroundColor: C.slate100,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  idTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: C.slate,
    letterSpacing: 0.3,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  crimeChip: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 17, fontWeight: "800", color: C.text },
  meta: { gap: 6, marginBottom: 14 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaTxt: { fontSize: 12.5, color: C.sub, flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  btnIcon: { width: 42, paddingVertical: 10 },
  btnTxt: { fontSize: 12.5, fontWeight: "700" },
  note: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    color: C.muted,
    fontStyle: "italic",
  },
});

function ActionBtn({ icon, label, onPress, tone = "navy", iconOnly, a11y }) {
  const t = TONES[tone];
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={HIT}
      activeOpacity={0.75}
      accessibilityLabel={a11y || label}
      style={[
        bc.btn,
        iconOnly ? bc.btnIcon : { flex: 1 },
        { backgroundColor: t.bg },
        t.border && { borderWidth: 1.5, borderColor: t.border },
      ]}
    >
      <Ionicons name={icon} size={15} color={t.fg} />
      {!iconOnly && <Text style={[bc.btnTxt, { color: t.fg }]}>{label}</Text>}
    </TouchableOpacity>
  );
}
const Note = ({ children }) => <Text style={bc.note}>{children}</Text>;

export const BlotterCard = memo(function BlotterCard({
  item,
  onView,
  onEdit,
  onDelete,
  onAccept,
  onRespond,
  onViewReferral,
  onRemind,
  fmt,
  isReferred,
  userRole,
  currentUserId,
}) {
  const status = item.status || "Pending";
  const accent = (STATUS_CFG[status] || STATUS_CFG.Pending).dot;
  const crimeColor = INCIDENT_COLORS[item.incident_type] || C.navyMid;
  const isAdmin =
    userRole === "Administrator" || userRole === "Technical Administrator";
  const mine = item.responder?.sender_user_id === currentUserId;

  return (
    <View style={bc.card}>
      <View style={[bc.stripe, { backgroundColor: accent }]} />
      <View style={bc.body}>
        <View style={bc.topRow}>
          <View style={bc.idTag}>
            <Text style={bc.idTxt} numberOfLines={1}>
              {item.blotter_entry_number}
            </Text>
          </View>
          <StatusPill status={status} />
        </View>

        <View style={bc.titleRow}>
          <View style={[bc.crimeChip, { backgroundColor: crimeColor + "1A" }]}>
            <Ionicons name="alert-circle" size={18} color={crimeColor} />
          </View>
          <Text style={bc.title} numberOfLines={1}>
            {item.incident_type}
          </Text>
        </View>

        <View style={bc.meta}>
          <View style={bc.metaRow}>
            <Ionicons name="location-outline" size={13} color={C.muted} />
            <Text style={bc.metaTxt} numberOfLines={1}>
              Brgy. {item.place_barangay}, {item.place_city_municipality}
            </Text>
          </View>
          <View style={bc.metaRow}>
            <Ionicons name="time-outline" size={13} color={C.muted} />
            <Text style={bc.metaTxt}>{fmt(item.date_time_reported)}</Text>
          </View>
        </View>

        <View style={bc.actions}>
          {isReferred ? (
            <>
              <ActionBtn
                icon="eye-outline"
                label="View"
                onPress={onViewReferral}
              />
              {userRole === "Patrol" && !item.responder && (
                <ActionBtn
                  icon="arrow-up-circle-outline"
                  label="Respond"
                  tone="blue"
                  onPress={onRespond}
                />
              )}
              {userRole === "Patrol" && item.responder && mine && (
                <>
                  <ActionBtn
                    icon="checkmark-circle-outline"
                    label="Accept"
                    tone="green"
                    onPress={onAccept}
                  />
                  <ActionBtn
                    icon="trash-outline"
                    tone="red"
                    iconOnly
                    a11y="Delete"
                    onPress={onDelete}
                  />
                </>
              )}
              {userRole === "Patrol" && item.responder && !mine && (
                <Note>Responded</Note>
              )}
              {userRole !== "Patrol" && !isAdmin && (
                <ActionBtn
                  icon="checkmark-circle-outline"
                  label="Accept"
                  tone="green"
                  onPress={onAccept}
                />
              )}
              {isAdmin &&
                (item.responder ? (
                  <Note>Responded</Note>
                ) : (
                  <ActionBtn
                    icon="time-outline"
                    label="Remind"
                    tone="amber"
                    onPress={onRemind}
                  />
                ))}
            </>
          ) : (
            <>
              <ActionBtn icon="eye-outline" label="View" onPress={onView} />
              <ActionBtn
                icon="create-outline"
                label="Edit"
                tone="ghost"
                onPress={onEdit}
              />
              {userRole !== "Patrol" && (
                <ActionBtn
                  icon="trash-outline"
                  tone="red"
                  iconOnly
                  a11y="Delete"
                  onPress={onDelete}
                />
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
});

/* ------------------------- ListHeader + SearchBar ------------------------- */
const TABS = [
  { key: "reports", label: "Reports", icon: "document-text-outline" },
  { key: "referred", label: "Referred", icon: "swap-horizontal-outline" },
];
const lh = StyleSheet.create({
  wrap: {
    backgroundColor: C.navy,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  top: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.45)",
    marginBottom: 2,
  },
  title: { fontSize: 22, fontWeight: "800", color: C.white },
  trashBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  trashTxt: { fontSize: 12, fontWeight: "700", color: C.white },
  seg: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.09)",
    borderRadius: 14,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  segBtnOn: { backgroundColor: C.white },
  segTxt: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.65)" },
  segTxtOn: { color: C.navyMid },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeTxt: { fontSize: 10, fontWeight: "800", color: C.white },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.white,
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 8 },
  filterBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnOn: { backgroundColor: C.navyMid },
  filterDot: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterDotTxt: { fontSize: 9, fontWeight: "800", color: C.white },
});

export const ListHeader = memo(function ListHeader({
  activeTab,
  onTab,
  referredCount,
  onOpenTrash,
}) {
  return (
    <View style={lh.wrap}>
      <View style={lh.top}>
        <View style={{ flex: 1 }}>
          <Text style={lh.eyebrow}>BANTAY</Text>
          <Text style={lh.title}>Reporting Records</Text>
        </View>
        <TouchableOpacity
          style={lh.trashBtn}
          onPress={onOpenTrash}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Deleted records"
        >
          <Ionicons name="archive-outline" size={16} color={C.white} />
          <Text style={lh.trashTxt}>Deleted</Text>
        </TouchableOpacity>
      </View>
      <View style={lh.seg}>
        {TABS.map((t) => {
          const on = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[lh.segBtn, on && lh.segBtnOn]}
              onPress={() => !on && onTab(t.key)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={t.icon}
                size={15}
                color={on ? C.navyMid : "rgba(255,255,255,0.65)"}
              />
              <Text style={[lh.segTxt, on && lh.segTxtOn]}>{t.label}</Text>
              {t.key === "referred" && referredCount > 0 && (
                <View style={lh.badge}>
                  <Text style={lh.badgeTxt}>{referredCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

export const SearchBar = memo(function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  activeFC,
  showF,
  onToggle,
}) {
  const hot = showF || activeFC > 0;
  return (
    <View style={lh.searchRow}>
      <Ionicons name="search-outline" size={17} color={C.muted} />
      <TextInput
        style={lh.searchInput}
        placeholder="Search by report ID"
        placeholderTextColor={C.muted}
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
        autoCorrect={false}
        onSubmitEditing={onSubmit}
      />
      {!!value && (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={17} color={C.muted} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[lh.filterBtn, hot && lh.filterBtnOn]}
        onPress={onToggle}
        accessibilityLabel="Filters"
      >
        <Ionicons
          name="options-outline"
          size={17}
          color={hot ? C.white : C.sub}
        />
        {activeFC > 0 && (
          <View style={lh.filterDot}>
            <Text style={lh.filterDotTxt}>{activeFC}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
});

/* -------------------------------- EmptyState -------------------------------- */
const es = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 64, paddingHorizontal: 30 },
  circle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { fontSize: 16, fontWeight: "800", color: C.sub, marginBottom: 6 },
  sub: { fontSize: 13, color: C.muted, textAlign: "center" },
});
export function EmptyState({ filtered, referred }) {
  return (
    <View style={es.wrap}>
      <View style={es.circle}>
        <Ionicons name="folder-open-outline" size={34} color={C.muted} />
      </View>
      <Text style={es.title}>No records found</Text>
      <Text style={es.sub}>
        {filtered
          ? "Try adjusting or clearing your filters"
          : referred
            ? "No referred records for this station"
            : "Tap New Report to add a crime record"}
      </Text>
    </View>
  );
}

/* -------------------------------- Pagination -------------------------------- */
const pg = StyleSheet.create({
  wrap: {
    padding: 16,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  info: { fontSize: 12, color: C.muted, fontWeight: "500" },
  row: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.white,
  },
  act: { backgroundColor: C.navyMid, borderColor: C.navyMid },
  dis: { opacity: 0.3 },
  btnTxt: { fontSize: 12, fontWeight: "600", color: C.sub },
  btnTxtAct: { color: C.white },
});
export function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const arr = [];
  if (pages <= 5) {
    for (let i = 1; i <= pages; i++) arr.push(i);
  } else {
    arr.push(1);
    if (page > 3) arr.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++)
      arr.push(i);
    if (page < pages - 2) arr.push("…");
    arr.push(pages);
  }
  return (
    <View style={pg.wrap}>
      <Text style={pg.info}>
        {from}–{to} of {total} records
      </Text>
      <View style={pg.row}>
        <TouchableOpacity
          style={[pg.btn, page === 1 && pg.dis]}
          onPress={() => page > 1 && onChange(page - 1)}
          disabled={page === 1}
        >
          <Ionicons
            name="chevron-back"
            size={14}
            color={page === 1 ? C.faint : C.navyMid}
          />
        </TouchableOpacity>
        {arr.map((n, i) => (
          <TouchableOpacity
            key={i}
            style={[
              pg.btn,
              n === page && pg.act,
              n === "…" && { borderWidth: 0, backgroundColor: "transparent" },
            ]}
            onPress={() => typeof n === "number" && onChange(n)}
            disabled={n === "…"}
          >
            <Text style={[pg.btnTxt, n === page && pg.btnTxtAct]}>{n}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[pg.btn, page === pages && pg.dis]}
          onPress={() => page < pages && onChange(page + 1)}
          disabled={page === pages}
        >
          <Ionicons
            name="chevron-forward"
            size={14}
            color={page === pages ? C.faint : C.navyMid}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ------------------------- FilterBar + CountBar ------------------------- */
const STATUS_OPTIONS = [
  { label: "All Status", value: "" },
  ...STATUSES.map((s) => ({ label: s, value: s })),
];
const INCIDENT_OPTIONS = [
  { label: "All Types", value: "" },
  ...INCIDENTS.map((s) => ({ label: s, value: s })),
];
const BARANGAY_OPTIONS = [
  { label: "All Barangays", value: "" },
  ...BACOOR_BARANGAYS.map((b) => ({ label: titleCase(b), value: b })),
  {
    label: "── Pre-2023 Names (Auto-resolved) ──",
    value: "__divider__",
    disabled: true,
  },
  ...LEGACY_BARANGAYS.map((item) => ({
    ...item,
    label:
      titleCase(item.label.split("(")[0].trim()) +
      (item.label.includes("(") ? " (" + item.label.split("(")[1] : ""),
  })),
];
const DATA_SOURCE_OPTIONS = [
  { label: "All Sources", value: "" },
  { label: "Manual Entry", value: "manual" },
  { label: "BANTAY Import (BLT-)", value: "bantay_import" },
  { label: "Barangay Referral (BRGY-)", value: "brgy_referral" },
];

const fb = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  panel: {
    marginTop: 10,
    gap: 12,
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  lbl: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.bg,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  chipOn: { backgroundColor: C.navy50, borderColor: C.navyMid },
  chipTxt: { fontSize: 13, color: C.sub, flex: 1 },
  chipTxtOn: { color: C.navyMid, fontWeight: "700" },
  applyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.navyMid,
    borderRadius: 12,
    paddingVertical: 11,
  },
  applyTxt: { fontSize: 13, fontWeight: "700", color: C.white },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.redBg,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(185,28,28,0.2)",
  },
  countBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  countTxt: { fontSize: 12, color: C.muted, fontWeight: "700" },
  pill: {
    backgroundColor: C.navy50,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillTxt: { fontSize: 11, color: C.navyMid, fontWeight: "700" },
});

function FilterChip({ label, value, onPress }) {
  const on = !!value;
  return (
    <TouchableOpacity style={[fb.chip, on && fb.chipOn]} onPress={onPress}>
      <Text style={[fb.chipTxt, on && fb.chipTxtOn]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons
        name="chevron-down"
        size={11}
        color={on ? C.navyMid : C.muted}
      />
    </TouchableOpacity>
  );
}

export function FilterBar({ tempF, setTempF, activeFC, onApply, onReset }) {
  const [showF, setShowF] = useState(false);
  const [fPick, setFPick] = useState(null);
  return (
    <View style={fb.wrap}>
      <SearchBar
        value={tempF.search}
        onChange={(v) => setTempF((p) => ({ ...p, search: v }))}
        onSubmit={() => onApply({ ...tempF })}
        onClear={() => {
          const nf = { ...tempF, search: "" };
          setTempF(nf);
          onApply(nf);
        }}
        activeFC={activeFC}
        showF={showF}
        onToggle={() => setShowF(!showF)}
      />

      {showF && (
        <View style={fb.panel}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={fb.lbl}>STATUS</Text>
              <FilterChip
                label={tempF.status || "All Status"}
                value={tempF.status}
                onPress={() => setFPick("status")}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fb.lbl}>CRIME TYPE</Text>
              <FilterChip
                label={tempF.incident_type || "All Types"}
                value={tempF.incident_type}
                onPress={() => setFPick("type")}
              />
            </View>
          </View>
          <View>
            <Text style={fb.lbl}>BARANGAY</Text>
            <FilterChip
              label={
                tempF.barangay ? titleCase(tempF.barangay) : "All Barangays"
              }
              value={tempF.barangay}
              onPress={() => setFPick("brgy")}
            />
          </View>
          <View>
            <Text style={fb.lbl}>DATA SOURCE</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {DATA_SOURCE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    sx.chip,
                    tempF.data_source === opt.value && sx.chipOn,
                  ]}
                  onPress={() =>
                    setTempF((p) => ({ ...p, data_source: opt.value }))
                  }
                >
                  <Text
                    style={[
                      sx.chipTxt,
                      tempF.data_source === opt.value && sx.chipTxtOn,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={fb.lbl}>DATE FROM</Text>
              <DatePickerBtn
                label="Date From"
                value={tempF.date_from}
                onChange={(d) => setTempF((p) => ({ ...p, date_from: d }))}
                maximumDate={tempF.date_to || new Date()}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fb.lbl}>DATE TO</Text>
              <DatePickerBtn
                label="Date To"
                value={tempF.date_to}
                onChange={(d) => setTempF((p) => ({ ...p, date_to: d }))}
                maximumDate={new Date()}
              />
            </View>
          </View>
          {(tempF.date_from || tempF.date_to) && (
            <TouchableOpacity
              onPress={() =>
                setTempF((p) => ({ ...p, date_from: null, date_to: null }))
              }
              style={{ alignSelf: "flex-end" }}
            >
              <Text style={{ fontSize: 12, color: C.red, fontWeight: "600" }}>
                Clear dates
              </Text>
            </TouchableOpacity>
          )}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
            <TouchableOpacity
              style={fb.applyBtn}
              onPress={() => {
                onApply({ ...tempF });
                setShowF(false);
              }}
            >
              <Ionicons name="search-outline" size={14} color={C.white} />
              <Text style={fb.applyTxt}>Apply Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={fb.clearBtn}
              onPress={() => {
                onReset();
                setShowF(false);
              }}
            >
              <Ionicons name="refresh-outline" size={14} color={C.red} />
              <Text style={[fb.applyTxt, { color: C.red }]}>Clear All</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <PickerModal
        visible={fPick === "status"}
        title="Filter by Status"
        options={STATUS_OPTIONS}
        selected={tempF.status}
        onSelect={(v) => {
          setTempF((p) => ({ ...p, status: v }));
          setFPick(null);
        }}
        onClose={() => setFPick(null)}
      />
      <PickerModal
        visible={fPick === "type"}
        title="Filter by Crime Type"
        options={INCIDENT_OPTIONS}
        selected={tempF.incident_type}
        onSelect={(v) => {
          setTempF((p) => ({ ...p, incident_type: v }));
          setFPick(null);
        }}
        onClose={() => setFPick(null)}
      />
      <PickerModal
        visible={fPick === "brgy"}
        title="Filter by Barangay"
        options={BARANGAY_OPTIONS}
        selected={tempF.barangay}
        onSelect={(v) => {
          if (v !== "__divider__") {
            setTempF((p) => ({ ...p, barangay: v }));
            setFPick(null);
          }
        }}
        onClose={() => setFPick(null)}
      />
    </View>
  );
}

export function CountBar({ count, activeFC, loading }) {
  return (
    <View style={fb.countBar}>
      <Text style={fb.countTxt}>
        {count} record{count !== 1 ? "s" : ""}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {activeFC > 0 && (
          <View style={fb.pill}>
            <Text style={fb.pillTxt}>
              {activeFC} filter{activeFC > 1 ? "s" : ""} active
            </Text>
          </View>
        )}
        {loading && <ActivityIndicator size="small" color={C.navyMid} />}
      </View>
    </View>
  );
}
