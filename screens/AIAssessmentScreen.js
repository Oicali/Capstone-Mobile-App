import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { generateAIAssessment, getPhtToday } from "./services/api";

// ─── COLORS (same palette as DashboardScreen) ────────────────────────────────
const NAVY = "#0a1628";
const NAVY_M = "#1e3a5f";
const RED = "#c1272d";
const WHITE = "#ffffff";
const G50 = "#f8f9fa";
const G100 = "#e9ecef";
const G200 = "#dee2e6";
const G400 = "#adb5bd";
const G600 = "#6c757d";
const G700 = "#495057";
const G900 = "#212529";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const MIN_RECOMMENDED_DAYS = 238; // 34 weeks, matches backtest fold requirement
const INDEX_CRIMES = [
  "MURDER", "HOMICIDE", "PHYSICAL INJURY", "RAPE", "ROBBERY",
  "THEFT", "CARNAPPING - MC", "CARNAPPING - MV", "SPECIAL COMPLEX CRIME",
];
const CRIME_DISPLAY = {
  MURDER: "Murder",
  HOMICIDE: "Homicide",
  "PHYSICAL INJURY": "Physical Injury",
  RAPE: "Rape",
  ROBBERY: "Robbery",
  THEFT: "Theft",
  "CARNAPPING - MC": "Carnapping - MC",
  "CARNAPPING - MV": "Carnapping - MV",
  "SPECIAL COMPLEX CRIME": "Special Complex Crime",
};
const CRIME_PILL_LABEL = {
  MURDER: "Murder",
  THEFT: "Theft",
  RAPE: "Rape",
  ROBBERY: "Robbery",
  HOMICIDE: "Homicide",
  "SPECIAL COMPLEX CRIME": "Spec. Complex",
  "PHYSICAL INJURY": "Phys. Inj.",
  "CARNAPPING - MC": "Carnap MC",
  "CARNAPPING - MV": "Carnap MV",
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
// Same title-casing as web, keeps roman numerals and P./F. initials uppercase
const ROMAN = new Set(["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"]);
const formatBarangayLabel = (name = "") =>
  name.toLowerCase().replace(/\b\w+/g, (word) => {
    const upper = word.toUpperCase();
    if (ROMAN.has(upper)) return upper;
    if (upper === "P" || upper === "F") return upper;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
};

// Mode compares dateTo against PHT today (string compare works for YYYY-MM-DD)
const getAssessmentMode = (dateTo) => {
  if (!dateTo) return "current";
  const today = getPhtToday().toISOString().slice(0, 10);
  return dateTo < today ? "retrospective" : "current";
};

// ─── RISK CARD ───────────────────────────────────────────────────────────────
function RiskCard({ row, thresholds }) {
  const [open, setOpen] = useState(false);
  const score = row.risk_score ?? 0;
  const color =
    score >= thresholds.priority ? "#b91c1c"
    : score >= thresholds.monitor ? "#f97316"
    : score >= thresholds.observe ? "#eab308"
    : "#6b7280";

  return (
    <TouchableOpacity
      style={s.riskCard}
      activeOpacity={0.8}
      onPress={() => setOpen((v) => !v)}
    >
      <View style={s.riskTop}>
        <Text style={s.riskRank}>{row.rank}</Text>
        <Text style={s.riskName} numberOfLines={1}>
          {formatBarangayLabel(row.barangay)}
        </Text>
        <Text style={[s.riskScore, { color }]}>{score}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={G400} />
      </View>

      <View style={s.riskBarBg}>
        <View style={[s.riskBarFill, { width: `${Math.min(score, 100)}%`, backgroundColor: color }]} />
      </View>

      <View style={s.pillRow}>
        {(row.top_crimes || []).map((c, i) => (
          <View key={i} style={s.crimePill}>
            <Text style={s.crimePillTxt}>{CRIME_PILL_LABEL[c] || c}</Text>
          </View>
        ))}
      </View>

      {open && (
        <View style={s.riskDetail}>
          <Text style={s.riskDetailLine}>
            <Text style={s.bold}>Last incident: </Text>{row.last_incident || "N/A"}
          </Text>
          <Text style={s.riskDetailLine}>
            <Text style={s.bold}>Why flagged: </Text>{row.why_flagged || "N/A"}
          </Text>
          <Text style={s.riskDetailLine}>
            <Text style={s.bold}>Total incidents: </Text>{row.total ?? "N/A"}
            {"   "}
            <Text style={s.bold}>Active weeks: </Text>{row.nonzero_weeks ?? "N/A"}
          </Text>
          <Text style={s.riskDetailLine}>
            <Text style={s.bold}>Avg interval: </Text>
            {row.avg_interval_days ? `~${Math.round(row.avg_interval_days)}d` : "N/A"}
            {"   "}
            <Text style={s.bold}>Model tier: </Text>{row.tier ?? "N/A"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── RISK LEGEND ─────────────────────────────────────────────────────────────
// Color bands built from backend thresholds so they match the card colors
function RiskLegend({ thresholds }) {
  const items = [
    { color: "#b91c1c", range: `${thresholds.priority}–100`, label: "Priority patrol needed" },
    { color: "#f97316", range: `${thresholds.monitor}–${thresholds.priority - 1}`, label: "Closely monitor" },
    { color: "#eab308", range: `${thresholds.observe}–${thresholds.monitor - 1}`, label: "Keep under observation" },
    { color: "#6b7280", range: `0–${thresholds.observe - 1}`, label: "Routine patrol sufficient" },
  ];
  return (
    <View style={s.legendWrap}>
      {items.map((it) => (
        <View key={it.label} style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: it.color }]} />
          <Text style={[s.legendRange, { color: it.color }]}>{it.range}</Text>
          <Text style={s.legendLbl}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── BACKTEST PANEL ──────────────────────────────────────────────────────────
// Walk-forward reliability report: 8 weekly folds, tap a fold to see its ranking
function BacktestPanel({ backtest }) {
  const [selected, setSelected] = useState(null);

  if (backtest.status === "insufficient") {
    return <Text style={s.btWarn}>⚠ {backtest.message}</Text>;
  }

  const verdictColor =
    backtest.model_verdict === "trustworthy" ? "#16a34a"
    : backtest.model_verdict === "use with caution" ? "#d97706"
    : "#dc2626";

  const fold = selected !== null ? backtest.per_fold?.[selected] : null;
  const top15 = fold?.phase1_top15 || [];
  const actual = fold?.actual_brgy || [];

  return (
    <View style={s.btPanel}>
      <Text style={s.blockTitle}>Backtest Reliability Report</Text>
      <Text style={s.mutedTxt}>
        {backtest.folds} weekly folds · Walk-forward validation · Verdict:{" "}
        <Text style={{ color: verdictColor, fontWeight: "700" }}>{backtest.model_verdict}</Text>
      </Text>

      <View style={s.btMetrics}>
        {[
          ["Hit Rate @ Top 5", `${backtest.hit_rate_top5}%`],
          ["Hit Rate @ Top 10", `${backtest.hit_rate_top10}%`],
          ["Hit Rate @ Top 15", `${backtest.hit_rate_top15}%`],
          ["Avg Rank of Actual", backtest.mean_rank ?? "—"],
        ].map(([l, v]) => (
          <View key={l} style={s.statBox}>
            <Text style={s.statVal}>{v}</Text>
            <Text style={s.statLbl}>{l}</Text>
          </View>
        ))}
      </View>

      <Text style={[s.mutedTxt, { marginTop: 10 }]}>
        Per-week result (green = actual crime barangay was in the top 15). Tap a week to see its ranking.
      </Text>
      <View style={s.foldRow}>
        {(backtest.per_fold || []).map((f, i) => (
          <TouchableOpacity
            key={i}
            style={[
              s.foldDot,
              { backgroundColor: f.hit_top15 ? "rgba(34,197,94,0.15)" : "rgba(220,38,38,0.12)" },
              { borderColor: f.hit_top15 ? "#16a34a" : "#dc2626" },
              selected === i && { borderWidth: 2 },
            ]}
            onPress={() => setSelected(selected === i ? null : i)}
          >
            <Text style={{ fontSize: 11, fontWeight: "700", color: f.hit_top15 ? "#16a34a" : "#dc2626" }}>
              {f.fold}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {fold && (
        <View style={s.foldDetail}>
          <Text style={s.quadLabel}>Phase 1 Ranking — Fold {fold.fold}</Text>
          <Text style={s.mutedTxt}>
            Trained on data up to {fold.train_end} · Testing {fold.test_week_start} to {fold.test_week_end}
          </Text>

          <Text style={[s.mutedTxt, { marginTop: 8 }]}>Actual crime barangays:</Text>
          <View style={s.pillRow}>
            {actual.length === 0 ? (
              <Text style={s.mutedTxt}>none recorded</Text>
            ) : (
              actual.map((b, i) => {
                const hit = top15.some((r) => r.barangay === b);
                return (
                  <View
                    key={i}
                    style={[s.actChip, { backgroundColor: hit ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.10)" }]}
                  >
                    <Text style={{ fontSize: 10, fontWeight: "700", color: hit ? "#16a34a" : "#dc2626" }}>
                      {formatBarangayLabel(b)} {hit ? "✓" : "✗"}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {top15.map((r) => {
            const isActual = actual.includes(r.barangay);
            return (
              <View key={r.rank} style={[s.foldRank, isActual && { backgroundColor: "rgba(34,197,94,0.08)" }]}>
                <Text style={s.riskRank}>{r.rank}</Text>
                <Text
                  style={[s.foldName, isActual && { color: "#16a34a" }]}
                  numberOfLines={1}
                >
                  {formatBarangayLabel(r.barangay)}
                </Text>
                {isActual && <Text style={s.foldHit}>ACTUAL</Text>}
                <Text style={s.foldScore}>{r.risk_score}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── RISK SECTION ────────────────────────────────────────────────────────────
// Collapsible: header always visible, legend + cards + report show on expand
function RiskSection({ forecast }) {
  // Hooks must run before any early return
  const [open, setOpen] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);

  const rows = forecast?.barangay_risk || [];
  const backtest = forecast?.backtest || null;

  if (rows.length === 0) {
    return (
      <Text style={s.mutedTxt}>
        Insufficient data to produce barangay risk rankings.
      </Text>
    );
  }
  // Backend percentile cutoffs; fixed bands as fallback on small samples
  const thresholds = forecast.risk_thresholds || { priority: 80, monitor: 65, observe: 45 };

  return (
    <View>
      <TouchableOpacity style={s.riskHdr} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <View style={{ flex: 1 }}>
          <Text style={[s.blockTitle, { marginBottom: 2 }]}>Top {rows.length} High-Risk Barangays</Text>
          <Text style={s.mutedTxt}>
            Structural risk ranking · {forecast.total_barangays ?? 0} scored · Tap to {open ? "collapse" : "expand"}
          </Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={G400} />
      </TouchableOpacity>

      {open && (
        <View style={{ marginTop: 10 }}>
          <RiskLegend thresholds={thresholds} />
          <Text style={[s.mutedTxt, { marginBottom: 10 }]}>
            Decay window: {forecast.decay_window_used ?? 90} days. Score ranks barangays against each other
            in this period, and the ranges recalculate per search. 100 = highest-risk area, not a percentage
            chance of crime.
          </Text>

          {rows.map((row) => (
            <RiskCard key={row.rank} row={row} thresholds={thresholds} />
          ))}

          {backtest && (
            <>
              <TouchableOpacity style={s.btBtn} onPress={() => setShowBacktest((v) => !v)}>
                <Text style={s.btBtnTxt}>{showBacktest ? "▾ Hide" : "▸ Show"} Reliability Report</Text>
              </TouchableOpacity>
              {showBacktest && <BacktestPanel backtest={backtest} />}
            </>
          )}
        </View>
      )}
    </View>
  );
}
// ─── PER-CRIME ACCORDION ─────────────────────────────────────────────────────
function CrimeAccordion({ crime }) {
  const [open, setOpen] = useState(false);

  // Operations text comes as lines with markdown bold markers; strip them like web
  const opsLines = (crime.operations || "")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.replace(/\*\*/g, ""));

  const Item = ({ label, children }) => (
    <View style={s.quadItem}>
      <Text style={s.quadLabel}>{label}</Text>
      {children}
    </View>
  );

  return (
    <View style={s.accWrap}>
      <TouchableOpacity style={s.accHdr} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <Text style={s.accTitle} numberOfLines={1}>{crime.crime_type}</Text>
        {crime.is_ecp && (
          <View style={s.ecpBadge}><Text style={s.ecpTxt}>ECP</Text></View>
        )}
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={G400} />
      </TouchableOpacity>

      {open && (
        <View style={s.accBody}>
          <Item label="Crime Assessment">
            <Text style={s.bodyTxt}>{crime.crime_assessment}</Text>
          </Item>
          <Item label="Operations">
            {opsLines.map((line, i) => (
              <Text key={i} style={[s.bodyTxt, { marginBottom: 6 }]}>{line}</Text>
            ))}
          </Item>
          <Item label="Intelligence">
            <Text style={s.bodyTxt}>{crime.intelligence}</Text>
          </Item>
          <Item label="Investigations">
            <Text style={s.bodyTxt}>{crime.investigations}</Text>
          </Item>
          <Item label="Police Community Relations">
            <Text style={s.bodyTxt}>{crime.police_community_relations}</Text>
          </Item>
        </View>
      )}
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function AIAssessmentScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const filters = route.params?.filters;

  const [assessment, setAssessment] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");

  const abortRef = useRef(null);
  const phaseTimerRef = useRef(null);

  // Cancel in-flight request + timer on unmount (covers forced logout reset too)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearInterval(phaseTimerRef.current);
    };
  }, []);

  // Block iOS swipe-back while generating
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !generating });
  }, [generating, navigation]);

  // Android hardware back: confirm while generating (no beforeRemove, so logout reset isn't blocked)
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!generating) return false;
        confirmLeave();
        return true;
      });
      return () => sub.remove();
    }, [generating]),
  );

  const confirmLeave = () => {
    Alert.alert(
      "Leave while generating?",
      "The request will be cancelled on your side, but the server may still finish and count toward the daily AI limit.",
      [
        { text: "Stay", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => navigation.goBack() },
      ],
    );
  };

  const handleBack = () => (generating ? confirmLeave() : navigation.goBack());

  const crimes = filters?.crimeTypes?.length > 0 ? filters.crimeTypes : INDEX_CRIMES;

  const run = async () => {
    const phases = [
      "Querying blotter records...",
      "Computing Barangay Priority Scores...",
      "Computing forecasts...",
      ...crimes.map((c) => `Assessing ${CRIME_DISPLAY[c] || c}...`),
      "Finalizing assessment...",
    ];

    let idx = 0;
    setPhase(phases[0]);
    clearInterval(phaseTimerRef.current);
    phaseTimerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, phases.length - 1);
      setPhase(phases[idx]);
    }, 3200);

    const controller = new AbortController();
    abortRef.current = controller;

    setError("");
    setGenerating(true);

    try {
      const json = await generateAIAssessment(
        {
          barangays: filters.barangays || [],
          crime_types: filters.crimeTypes || [],
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          mode: getAssessmentMode(filters.dateTo),
        },
        controller.signal,
      );
      setAssessment(json.assessment);
      setForecast(json.barangay_forecast || null);
    } catch (err) {
      if (err.aborted) return; // screen is leaving, don't touch state
      const msg = (err.message || "").toLowerCase();
      const isRateLimit =
        err.status === 429 || msg.includes("rate limit") || msg.includes("quota") || msg.includes("limit");
      setError(
        err.status === 403
          ? "You don't have permission to generate assessments."
          : isRateLimit
            ? "The AI service has reached its daily request limit. Please try again tomorrow (resets at 8:00 AM Philippine Time)."
            : err.timedOut
              ? "The assessment took too long. Please try again."
              : "Something went wrong while generating the assessment. Please try again in a few moments.",
      );
    } finally {
      clearInterval(phaseTimerRef.current);
      setPhase("");
      setGenerating(false);
    }
  };

  // Short-range warning, same threshold as web
  const handleGenerate = () => {
    const dayCount = Math.round(
      (new Date(filters.dateTo) - new Date(filters.dateFrom)) / 86400000,
    );
    if (dayCount < MIN_RECOMMENDED_DAYS) {
      Alert.alert(
        "Short date range",
        `Your range is ${dayCount} days. At least ${MIN_RECOMMENDED_DAYS} days (34 weeks) is recommended for a reliable forecast. Generate anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Generate anyway", onPress: run },
        ],
      );
      return;
    }
    run();
  };

  if (!filters) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={[s.mutedTxt, { padding: 24 }]}>No filters were passed to this screen.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color={WHITE} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hTitle}>AI Assessment</Text>
          <Text style={s.hSub}>EMPO QUAD · {fmtDate(filters.dateFrom)} — {fmtDate(filters.dateTo)}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: G50 }}
        contentContainerStyle={{ padding: 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* PRE-GENERATE / LOADING / ERROR */}
        {!assessment && (
          <View style={s.card}>
            {generating ? (
              <View style={s.centerBox}>
                <ActivityIndicator size="large" color={NAVY} />
                <Text style={s.phaseTxt}>{phase || "Generating AI assessment..."}</Text>
                <Text style={s.mutedTxt}>This can take a minute. Please keep this screen open.</Text>
              </View>
            ) : (
              <View style={s.centerBox}>
                <Text style={s.blockTitle}>Generate Assessment</Text>
                <Text style={[s.mutedTxt, { textAlign: "center" }]}>
                  Generates an AI-powered EMPO QUAD assessment based on the filters from your dashboard.
                  Each generation counts toward a daily limit.
                </Text>

                {!!error && (
                  <View style={s.errBox}>
                    <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
                    <Text style={s.errTxt}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity style={s.genBtn} onPress={handleGenerate}>
                  <Text style={s.genBtnTxt}>{error ? "Try Again" : "Generate Assessment"}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* RESULT */}
        {assessment && (
          <>
            <View style={s.card}>
              <View style={s.cardPad}>
                <Text style={s.resultTitle}>{assessment.title || "AI Crime Assessment"}</Text>
                <Text style={s.mutedTxt}>
                  Generated:{" "}
                  {assessment.generatedAt
                    ? new Date(assessment.generatedAt).toLocaleString()
                    : new Date().toLocaleString()}
                </Text>
                <View style={s.aiBadge}><Text style={s.aiBadgeTxt}>AI Output</Text></View>
              </View>

              {assessment.stats && (
                <View style={s.statGrid}>
                  {[
                    [assessment.stats.total ?? 0, "Total Incidents"],
                    [`${assessment.stats.cce ?? "0.0"}%`, "CCE"],
                    [`${assessment.stats.cse ?? "0.0"}%`, "CSE"],
                    [assessment.stats.ui ?? 0, "Under Inv."],
                  ].map(([v, l]) => (
                    <View key={l} style={s.statBox}>
                      <Text style={s.statVal}>{v}</Text>
                      <Text style={s.statLbl}>{l}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={s.card}>
              <View style={s.cardPad}>
                <Text style={s.blockTitle}>Overall Assessment</Text>
                <Text style={s.bodyTxt}>
                  {assessment.overall_assessment || "No assessment generated."}
                </Text>
              </View>
            </View>

            {forecast && (
              <View style={s.card}>
                <View style={s.cardPad}>
                  <RiskSection forecast={forecast} />
                </View>
              </View>
            )}

            <Text style={s.divider}>PER-CRIME EMPO QUAD ASSESSMENT</Text>
            {(assessment.per_crime || []).map((crime, i) => (
              <CrimeAccordion key={i} crime={crime} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  hTitle: { fontSize: 18, fontWeight: "700", color: WHITE },
  hSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  card: {
    backgroundColor: WHITE, borderRadius: 10, borderWidth: 1,
    borderColor: G200, marginBottom: 10, overflow: "hidden",
  },
  cardPad: { padding: 14 },
  centerBox: { padding: 24, alignItems: "center", gap: 12 },

  blockTitle: { fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: 6 },
  resultTitle: { fontSize: 16, fontWeight: "700", color: NAVY, marginBottom: 4 },
  bodyTxt: { fontSize: 13, lineHeight: 20, color: G700 },
  mutedTxt: { fontSize: 11, lineHeight: 16, color: G600 },
  bold: { fontWeight: "700", color: G900 },
  phaseTxt: { fontSize: 14, fontWeight: "600", color: NAVY, textAlign: "center" },

  genBtn: {
    backgroundColor: RED, borderRadius: 10, paddingVertical: 14,
    paddingHorizontal: 28, marginTop: 6,
  },
  genBtnTxt: { color: WHITE, fontWeight: "700", fontSize: 14 },
  errBox: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca",
    borderRadius: 8, padding: 10, alignSelf: "stretch",
  },
  errTxt: { flex: 1, fontSize: 12, color: "#dc2626", lineHeight: 17 },

  aiBadge: {
    alignSelf: "flex-start", marginTop: 8, backgroundColor: "rgba(30,58,95,0.1)",
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
  },
  aiBadgeTxt: { fontSize: 10, fontWeight: "700", color: NAVY_M },

  statGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 8,
    padding: 14, paddingTop: 0,
  },
  statBox: {
    width: "48%", backgroundColor: G50, borderRadius: 8, borderWidth: 1,
    borderColor: G200, padding: 10, alignItems: "center",
  },
  statVal: { fontSize: 18, fontWeight: "700", color: NAVY },
  statLbl: { fontSize: 10, color: G600, fontWeight: "600", marginTop: 2 },

  riskCard: {
    backgroundColor: G50, borderWidth: 1, borderColor: G200,
    borderRadius: 8, padding: 10, marginBottom: 8,
  },
  riskTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  riskRank: { width: 20, fontSize: 11, fontWeight: "700", color: G400 },
  riskName: { flex: 1, fontSize: 13, fontWeight: "700", color: NAVY_M },
  riskScore: { fontSize: 15, fontWeight: "700" },
  riskBarBg: {
    height: 5, backgroundColor: G100, borderRadius: 3,
    marginTop: 8, overflow: "hidden",
  },
  riskBarFill: { height: "100%", borderRadius: 3 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  crimePill: {
    backgroundColor: NAVY_M, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  crimePillTxt: { fontSize: 10, color: WHITE, fontWeight: "600" },
  riskDetail: {
    marginTop: 10, paddingTop: 10, borderTopWidth: 1,
    borderTopColor: G200, gap: 4,
  },
  riskDetailLine: { fontSize: 11, lineHeight: 16, color: G700 },

  divider: {
    fontSize: 10, fontWeight: "700", color: G400, letterSpacing: 1,
    textAlign: "center", marginVertical: 12,
  },
  accWrap: {
    backgroundColor: WHITE, borderRadius: 10, borderWidth: 1,
    borderColor: G200, marginBottom: 8, overflow: "hidden",
  },
  accHdr: { flexDirection: "row", alignItems: "center", padding: 14, gap: 8 },
  accTitle: { flex: 1, fontSize: 13, fontWeight: "700", color: NAVY },
  ecpBadge: {
    backgroundColor: RED, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6,
  },
  ecpTxt: { fontSize: 9, fontWeight: "700", color: WHITE },
  accBody: {
    padding: 14, paddingTop: 4, borderTopWidth: 1,
    borderTopColor: G100, backgroundColor: G50,
  },
  quadItem: { marginTop: 12 },
  quadLabel: {
    fontSize: 10, fontWeight: "700", color: NAVY_M,
    textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4,
  },

  // Collapsible risk header, legend, and reliability report
  riskHdr: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendWrap: { gap: 6, marginBottom: 10 },
  legendItem: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: G50, borderWidth: 1, borderColor: G200,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendRange: { fontSize: 11, fontWeight: "700", minWidth: 48 },
  legendLbl: { flex: 1, fontSize: 11, color: G700 },
  btBtn: {
    marginTop: 4, paddingVertical: 10, alignItems: "center",
    borderWidth: 1, borderColor: G200, borderRadius: 8, backgroundColor: WHITE,
  },
  btBtnTxt: { fontSize: 12, fontWeight: "700", color: NAVY_M },
  btPanel: {
    marginTop: 10, padding: 12, backgroundColor: G50,
    borderWidth: 1, borderColor: G200, borderRadius: 8,
  },
  btWarn: {
    marginTop: 10, fontSize: 11, lineHeight: 16, color: "#92400e",
    backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a",
    borderRadius: 8, padding: 10,
  },
  btMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  foldRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  foldDot: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  foldDetail: {
    marginTop: 12, padding: 12, backgroundColor: WHITE,
    borderWidth: 1, borderColor: G200, borderRadius: 8,
  },
  actChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  foldRank: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 6, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: G100,
  },
  foldName: { flex: 1, fontSize: 12, fontWeight: "600", color: NAVY_M },
  foldHit: {
    fontSize: 9, fontWeight: "700", color: "#16a34a",
    backgroundColor: "rgba(34,197,94,0.15)", paddingHorizontal: 5,
    paddingVertical: 1, borderRadius: 4,
  },
  foldScore: { fontSize: 12, fontWeight: "700", color: NAVY, minWidth: 24, textAlign: "right" },
});