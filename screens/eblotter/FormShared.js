// screens/eblotter/FormShared.js
import React, { memo, useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { C, PSGC, NCR_CODE, _formErrRef } from "./constants";

const { height: SH } = Dimensions.get("window");

/* ------------------------------- PSGC hook ------------------------------- */
export function usePSGC() {
  const [regions, setRegions] = useState([]);
  const [loadingR, setLoadingR] = useState(false);
  const cache = useRef({});

  useEffect(() => {
    setLoadingR(true);
    fetch(`${PSGC}/regions/`)
      .then((r) => r.json())
      .then((d) =>
        setRegions(
          Array.isArray(d)
            ? d.sort((a, b) => a.name.localeCompare(b.name))
            : [],
        ),
      )
      .catch(() => {})
      .finally(() => setLoadingR(false));
  }, []);

  const get = useCallback(async (url) => {
    if (cache.current[url]) return cache.current[url];
    try {
      const r = await fetch(url);
      const d = await r.json();
      const s = Array.isArray(d)
        ? d.sort((a, b) => a.name.localeCompare(b.name))
        : [];
      cache.current[url] = s;
      return s;
    } catch {
      return [];
    }
  }, []);

  return {
    regions,
    loadingR,
    getProvinces: (code) => get(`${PSGC}/regions/${code}/provinces/`),
    getCities: (code) =>
      code === NCR_CODE
        ? get(`${PSGC}/regions/${code}/cities-municipalities/`)
        : get(`${PSGC}/provinces/${code}/cities-municipalities/`),
    getBarangays: (code) =>
      get(`${PSGC}/cities-municipalities/${code}/barangays/`),
  };
}

/* ----------------------------- shared styles ----------------------------- */
export const sx = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 14, paddingTop: 14 },
  card: {
    backgroundColor: C.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  row2: { flexDirection: "row" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.navyMid,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: C.navy50,
  },
  addTxt: { fontSize: 14, fontWeight: "700", color: C.navyMid },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  chipOn: { backgroundColor: C.navyMid, borderColor: C.navyMid },
  chipTxt: { fontSize: 12, fontWeight: "600", color: C.sub },
  chipTxtOn: { color: C.white },
  fixedLoc: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.navy50,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  fixedLocTxt: { fontSize: 12, fontWeight: "600", color: C.navyMid, flex: 1 },
});

export const inp = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.white,
  },
  err: { borderColor: C.red, backgroundColor: "#FFF5F5" },
  dis: { backgroundColor: C.slate100, color: C.muted },
});

export const ff = StyleSheet.create({
  g: { marginBottom: 14 },
  l: {
    fontSize: 11,
    fontWeight: "700",
    color: C.slate,
    marginBottom: 6,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  r: { color: C.red },
  h: { fontSize: 11, color: C.muted, marginTop: 4 },
  er: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  et: { fontSize: 11, color: C.red },
});

/* ------------------------------ form inputs ------------------------------ */
export function FField({ label, required, error, hint, children }) {
  return (
    <View style={ff.g}>
      <Text style={ff.l}>
        {label}
        {required && <Text style={ff.r}> *</Text>}
      </Text>
      {children}
      {hint && !error && <Text style={ff.h}>{hint}</Text>}
      {error && (
        <View style={ff.er}>
          <Ionicons name="alert-circle" size={11} color={C.red} />
          <Text style={ff.et}> {error}</Text>
        </View>
      )}
    </View>
  );
}

export function TInput({
  value,
  onChange,
  placeholder,
  error,
  multiline,
  lines,
  kb,
  maxLen,
  editable = true,
  fieldKey,
}) {
  return (
    <TextInput
      style={[
        inp.base,
        error && inp.err,
        multiline && {
          height: Math.max(96, (lines || 4) * 26),
          textAlignVertical: "top",
          paddingTop: 12,
        },
        !editable && inp.dis,
      ]}
      value={String(value ?? "")}
      onChangeText={(v) => {
        onChange && onChange(v);
        if (fieldKey && _formErrRef.setter && _formErrRef.current[fieldKey]) {
          _formErrRef.setter((prev) => {
            const n = { ...prev };
            delete n[fieldKey];
            return n;
          });
        }
      }}
      placeholder={placeholder}
      placeholderTextColor={C.faint}
      multiline={multiline}
      keyboardType={kb || "default"}
      maxLength={maxLen}
      editable={editable}
      autoCorrect={false}
    />
  );
}

export function SelBtn({ label, value, onPress, error, disabled }) {
  return (
    <TouchableOpacity
      style={[
        inp.base,
        {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        error && inp.err,
        disabled && inp.dis,
      ]}
      onPress={disabled ? null : onPress}
      activeOpacity={disabled ? 1 : 0.75}
    >
      <Text
        style={{ fontSize: 14, color: value ? C.text : C.faint, flex: 1 }}
        numberOfLines={1}
      >
        {value || label}
      </Text>
      <Ionicons
        name="chevron-down"
        size={16}
        color={disabled ? C.faint : C.muted}
      />
    </TouchableOpacity>
  );
}

const tg = StyleSheet.create({
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 11,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.white,
  },
  on: { backgroundColor: C.navyMid, borderColor: C.navyMid },
  txt: { fontSize: 13, fontWeight: "600", color: C.sub },
  onTxt: { color: C.white },
});

export function Toggle({ opts, value, onChange }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <TouchableOpacity
            key={String(o.v)}
            style={[tg.btn, on && tg.on]}
            onPress={() => onChange(o.v)}
          >
            {o.ic && (
              <Ionicons name={o.ic} size={13} color={on ? C.white : C.sub} />
            )}
            <Text style={[tg.txt, on && tg.onTxt]}>{o.l}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const fcs = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    shadowColor: C.navy,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  hdr: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: C.navy50,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { fontSize: 12, fontWeight: "800", color: C.white },
  title: { fontSize: 14, fontWeight: "800", color: C.navy },
  sub: { fontSize: 11, color: C.muted, marginTop: 1 },
  rm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.redBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rmTxt: { fontSize: 11, color: C.red, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 4 },
});

export function FormCard({
  accent = C.navyMid,
  badge,
  icon,
  title,
  subtitle,
  onRemove,
  children,
}) {
  return (
    <View style={fcs.card}>
      <View style={fcs.hdr}>
        <View style={[fcs.badge, { backgroundColor: accent }]}>
          {icon ? (
            <Ionicons name={icon} size={15} color={C.white} />
          ) : (
            <Text style={fcs.badgeTxt}>{badge}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={fcs.title}>{title}</Text>
          {!!subtitle && <Text style={fcs.sub}>{subtitle}</Text>}
        </View>
        {onRemove && (
          <TouchableOpacity onPress={onRemove} style={fcs.rm}>
            <Ionicons name="trash-outline" size={12} color={C.red} />
            <Text style={fcs.rmTxt}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={fcs.body}>{children}</View>
    </View>
  );
}

const gps = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
  },
  txt: { fontSize: 10, fontWeight: "800", color: C.muted, letterSpacing: 1.2 },
  line: { flex: 1, height: 1, backgroundColor: C.border },
});

export function Group({ icon, title }) {
  return (
    <View style={gps.row}>
      {icon && <Ionicons name={icon} size={12} color={C.muted} />}
      <Text style={gps.txt}>{title.toUpperCase()}</Text>
      <View style={gps.line} />
    </View>
  );
}

/* ------------------------------ PickerModal ------------------------------ */
const pks = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,36,71,0.55)",
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    maxHeight: SH * 0.8,
  },
  pill: {
    width: 40,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  title: { fontSize: 16, fontWeight: "800", color: C.navy },
  xBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 14,
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIn: { flex: 1, fontSize: 14, color: C.text },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  optSel: { backgroundColor: C.navy50 },
  optTxt: { fontSize: 14, color: C.sub, flex: 1, marginRight: 8 },
  optTxtSel: { color: C.navyMid, fontWeight: "700" },
  empty: { textAlign: "center", color: C.muted, padding: 24, fontSize: 14 },
});

export const PickerModal = memo(function PickerModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  noSearch,
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!visible) setQ("");
  }, [visible]);
  if (!visible) return null;
  const filtered = (options || []).filter((o) => {
    const l = typeof o === "string" ? o : o.name || o.label || "";
    return l.toLowerCase().includes(q.toLowerCase());
  });
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={pks.overlay}>
        <TouchableOpacity
          style={pks.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={pks.sheet}>
          <View style={pks.pill} />
          <View style={pks.header}>
            <Text style={pks.title}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              style={pks.xBtn}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              <Ionicons name="close" size={16} color={C.sub} />
            </TouchableOpacity>
          </View>
          {!noSearch && (
            <View style={pks.searchRow}>
              <Ionicons name="search-outline" size={14} color={C.muted} />
              <TextInput
                style={pks.searchIn}
                placeholder="Search…"
                value={q}
                onChangeText={setQ}
                placeholderTextColor={C.muted}
              />
              {q.length > 0 && (
                <TouchableOpacity
                  onPress={() => setQ("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={14} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(_, i) => String(i)}
            style={{ height: SH * 0.45 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isObj =
                typeof item === "object" && item !== null && !item.code;
              const l = isObj
                ? item.label
                : typeof item === "string"
                  ? item
                  : item.name || "";
              const val = isObj
                ? item.value
                : typeof item === "string"
                  ? item
                  : item.code || item.name || "";
              const sel = selected === val;
              if (val === "__divider__") {
                return (
                  <View
                    style={{
                      paddingHorizontal: 20,
                      paddingVertical: 10,
                      backgroundColor: C.slate100,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "700",
                        color: C.muted,
                        letterSpacing: 0.5,
                      }}
                    >
                      {l}
                    </Text>
                  </View>
                );
              }
              return (
                <TouchableOpacity
                  style={[pks.option, sel && pks.optSel]}
                  onPress={() => {
                    onSelect(val);
                    onClose();
                  }}
                >
                  <Text
                    style={[pks.optTxt, sel && pks.optTxtSel]}
                    numberOfLines={2}
                  >
                    {l || "-"}
                  </Text>
                  {sel && (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={C.navyMid}
                    />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={pks.empty}>No results</Text>}
          />
        </View>
      </View>
    </Modal>
  );
});

/* --------------------------- date / time pickers --------------------------- */
const sheet = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  box: {
    backgroundColor: C.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  hdr: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  cancel: { fontSize: 15, color: C.sub, fontWeight: "600" },
  title: { fontSize: 15, fontWeight: "700", color: C.navy },
  done: { fontSize: 15, color: C.navyMid, fontWeight: "700" },
});
const pad2 = (n) => String(n).padStart(2, "0");
const toIsoLocal = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export function DateTimePickerField({
  label,
  value,
  onChange,
  error,
  fieldKey,
}) {
  const safeDate = (d) =>
    d && !isNaN(new Date(d).getTime()) ? new Date(d) : new Date();
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [tempDate, setTempDate] = useState(
    value ? new Date(value) : new Date(),
  );

  const formatDisplay = (dt) => {
    if (!dt) return "";
    const d = new Date(dt);
    if (isNaN(d.getTime())) return "";
    const hrs = d.getHours();
    const ampm = hrs >= 12 ? "PM" : "AM";
    const h12 = hrs % 12 || 12;
    return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()} ${h12}:${pad2(d.getMinutes())} ${ampm}`;
  };

  const handleClear = () => {
    onChange("");
    if (fieldKey && _formErrRef.setter) {
      _formErrRef.setter((prev) => {
        const n = { ...prev };
        delete n[fieldKey];
        return n;
      });
    }
  };

  return (
    <View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          style={[
            inp.base,
            {
              flex: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            },
            error && inp.err,
          ]}
          onPress={() => {
            setTempDate(value ? new Date(value) : new Date());
            setShowDate(true);
          }}
        >
          <Text
            style={{ fontSize: 14, color: value ? C.text : C.faint, flex: 1 }}
          >
            {formatDisplay(value) || "Select date & time"}
          </Text>
          <Ionicons name="calendar-outline" size={16} color={C.muted} />
        </TouchableOpacity>
        {value ? (
          <TouchableOpacity
            style={{
              paddingHorizontal: 12,
              paddingVertical: 12,
              backgroundColor: C.redBg,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#fca5a5",
              justifyContent: "center",
            }}
            onPress={handleClear}
          >
            <Ionicons name="close" size={16} color={C.red} />
          </TouchableOpacity>
        ) : null}
      </View>

      {Platform.OS === "ios" ? (
        <Modal
          visible={showDate}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
        >
          <View style={sheet.overlay}>
            <View style={sheet.box}>
              <View style={sheet.hdr}>
                <TouchableOpacity onPress={() => setShowDate(false)}>
                  <Text style={sheet.cancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={sheet.title}>Select Date & Time</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowDate(false);
                    onChange(toIsoLocal(tempDate));
                  }}
                >
                  <Text style={sheet.done}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={safeDate(tempDate)}
                mode="datetime"
                display="spinner"
                onChange={(_, d) => {
                  if (d) setTempDate(d);
                }}
                maximumDate={new Date()}
              />
            </View>
          </View>
        </Modal>
      ) : (
        <>
          {showDate && (
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="default"
              onChange={(e, d) => {
                setShowDate(false);
                if (e.type !== "dismissed" && d) {
                  setTempDate(new Date(d));
                  setTimeout(() => setShowTime(true), 50);
                }
              }}
              maximumDate={new Date()}
            />
          )}
          {showTime && (
            <DateTimePicker
              value={tempDate}
              mode="time"
              display="default"
              onChange={(e, t) => {
                setShowTime(false);
                if (e.type !== "dismissed" && t) {
                  const combined = new Date(tempDate);
                  combined.setHours(t.getHours(), t.getMinutes(), 0, 0);
                  onChange(toIsoLocal(combined));
                }
              }}
            />
          )}
        </>
      )}
    </View>
  );
}

export function DatePickerBtn({ label, value, onChange, maximumDate }) {
  const [show, setShow] = useState(false);
  const toLocalDate = (iso) => {
    if (!iso) return new Date();
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date() : d;
  };
  const [temp, setTemp] = useState(() => toLocalDate(value));
  const fmtDisplay = (d) =>
    d
      ? `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()}`
      : "";
  const maxDate = maximumDate || new Date();

  const trigger = (
    <TouchableOpacity
      style={[
        inp.base,
        {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
      ]}
      onPress={() => {
        setTemp(value || new Date());
        setShow(true);
      }}
    >
      <Text style={{ fontSize: 14, color: value ? C.text : C.faint, flex: 1 }}>
        {fmtDisplay(value) || "mm/dd/yyyy"}
      </Text>
      <Ionicons name="calendar-outline" size={16} color={C.muted} />
    </TouchableOpacity>
  );

  if (Platform.OS === "ios") {
    return (
      <View>
        {trigger}
        <Modal visible={show} transparent animationType="slide">
          <View style={sheet.overlay}>
            <View style={sheet.box}>
              <View style={sheet.hdr}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={sheet.cancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={sheet.title}>{label || "Select Date"}</Text>
                <TouchableOpacity
                  onPress={() => {
                    onChange(temp > maxDate ? maxDate : temp);
                    setShow(false);
                  }}
                >
                  <Text style={sheet.done}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={temp > maxDate ? maxDate : temp}
                mode="date"
                display="spinner"
                onChange={(_, d) => d && setTemp(d > maxDate ? maxDate : d)}
                maximumDate={maxDate}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }
  return (
    <View>
      {trigger}
      {show && (
        <DateTimePicker
          value={temp > maxDate ? maxDate : temp}
          mode="date"
          display="calendar"
          onChange={(evt, d) => {
            setShow(false);
            if (evt.type !== "dismissed" && d)
              onChange(d > maxDate ? maxDate : d);
          }}
          maximumDate={maxDate}
        />
      )}
    </View>
  );
}

/* ------------------------------ AddrFields ------------------------------ */
export const AddrFields = memo(function AddrFields({
  data,
  onUpdate,
  errors,
  pfx,
  regions,
  loadingR,
  provinces,
  cities,
  barangays,
  lPr,
  lCi,
  lBr,
  onReg,
  onProv,
  onCity,
}) {
  const [pick, setPick] = useState(null);
  const isNCR = data.region_code === NCR_CODE;
  const rName =
    (regions || []).find((r) => r.code === data.region_code)?.name || "";
  const pName = isNCR
    ? "N/A (NCR has no province)"
    : (provinces || []).find((p) => p.code === data.province_code)?.name || "";
  const cName =
    (cities || []).find((c) => c.code === data.municipality_code)?.name || "";
  const bName =
    (barangays || []).find((b) => b.code === data.barangay_code)?.name || "";
  const hasSavedText =
    !data.region_code &&
    (data.region ||
      data.district_province ||
      data.city_municipality ||
      data.barangay);
  const savedAddressText = hasSavedText
    ? [
        data.region,
        data.district_province,
        data.city_municipality,
        data.barangay,
      ]
        .filter(Boolean)
        .join(" > ")
    : null;
  return (
    <>
      {savedAddressText && (
        <View
          style={{
            backgroundColor: "#FEF3C7",
            borderRadius: 10,
            padding: 12,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: "#F59E0B",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <Ionicons name="warning-outline" size={14} color="#B45309" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#B45309" }}>
              Previous address (please re-select below):
            </Text>
          </View>
          <Text style={{ fontSize: 13, color: "#92400E" }}>
            {savedAddressText}
          </Text>
        </View>
      )}
      <FField label="Region" error={errors[pfx + "_reg"]}>
        <SelBtn
          label={loadingR ? "Loading regions…" : "Select Region"}
          value={rName}
          onPress={() => setPick("r")}
          error={errors[pfx + "_reg"]}
          disabled={loadingR}
        />
      </FField>
      <FField label="Province" error={!isNCR ? errors[pfx + "_prov"] : null}>
        <SelBtn
          label={
            lPr
              ? "Loading…"
              : isNCR
                ? "N/A (NCR has no province)"
                : !data.region_code
                  ? "Select region first"
                  : "Select Province"
          }
          value={isNCR ? "N/A (NCR has no province)" : pName}
          onPress={() => !isNCR && setPick("p")}
          error={!isNCR && errors[pfx + "_prov"]}
          disabled={isNCR || !data.region_code || lPr}
        />
      </FField>
      <FField label="City / Municipality" error={errors[pfx + "_city"]}>
        <SelBtn
          label={
            lCi
              ? "Loading…"
              : !data.province_code && !isNCR
                ? "Select province first"
                : "Select City/Municipality"
          }
          value={cName}
          onPress={() => setPick("c")}
          error={errors[pfx + "_city"]}
          disabled={(!data.province_code && !isNCR) || lCi}
        />
      </FField>
      <FField label="Barangay" error={errors[pfx + "_brgy"]}>
        <SelBtn
          label={
            lBr
              ? "Loading…"
              : !data.municipality_code
                ? "Select city first"
                : "Select Barangay"
          }
          value={bName}
          onPress={() => setPick("b")}
          error={errors[pfx + "_brgy"]}
          disabled={!data.municipality_code || lBr}
        />
      </FField>
      <PickerModal
        visible={pick === "r"}
        title="Select Region"
        options={regions || []}
        selected={data.region_code}
        onSelect={(c) => {
          onReg(c);
          setPick(null);
        }}
        onClose={() => setPick(null)}
      />
      <PickerModal
        visible={pick === "p"}
        title="Select Province"
        options={provinces || []}
        selected={data.province_code}
        onSelect={(c) => {
          onProv(c);
          setPick(null);
        }}
        onClose={() => setPick(null)}
      />
      <PickerModal
        visible={pick === "c"}
        title="Select City/Municipality"
        options={cities || []}
        selected={data.municipality_code}
        onSelect={(c) => {
          onCity(c);
          setPick(null);
        }}
        onClose={() => setPick(null)}
      />
      <PickerModal
        visible={pick === "b"}
        title="Select Barangay"
        options={barangays || []}
        selected={data.barangay_code}
        onSelect={(c) => {
          onUpdate("barangay_code", c);
          setPick(null);
        }}
        onClose={() => setPick(null)}
      />
    </>
  );
});
