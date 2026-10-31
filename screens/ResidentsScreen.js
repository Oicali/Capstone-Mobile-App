import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BASE_URL, getSession } from "./services/api";
import { getMyBarangayName } from "./services/barangayLock";

const DARK = "#0a1628";
const NAVY = "#1e3a5f";
const RED = "#c1272d";
const BG = "#f1f5f9";
const PAGE_SIZE = 15;

const GENDERS = ["Male", "Female"];
const CIVIL = ["Single", "Married", "Widowed", "Separated", "Annulled"];
const VOTER = ["Registered", "Not Registered"];
const EMPTY_FILTERS = { gender: "", civil: "", voter: "" };

// ── helpers ─────────────────────────────────────────────────────────────────
const authFetch = async (path, options = {}) => {
  const session = await getSession();
  if (!session?.token) throw new Error("Not logged in");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
};

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date)) return "—";
  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const ageOf = (d) => {
  if (!d) return null;
  const b = new Date(d);
  if (isNaN(b)) return null;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return a >= 0 ? a : null;
};

const initials = (f, l) => `${(f || "?")[0]}${(l || "?")[0]}`.toUpperCase();
const AVATAR_COLORS = [
  "#1e3a5f",
  "#2d5a8e",
  "#c1272d",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#be185d",
];
const avatarColor = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};
const displayName = (r) =>
  `${r.last_name}, ${r.first_name}${r.middle_name ? ` ${r.middle_name[0]}.` : ""}${r.qualifier ? ` ${r.qualifier}` : ""}`;

// 1 … 4 5 6 … 334
const getPages = (cur, total) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  let start = Math.max(2, cur - 1);
  let end = Math.min(total - 1, cur + 1);
  if (cur <= 3) {
    start = 2;
    end = 4;
  }
  if (cur >= total - 2) {
    start = total - 3;
    end = total - 1;
  }
  const pages = [1];
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
};

// ── small components ────────────────────────────────────────────────────────
function Avatar({ r, size = 46 }) {
  const full = `${r.first_name} ${r.last_name}`;
  return r.profile_picture ? (
    <Image
      source={{ uri: r.profile_picture }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(full),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.34 }}>
        {initials(r.first_name, r.last_name)}
      </Text>
    </View>
  );
}

function VoterPill({ status }) {
  if (!status) return null;
  const ok = status === "Registered";
  return (
    <View style={[s.pill, { backgroundColor: ok ? "#d1fae5" : "#fee2e2" }]}>
      <View
        style={[s.pillDot, { backgroundColor: ok ? "#10b981" : "#ef4444" }]}
      />
      <Text style={[s.pillTxt, { color: ok ? "#065f46" : "#991b1b" }]}>
        {status}
      </Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.chip, active && s.chipOn]}
      activeOpacity={0.8}
    >
      {active && (
        <Ionicons
          name="checkmark"
          size={13}
          color="#fff"
          style={{ marginRight: 4 }}
        />
      )}
      <Text style={[s.chipTxt, active && s.chipTxtOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIcon}>
        <Ionicons name={icon} size={15} color={NAVY} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLbl}>{label}</Text>
        <Text style={s.infoVal}>{value || "—"}</Text>
      </View>
    </View>
  );
}

function Pagination({ page, totalPages, total, onChange }) {
  if (total === 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const pages = getPages(page, totalPages);
  return (
    <View style={s.pgWrap}>
      <Text style={s.pgInfo}>
        Showing{" "}
        <Text style={s.pgInfoB}>
          {from}–{to}
        </Text>{" "}
        of <Text style={s.pgInfoB}>{total}</Text> residents
      </Text>
      <View style={s.pgRow}>
        <TouchableOpacity
          style={[s.pgBtn, page === 1 && s.pgDis]}
          disabled={page === 1}
          onPress={() => onChange(page - 1)}
        >
          <Ionicons name="chevron-back" size={16} color={NAVY} />
        </TouchableOpacity>
        {pages.map((p, i) =>
          typeof p === "string" ? (
            <Text key={`dots${i}`} style={s.pgDots}>
              …
            </Text>
          ) : (
            <TouchableOpacity
              key={p}
              style={[s.pgBtn, p === page && s.pgActive]}
              onPress={() => onChange(p)}
            >
              <Text style={[s.pgTxt, p === page && { color: "#fff" }]}>
                {p}
              </Text>
            </TouchableOpacity>
          ),
        )}
        <TouchableOpacity
          style={[s.pgBtn, page === totalPages && s.pgDis]}
          disabled={page === totalPages}
          onPress={() => onChange(page + 1)}
        >
          <Ionicons name="chevron-forward" size={16} color={NAVY} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── screen ──────────────────────────────────────────────────────────────────
export default function ResidentsScreen() {
  const insets = useSafeAreaInsets();
  const TAB_H = 55 + Math.max(insets.bottom, 25); // matches the tab bar in App.js
  const listRef = useRef(null);

  const [barangay, setBarangay] = useState("");
  const [isCaptain, setIsCaptain] = useState(false);

  const [residents, setResidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);

  const [selected, setSelected] = useState(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [removed, setRemoved] = useState([]);
  const [loadingRemoved, setLoadingRemoved] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      setIsCaptain(
        /captain/i.test(
          String(session?.user?.role || session?.user?.role_name || ""),
        ),
      );
      const name = await getMyBarangayName();
      if (name) setBarangay(name);
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchResidents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (debounced) params.append("q", debounced);
      if (applied.gender) params.append("gender", applied.gender);
      if (applied.civil) params.append("civil_status", applied.civil);
      if (applied.voter) params.append("voter_status", applied.voter);
      const { data } = await authFetch(`/residents?${params.toString()}`);
      if (data?.success) {
        setResidents(data.data);
        setPage(1);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced, applied]);

  useEffect(() => {
    fetchResidents();
  }, [fetchResidents]);

  const fetchRemoved = useCallback(async () => {
    setLoadingRemoved(true);
    try {
      const { data } = await authFetch("/residents/removed");
      if (data?.success) {
        setRemoved(data.data);
        setPage(1);
      }
    } catch {
    } finally {
      setLoadingRemoved(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (showRemoved) fetchRemoved();
    else setPage(1);
  }, [showRemoved, fetchRemoved]);

  const confirmRemove = (r) => {
    Alert.alert(
      "Remove Resident",
      `Remove ${r.first_name} ${r.last_name} from the resident database?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { data } = await authFetch(`/residents/${r.resident_id}`, {
              method: "DELETE",
            });
            if (data?.success) {
              setSelected(null);
              fetchResidents();
              if (showRemoved) fetchRemoved();
            } else
              Alert.alert(
                "Failed",
                data?.message || "Could not remove resident.",
              );
          },
        },
      ],
    );
  };

  const restore = async (r) => {
    const { data } = await authFetch(`/residents/${r.resident_id}/restore`, {
      method: "PUT",
    });
    if (data?.success) {
      fetchRemoved();
      fetchResidents();
    } else
      Alert.alert("Failed", data?.message || "Could not restore resident.");
  };

  // ── derived ──
  const stats = useMemo(
    () => ({
      total: residents.length,
      male: residents.filter((r) => r.gender === "Male").length,
      female: residents.filter((r) => r.gender === "Female").length,
      voters: residents.filter((r) => r.voter_status === "Registered").length,
    }),
    [residents],
  );

  const source = showRemoved ? removed : residents;
  const totalPages = Math.max(1, Math.ceil(source.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = source.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const goPage = (p) => {
    setPage(p);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const activeChips = [
    applied.gender && { key: "gender", label: applied.gender },
    applied.civil && { key: "civil", label: applied.civil },
    applied.voter && { key: "voter", label: applied.voter },
  ].filter(Boolean);
  const hasQuery = !!search || activeChips.length > 0;

  const clearAll = () => {
    setSearch("");
    setApplied(EMPTY_FILTERS);
  };

  const openFilters = () => {
    setDraft(applied);
    setShowFilters(true);
  };

  // ── list rows ──
  const renderItem = ({ item: r }) => {
    const age = ageOf(r.date_of_birth);
    const meta = [age != null ? `${age} yrs` : null, r.civil_status]
      .filter(Boolean)
      .join(" · ");
    return (
      <TouchableOpacity
        style={s.card}
        activeOpacity={showRemoved ? 1 : 0.7}
        onPress={() => !showRemoved && setSelected(r)}
      >
        <Avatar r={r} />
        <View style={s.cardMid}>
          <Text style={s.name} numberOfLines={1}>
            {displayName(r)}
          </Text>
          <View style={s.metaRow}>
            {!!r.gender && (
              <Ionicons
                name={r.gender === "Male" ? "male" : "female"}
                size={13}
                color={r.gender === "Male" ? "#2563eb" : "#db2777"}
                style={{ marginRight: 4 }}
              />
            )}
            <Text style={s.meta} numberOfLines={1}>
              {meta || r.gender || "—"}
            </Text>
          </View>
          {!!r.house_street && (
            <View style={s.metaRow}>
              <Ionicons
                name="location-outline"
                size={12}
                color="#9ca3af"
                style={{ marginRight: 4 }}
              />
              <Text style={s.addr} numberOfLines={1}>
                {r.house_street}
              </Text>
            </View>
          )}
        </View>
        {showRemoved ? (
          <TouchableOpacity style={s.restoreBtn} onPress={() => restore(r)}>
            <Ionicons name="refresh" size={13} color="#065f46" />
            <Text style={s.restoreTxt}> Restore</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <VoterPill status={r.voter_status} />
            <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const isLoading = showRemoved ? loadingRemoved : loading;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={DARK} />

      {/* HEADER + STATS */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.hTitle}>Residents</Text>
            <Text style={s.hSub}>
              {barangay
                ? `Brgy. ${barangay} · citizen database`
                : "Barangay citizen database"}
            </Text>
          </View>
          {isCaptain && (
            <TouchableOpacity
              style={[
                s.hBtn,
                showRemoved && { backgroundColor: "rgba(220,38,38,0.4)" },
              ]}
              onPress={() => setShowRemoved((v) => !v)}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {!showRemoved && (
          <View style={s.statsStrip}>
            {[
              ["people", "#93c5fd", stats.total, "Total"],
              ["male", "#60a5fa", stats.male, "Male"],
              ["female", "#f472b6", stats.female, "Female"],
              ["checkmark-circle", "#4ade80", stats.voters, "Voters"],
            ].map(([icon, color, val, lbl], i) => (
              <View key={lbl} style={[s.statCol, i > 0 && s.statDivider]}>
                <Ionicons name={icon} size={14} color={color} />
                <Text style={s.statNum}>{val}</Text>
                <Text style={s.statLbl}>{lbl}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* BODY */}
      <View style={s.body}>
        {showRemoved ? (
          <View style={s.removedBar}>
            <Ionicons name="trash" size={14} color="#dc2626" />
            <Text style={s.removedTxt}>
              Removed residents ({removed.length}). Tap Restore to bring one
              back.
            </Text>
          </View>
        ) : (
          <>
            <View style={s.searchRow}>
              <View style={s.searchBox}>
                <Ionicons name="search-outline" size={17} color="#9ca3af" />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search by name..."
                  placeholderTextColor="#9ca3af"
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                />
                {!!search && (
                  <TouchableOpacity
                    onPress={() => setSearch("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={17} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={s.filterBtn}
                onPress={openFilters}
                activeOpacity={0.85}
              >
                <Ionicons name="options-outline" size={20} color="#fff" />
                {activeChips.length > 0 && (
                  <View style={s.filterBadge}>
                    <Text style={s.filterBadgeTxt}>{activeChips.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {activeChips.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0 }}
                contentContainerStyle={s.activeRow}
              >
                {activeChips.map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    style={s.activeChip}
                    onPress={() => setApplied((a) => ({ ...a, [c.key]: "" }))}
                  >
                    <Text style={s.activeChipTxt}>{c.label}</Text>
                    <Ionicons
                      name="close"
                      size={13}
                      color={NAVY}
                      style={{ marginLeft: 4 }}
                    />
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.activeChip, { backgroundColor: "#fee2e2" }]}
                  onPress={clearAll}
                >
                  <Text style={[s.activeChipTxt, { color: RED }]}>
                    Clear all
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </>
        )}

        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator color={NAVY} size="large" />
            <Text style={s.loadTxt}>Loading residents...</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={pageItems}
            keyExtractor={(r) => String(r.resident_id)}
            renderItem={renderItem}
            contentContainerStyle={{
              padding: 12,
              paddingBottom: 16,
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  showRemoved ? fetchRemoved() : fetchResidents();
                }}
                colors={[NAVY]}
                tintColor={NAVY}
              />
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Ionicons name="people-outline" size={30} color="#9ca3af" />
                </View>
                <Text style={s.emptyTitle}>
                  {showRemoved
                    ? "No removed residents"
                    : hasQuery
                      ? "No residents found"
                      : "No residents yet"}
                </Text>
                <Text style={s.emptySub}>
                  {showRemoved
                    ? "Residents you remove will show up here."
                    : hasQuery
                      ? "Try a different name or remove some filters."
                      : "The resident database for your barangay is empty."}
                </Text>
                {hasQuery && !showRemoved && (
                  <TouchableOpacity style={s.emptyBtn} onPress={clearAll}>
                    <Text style={s.emptyBtnTxt}>Clear search & filters</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}

        {!isLoading && (
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={source.length}
            onChange={goPage}
          />
        )}
        {/* keeps the pagination bar above the floating tab bar */}
        <View style={{ height: TAB_H }} />
      </View>

      {/* FILTER SHEET */}
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={s.overlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setShowFilters(false)}
          />
          <View
            style={[
              s.sheet,
              { paddingBottom: Math.max(insets.bottom + 12, 20) },
            ]}
          >
            <View style={s.handle} />
            <View style={s.sheetTop}>
              <Text style={s.sheetTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={22} color={NAVY} />
              </TouchableOpacity>
            </View>

            <Text style={s.fLbl}>Gender</Text>
            <View style={s.chipWrap}>
              {GENDERS.map((g) => (
                <FilterChip
                  key={g}
                  label={g}
                  active={draft.gender === g}
                  onPress={() =>
                    setDraft((d) => ({ ...d, gender: d.gender === g ? "" : g }))
                  }
                />
              ))}
            </View>

            <Text style={s.fLbl}>Civil Status</Text>
            <View style={s.chipWrap}>
              {CIVIL.map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  active={draft.civil === c}
                  onPress={() =>
                    setDraft((d) => ({ ...d, civil: d.civil === c ? "" : c }))
                  }
                />
              ))}
            </View>

            <Text style={s.fLbl}>Voter Status</Text>
            <View style={s.chipWrap}>
              {VOTER.map((v) => (
                <FilterChip
                  key={v}
                  label={v}
                  active={draft.voter === v}
                  onPress={() =>
                    setDraft((d) => ({ ...d, voter: d.voter === v ? "" : v }))
                  }
                />
              ))}
            </View>

            <View style={s.sheetFoot}>
              <TouchableOpacity
                style={s.resetBtn}
                onPress={() => setDraft(EMPTY_FILTERS)}
              >
                <Text style={s.resetTxt}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.applyBtn}
                onPress={() => {
                  setApplied(draft);
                  setShowFilters(false);
                }}
              >
                <Text style={s.applyTxt}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DETAIL SHEET */}
      <Modal
        visible={!!selected}
        transparent
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.overlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setSelected(null)}
          />
          {selected && (
            <View
              style={[
                s.sheet,
                {
                  maxHeight: "88%",
                  paddingBottom: Math.max(insets.bottom + 12, 20),
                },
              ]}
            >
              <View style={s.handle} />
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ alignItems: "center", marginBottom: 16 }}>
                  <Avatar r={selected} size={80} />
                  <Text style={s.dName}>{displayName(selected)}</Text>
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 8,
                      marginTop: 8,
                      flexWrap: "wrap",
                      justifyContent: "center",
                    }}
                  >
                    {!!selected.gender && (
                      <View
                        style={[
                          s.pill,
                          {
                            backgroundColor:
                              selected.gender === "Male"
                                ? "#dbeafe"
                                : "#fce7f3",
                          },
                        ]}
                      >
                        <Ionicons
                          name={selected.gender === "Male" ? "male" : "female"}
                          size={12}
                          color={
                            selected.gender === "Male" ? "#1d4ed8" : "#be185d"
                          }
                        />
                        <Text
                          style={[
                            s.pillTxt,
                            {
                              color:
                                selected.gender === "Male"
                                  ? "#1d4ed8"
                                  : "#be185d",
                              marginLeft: 4,
                            },
                          ]}
                        >
                          {selected.gender}
                        </Text>
                      </View>
                    )}
                    <VoterPill status={selected.voter_status} />
                  </View>
                </View>

                <Text style={s.secTitle}>Personal Information</Text>
                <View style={s.infoCard}>
                  <InfoRow
                    icon="person-outline"
                    label="First Name"
                    value={selected.first_name}
                  />
                  <InfoRow
                    icon="person-outline"
                    label="Middle Name"
                    value={selected.middle_name}
                  />
                  <InfoRow
                    icon="person-outline"
                    label="Last Name"
                    value={selected.last_name}
                  />
                  <InfoRow
                    icon="ribbon-outline"
                    label="Qualifier"
                    value={selected.qualifier}
                  />
                  <InfoRow
                    icon="calendar-outline"
                    label="Date of Birth"
                    value={
                      selected.date_of_birth
                        ? `${fmtDate(selected.date_of_birth)}${ageOf(selected.date_of_birth) != null ? `  (${ageOf(selected.date_of_birth)} yrs)` : ""}`
                        : null
                    }
                  />
                </View>

                <Text style={s.secTitle}>Contact & Status</Text>
                <View style={s.infoCard}>
                  <InfoRow
                    icon="call-outline"
                    label="Contact Number"
                    value={selected.contact_number}
                  />
                  <InfoRow
                    icon="heart-outline"
                    label="Civil Status"
                    value={selected.civil_status}
                  />
                  <InfoRow
                    icon="checkmark-circle-outline"
                    label="Voter Status"
                    value={selected.voter_status}
                  />
                  <InfoRow
                    icon="location-outline"
                    label="Address"
                    value={selected.house_street}
                  />
                </View>

                {!isCaptain && (
                  <Text style={s.viewOnly}>
                    View-only — contact your Councilor to make changes
                  </Text>
                )}
                {isCaptain && (
                  <TouchableOpacity
                    style={s.removeBtn}
                    onPress={() => confirmRemove(selected)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={s.removeTxt}> Remove Resident</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={s.closeBtn}
                  onPress={() => setSelected(null)}
                >
                  <Text style={s.closeTxt}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DARK },

  header: {
    backgroundColor: DARK,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTop: { flexDirection: "row", alignItems: "center" },
  hTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  hSub: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 },
  hBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  statsStrip: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    marginTop: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statCol: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: "rgba(255,255,255,0.1)" },
  statNum: { color: "#fff", fontSize: 17, fontWeight: "800" },
  statLbl: { color: "rgba(255,255,255,0.55)", fontSize: 10, fontWeight: "600" },

  body: { flex: 1, backgroundColor: BG },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#0f172a", padding: 0 },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: NAVY,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: BG,
    paddingHorizontal: 3,
  },
  filterBadgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },

  activeRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0e7f1",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  activeChipTxt: { fontSize: 12, fontWeight: "700", color: NAVY },

  removedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderBottomWidth: 1,
    borderBottomColor: "#fecaca",
    padding: 12,
  },
  removedTxt: { flex: 1, color: "#dc2626", fontSize: 12, fontWeight: "600" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadTxt: { fontSize: 13, color: "#6b7280" },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e8edf3",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardMid: { flex: 1, marginLeft: 12, marginRight: 8 },
  name: { fontSize: 14, fontWeight: "700", color: NAVY },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 3 },
  meta: { fontSize: 12, color: "#64748b", flexShrink: 1 },
  addr: { fontSize: 11, color: "#9ca3af", flexShrink: 1 },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  pillTxt: { fontSize: 10, fontWeight: "700" },

  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d1fae5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  restoreTxt: { color: "#065f46", fontWeight: "700", fontSize: 12 },

  empty: { alignItems: "center", paddingTop: 50, paddingHorizontal: 30 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#374151" },
  emptySub: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop: 14,
    backgroundColor: NAVY,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // pagination
  pgWrap: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: "center",
    gap: 8,
  },
  pgInfo: { fontSize: 11, color: "#6b7280" },
  pgInfoB: { fontWeight: "800", color: NAVY },
  pgRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  pgBtn: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe2ea",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  pgActive: { backgroundColor: NAVY, borderColor: NAVY },
  pgDis: { opacity: 0.35 },
  pgTxt: { fontSize: 12, fontWeight: "700", color: NAVY },
  pgDots: { fontSize: 14, color: "#9ca3af", paddingHorizontal: 2 },

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
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: NAVY },
  fLbl: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#dbe2ea",
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: NAVY, borderColor: NAVY },
  chipTxt: { fontSize: 13, fontWeight: "600", color: "#475569" },
  chipTxtOn: { color: "#fff" },
  sheetFoot: { flexDirection: "row", gap: 10, marginTop: 24 },
  resetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#dbe2ea",
    alignItems: "center",
    justifyContent: "center",
  },
  resetTxt: { fontSize: 14, fontWeight: "700", color: "#475569" },
  applyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  applyTxt: { fontSize: 15, fontWeight: "800", color: "#fff" },

  dName: {
    fontSize: 18,
    fontWeight: "800",
    color: NAVY,
    marginTop: 12,
    textAlign: "center",
  },
  secTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8edf3",
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f6",
  },
  infoIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#e0e7f1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoLbl: { fontSize: 11, color: "#9ca3af", fontWeight: "600" },
  infoVal: { fontSize: 14, color: "#111827", fontWeight: "600", marginTop: 1 },
  viewOnly: {
    textAlign: "center",
    fontSize: 11,
    color: "#9ca3af",
    fontStyle: "italic",
    marginTop: 12,
  },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 14,
  },
  removeTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  closeBtn: {
    backgroundColor: NAVY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  closeTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
