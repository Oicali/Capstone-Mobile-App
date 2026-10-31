// =============================================================================
// FILE 2 of 2: screens/AIAssessmentScreen.js   (replace the ENTIRE file with this)
// =============================================================================
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { generateAIAssessment, getPhtToday } from "./services/api";
import {
  NAVY,
  NAVY_M,
  RED,
  WHITE,
  G50,
  G100,
  G200,
  G400,
  G600,
  G700,
  G900,
  MIN_RECOMMENDED_DAYS,
  MAX_HISTORY,
  INDEX_CRIMES,
  CRIME_DISPLAY,
  CRIME_PILL_LABEL,
  formatBarangayLabel,
  fmtDate,
  fmtStamp,
  filterSummary,
  filterSig,
  getUserKey,
  loadHistory,
  persistHistory,
  splitSentences,
  parseCrimeFacts,
  parseOverall,
  parseOperations,
  TREND_META,
} from "./aiAssessmentHelpers";

// --- LOCAL CONSTANTS ---------------------------------------------------------
const VIEW_TABS = [
  { key: "brief", label: "Brief", icon: "document-text-outline" },
  { key: "hotspots", label: "Hotspots", icon: "flame-outline" },
  { key: "crimes", label: "Crimes", icon: "list-outline" },
];
const CRIME_TABS = [
  { key: "operations", label: "Operations", icon: "shield-checkmark-outline" },
  { key: "assessment", label: "Assessment", icon: "analytics-outline" },
  { key: "intel", label: "Intel", icon: "eye-outline" },
  { key: "investigation", label: "Investigation", icon: "search-outline" },
  { key: "pcr", label: "PCR", icon: "people-outline" },
];
const STAGES = [
  "Querying blotter records",
  "Scoring barangays",
  "Computing forecasts",
  "Assessing crime types",
  "Finalizing briefing",
];

// Mode compares dateTo against PHT today (string compare works for YYYY-MM-DD)
const getAssessmentMode = (dateTo) => {
  if (!dateTo) return "current";
  const today = getPhtToday().toISOString().slice(0, 10);
  return dateTo < today ? "retrospective" : "current";
};

// --- SMALL PIECES ------------------------------------------------------------
function Chip({ icon, text, color }) {
  if (!text) return null;
  return (
    <View style={s.chip}>
      {!!icon && <Ionicons name={icon} size={11} color={color || G600} />}
      <Text style={[s.chipTxt, color && { color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

// Ring gauge (react-native-svg is already installed)
function Ring({ value, label, color, size = 64 }) {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, parseFloat(value) || 0));
  return (
    <View style={s.ringWrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={stroke}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(c * pct) / 100} ${c}`}
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={s.ringCenter}>
          <Text style={s.ringVal}>{String(value)}%</Text>
        </View>
      </View>
      <Text style={s.ringLbl}>{label}</Text>
    </View>
  );
}

// Sentences as scannable lines instead of a wall of text
function BulletList({ text }) {
  const lines = splitSentences(text);
  if (lines.length === 0)
    return <Text style={s.bodyTxt}>No data available.</Text>;
  return (
    <View>
      {lines.map((l, i) => (
        <View key={i} style={s.bulletRow}>
          <View style={s.bulletDot} />
          <Text style={s.bulletTxt}>{l}</Text>
        </View>
      ))}
    </View>
  );
}

// --- OPERATIONS TIMELINE -----------------------------------------------------
function OperationsPane({ raw }) {
  const ops = useMemo(() => parseOperations(raw), [raw]);
  if (!ops.structured) return <BulletList text={raw} />;

  return (
    <View>
      {!!ops.mission && (
        <View style={s.missionBox}>
          <Text style={s.missionLbl}>MISSION</Text>
          <Text style={s.missionTxt}>{ops.mission}</Text>
        </View>
      )}

      {!!ops.situation && (
        <>
          <Text style={s.opLabel}>SITUATION</Text>
          <Text style={s.bodyTxt}>{ops.situation}</Text>
        </>
      )}
      {!!ops.execution && (
        <>
          <Text style={s.opLabel}>EXECUTION</Text>
          <Text style={s.bodyTxt}>{ops.execution}</Text>
        </>
      )}

      {ops.mustDo.length > 0 && (
        <>
          <Text style={s.opLabel}>MUST DO</Text>
          {ops.mustDo.map((d, i) => {
            const last = i === ops.mustDo.length - 1;
            return (
              <View key={i} style={s.tlRow}>
                <Text style={s.tlTime}>{d.time || "Any time"}</Text>
                <View style={s.tlRail}>
                  <View style={s.tlDot} />
                  {!last && <View style={s.tlLine} />}
                </View>
                <View style={s.tlCard}>
                  <Text style={s.tlAct}>{d.action}</Text>
                  {!!d.place && (
                    <View style={s.tlPlaceRow}>
                      <Ionicons
                        name="location-outline"
                        size={12}
                        color={G600}
                      />
                      <Text style={s.tlPlace}>{d.place}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </>
      )}

      {!!ops.coordinating && (
        <View style={s.coordBox}>
          <Ionicons name="people-outline" size={14} color="#92400e" />
          <Text style={s.coordTxt}>{ops.coordinating}</Text>
        </View>
      )}
      {ops.extra.map((line, i) => (
        <Text key={i} style={[s.bodyTxt, { marginTop: 6 }]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

// --- CRIME DETAIL (full-screen slide-up panel) --------------------------------
function CrimeDetail({ crime, onClose }) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("operations");
  const facts = useMemo(
    () => parseCrimeFacts(crime.crime_assessment),
    [crime.crime_assessment],
  );
  const trend = TREND_META[facts.trend] || TREND_META.unknown;
  const peakText = [facts.day, facts.time].filter(Boolean).join(" ");
  const openCases = useMemo(() => {
    const m = String(crime.investigations || "").match(/(\d+)\s+open cases?/i);
    return m ? m[1] : null;
  }, [crime.investigations]);

  const renderPane = () => {
    if (tab === "operations") return <OperationsPane raw={crime.operations} />;
    if (tab === "assessment")
      return <BulletList text={crime.crime_assessment} />;
    if (tab === "intel") return <BulletList text={crime.intelligence} />;
    if (tab === "investigation") {
      return (
        <View>
          {!!openCases && (
            <View style={s.openBadge}>
              <Text style={s.openNum}>{openCases}</Text>
              <Text style={s.openLbl}>open cases</Text>
            </View>
          )}
          <BulletList text={crime.investigations} />
        </View>
      );
    }
    return <BulletList text={crime.police_community_relations} />;
  };

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={s.mRoot}>
        <View style={[s.mHead, { paddingTop: insets.top + 12 }]}>
          <View style={s.mHeadRow}>
            <TouchableOpacity style={s.backBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={WHITE} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.mTitle} numberOfLines={1}>
                {CRIME_DISPLAY[crime.crime_type] || crime.crime_type}
              </Text>
              <Text style={s.hSub}>EMPO QUAD assessment</Text>
            </View>
            {crime.is_ecp && (
              <View style={s.ecpBadge}>
                <Text style={s.ecpTxt}>ECP</Text>
              </View>
            )}
            <View style={{ alignItems: "flex-end" }}>
              <Text style={s.mCount}>{facts.incidents ?? "-"}</Text>
              <Text style={s.mCountLbl}>INCIDENTS</Text>
            </View>
          </View>
          <View style={s.mChips}>
            <Chip icon={trend.icon} text={trend.label} color={trend.color} />
            <Chip text={facts.cce ? `CCE ${facts.cce}%` : null} />
            <Chip text={facts.cse ? `CSE ${facts.cse}%` : null} />
            <Chip icon="location-outline" text={facts.barangay} />
            <Chip icon="time-outline" text={peakText} />
          </View>
        </View>

        <View style={s.mTabBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.mTabScroll}
          >
            {CRIME_TABS.map((t) => {
              const on = tab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[s.tab, on && s.tabOn]}
                  onPress={() => setTab(t.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={t.icon}
                    size={13}
                    color={on ? WHITE : NAVY_M}
                  />
                  <Text style={[s.tabTxt, on && s.tabTxtOn]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {renderPane()}
        </ScrollView>
      </View>
    </Modal>
  );
}

// --- RISK CARD ---------------------------------------------------------------
function RiskCard({ row, thresholds }) {
  const [open, setOpen] = useState(false);
  const score = row.risk_score ?? 0;
  const color =
    score >= thresholds.priority
      ? "#b91c1c"
      : score >= thresholds.monitor
        ? "#f97316"
        : score >= thresholds.observe
          ? "#eab308"
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
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={14}
          color={G400}
        />
      </View>

      <View style={s.riskBarBg}>
        <View
          style={[
            s.riskBarFill,
            { width: `${Math.min(score, 100)}%`, backgroundColor: color },
          ]}
        />
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
            <Text style={s.bold}>Last incident: </Text>
            {row.last_incident || "N/A"}
          </Text>
          <Text style={s.riskDetailLine}>
            <Text style={s.bold}>Why flagged: </Text>
            {row.why_flagged || "N/A"}
          </Text>
          <Text style={s.riskDetailLine}>
            <Text style={s.bold}>Total incidents: </Text>
            {row.total ?? "N/A"}
            {"   "}
            <Text style={s.bold}>Active weeks: </Text>
            {row.nonzero_weeks ?? "N/A"}
          </Text>
          <Text style={s.riskDetailLine}>
            <Text style={s.bold}>Avg interval: </Text>
            {row.avg_interval_days
              ? `~${Math.round(row.avg_interval_days)}d`
              : "N/A"}
            {"   "}
            <Text style={s.bold}>Model tier: </Text>
            {row.tier ?? "N/A"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// --- RISK LEGEND -------------------------------------------------------------
function RiskLegend({ thresholds }) {
  const items = [
    {
      color: "#b91c1c",
      range: `${thresholds.priority}\u2013100`,
      label: "Priority patrol needed",
    },
    {
      color: "#f97316",
      range: `${thresholds.monitor}\u2013${thresholds.priority - 1}`,
      label: "Closely monitor",
    },
    {
      color: "#eab308",
      range: `${thresholds.observe}\u2013${thresholds.monitor - 1}`,
      label: "Keep under observation",
    },
    {
      color: "#6b7280",
      range: `0\u2013${thresholds.observe - 1}`,
      label: "Routine patrol sufficient",
    },
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

// --- BACKTEST PANEL ----------------------------------------------------------
function BacktestPanel({ backtest }) {
  const [selected, setSelected] = useState(null);

  if (backtest.status === "insufficient") {
    return (
      <Text style={s.btWarn}>
        {"\u26A0"} {backtest.message}
      </Text>
    );
  }

  const verdictColor =
    backtest.model_verdict === "trustworthy"
      ? "#16a34a"
      : backtest.model_verdict === "use with caution"
        ? "#d97706"
        : "#dc2626";

  const fold = selected !== null ? backtest.per_fold?.[selected] : null;
  const top15 = fold?.phase1_top15 || [];
  const actual = fold?.actual_brgy || [];

  return (
    <View style={s.btPanel}>
      <Text style={s.blockTitle}>Backtest Reliability Report</Text>
      <Text style={s.mutedTxt}>
        {backtest.folds} weekly folds {"\u00B7"} Walk-forward validation{" "}
        {"\u00B7"} Verdict:{" "}
        <Text style={{ color: verdictColor, fontWeight: "700" }}>
          {backtest.model_verdict}
        </Text>
      </Text>

      <View style={s.btMetrics}>
        {[
          ["Hit Rate @ Top 5", `${backtest.hit_rate_top5}%`],
          ["Hit Rate @ Top 10", `${backtest.hit_rate_top10}%`],
          ["Hit Rate @ Top 15", `${backtest.hit_rate_top15}%`],
          ["Avg Rank of Actual", backtest.mean_rank ?? "\u2014"],
        ].map(([l, v]) => (
          <View key={l} style={s.statBox}>
            <Text style={s.statVal}>{v}</Text>
            <Text style={s.statLbl}>{l}</Text>
          </View>
        ))}
      </View>

      <Text style={[s.mutedTxt, { marginTop: 10 }]}>
        Per-week result (green = actual crime barangay was in the top 15). Tap a
        week to see its ranking.
      </Text>
      <View style={s.foldRow}>
        {(backtest.per_fold || []).map((f, i) => (
          <TouchableOpacity
            key={i}
            style={[
              s.foldDot,
              {
                backgroundColor: f.hit_top15
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(220,38,38,0.12)",
              },
              { borderColor: f.hit_top15 ? "#16a34a" : "#dc2626" },
              selected === i && { borderWidth: 2 },
            ]}
            onPress={() => setSelected(selected === i ? null : i)}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: f.hit_top15 ? "#16a34a" : "#dc2626",
              }}
            >
              {f.fold}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {fold && (
        <View style={s.foldDetail}>
          <Text style={s.quadLabel}>
            Phase 1 Ranking {"\u2014"} Fold {fold.fold}
          </Text>
          <Text style={s.mutedTxt}>
            Trained on data up to {fold.train_end} {"\u00B7"} Testing{" "}
            {fold.test_week_start} to {fold.test_week_end}
          </Text>

          <Text style={[s.mutedTxt, { marginTop: 8 }]}>
            Actual crime barangays:
          </Text>
          <View style={s.pillRow}>
            {actual.length === 0 ? (
              <Text style={s.mutedTxt}>none recorded</Text>
            ) : (
              actual.map((b, i) => {
                const hit = top15.some((r) => r.barangay === b);
                return (
                  <View
                    key={i}
                    style={[
                      s.actChip,
                      {
                        backgroundColor: hit
                          ? "rgba(34,197,94,0.12)"
                          : "rgba(220,38,38,0.10)",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "700",
                        color: hit ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {formatBarangayLabel(b)} {hit ? "\u2713" : "\u2717"}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {top15.map((r) => {
            const isActual = actual.includes(r.barangay);
            return (
              <View
                key={r.rank}
                style={[
                  s.foldRank,
                  isActual && { backgroundColor: "rgba(34,197,94,0.08)" },
                ]}
              >
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

// --- TAB: HOTSPOTS (risk ranking + reliability report) -------------------------
function HotspotsTab({ forecast }) {
  const [showBacktest, setShowBacktest] = useState(false);
  const rows = forecast?.barangay_risk || [];
  const backtest = forecast?.backtest || null;

  if (rows.length === 0) {
    return (
      <View style={s.card}>
        <View style={s.cardPad}>
          <Text style={s.mutedTxt}>
            Insufficient data to produce barangay risk rankings.
          </Text>
        </View>
      </View>
    );
  }
  const thresholds = forecast.risk_thresholds || {
    priority: 80,
    monitor: 65,
    observe: 45,
  };

  return (
    <View>
      <View style={s.secHead}>
        <Text style={s.secTitle}>Top {rows.length} high-risk barangays</Text>
        <Text style={s.mutedTxt}>
          Structural risk ranking {"\u00B7"} {forecast.total_barangays ?? 0}{" "}
          scored {"\u00B7"} Tap a card for details
        </Text>
      </View>
      <RiskLegend thresholds={thresholds} />
      <Text style={[s.mutedTxt, { marginBottom: 10 }]}>
        Decay window: {forecast.decay_window_used ?? 90} days. Score ranks
        barangays against each other in this period, and the ranges recalculate
        per search. 100 = highest-risk area, not a percentage chance of crime.
      </Text>

      {rows.map((row) => (
        <RiskCard key={row.rank} row={row} thresholds={thresholds} />
      ))}

      {backtest && (
        <>
          <TouchableOpacity
            style={s.btBtn}
            onPress={() => setShowBacktest((v) => !v)}
          >
            <Text style={s.btBtnTxt}>
              {showBacktest ? "\u25BE Hide" : "\u25B8 Show"} Reliability Report
            </Text>
          </TouchableOpacity>
          {showBacktest && <BacktestPanel backtest={backtest} />}
        </>
      )}
    </View>
  );
}

// --- TAB: BRIEF (headline facts + full text on demand) -------------------------
function BriefTab({ assessment }) {
  const [expanded, setExpanded] = useState(false);
  const text = assessment.overall_assessment || "No assessment generated.";
  const f = useMemo(() => parseOverall(text), [text]);

  const tiles = [];
  if (f.peak)
    tiles.push({
      icon: "time-outline",
      label: "Peak activity",
      value: f.peak,
      sub: null,
    });
  if (f.concernName) {
    tiles.push({
      icon: "alert-circle-outline",
      label: "Biggest concern",
      value: f.concernName,
      sub: f.concernCount ? `${f.concernCount} incidents` : null,
    });
  }
  const hasFacts = !!(f.topName || tiles.length);
  const showText = expanded || !hasFacts;

  return (
    <View>
      {!!f.topName && (
        <View style={s.priority}>
          <View style={s.priorityRail} />
          <View style={{ flex: 1 }}>
            <Text style={s.priLbl}>PRIORITY ATTENTION</Text>
            <Text style={s.priName}>{f.topName}</Text>
            <Text style={s.mutedTxt}>
              Barangay needing the most attention this period
            </Text>
          </View>
          {!!f.topScore && (
            <View style={s.priScoreBox}>
              <Text style={s.priScore}>{f.topScore}</Text>
              <Text style={s.priScoreOf}>/100</Text>
            </View>
          )}
        </View>
      )}

      {tiles.length > 0 && (
        <View style={s.tileRow}>
          {tiles.map((t) => (
            <View key={t.label} style={s.tile}>
              <View style={s.tileIcon}>
                <Ionicons name={t.icon} size={15} color={NAVY_M} />
              </View>
              <Text style={s.tileLbl}>{t.label}</Text>
              <Text style={s.tileVal}>{t.value}</Text>
              {!!t.sub && <Text style={s.tileSub}>{t.sub}</Text>}
            </View>
          ))}
        </View>
      )}

      <View style={s.card}>
        <View style={s.cardPad}>
          <Text style={s.blockTitle}>Overall assessment</Text>
          {showText && <BulletList text={text} />}
          {hasFacts && (
            <TouchableOpacity
              style={s.readMore}
              onPress={() => setExpanded((v) => !v)}
            >
              <Text style={s.readMoreTxt}>
                {expanded ? "Hide full text" : "Read full text"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// --- TAB: CRIMES (ranked by volume, tap to open) ------------------------------
function CrimesTab({ crimes, onOpen }) {
  const ranked = useMemo(() => {
    const list = crimes.map((c, i) => ({
      c,
      i,
      f: parseCrimeFacts(c.crime_assessment),
    }));
    list.sort(
      (a, b) => (Number(b.f.incidents) || 0) - (Number(a.f.incidents) || 0),
    );
    return list;
  }, [crimes]);
  const max = Math.max(1, ...ranked.map((r) => Number(r.f.incidents) || 0));

  return (
    <View>
      <View style={s.secHead}>
        <Text style={s.secTitle}>Crimes by volume</Text>
        <Text style={s.mutedTxt}>
          Tap a crime to open its full EMPO QUAD assessment
        </Text>
      </View>
      {ranked.map((r, idx) => {
        const trend = TREND_META[r.f.trend] || TREND_META.unknown;
        const pct = Math.round(((Number(r.f.incidents) || 0) / max) * 100);
        const peakText = [r.f.day, r.f.time].filter(Boolean).join(" ");
        return (
          <TouchableOpacity
            key={r.i}
            style={s.crow}
            onPress={() => onOpen(r.i)}
            activeOpacity={0.85}
          >
            <View style={[s.crail, { backgroundColor: trend.color }]} />
            <Text style={s.crank}>{String(idx + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <View style={s.crowTop}>
                <Text style={s.crowName} numberOfLines={1}>
                  {CRIME_DISPLAY[r.c.crime_type] || r.c.crime_type}
                </Text>
                {r.c.is_ecp && (
                  <View style={s.ecpBadge}>
                    <Text style={s.ecpTxt}>ECP</Text>
                  </View>
                )}
              </View>
              <View style={s.cbarBg}>
                <View style={[s.cbarFill, { width: `${pct}%` }]} />
              </View>
              <View style={s.chipRow}>
                <Chip
                  icon={trend.icon}
                  text={trend.label}
                  color={trend.color}
                />
                <Chip text={r.f.cce ? `CCE ${r.f.cce}%` : null} />
                <Chip text={r.f.cse ? `CSE ${r.f.cse}%` : null} />
                <Chip icon="time-outline" text={peakText} />
              </View>
            </View>
            <Text style={s.ccount}>{r.f.incidents ?? "-"}</Text>
            <Ionicons name="chevron-forward" size={16} color={G400} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// --- HERO (title + headline numbers) ------------------------------------------
function Hero({ assessment, stamp }) {
  const st = assessment.stats;
  return (
    <View style={s.hero}>
      <View style={s.heroBadge}>
        <Text style={s.heroBadgeTxt}>AI OUTPUT</Text>
      </View>
      <Text style={s.heroTitle}>
        {assessment.title || "AI Crime Assessment"}
      </Text>
      {!!stamp && <Text style={s.heroSub}>Generated {stamp}</Text>}
      {st && (
        <View style={s.heroStats}>
          <View style={{ flex: 1 }}>
            <Text style={s.heroBig}>{st.total ?? 0}</Text>
            <Text style={s.heroBigLbl}>TOTAL INCIDENTS</Text>
            <View style={s.heroPill}>
              <Text style={s.heroPillTxt}>
                {st.ui ?? 0} under investigation
              </Text>
            </View>
          </View>
          <Ring value={st.cce ?? "0.0"} label="CCE" color="#4ade80" />
          <Ring value={st.cse ?? "0.0"} label="CSE" color="#fb923c" />
        </View>
      )}
    </View>
  );
}

// --- SAVED BRIEFING ROW -------------------------------------------------------
function SavedRow({ item, matches, onOpen, onDelete }) {
  const total = item.assessment?.stats?.total;
  return (
    <TouchableOpacity style={s.savedRow} onPress={onOpen} activeOpacity={0.85}>
      <View style={s.savedIcon}>
        <Ionicons name="folder-open-outline" size={18} color={NAVY_M} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.savedRange}>
          {fmtDate(item.meta?.dateFrom)} {"\u2014"} {fmtDate(item.meta?.dateTo)}
        </Text>
        <Text style={s.savedSub} numberOfLines={1}>
          {filterSummary(item.meta)}
        </Text>
        <View style={s.chipRow}>
          <Chip text={fmtStamp(item.savedAt)} icon="time-outline" />
          {total !== undefined && total !== null && (
            <Chip text={`${total} incidents`} />
          )}
          {matches && <Chip text="Matches current filters" color="#16a34a" />}
        </View>
      </View>
      <TouchableOpacity
        style={s.delBtn}
        onPress={onDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash-outline" size={17} color={G600} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// --- CONFIRM SHEET (replaces the plain system popups) -------------------------
function ConfirmSheet({ cfg, onClose }) {
  const insets = useSafeAreaInsets();
  if (!cfg) return null;

  const tones = {
    warn: { bg: "#fffbeb", fg: "#d97706", icon: "calendar-outline" },
    danger: { bg: "#fef2f2", fg: "#dc2626", icon: "trash-outline" },
    info: { bg: "rgba(30,58,95,0.1)", fg: NAVY_M, icon: "help-circle-outline" },
  };
  const t = tones[cfg.tone] || tones.info;
  const pct = cfg.meter
    ? Math.max(0, Math.min(100, (cfg.meter.value / cfg.meter.max) * 100))
    : 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.cfRoot}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[s.cfSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.cfGrab} />
          <View style={[s.cfIcon, { backgroundColor: t.bg }]}>
            <Ionicons name={cfg.icon || t.icon} size={24} color={t.fg} />
          </View>
          <Text style={s.cfTitle}>{cfg.title}</Text>
          <Text style={s.cfMsg}>{cfg.message}</Text>

          {!!cfg.meter && (
            <View style={s.cfMeter}>
              <View style={s.cfMeterBg}>
                <View style={[s.cfMeterFill, { width: `${pct}%`, backgroundColor: t.fg }]} />
              </View>
              <View style={s.cfMeterRow}>
                <Text style={[s.cfMeterTxt, { color: t.fg }]}>{cfg.meter.leftLabel}</Text>
                <Text style={s.cfMeterTxt}>{cfg.meter.rightLabel}</Text>
              </View>
            </View>
          )}

          <View style={s.cfBtns}>
            <TouchableOpacity style={s.cfGhost} onPress={onClose} activeOpacity={0.8}>
              <Text style={s.cfGhostTxt}>{cfg.cancelText || "Cancel"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.cfPrimary, { backgroundColor: cfg.tone === "danger" ? RED : NAVY }]}
              activeOpacity={0.85}
              onPress={() => {
                onClose();
                if (cfg.onConfirm) cfg.onConfirm();
              }}
            >
              <Text style={s.cfPrimaryTxt}>{cfg.confirmText || "Confirm"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// --- MAIN SCREEN
export default function AIAssessmentScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const filters = route.params?.filters;

  const [assessment, setAssessment] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [meta, setMeta] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [view, setView] = useState("brief");
  const [selectedCrime, setSelectedCrime] = useState(null);
  const [history, setHistory] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(null);

  const abortRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const userKeyRef = useRef("shared");

  const crimes = useMemo(
    () => (filters?.crimeTypes?.length > 0 ? filters.crimeTypes : INDEX_CRIMES),
    [filters],
  );
  const phases = useMemo(
    () => [
      "Querying blotter records...",
      "Computing Barangay Priority Scores...",
      "Computing forecasts...",
      ...crimes.map((c) => `Assessing ${CRIME_DISPLAY[c] || c}...`),
      "Finalizing assessment...",
    ],
    [crimes],
  );
  const curSig = useMemo(() => filterSig(filters), [filters]);
  const matchSaved = history.some((h) => h.sig === curSig);

  // Load this officer's saved briefings
  useEffect(() => {
    let alive = true;
    (async () => {
      const key = await getUserKey();
      userKeyRef.current = key;
      const list = await loadHistory(key);
      if (alive) setHistory(list);
    })();
    return () => {
      alive = false;
    };
  }, []);

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

  const confirmLeave = () => {
    setConfirm({
      tone: "warn",
      icon: "exit-outline",
      title: "Leave while generating?",
      message:
        "The request will be cancelled on your side, but the server may still finish and count toward the daily AI limit.",
      cancelText: "Stay",
      confirmText: "Leave",
      onConfirm: () => navigation.goBack(),
    });
  };


  const closeResult = () => {
    setAssessment(null);
    setForecast(null);
    setMeta(null);
    setSelectedCrime(null);
  };

  // Android hardware back: confirm while generating, result -> saved list -> leave
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (generating) {
          confirmLeave();
          return true;
        }
        if (assessment) {
          closeResult();
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [generating, assessment]),
  );

  const handleBack = () => {
    if (generating) return confirmLeave();
    if (assessment) return closeResult();
    return navigation.goBack();
  };

  const openEntry = (e) => {
    setAssessment(e.assessment);
    setForecast(e.forecast || null);
    setMeta(e.meta || null);
    setSavedAt(e.savedAt || null);
    setView("brief");
    setSelectedCrime(null);
  };

  const removeSaved = (id) => {
    setConfirm({
      tone: "danger",
      title: "Delete this briefing?",
      message:
        "It will be removed from this phone only. You can generate it again anytime.",
      cancelText: "Keep it",
      confirmText: "Delete",
      onConfirm: () => {
        const next = history.filter((h) => h.id !== id);
        setHistory(next);
        persistHistory(userKeyRef.current, next);
      },
    });
  };

  const clearAll = () => {
    setConfirm({
      tone: "danger",
      title: "Clear all saved briefings?",
      message: `All ${history.length} saved briefings will be removed from this phone only.`,
      cancelText: "Keep them",
      confirmText: "Clear all",
      onConfirm: () => {
        setHistory([]);
        persistHistory(userKeyRef.current, []);
      },
    });
  };


  const run = async () => {
    setPhaseIdx(0);
    clearInterval(phaseTimerRef.current);
    phaseTimerRef.current = setInterval(() => {
      setPhaseIdx((p) => Math.min(p + 1, phases.length - 1));
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

      const entryMeta = {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        barangays: filters.barangays || [],
        crimeTypes: filters.crimeTypes || [],
      };
      const entry = {
        id: String(Date.now()),
        sig: filterSig(entryMeta),
        meta: entryMeta,
        assessment: json.assessment,
        forecast: json.barangay_forecast || null,
        savedAt: new Date().toISOString(),
      };
      const next = [entry, ...history.filter((h) => h.sig !== entry.sig)].slice(
        0,
        MAX_HISTORY,
      );
      setHistory(next);
      persistHistory(userKeyRef.current, next);
      openEntry(entry);
    } catch (err) {
      if (err.aborted) return; // screen is leaving, don't touch state
      const msg = (err.message || "").toLowerCase();
      const isRateLimit =
        err.status === 429 ||
        msg.includes("rate limit") ||
        msg.includes("quota") ||
        msg.includes("limit");
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
      setGenerating(false);
    }
  };

  // Short-range warning, same threshold as web
  const handleGenerate = () => {
    const dayCount = Math.round(
      (new Date(filters.dateTo) - new Date(filters.dateFrom)) / 86400000,
    );
    if (dayCount < MIN_RECOMMENDED_DAYS) {
      setConfirm({
        tone: "warn",
        title: "Short date range",
        message:
          "A longer range gives the forecast more weeks to learn from, so the rankings are more reliable.",
        meter: {
          value: dayCount,
          max: MIN_RECOMMENDED_DAYS,
          leftLabel: `${dayCount} days selected`,
          rightLabel: `${MIN_RECOMMENDED_DAYS} days (34 weeks) recommended`,
        },
        cancelText: "Cancel",
        confirmText: "Generate anyway",
        onConfirm: run,
      });
      return;
    }


    run();
  };

  if (!filters) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={[s.mutedTxt, { padding: 24 }]}>
          No filters were passed to this screen.
        </Text>
      </SafeAreaView>
    );
  }

  const range = meta || filters;
  const stageIdx =
    phaseIdx <= 2 ? phaseIdx : phaseIdx >= phases.length - 1 ? 4 : 3;
  const stamp = assessment ? fmtStamp(assessment.generatedAt || savedAt) : "";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color={WHITE} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hTitle}>AI Assessment</Text>
          <Text style={s.hSub}>
            EMPO QUAD {"\u00B7"} {fmtDate(range.dateFrom)} {"\u2014"}{" "}
            {fmtDate(range.dateTo)}
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: G50 }}
        contentContainerStyle={{
          padding: 12,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* START: generate card + saved briefings layer */}
        {!assessment && !generating && (
          <>
            <View style={s.card}>
              <View style={s.centerBox}>
                <Text style={s.blockTitle}>Generate Assessment</Text>
                <Text style={[s.mutedTxt, { textAlign: "center" }]}>
                  Generates an AI-powered EMPO QUAD assessment based on the
                  filters from your dashboard. Each generation counts toward a
                  daily limit.
                </Text>

                {!!error && (
                  <View style={s.errBox}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={16}
                      color="#dc2626"
                    />
                    <Text style={s.errTxt}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity style={s.genBtn} onPress={handleGenerate}>
                  <Text style={s.genBtnTxt}>
                    {error ? "Try Again" : "Generate Assessment"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {history.length > 0 && (
              <View style={s.savedWrap}>
                <View style={s.savedHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.savedTitle}>
                      SAVED BRIEFINGS ({history.length})
                    </Text>
                    <Text style={s.mutedTxt}>
                      Stored on this phone. Open one without generating again.
                    </Text>
                  </View>
                  <TouchableOpacity onPress={clearAll}>
                    <Text style={s.clearTxt}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                {history.map((h) => (
                  <SavedRow
                    key={h.id}
                    item={h}
                    matches={h.sig === curSig}
                    onOpen={() => openEntry(h)}
                    onDelete={() => removeSaved(h.id)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* GENERATING: stage checklist */}
        {!assessment && generating && (
          <View style={s.card}>
            <View style={s.cardPad}>
              <Text style={s.blockTitle}>Building your briefing</Text>
              {STAGES.map((st, i) => {
                const done = i < stageIdx;
                const active = i === stageIdx;
                return (
                  <View key={st} style={s.stageRow}>
                    <View
                      style={[
                        s.stageDot,
                        done && s.stageDone,
                        active && s.stageActive,
                      ]}
                    >
                      {done ? (
                        <Ionicons name="checkmark" size={12} color={WHITE} />
                      ) : active ? (
                        <ActivityIndicator
                          size="small"
                          color={WHITE}
                          style={{ transform: [{ scale: 0.6 }] }}
                        />
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[s.stageTxt, (done || active) && s.stageTxtOn]}
                      >
                        {st}
                      </Text>
                      {active && i === 3 && !!phases[phaseIdx] && (
                        <Text style={s.mutedTxt}>{phases[phaseIdx]}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
              <Text style={[s.mutedTxt, { marginTop: 8 }]}>
                This can take a minute. Please keep this screen open.
              </Text>
            </View>
          </View>
        )}

        {/* RESULT */}
        {assessment && (
          <>
            <Hero assessment={assessment} stamp={stamp} />

            <View style={s.segTrack}>
              {VIEW_TABS.map((t) => {
                const on = view === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.segTab, on && s.segTabOn]}
                    onPress={() => setView(t.key)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={t.icon}
                      size={14}
                      color={on ? WHITE : G600}
                    />
                    <Text style={[s.segTxt, on && s.segTxtOn]}>{t.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {view === "brief" && <BriefTab assessment={assessment} />}
            {view === "hotspots" &&
              (forecast ? (
                <HotspotsTab forecast={forecast} />
              ) : (
                <View style={s.card}>
                  <View style={s.cardPad}>
                    <Text style={s.mutedTxt}>
                      No hotspot forecast was returned for this briefing.
                    </Text>
                  </View>
                </View>
              ))}
            {view === "crimes" && (
              <CrimesTab
                crimes={assessment.per_crime || []}
                onOpen={setSelectedCrime}
              />
            )}
          </>
        )}
      </ScrollView>

      <ConfirmSheet cfg={confirm} onClose={() => setConfirm(null)} />

      {assessment &&
        selectedCrime !== null &&
        assessment.per_crime?.[selectedCrime] && (
          <CrimeDetail
            key={selectedCrime}
            crime={assessment.per_crime[selectedCrime]}
            onClose={() => setSelectedCrime(null)}
          />
        )}
    </SafeAreaView>
  );
}

// --- STYLES ------------------------------------------------------------------
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  hTitle: { fontSize: 18, fontWeight: "700", color: WHITE },
  hSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  card: {
    backgroundColor: WHITE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: G200,
    marginBottom: 10,
    overflow: "hidden",
  },
  cardPad: { padding: 14 },
  centerBox: { padding: 24, alignItems: "center", gap: 12 },

  blockTitle: { fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: 6 },
  bodyTxt: { fontSize: 13, lineHeight: 20, color: G700 },
  mutedTxt: { fontSize: 11, lineHeight: 16, color: G600 },
  bold: { fontWeight: "700", color: G900 },

  genBtn: {
    backgroundColor: RED,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 6,
  },
  genBtnTxt: { color: WHITE, fontWeight: "700", fontSize: 14 },
  errBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 10,
    alignSelf: "stretch",
  },
  errTxt: { flex: 1, fontSize: 12, color: "#dc2626", lineHeight: 17 },

  // saved briefings layer
  savedWrap: { marginTop: 6 },
  savedHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  savedTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: NAVY_M,
    letterSpacing: 1,
    marginBottom: 2,
  },
  clearTxt: { fontSize: 12, fontWeight: "700", color: RED },
  savedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  savedIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(30,58,95,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  savedRange: { fontSize: 13, fontWeight: "700", color: NAVY },
  savedSub: { fontSize: 11, color: G600, marginTop: 1 },
  delBtn: { padding: 6 },

  // generating stages
  stageRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  stageDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: G100,
    alignItems: "center",
    justifyContent: "center",
  },
  stageDone: { backgroundColor: "#16a34a" },
  stageActive: { backgroundColor: NAVY },
  stageTxt: { fontSize: 13, fontWeight: "600", color: G400 },
  stageTxtOn: { color: NAVY },

  // hero
  hero: {
    backgroundColor: NAVY,
    borderRadius: 14,
    padding: 16,
    borderTopWidth: 3,
    borderTopColor: RED,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroBadgeTxt: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.8)",
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: WHITE,
    marginTop: 10,
    lineHeight: 23,
  },
  heroSub: { fontSize: 11, color: "rgba(255,255,255,0.55)", marginTop: 4 },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  heroBig: { fontSize: 40, fontWeight: "700", color: WHITE, lineHeight: 44 },
  heroBigLbl: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
  },
  heroPill: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: "rgba(193,39,45,0.25)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroPillTxt: { fontSize: 10, fontWeight: "700", color: "#fca5a5" },
  ringWrap: { alignItems: "center", gap: 4 },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  ringVal: { fontSize: 11, fontWeight: "700", color: WHITE },
  ringLbl: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.5,
  },

  // segmented control
  segTrack: {
    flexDirection: "row",
    backgroundColor: G100,
    borderRadius: 12,
    padding: 4,
    marginTop: 12,
    marginBottom: 12,
  },
  segTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segTabOn: { backgroundColor: NAVY },
  segTxt: { fontSize: 12, fontWeight: "700", color: G600 },
  segTxtOn: { color: WHITE },

  secHead: { marginBottom: 10, paddingHorizontal: 2 },
  secTitle: { fontSize: 15, fontWeight: "700", color: NAVY, marginBottom: 2 },

  // brief tab
  priority: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 12,
    padding: 14,
    paddingLeft: 18,
    marginBottom: 10,
    overflow: "hidden",
  },
  priorityRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    backgroundColor: RED,
  },
  priLbl: { fontSize: 10, fontWeight: "700", color: RED, letterSpacing: 1 },
  priName: { fontSize: 18, fontWeight: "700", color: NAVY, marginVertical: 2 },
  priScoreBox: { flexDirection: "row", alignItems: "baseline" },
  priScore: { fontSize: 30, fontWeight: "700", color: RED },
  priScoreOf: { fontSize: 11, fontWeight: "700", color: G400 },
  tileRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  tile: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: G200,
    padding: 12,
  },
  tileIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(30,58,95,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  tileLbl: {
    fontSize: 10,
    fontWeight: "700",
    color: G600,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tileVal: {
    fontSize: 13,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
    lineHeight: 18,
  },
  tileSub: { fontSize: 11, fontWeight: "700", color: RED, marginTop: 2 },
  readMore: { marginTop: 10, alignSelf: "flex-start", paddingVertical: 4 },
  readMoreTxt: { fontSize: 12, fontWeight: "700", color: NAVY_M },

  bulletRow: { flexDirection: "row", gap: 10, marginBottom: 9 },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RED,
    marginTop: 7,
  },
  bulletTxt: { flex: 1, fontSize: 13, lineHeight: 20, color: G700 },

  // crimes tab
  crow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: WHITE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: G200,
    marginBottom: 8,
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 16,
    overflow: "hidden",
  },
  crail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  crank: { fontSize: 11, fontWeight: "700", color: G400, width: 18 },
  crowTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  crowName: { flexShrink: 1, fontSize: 14, fontWeight: "700", color: NAVY },
  cbarBg: {
    height: 4,
    backgroundColor: G100,
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
  },
  cbarFill: { height: "100%", backgroundColor: NAVY_M, borderRadius: 2 },
  ccount: {
    fontSize: 22,
    fontWeight: "700",
    color: NAVY,
    minWidth: 28,
    textAlign: "right",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: G50,
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: "100%",
  },
  chipTxt: { fontSize: 10, fontWeight: "600", color: G700, flexShrink: 1 },
  ecpBadge: {
    backgroundColor: RED,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ecpTxt: { fontSize: 9, fontWeight: "700", color: WHITE },

  // crime detail modal
  mRoot: { flex: 1, backgroundColor: G50 },
  mHead: { backgroundColor: NAVY, paddingHorizontal: 16, paddingBottom: 14 },
  mHeadRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  mTitle: { fontSize: 18, fontWeight: "700", color: WHITE },
  mCount: { fontSize: 28, fontWeight: "700", color: WHITE, lineHeight: 30 },
  mCountLbl: {
    fontSize: 8,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
  },
  mChips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  mTabBar: {
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: G200,
  },
  mTabScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: G200,
    backgroundColor: WHITE,
  },
  tabOn: { backgroundColor: NAVY, borderColor: NAVY },
  tabTxt: { fontSize: 12, fontWeight: "700", color: NAVY_M },
  tabTxtOn: { color: WHITE },

  // operations timeline
  opLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: NAVY_M,
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 16,
  },
  missionBox: { backgroundColor: NAVY, borderRadius: 10, padding: 12 },
  missionLbl: {
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
  },
  missionTxt: {
    fontSize: 14,
    fontWeight: "600",
    color: WHITE,
    lineHeight: 20,
    marginTop: 3,
  },
  tlRow: { flexDirection: "row", marginTop: 4 },
  tlTime: {
    width: 74,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "700",
    color: NAVY,
    paddingTop: 10,
    paddingRight: 6,
  },
  tlRail: { width: 18, alignItems: "center" },
  tlDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: RED,
    marginTop: 11,
    borderWidth: 2,
    borderColor: WHITE,
  },
  tlLine: { flex: 1, width: 2, backgroundColor: G200, marginTop: 2 },
  tlCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    marginLeft: 4,
  },
  tlAct: { fontSize: 13, fontWeight: "600", color: G900, lineHeight: 18 },
  tlPlaceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  tlPlace: { fontSize: 11, color: G600, flexShrink: 1 },
  coordBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  coordTxt: { flex: 1, fontSize: 12, lineHeight: 17, color: "#92400e" },
  openBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  openNum: { fontSize: 22, fontWeight: "700", color: RED },
  openLbl: { fontSize: 11, fontWeight: "600", color: G600 },

  // hotspots tab (risk cards, legend, backtest)
  statBox: {
    width: "48%",
    backgroundColor: G50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: G200,
    padding: 10,
    alignItems: "center",
  },
  statVal: { fontSize: 18, fontWeight: "700", color: NAVY },
  statLbl: { fontSize: 10, color: G600, fontWeight: "600", marginTop: 2 },
  riskCard: {
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  riskTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  riskRank: { width: 20, fontSize: 11, fontWeight: "700", color: G400 },
  riskName: { flex: 1, fontSize: 13, fontWeight: "700", color: NAVY_M },
  riskScore: { fontSize: 15, fontWeight: "700" },
  riskBarBg: {
    height: 5,
    backgroundColor: G100,
    borderRadius: 3,
    marginTop: 8,
    overflow: "hidden",
  },
  riskBarFill: { height: "100%", borderRadius: 3 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  crimePill: {
    backgroundColor: NAVY_M,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  crimePillTxt: { fontSize: 10, color: WHITE, fontWeight: "600" },
  riskDetail: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: G200,
    gap: 4,
  },
  riskDetailLine: { fontSize: 11, lineHeight: 16, color: G700 },
  quadLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: NAVY_M,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  legendWrap: { gap: 6, marginBottom: 10 },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendRange: { fontSize: 11, fontWeight: "700", minWidth: 48 },
  legendLbl: { flex: 1, fontSize: 11, color: G700 },
  btBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 8,
    backgroundColor: WHITE,
  },
  btBtnTxt: { fontSize: 12, fontWeight: "700", color: NAVY_M },
  btPanel: {
    marginTop: 10,
    padding: 12,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 8,
  },
  btWarn: {
    marginTop: 10,
    fontSize: 11,
    lineHeight: 16,
    color: "#92400e",
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 10,
  },
  btMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  foldRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  foldDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  foldDetail: {
    marginTop: 12,
    padding: 12,
    backgroundColor: G50,
    borderWidth: 1,
    borderColor: G200,
    borderRadius: 8,
  },
  actChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  foldRank: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: G100,
  },
  foldName: { flex: 1, fontSize: 12, fontWeight: "600", color: NAVY_M },
  foldHit: {
    fontSize: 9,
    fontWeight: "700",
    color: "#16a34a",
    backgroundColor: "rgba(34,197,94,0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  foldScore: {
    fontSize: 12,
    fontWeight: "700",
    color: NAVY,
    minWidth: 24,
    textAlign: "right",
  },
  // confirm sheet
  cfRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10,22,40,0.55)",
  },
  cfSheet: {
    backgroundColor: WHITE,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    alignItems: "center",
  },
  cfGrab: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: G200,
    marginBottom: 16,
  },
  cfIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cfTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
  },
  cfMsg: {
    fontSize: 13,
    lineHeight: 20,
    color: G600,
    textAlign: "center",
    marginTop: 6,
  },
  cfMeter: { alignSelf: "stretch", marginTop: 16 },
  cfMeterBg: {
    height: 8,
    backgroundColor: G100,
    borderRadius: 4,
    overflow: "hidden",
  },
  cfMeterFill: { height: "100%", borderRadius: 4 },
  cfMeterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 8,
  },
  cfMeterTxt: { fontSize: 11, fontWeight: "700", color: G600, flexShrink: 1 },
  cfBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    alignSelf: "stretch",
  },
  cfGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: G200,
    backgroundColor: WHITE,
  },
  cfGhostTxt: { fontSize: 14, fontWeight: "700", color: NAVY_M },
  cfPrimary: {
    flex: 1.3,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cfPrimaryTxt: { fontSize: 14, fontWeight: "700", color: WHITE },
});
