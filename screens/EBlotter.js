// screens/EBlotter.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  RefreshControl,
  StatusBar,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Mapbox from "@rnmapbox/maps";
import { Asset } from "expo-asset";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

import {
  C,
  API,
  PAGE_SIZE,
  NCR_CODE,
  BLANK_F,
  CRIME_MAP,
  BRGY_MAP,
  mkC,
  mkS,
  mkO,
  mkCase,
  _formErrRef,
} from "./eblotter/constants";
import { usePSGC } from "./eblotter/FormShared";
import {
  BlotterCard,
  ListHeader,
  EmptyState,
  FilterBar,
  CountBar,
  Pagination,
} from "./eblotter/ListUI";
import {
  FormHeader,
  StepBar,
  FormFooter,
  SavingOverlay,
  GpsPrompt,
  Step1,
  Step2,
  Step3,
} from "./eblotter/FormSteps";
import ViewContent from "./eblotter/ViewContent";
import {
  ConfirmModal,
  ViewReferralModal,
  RemindPatrolModal,
  SuccessModal,
  Lightbox,
  TrashModal,
} from "./eblotter/Dialogs";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

export default function EBlotterScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { regions, loadingR, getProvinces, getCities, getBarangays } =
    usePSGC();

  const [allData, setAllData] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRef] = useState(false);
  const [filters, setFilters] = useState(BLANK_F);
  const [tempF, setTempF] = useState(BLANK_F);

  const [activeReportTab, setActiveReportTab] = useState("reports");

  const [confirm, setConfirm] = useState({
    visible: false,
    title: "",
    message: "",
    confirmText: "",
    confirmColor: C.red,
    onConfirm: null,
  });
  const showConfirm = (title, message, confirmText, confirmColor, onConfirm) =>
    setConfirm({
      visible: true,
      title,
      message,
      confirmText,
      confirmColor,
      onConfirm,
    });
  const hideConfirm = () => setConfirm((p) => ({ ...p, visible: false }));

  const [modal, setModal] = useState(false);
  const [step, setStep] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [acceptMode, setAcceptMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [auditSummary, setAuditSummary] = useState(null);
  const [mLoad, setMLoad] = useState(false);
  const [isImportedRecord, setIsImportedRecord] = useState(false);

  const [comp, setComp] = useState([mkC()]);
  const [susp, setSusp] = useState([mkS()]);
  const [hasSuspect, setHasSuspect] = useState(false);
  const [offs, setOffs] = useState([mkO(true)]);
  const [caseD, setCaseD] = useState(mkCase());
  const [topPl, setTopPl] = useState("");
  const [modus, setModus] = useState({});
  const [selM, setSelM] = useState({});
  const [formErr, setFormErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [activePick, setActivePick] = useState(null);

  const [userRole, setUserRole] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("auth_token");
        if (token) {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setUserRole(payload.role);
          setCurrentUserId(payload.user_id);
        }
      } catch {}
    })();
  }, []);

  const [referredCount, setReferredCount] = useState(0);
  const [modalAttachments, setModalAttachments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [streetSuggestions, setStreetSuggestions] = useState([]);
  const [showStreetModal, setShowStreetModal] = useState(false);
  const [streetQuery, setStreetQuery] = useState("");
  const [showGpsForPin, setShowGpsForPin] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState([]);
  const [successModal, setSuccessModal] = useState({
    show: false,
    reportId: "",
    message: "",
  });

  const [viewReferralData, setViewReferralData] = useState(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [remindTarget, setRemindTarget] = useState(null);

  // Wire formErr into the shared ref so inputs can clear their own errors.
  useEffect(() => {
    _formErrRef.current = formErr;
    _formErrRef.setter = setFormErr;
  }, [formErr]);

  const scrollRef = useRef(null);
  const [geoJSON, setGeoJSON] = useState(null);

  const [cPr, setCPr] = useState({});
  const [cCi, setCCi] = useState({});
  const [cBr, setCBr] = useState({});
  const [cLP, setCLP] = useState({});
  const [cLC, setCLC] = useState({});
  const [cLB, setCLB] = useState({});
  const [sPr, setSPr] = useState({});
  const [sCi, setSCi] = useState({});
  const [sBr, setSBr] = useState({});
  const [sLP, setSLP] = useState({});
  const [sLC, setSLC] = useState({});
  const [sLB, setSLB] = useState({});

  const [trashModal, setTrashModal] = useState(false);
  const [trashList, setTrashList] = useState([]);
  const [trashLoad, setTrashLoad] = useState(false);
  const [trashPage, setTrashPage] = useState(1);

  const listRef = useRef(null);
  const fabScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(fabScale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  }, []);
  const pressIn = () =>
    Animated.spring(fabScale, { toValue: 0.9, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(fabScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  const STEPS = 3;
  const paged = allData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFC = [
    filters.status,
    filters.incident_type,
    filters.barangay,
    filters.date_from,
    filters.date_to,
    filters.data_source,
  ].filter((v) => v && v !== "").length;

  // Load GeoJSON once
  useEffect(() => {
    (async () => {
      try {
        const asset = Asset.fromModule(
          require("../assets/bacoor_barangays.geojson"),
        );
        await asset.downloadAsync();
        const data = await (await fetch(asset.localUri)).json();
        setGeoJSON(data);
      } catch (err) {
        console.warn("[EBlotter] GeoJSON load error:", err.message);
      }
    })();
  }, []);

  /* ── Updaters (kept above everything that uses them) ──────────────────── */
  const uC = useCallback(
    (i, f, v) =>
      setComp((prev) => {
        const a = [...prev];
        a[i] = { ...a[i], [f]: v };
        return a;
      }),
    [],
  );
  const uS = useCallback(
    (i, f, v) =>
      setSusp((prev) => {
        const a = [...prev];
        a[i] = { ...a[i], [f]: v };
        return a;
      }),
    [],
  );
  const uO = useCallback(
    (i, f, v) =>
      setOffs((prev) => {
        const a = [...prev];
        a[i] = { ...a[i], [f]: v };
        return a;
      }),
    [],
  );
  const uCase = useCallback(
    (f, v) => setCaseD((prev) => ({ ...prev, [f]: v })),
    [],
  );

  /* ── API ──────────────────────────────────────────────────────────────── */
  const api = useCallback(async (url, method = "GET", body = null) => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const opts = {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API}${url}`, opts);
      if (res.status === 401) {
        showConfirm(
          "Session Expired",
          "Please log in again.",
          "OK",
          C.navyMid,
          async () => {
            await AsyncStorage.clear();
            hideConfirm();
          },
        );
        return null;
      }
      return await res.json();
    } catch (e) {
      return null;
    }
  }, []);

  /* ── Load ─────────────────────────────────────────────────────────────── */
  const load = useCallback(
    async (f, tab) => {
      const currentTab = tab !== undefined ? tab : activeReportTab;
      setLoading(true);
      try {
        const p = new URLSearchParams();
        if (f.search) p.append("search", f.search);
        if (f.status) p.append("status", f.status);
        if (f.barangay) p.append("barangay", f.barangay);
        if (f.date_from) {
          const d = f.date_from;
          p.append(
            "date_from",
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          );
        }
        if (f.date_to) {
          const d = f.date_to;
          p.append(
            "date_to",
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
          );
        }

        if (currentTab === "referred") {
          p.append("referred", "true");
        } else if (f.data_source !== "brgy_referral") {
          p.append("referred", "false");
        }

        const data = await api(`/blotters?${p.toString()}`);
        if (data?.success) {
          let results = data.data || [];
          if (f.incident_type)
            results = results.filter(
              (b) =>
                b.incident_type.toLowerCase() === f.incident_type.toLowerCase(),
            );
          if (f.data_source === "brgy_referral")
            results = results.filter((b) =>
              (b.blotter_entry_number || "").toUpperCase().startsWith("BRGY"),
            );
          else if (f.data_source === "bantay_import")
            results = results.filter((b) =>
              (b.blotter_entry_number || "").toUpperCase().startsWith("BLT"),
            );
          else if (f.data_source === "manual")
            results = results.filter((b) =>
              /^\d{4}/.test(b.blotter_entry_number || ""),
            );
          setAllData(results);
          setPage(1);
        } else if (data) {
          setAllData([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [api, activeReportTab],
  );

  useEffect(() => {
    load(BLANK_F, activeReportTab);
  }, [activeReportTab]);
  useEffect(() => {
    load(BLANK_F, "reports");
  }, []);

  // Poll referred count every 30s
  useEffect(() => {
    const fetchCount = async () => {
      const data = await api("/blotters/referred/count");
      if (data?.success) setReferredCount(data.count);
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [api]);

  const fmt = useCallback((d) => {
    if (!d) return "N/A";
    const cleaned = String(d)
      .replace("Z", "")
      .replace(/\+\d{2}:\d{2}$/, "");
    const dt = new Date(cleaned + "+08:00");
    if (isNaN(dt)) return String(d);
    const pad = (n) => String(n).padStart(2, "0");
    let h = dt.getHours();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${h}:${pad(dt.getMinutes())} ${ap}`;
  }, []);

  /* ── Reset ────────────────────────────────────────────────────────────── */
  const reset = () => {
    setComp([mkC()]);
    setSusp([mkS()]);
    setHasSuspect(false);
    setOffs([mkO(true)]);
    setCaseD(mkCase());
    setTopPl("");
    setModus({});
    setSelM({});
    setFormErr({});
    setStep(1);
    setEditMode(false);
    setViewMode(false);
    setAcceptMode(false);
    setEditId(null);
    setViewData(null);
    setAuditSummary(null);
    setMLoad(false);
    setIsImportedRecord(false);
    setCPr({});
    setCCi({});
    setCBr({});
    setCLP({});
    setCLC({});
    setCLB({});
    setSPr({});
    setSCi({});
    setSBr({});
    setSLP({});
    setSLC({});
    setSLB({});
    setActivePick(null);
    setModalAttachments([]);
    setPendingFiles([]);
    setLightboxImage(null);
    setPendingDeletes([]);
  };
  const closeModal = () => {
    setModal(false);
    reset();
  };
  const closeSuccessModal = () => {
    setSuccessModal({ show: false, reportId: "", message: "" });
  };
  const askClose = () => {
    if (viewMode) {
      closeModal();
      return;
    }
    showConfirm(
      "Close Form",
      "Unsaved data will be lost. Are you sure?",
      "Close",
      C.red,
      () => {
        hideConfirm();
        closeModal();
      },
    );
  };

  /* ── Attachments ──────────────────────────────────────────────────────── */
  const fetchAttachments = useCallback(
    async (id) => {
      const data = await api(`/blotters/${id}/attachments`);
      if (data?.success) setModalAttachments(data.data || []);
      else setModalAttachments([]);
    },
    [api],
  );

  const uploadAttachment = useCallback(async (id, file) => {
    try {
      const token = await AsyncStorage.getItem("auth_token");
      const formData = new FormData();
      const isVideo = file.isVideo || file.mimeType?.startsWith("video/");
      const ext = (file.uri || file.fileName || "")
        .split(".")
        .pop()
        ?.toLowerCase();
      let resolvedType = file.mimeType;
      if (isVideo) {
        if (ext === "mov") resolvedType = "video/quicktime";
        else if (ext === "webm") resolvedType = "video/webm";
        else resolvedType = "video/mp4";
      } else if (!resolvedType) {
        resolvedType = "image/jpeg";
      }
      formData.append("file", {
        uri: file.uri,
        type: resolvedType,
        name:
          file.fileName ||
          (isVideo
            ? `video_${Date.now()}.${ext === "mov" ? "mov" : "mp4"}`
            : `photo_${Date.now()}.jpg`),
      });
      const res = await fetch(`${API}/blotters/${id}/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (!json.success) {
        console.error("Upload failed:", json.message);
        showConfirm(
          "Upload Failed",
          json.message || "Could not upload file.",
          "OK",
          C.navyMid,
          hideConfirm,
        );
      }
      return json;
    } catch (e) {
      console.error("uploadAttachment error:", e.message);
      showConfirm(
        "Upload Error",
        "Network error while uploading. Check your connection.",
        "OK",
        C.navyMid,
        hideConfirm,
      );
      return null;
    }
  }, []);

  const deleteAttachment = useCallback(
    async (blotterId, attachmentId) => {
      const data = await api(
        `/blotters/${blotterId}/attachments/${attachmentId}`,
        "DELETE",
      );
      return data?.success;
    },
    [api],
  );

  /* ── Modus ────────────────────────────────────────────────────────────── */
  const loadModus = useCallback(
    async (name, idx) => {
      const ct = CRIME_MAP[name];
      if (!ct) {
        setModus((p) => ({ ...p, [idx]: [] }));
        setSelM((p) => ({ ...p, [idx]: [] }));
        return;
      }
      const data = await api(`/blotters/modus/${encodeURIComponent(ct)}`);
      if (data?.success) {
        setModus((p) => ({ ...p, [idx]: data.data }));
        setSelM((p) => ({ ...p, [idx]: [] }));
      }
    },
    [api],
  );

  /* ── View ─────────────────────────────────────────────────────────────── */
  const handleView = useCallback(
    async (id) => {
      setModal(true);
      setViewMode(true);
      setMLoad(true);
      const data = await api(`/blotters/${id}`);
      if (!data?.success) {
        closeModal();
        return;
      }
      setViewData(data.data);
      setMLoad(false);
      fetchAttachments(id);
      api(`/blotters/${id}/audit-summary`).then((au) => {
        setAuditSummary(au?.success ? au.data : null);
      });
    },
    [api],
  );

  /* ── Deep-links ───────────────────────────────────────────────────────── */
  useEffect(() => {
    const openId = route?.params?.openBlotterId;
    if (openId) {
      handleView(openId);
      navigation.setParams({ openBlotterId: undefined });
    }
  }, [route?.params?.openBlotterId]);

  useEffect(() => {
    const initialTab = route?.params?.initialReportTab;
    if (initialTab) {
      setActiveReportTab(initialTab);
      navigation.setParams({ initialReportTab: undefined });
    }
  }, [route?.params?.initialReportTab]);

  /* ── Edit ─────────────────────────────────────────────────────────────── */
  const handleEdit = useCallback(
    async (id) => {
      setModal(true);
      setMLoad(true);
      const data = await api(`/blotters/${id}`);
      if (!data?.success) {
        closeModal();
        return;
      }
      const dd = data.data;

      const hasNoPsgc = (dd.complainants || []).every(
        (c) =>
          !c.region_code &&
          !c.province_code &&
          !c.municipality_code &&
          (c.region ||
            c.district_province ||
            c.city_municipality ||
            c.barangay),
      );

      setIsImportedRecord(hasNoPsgc);
      setComp(dd.complainants?.length ? dd.complainants : [mkC()]);
      const hasSusp = (dd.suspects || []).length > 0;
      setHasSuspect(hasSusp);
      setSusp(hasSusp ? dd.suspects : [mkS()]);
      setOffs(
        dd.offenses?.length
          ? dd.offenses.map((o) => ({
              is_principal_offense: o.is_principal_offense,
              offense_name: o.offense_name,
              stage_of_felony: o.stage_of_felony,
              index_type: o.index_type || "Non-Index",
            }))
          : [mkO(true)],
      );
      setTopPl(dd.type_of_place || "");

      const resolvedBrgy =
        BRGY_MAP[(dd.place_barangay || "").toUpperCase()] ||
        dd.place_barangay ||
        "";
      setCaseD({
        incident_type: dd.incident_type || "",
        cop: dd.cop || "",
        date_time_commission: dd.date_time_commission || "",
        date_time_reported: dd.date_time_reported || "",
        place_region: "Region IV-A (CALABARZON)",
        place_district_province: "Cavite",
        place_city_municipality: "Bacoor City",
        place_barangay: resolvedBrgy,
        place_street: dd.place_street || "",
        is_private_place: dd.is_private_place || "",
        narrative: dd.narrative || "",
        amount_involved: dd.amount_involved || "",
        referred_by_barangay: dd.referred_by_barangay || false,
        referred_to_barangay: dd.referred_to_barangay || "",
        referred_by_dilg: dd.referred_by_dilg || false,
        lat: dd.lat != null ? String(dd.lat) : "",
        lng: dd.lng != null ? String(dd.lng) : "",
      });

      setEditMode(true);
      setEditId(id);
      setMLoad(false);
      fetchAttachments(id);

      if (!hasNoPsgc) {
        const nCP = {},
          nCC = {},
          nCB = {};
        for (let i = 0; i < (dd.complainants || []).length; i++) {
          const c = dd.complainants[i];
          if (c.region_code) {
            nCP[i] = await getProvinces(c.region_code);
            if (c.province_code) {
              nCC[i] = await getCities(c.province_code);
              if (c.municipality_code) {
                nCB[i] = await getBarangays(c.municipality_code);
              }
            } else if (c.region_code === NCR_CODE) {
              nCC[i] = await getCities(NCR_CODE);
            }
          }
        }
        setCPr(nCP);
        setCCi(nCC);
        setCBr(nCB);

        const nSP = {},
          nSC = {},
          nSB = {};
        for (let i = 0; i < (dd.suspects || []).length; i++) {
          const s = dd.suspects[i];
          if (s.region_code) {
            nSP[i] = await getProvinces(s.region_code);
            if (s.province_code) {
              nSC[i] = await getCities(s.province_code);
              if (s.municipality_code) {
                nSB[i] = await getBarangays(s.municipality_code);
              }
            } else if (s.region_code === NCR_CODE) {
              nSC[i] = await getCities(NCR_CODE);
            }
          }
        }
        setSPr(nSP);
        setSCi(nSC);
        setSBr(nSB);
      }

      const nM = {},
        nSel = {};
      for (let i = 0; i < (dd.offenses || []).length; i++) {
        const offense = dd.offenses[i];
        const ct = CRIME_MAP[offense.offense_name];
        if (ct) {
          const md = await api(`/blotters/modus/${encodeURIComponent(ct)}`);
          if (md?.success) {
            nM[i] = md.data;
            const firstModus = (dd.modus_refs || [])[0];
            nSel[i] = firstModus ? [firstModus.modus_reference_id] : [];
          } else {
            nM[i] = [];
            nSel[i] = [];
          }
        } else {
          nM[i] = [];
          nSel[i] = [];
        }
      }
      setModus(nM);
      setSelM(nSel);
    },
    [api, getProvinces, getCities, getBarangays],
  );

  /* ── Accept Referral ──────────────────────────────────────────────────── */
  const handleAcceptReferral = useCallback(
    async (id) => {
      setModal(true);
      setMLoad(true);
      setAcceptMode(true);
      const data = await api(`/blotters/${id}`);
      if (!data?.success) {
        closeModal();
        return;
      }
      const dd = data.data;

      const hasNoPsgc = (dd.complainants || []).every(
        (c) =>
          !c.region_code &&
          !c.province_code &&
          !c.municipality_code &&
          (c.region ||
            c.district_province ||
            c.city_municipality ||
            c.barangay),
      );
      setIsImportedRecord(hasNoPsgc);
      setComp(dd.complainants?.length ? dd.complainants : [mkC()]);
      const hasSusp = (dd.suspects || []).length > 0;
      setHasSuspect(hasSusp);
      setSusp(hasSusp ? dd.suspects : [mkS()]);
      const VALID_STAGES = ["CONSUMMATED", "ATTEMPTED", "FRUSTRATED"];
      setOffs(
        dd.offenses?.length
          ? dd.offenses.map((o) => {
              const raw = (o.stage_of_felony || "").toUpperCase();
              const normalized =
                raw === "COMPLETED" ? "CONSUMMATED" : o.stage_of_felony || "";
              return {
                is_principal_offense: o.is_principal_offense,
                offense_name: o.offense_name,
                stage_of_felony: VALID_STAGES.includes(normalized)
                  ? normalized
                  : "",
                index_type: o.index_type || "Non-Index",
              };
            })
          : [mkO(true)],
      );
      setTopPl(dd.type_of_place || "");
      const resolvedBrgy =
        BRGY_MAP[(dd.place_barangay || "").toUpperCase()] ||
        dd.place_barangay ||
        "";
      setCaseD({
        incident_type: dd.incident_type || "",
        cop: dd.cop || "",
        date_time_commission: dd.date_time_commission || "",
        date_time_reported: dd.date_time_reported || "",
        place_region: "Region IV-A (CALABARZON)",
        place_district_province: "Cavite",
        place_city_municipality: "Bacoor City",
        place_barangay: resolvedBrgy,
        place_street: dd.place_street || "",
        is_private_place: dd.is_private_place || "",
        narrative: dd.narrative || "",
        amount_involved: dd.amount_involved || "",
        referred_by_barangay: dd.referred_by_barangay || false,
        referred_to_barangay: dd.referred_to_barangay || "",
        referred_by_dilg: dd.referred_by_dilg || false,
        lat: dd.lat != null ? String(dd.lat) : "",
        lng: dd.lng != null ? String(dd.lng) : "",
      });

      const nCP = {},
        nCC = {},
        nCB = {};
      await Promise.all(
        (dd.complainants || []).map(async (c, i) => {
          if (!c.region_code) return;
          nCP[i] = await getProvinces(c.region_code);
          if (c.province_code) {
            nCC[i] = await getCities(c.province_code);
            if (c.municipality_code)
              nCB[i] = await getBarangays(c.municipality_code);
          } else if (c.region_code === NCR_CODE) {
            nCC[i] = await getCities(NCR_CODE);
          }
        }),
      );
      setCPr(nCP);
      setCCi(nCC);
      setCBr(nCB);
      const nM = {},
        nSel = {};
      await Promise.all(
        (dd.offenses || []).map(async (offense, i) => {
          const ct = CRIME_MAP[offense.offense_name];
          if (ct) {
            const md = await api(`/blotters/modus/${encodeURIComponent(ct)}`);
            if (md?.success) {
              nM[i] = md.data;
              const firstModus = (dd.modus_refs || [])[0];
              nSel[i] = firstModus ? [firstModus.modus_reference_id] : [];
            } else {
              nM[i] = [];
              nSel[i] = [];
            }
          } else {
            nM[i] = [];
            nSel[i] = [];
          }
        }),
      );
      setModus(nM);
      setSelM(nSel);
      setEditId(id);
      setMLoad(false);
      fetchAttachments(id);
    },
    [api, getProvinces, getCities, getBarangays],
  );

  const handleRespond = useCallback(
    async (id) => {
      const data = await api(`/blotters/${id}/respond`, "PATCH");
      if (data?.success) {
        load(filters, activeReportTab);
      } else {
        showConfirm(
          "Error",
          data?.message || "Could not respond to referral.",
          "OK",
          C.navyMid,
          hideConfirm,
        );
      }
    },
    [api, load, filters, activeReportTab],
  );

  /* ── Delete ───────────────────────────────────────────────────────────── */
  const handleDelete = useCallback(
    (id) => {
      showConfirm(
        "Delete Record",
        "Move this crime record to Deleted Records?",
        "Delete",
        C.red,
        async () => {
          hideConfirm();
          const data = await api(`/blotters/${id}`, "DELETE");
          if (data?.success) {
            load(filters, activeReportTab);
            const countData = await api("/blotters/referred/count");
            if (countData?.success) setReferredCount(countData.count);
          } else {
            showConfirm(
              "Error",
              data?.message || data?.error || "Delete failed.",
              "OK",
              C.navyMid,
              hideConfirm,
            );
          }
        },
      );
    },
    [api, load, filters, activeReportTab],
  );

  /* ── Trash / Restore ──────────────────────────────────────────────────── */
  const loadTrash = async () => {
    setTrashLoad(true);
    const data = await api("/blotters/deleted/all");
    if (data?.success) {
      setTrashList(data.data || []);
      setTrashPage(1);
    }
    setTrashLoad(false);
  };
  const handleRestore = useCallback(
    (id) => {
      showConfirm(
        "Restore Record",
        "Move this record back to active records?",
        "Restore",
        C.green,
        async () => {
          hideConfirm();
          const data = await api(`/blotters/${id}/restore`, "PUT");
          if (data?.success) {
            const [countData] = await Promise.all([
              api("/blotters/referred/count"),
              load(filters, activeReportTab),
              loadTrash(),
            ]);
            if (countData?.success) setReferredCount(countData.count);
          } else {
            showConfirm(
              "Error",
              data?.message || data?.error || "Restore failed.",
              "OK",
              C.navyMid,
              hideConfirm,
            );
          }
        },
      );
    },
    [api, load, filters, activeReportTab],
  );

  /* ── Validate ─────────────────────────────────────────────────────────── */
  const validate = () => {
    const e = {};

    if (step === 1)
      comp.forEach((c, i) => {
        if (!c.first_name?.trim()) e[`c${i}fn`] = "Required";
        else if (c.first_name.trim().length < 2)
          e[`c${i}fn`] = "At least 2 characters";
        else if (!/^[A-Za-zÑñ\s'-]+$/.test(c.first_name.trim()))
          e[`c${i}fn`] = "Letters only";

        if (!c.last_name?.trim()) e[`c${i}ln`] = "Required";
        else if (c.last_name.trim().length < 2)
          e[`c${i}ln`] = "At least 2 characters";
        else if (!/^[A-Za-zÑñ\s'-]+$/.test(c.last_name.trim()))
          e[`c${i}ln`] = "Letters only";

        if (c.middle_name && c.middle_name.trim().length > 0) {
          if (c.middle_name.trim().length < 2)
            e[`c${i}mn`] = "At least 2 characters";
          else if (!/^[A-Za-zÑñ\s'-]+$/.test(c.middle_name.trim()))
            e[`c${i}mn`] = "Letters only";
        }
        if (c.alias && c.alias.trim().length > 0) {
          if (c.alias.trim().length < 2)
            e[`c${i}alias`] = "At least 2 characters";
          else if (c.alias.trim().length > 50)
            e[`c${i}alias`] = "Maximum 50 characters";
        }

        if (c.occupation && c.occupation.trim().length > 0) {
          if (c.occupation.trim().length < 2)
            e[`c${i}occ`] = "At least 2 characters";
          else if (c.occupation.trim().length > 100)
            e[`c${i}occ`] = "Maximum 100 characters";
        }

        if (
          c.house_street &&
          c.house_street.trim().length > 0 &&
          c.house_street.trim().length < 2
        )
          e[`c${i}hs`] = "At least 2 characters";

        if (!c.nationality) e[`c${i}nat`] = "Required";
        if (!c.info_obtained) e[`c${i}inf`] = "Required";

        if (c.contact_number && c.contact_number.length > 0) {
          if (c.contact_number.length !== 11)
            e[`c${i}cn`] = "Must be 11 digits";
          else if (!c.contact_number.startsWith("09"))
            e[`c${i}cn`] = "Must start with 09";
        }
        if (c.witness_statement && c.witness_statement.length > 500) {
          e[`c${i}ws`] = "Max 500 characters";
        }
        if (c.relationship_to_victim && c.relationship_to_victim.length > 100) {
          e[`c${i}rel2`] = "Max 100 characters";
        }
      });

    if (step === 2 && hasSuspect)
      susp.forEach((s, i) => {
        if (s.first_name && s.first_name.trim().length > 0) {
          if (s.first_name.trim().length < 2)
            e[`s${i}fn`] = "At least 2 characters";
          else if (s.first_name.trim().length > 50)
            e[`s${i}fn`] = "Maximum 50 characters";
          else if (!/^[A-Za-zÑñ\s'-]+$/.test(s.first_name.trim()))
            e[`s${i}fn`] = "Letters only";
        }

        if (s.last_name && s.last_name.trim().length > 0) {
          if (s.last_name.trim().length < 2)
            e[`s${i}ln`] = "At least 2 characters";
          else if (s.last_name.trim().length > 50)
            e[`s${i}ln`] = "Maximum 50 characters";
          else if (!/^[A-Za-zÑñ\s'-]+$/.test(s.last_name.trim()))
            e[`s${i}ln`] = "Letters only";
        }

        if (s.middle_name && s.middle_name.trim().length > 0) {
          if (s.middle_name.trim().length < 2)
            e[`s${i}mn`] = "At least 2 characters";
          else if (s.middle_name.trim().length > 50)
            e[`s${i}mn`] = "Maximum 50 characters";
          else if (!/^[A-Za-zÑñ\s'-]+$/.test(s.middle_name.trim()))
            e[`s${i}mn`] = "Letters only";
        }

        if (s.alias && s.alias.trim().length > 0) {
          if (s.alias.trim().length < 2)
            e[`s${i}alias`] = "At least 2 characters";
          else if (s.alias.trim().length > 50)
            e[`s${i}alias`] = "Maximum 50 characters";
        }

        if (s.birth_place && s.birth_place.trim().length > 0) {
          if (s.birth_place.trim().length < 2)
            e[`s${i}bp`] = "At least 2 characters";
          else if (s.birth_place.trim().length > 100)
            e[`s${i}bp`] = "Maximum 100 characters";
        }

        if (s.relation_to_victim && s.relation_to_victim.trim().length > 0) {
          if (s.relation_to_victim.trim().length < 2)
            e[`s${i}rel`] = "At least 2 characters";
          else if (s.relation_to_victim.trim().length > 100)
            e[`s${i}rel`] = "Maximum 100 characters";
        }

        if (s.motive && s.motive.trim().length > 0) {
          if (s.motive.trim().length < 2)
            e[`s${i}mot`] = "At least 2 characters";
          else if (s.motive.trim().length > 500)
            e[`s${i}mot`] = "Maximum 500 characters";
        }

        if (s.occupation && s.occupation.trim().length > 0) {
          if (s.occupation.trim().length < 2)
            e[`s${i}socc`] = "At least 2 characters";
          else if (s.occupation.trim().length > 100)
            e[`s${i}socc`] = "Maximum 100 characters";
        }

        if (s.birthday) {
          const birthDate = new Date(s.birthday);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          const dayDiff = today.getDate() - birthDate.getDate();
          const actualAge =
            monthDiff < 0 || (monthDiff === 0 && dayDiff < 0) ? age - 1 : age;

          if (birthDate > today) {
            e[`s${i}bday`] = "Cannot be future date";
          } else if (actualAge < 10) {
            e[`s${i}bday`] = "Must be at least 10 years old";
          }
        }

        if (s.age && String(s.age).trim()) {
          const a = parseInt(s.age);
          if (isNaN(a) || a < 10 || a > 120) e[`s${i}age`] = "Must be 10–120";
        }
        if (s.height_cm && String(s.height_cm).trim()) {
          const h = parseInt(s.height_cm);
          if (isNaN(h) || h < 50 || h > 250) e[`s${i}ht`] = "Must be 50–250 cm";
        }
        if (s.birthday) {
          const bd = new Date(s.birthday);
          if (bd > new Date()) e[`s${i}bday`] = "Cannot be future date";
        }

        if (["Arrested", "In Custody", "Detained"].includes(s.status)) {
          if (
            s.location_if_arrested &&
            s.location_if_arrested.trim().length > 0
          ) {
            if (s.location_if_arrested.trim().length < 5) {
              e[`s${i}loc`] = "At least 5 characters";
            }
          }
        }

        if (
          s.house_street &&
          s.house_street.trim().length > 0 &&
          s.house_street.trim().length < 2
        )
          e[`s${i}hs`] = "At least 2 characters";
        if (s.nationality && s.nationality.trim().length > 0) {
          if (s.nationality.trim().length < 2)
            e[`s${i}nat`] = "At least 2 characters";
        }
      });

    if (step === 3) {
      if (!caseD.incident_type) e.inc = "Required";
      if (!offs[0]?.stage_of_felony) e.stg = "Stage of Felony is required";
      if (!topPl) e.top = "Type of Place is required";

      if (
        caseD.cop &&
        caseD.cop.trim().length > 0 &&
        caseD.cop.trim().length < 2
      )
        e.cop = "At least 2 characters";

      if (!caseD.date_time_commission) {
        e.dtc = "Required";
      } else {
        const comm = new Date(caseD.date_time_commission);
        if (isNaN(comm)) {
          e.dtc = "Invalid date format";
        } else {
          if (comm > new Date()) e.dtc = "Cannot be future date";
          if (caseD.date_time_reported) {
            const rep = new Date(caseD.date_time_reported);
            if (!isNaN(rep) && comm > rep) e.dtc = "Must be before report date";
          }
        }
      }

      if (!caseD.date_time_reported) {
        e.dtr = "Required";
      } else {
        const rep = new Date(caseD.date_time_reported);
        if (isNaN(rep)) {
          e.dtr = "Invalid date format";
        } else {
          if (rep > new Date()) e.dtr = "Cannot be future date";
          if (caseD.date_time_commission) {
            const comm = new Date(caseD.date_time_commission);
            if (!isNaN(comm) && rep < comm)
              e.dtr = "Cannot be before commission";
          }
        }
      }

      if (!caseD.place_barangay) e.brgy = "Required";

      if (!caseD.place_street?.trim()) e.str = "Required";
      else if (caseD.place_street.trim().length < 2)
        e.str = "At least 2 characters";

      if (!caseD.narrative?.trim()) e.narr = "Required";
      else if (caseD.narrative.trim().length < 20)
        e.narr = "At least 20 characters";

      if (!caseD.lat || !caseD.lng)
        e.pin = "Please drop a pin on the map to mark the exact location";

      if (caseD.amount_involved && caseD.amount_involved.trim().length > 0) {
        const amt = parseFloat(caseD.amount_involved.replace(/[₱,]/g, ""));
        if (isNaN(amt)) e.amount_involved = "Invalid amount";
        else if (amt < 0.01) e.amount_involved = "Must be at least ₱0.01";
      }
    }

    return e;
  };

  const goStep = (dir) => {
    if (dir === 1) {
      const e = validate();
      if (Object.keys(e).length) {
        setFormErr(e);
        const firstKey = Object.keys(e)[0];
        const isFirstItem =
          firstKey?.match(/^[cs]0/) ||
          [
            "inc",
            "stg",
            "top",
            "dtc",
            "dtr",
            "brgy",
            "str",
            "narr",
            "pin",
            "cop",
          ].includes(firstKey);
        if (isFirstItem) {
          setTimeout(() => {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }, 100);
        }
        return;
      }
    }
    setFormErr({});
    setStep((p) => Math.max(1, Math.min(STEPS, p + dir)));
  };

  /* ── Submit ───────────────────────────────────────────────────────────── */
  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) {
      setFormErr(e);
      return;
    }
    setSaving(true);
    try {
      const fc = { ...caseD };
      if (fc.amount_involved)
        fc.amount_involved = fc.amount_involved.replace(/,/g, "");
      fc.type_of_place = topPl;
      fc.modus_reference_ids = Object.values(selM).flat();
      const ra = (item, pr, ci, br, i) => ({
        ...item,
        region:
          (regions || []).find((r) => r.code === item.region_code)?.name ||
          item.region ||
          item.region_code,
        district_province:
          ((pr[i] || []).find((p) => p.code === item.province_code) || {})
            .name ||
          item.district_province ||
          item.province_code,
        city_municipality:
          ((ci[i] || []).find((c) => c.code === item.municipality_code) || {})
            .name ||
          item.city_municipality ||
          item.municipality_code,
        barangay:
          ((br[i] || []).find((b) => b.code === item.barangay_code) || {})
            .name ||
          item.barangay ||
          item.barangay_code,
      });
      const payload = {
        blotterData: fc,
        complainants: comp.map((c, i) => ra(c, cPr, cCi, cBr, i)),
        suspects: hasSuspect ? susp.map((s, i) => ra(s, sPr, sCi, sBr, i)) : [],
        offenses: offs.map((o) => ({
          is_principal_offense: o.is_principal_offense,
          offense_name: o.offense_name,
          stage_of_felony: o.stage_of_felony,
          index_type: o.index_type || "Non-Index",
          modus_reference_ids: selM[0] || [],
        })),
      };

      if (acceptMode && editId) {
        const upd = await api(`/blotters/${editId}`, "PUT", payload);
        if (upd?.success) {
          const acc = await api(`/blotters/${editId}/accept`, "PATCH");
          if (acc?.success) {
            if (pendingDeletes.length > 0 && editId) {
              for (const attachmentId of pendingDeletes) {
                await deleteAttachment(editId, attachmentId);
              }
            }
            if (pendingFiles.length > 0 && editId) {
              for (const file of pendingFiles) {
                await uploadAttachment(editId, file);
              }
            }
            setSaving(false);
            closeModal();
            load(filters, activeReportTab);
            const countData = await api("/blotters/referred/count");
            if (countData?.success) setReferredCount(countData.count);
          } else {
            setSaving(false);
            showConfirm(
              "Accept Failed",
              acc?.error || "Could not accept referral.",
              "OK",
              C.navyMid,
              hideConfirm,
            );
          }
        } else {
          setSaving(false);
          showConfirm(
            "Error",
            upd?.errors?.join("\n") || upd?.error || "Update failed.",
            "OK",
            C.navyMid,
            hideConfirm,
          );
        }
      } else {
        const data = await api(
          editMode ? `/blotters/${editId}` : "/blotters",
          editMode ? "PUT" : "POST",
          payload,
        );
        if (data?.success) {
          if (editMode) {
            if (pendingDeletes.length > 0 && editId) {
              for (const attachmentId of pendingDeletes) {
                await deleteAttachment(editId, attachmentId);
              }
            }
            if (pendingFiles.length > 0 && editId) {
              for (const file of pendingFiles) {
                await uploadAttachment(editId, file);
              }
            }
            setSaving(false);
            closeModal();
            load(filters, activeReportTab);
          } else {
            const newId = data.data?.blotter_id || data.data?.id;
            if (newId && pendingFiles.length > 0) {
              for (const file of pendingFiles) {
                await uploadAttachment(newId, file);
              }
            }
            setSaving(false);
            setModal(false);
            setTimeout(() => {
              setSuccessModal({
                show: true,
                reportId: data.data.blotter_entry_number,
                message: "Report Entry Created Successfully!",
              });
              load(filters, activeReportTab);
            }, 350);
            reset();
          }
        } else {
          setSaving(false);
          showConfirm(
            "Error",
            data?.errors?.join("\n") || data?.error || "Submission failed.",
            "OK",
            C.navyMid,
            hideConfirm,
          );
        }
      }
    } catch {
      setSaving(false);
      showConfirm(
        "Error",
        "Submission failed. Please try again.",
        "OK",
        C.navyMid,
        hideConfirm,
      );
    }
  };

  /* ── Street search / GPS ──────────────────────────────────────────────── */
  const fetchStreetSuggestions = useCallback(async (query, barangay, geo) => {
    if (!query || query.trim().length < 2) {
      setStreetSuggestions([]);
      return;
    }
    try {
      const feature = geo?.features?.find(
        (f) => f?.properties?.name_db === barangay,
      );
      const centroid_lat = feature?.properties?.centroid_lat ?? 14.4341;
      const centroid_lng = feature?.properties?.centroid_lng ?? 120.9647;

      let bbox = "120.9200,14.3900,121.0100,14.5000";
      if (feature) {
        const coords =
          feature.geometry.type === "Polygon"
            ? feature.geometry.coordinates[0]
            : feature.geometry.coordinates.flat(2);
        const lngs = coords.map((c) => c[0]);
        const lats = coords.map((c) => c[1]);
        bbox = `${Math.min(...lngs) - 0.003},${Math.min(...lats) - 0.003},${Math.max(...lngs) + 0.003},${Math.max(...lats) + 0.003}`;
      }

      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.EXPO_PUBLIC_MAPBOX_TOKEN}&country=PH&proximity=${centroid_lng},${centroid_lat}&bbox=${bbox}&types=address,poi&limit=5&language=en`;
      const res = await fetch(url);
      const data = await res.json();
      setStreetSuggestions(data.features || []);
    } catch (e) {
      setStreetSuggestions([]);
    }
  }, []);

  const useMyLocationAsPin = useCallback(async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setShowGpsForPin(false);
        setGpsLoading(false);
        setTimeout(() => {
          showConfirm(
            "Permission Denied",
            "Location permission is required to use this feature.",
            "OK",
            C.navyMid,
            hideConfirm,
          );
        }, 300);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;

      if (caseD.place_barangay && geoJSON?.features) {
        const feature = geoJSON.features.find(
          (f) => f?.properties?.name_db === caseD.place_barangay,
        );
        if (feature) {
          const rings =
            feature.geometry.type === "Polygon"
              ? feature.geometry.coordinates
              : feature.geometry.coordinates.flat(1);
          let inside = false;
          for (const ring of rings) {
            const n = ring.length;
            let j = n - 1;
            for (let i = 0; i < n; i++) {
              const xi = ring[i][0],
                yi = ring[i][1],
                xj = ring[j][0],
                yj = ring[j][1];
              const intersect =
                yi > latitude !== yj > latitude &&
                longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
              if (intersect) inside = !inside;
              j = i;
            }
          }
          if (!inside) {
            setShowGpsForPin(false);
            setGpsLoading(false);
            setTimeout(() => {
              showConfirm(
                "Outside Barangay",
                `Your current location is outside ${caseD.place_barangay}. Please drop the pin manually on the map instead.`,
                "OK",
                C.navyMid,
                hideConfirm,
              );
            }, 300);
            return;
          }
        }
      }

      uCase("lat", latitude.toFixed(6));
      uCase("lng", longitude.toFixed(6));

      if (_formErrRef.setter)
        _formErrRef.setter((prev) => {
          const n = { ...prev };
          delete n.pin;
          return n;
        });
    } catch (err) {
      showConfirm(
        "GPS Error",
        "Could not get your location. Make sure GPS is enabled.",
        "OK",
        C.navyMid,
        hideConfirm,
      );
    } finally {
      setGpsLoading(false);
      setShowGpsForPin(false);
    }
  }, [uCase, caseD.place_barangay, geoJSON]);

  /* ── Media pickers ────────────────────────────────────────────────────── */
  const pickVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showConfirm(
        "Permission Denied",
        "Media library permission is required.",
        "OK",
        C.navyMid,
        hideConfirm,
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const allowedVideoTypes = ["video/mp4", "video/quicktime", "video/webm"];
      if (asset.mimeType && !allowedVideoTypes.includes(asset.mimeType)) {
        showConfirm(
          "Invalid File",
          "Only MP4, MOV, or WebM videos allowed.",
          "OK",
          C.navyMid,
          hideConfirm,
        );
        return;
      }
      if (asset.fileSize && asset.fileSize > 180 * 1024 * 1024) {
        showConfirm(
          "File Too Large",
          "Max 180MB per video.",
          "OK",
          C.navyMid,
          hideConfirm,
        );
        return;
      }
      setPendingFiles((prev) => [...prev, { ...asset, isVideo: true }]);
    }
  }, []);

  const takeVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showConfirm(
        "Permission Denied",
        "Camera permission is required.",
        "OK",
        C.navyMid,
        hideConfirm,
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      allowsEditing: false,
      quality: 1,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const allowedVideoTypes = ["video/mp4", "video/quicktime", "video/webm"];
      if (asset.mimeType && !allowedVideoTypes.includes(asset.mimeType)) {
        showConfirm(
          "Invalid File",
          "Only MP4, MOV, or WebM videos allowed.",
          "OK",
          C.navyMid,
          hideConfirm,
        );
        return;
      }
      if (asset.fileSize && asset.fileSize > 180 * 1024 * 1024) {
        showConfirm(
          "File Too Large",
          "Max 180MB per video.",
          "OK",
          C.navyMid,
          hideConfirm,
        );
        return;
      }
      setPendingFiles((prev) => [...prev, { ...asset, isVideo: true }]);
    }
  }, []);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showConfirm(
        "Permission Denied",
        "Camera roll permission is required.",
        "OK",
        C.navyMid,
        hideConfirm,
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ];
      if (asset.mimeType && !allowedTypes.includes(asset.mimeType)) {
        showConfirm(
          "Invalid File",
          "Only JPG, PNG, WebP, or HEIC images allowed.",
          "OK",
          C.navyMid,
          hideConfirm,
        );
        return;
      }
      if (asset.fileSize && asset.fileSize > 12 * 1024 * 1024) {
        showConfirm(
          "File Too Large",
          "Max 12MB per photo.",
          "OK",
          C.navyMid,
          hideConfirm,
        );
        return;
      }
      setPendingFiles((prev) => [...prev, asset]);
    }
  }, []);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      showConfirm(
        "Permission Denied",
        "Camera permission is required.",
        "OK",
        C.navyMid,
        hideConfirm,
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > 12 * 1024 * 1024) {
        showConfirm(
          "File Too Large",
          "Max 12MB per photo.",
          "OK",
          C.navyMid,
          hideConfirm,
        );
        return;
      }
      setPendingFiles((prev) => [...prev, asset]);
    }
  }, []);

  /* ── PSGC complainant ─────────────────────────────────────────────────── */
  const cReg = useCallback(
    async (i, v) => {
      uC(i, "region_code", v);
      uC(i, "province_code", "");
      uC(i, "municipality_code", "");
      uC(i, "barangay_code", "");
      setCPr((p) => ({ ...p, [i]: [] }));
      setCCi((p) => ({ ...p, [i]: [] }));
      setCBr((p) => ({ ...p, [i]: [] }));
      if (v === NCR_CODE) {
        setCLC((p) => ({ ...p, [i]: true }));
        const d = await getCities(NCR_CODE);
        setCCi((p) => ({ ...p, [i]: d }));
        setCLC((p) => ({ ...p, [i]: false }));
      } else {
        setCLP((p) => ({ ...p, [i]: true }));
        const d = await getProvinces(v);
        setCPr((p) => ({ ...p, [i]: d }));
        setCLP((p) => ({ ...p, [i]: false }));
      }
    },
    [uC, getProvinces, getCities],
  );
  const cPrv = useCallback(
    async (i, v) => {
      uC(i, "province_code", v);
      uC(i, "municipality_code", "");
      uC(i, "barangay_code", "");
      setCCi((p) => ({ ...p, [i]: [] }));
      setCBr((p) => ({ ...p, [i]: [] }));
      setCLC((p) => ({ ...p, [i]: true }));
      const d = await getCities(v);
      setCCi((p) => ({ ...p, [i]: d }));
      setCLC((p) => ({ ...p, [i]: false }));
    },
    [uC, getCities],
  );
  const cCit = useCallback(
    async (i, v) => {
      uC(i, "municipality_code", v);
      uC(i, "barangay_code", "");
      setCBr((p) => ({ ...p, [i]: [] }));
      setCLB((p) => ({ ...p, [i]: true }));
      const d = await getBarangays(v);
      setCBr((p) => ({ ...p, [i]: d }));
      setCLB((p) => ({ ...p, [i]: false }));
    },
    [uC, getBarangays],
  );

  /* ── PSGC suspect ─────────────────────────────────────────────────────── */
  const sReg = useCallback(
    async (i, v) => {
      uS(i, "region_code", v);
      uS(i, "province_code", "");
      uS(i, "municipality_code", "");
      uS(i, "barangay_code", "");
      setSPr((p) => ({ ...p, [i]: [] }));
      setSCi((p) => ({ ...p, [i]: [] }));
      setSBr((p) => ({ ...p, [i]: [] }));
      if (v === NCR_CODE) {
        setSLC((p) => ({ ...p, [i]: true }));
        const d = await getCities(NCR_CODE);
        setSCi((p) => ({ ...p, [i]: d }));
        setSLC((p) => ({ ...p, [i]: false }));
      } else {
        setSLP((p) => ({ ...p, [i]: true }));
        const d = await getProvinces(v);
        setSPr((p) => ({ ...p, [i]: d }));
        setSLP((p) => ({ ...p, [i]: false }));
      }
    },
    [uS, getProvinces, getCities],
  );
  const sPrv = useCallback(
    async (i, v) => {
      uS(i, "province_code", v);
      uS(i, "municipality_code", "");
      uS(i, "barangay_code", "");
      setSCi((p) => ({ ...p, [i]: [] }));
      setSBr((p) => ({ ...p, [i]: [] }));
      setSLC((p) => ({ ...p, [i]: true }));
      const d = await getCities(v);
      setSCi((p) => ({ ...p, [i]: d }));
      setSLC((p) => ({ ...p, [i]: false }));
    },
    [uS, getCities],
  );
  const sCit = useCallback(
    async (i, v) => {
      uS(i, "municipality_code", v);
      uS(i, "barangay_code", "");
      setSBr((p) => ({ ...p, [i]: [] }));
      setSLB((p) => ({ ...p, [i]: true }));
      const d = await getBarangays(v);
      setSBr((p) => ({ ...p, [i]: d }));
      setSLB((p) => ({ ...p, [i]: false }));
    },
    [uS, getBarangays],
  );

  /* ════════════════════════════════ RENDER ════════════════════════════════ */
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.navy }}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy} />
      <ConfirmModal {...confirm} onCancel={hideConfirm} />

      <ListHeader
        activeTab={activeReportTab}
        onTab={setActiveReportTab}
        referredCount={referredCount}
        onOpenTrash={() => {
          setTrashModal(true);
          setTrashPage(1);
          loadTrash();
        }}
      />

      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <FilterBar
          tempF={tempF}
          setTempF={setTempF}
          activeFC={activeFC}
          onApply={(nf) => {
            setFilters(nf);
            load(nf, activeReportTab);
          }}
          onReset={() => {
            setFilters(BLANK_F);
            setTempF(BLANK_F);
            load(BLANK_F, activeReportTab);
          }}
        />
        <CountBar
          count={allData.length}
          activeFC={activeFC}
          loading={loading}
        />

        <FlatList
          ref={listRef}
          data={paged}
          renderItem={({ item }) => (
            <BlotterCard
              item={item}
              fmt={fmt}
              isReferred={activeReportTab === "referred"}
              userRole={userRole}
              currentUserId={currentUserId}
              onView={() => handleView(item.blotter_id)}
              onEdit={() => handleEdit(item.blotter_id)}
              onDelete={() => handleDelete(item.blotter_id)}
              onAccept={() => handleAcceptReferral(item.blotter_id)}
              onRespond={() => handleRespond(item.blotter_id)}
              onViewReferral={() => {
                setViewReferralData(item);
                setShowReferralModal(true);
              }}
              onRemind={() =>
                setRemindTarget({
                  blotterId: item.blotter_id,
                  blotterNumber: item.blotter_entry_number,
                })
              }
            />
          )}
          keyExtractor={(item) => String(item.blotter_id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 130 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              colors={[C.navyMid]}
              tintColor={C.navyMid}
              onRefresh={async () => {
                setRef(true);
                await load(filters, activeReportTab);
                setRef(false);
              }}
            />
          }
          ListEmptyComponent={
            !loading && (
              <EmptyState
                filtered={activeFC > 0}
                referred={activeReportTab === "referred"}
              />
            )
          }
          ListFooterComponent={
            allData.length > PAGE_SIZE ? (
              <Pagination
                page={page}
                total={allData.length}
                pageSize={PAGE_SIZE}
                onChange={(p2) => {
                  setPage(p2);
                  listRef.current?.scrollToOffset({
                    offset: 0,
                    animated: true,
                  });
                }}
              />
            ) : null
          }
        />
      </View>

      {/* FORM / VIEW MODAL */}
      <Modal visible={modal} animationType="slide" onRequestClose={askClose}>
        <View
          style={{ flex: 1, backgroundColor: C.navy, paddingTop: insets.top }}
        >
          <StatusBar barStyle="light-content" backgroundColor={C.navy} />
          <ConfirmModal {...confirm} onCancel={hideConfirm} />

          {saving && (
            <SavingOverlay
              fileCount={pendingFiles.length}
              label={
                acceptMode
                  ? "Accepting Referral…"
                  : editMode
                    ? "Updating Report…"
                    : "Creating Report…"
              }
            />
          )}
          {showGpsForPin && (
            <GpsPrompt
              loading={gpsLoading}
              onCancel={() => setShowGpsForPin(false)}
              onConfirm={useMyLocationAsPin}
            />
          )}

          <FormHeader
            onClose={askClose}
            title={
              viewMode
                ? "View Record"
                : acceptMode
                  ? "Accept Referral"
                  : editMode
                    ? "Edit Record"
                    : "New Crime Record"
            }
          />

          {mLoad ? (
            <View
              style={{
                flex: 1,
                backgroundColor: C.bg,
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
              }}
            >
              <ActivityIndicator size="large" color={C.navyMid} />
              <Text style={{ fontSize: 14, color: C.sub }}>
                Loading record…
              </Text>
            </View>
          ) : viewMode ? (
            <View style={{ flex: 1, backgroundColor: C.bg }}>
              <ViewContent
                viewData={viewData}
                fmt={fmt}
                modalAttachments={modalAttachments}
                setLightboxImage={setLightboxImage}
                auditSummary={auditSummary}
              />
              <FormFooter viewMode onClose={closeModal} />
            </View>
          ) : (
            <KeyboardAvoidingView
              style={{ flex: 1, backgroundColor: C.bg }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <StepBar step={step} />
              {step === 1 && (
                <Step1
                  comp={comp}
                  setComp={setComp}
                  formErr={formErr}
                  activePick={activePick}
                  setActivePick={setActivePick}
                  regions={regions}
                  loadingR={loadingR}
                  cPr={cPr}
                  cCi={cCi}
                  cBr={cBr}
                  cLP={cLP}
                  cLC={cLC}
                  cLB={cLB}
                  cReg={cReg}
                  cPrv={cPrv}
                  cCit={cCit}
                  uC={uC}
                  isImportedRecord={isImportedRecord}
                  scrollRef={scrollRef}
                />
              )}
              {step === 2 && (
                <Step2
                  susp={susp}
                  setSusp={setSusp}
                  formErr={formErr}
                  activePick={activePick}
                  setActivePick={setActivePick}
                  regions={regions}
                  loadingR={loadingR}
                  sPr={sPr}
                  sCi={sCi}
                  sBr={sBr}
                  sLP={sLP}
                  sLC={sLC}
                  sLB={sLB}
                  sReg={sReg}
                  sPrv={sPrv}
                  sCit={sCit}
                  uS={uS}
                  hasSuspect={hasSuspect}
                  setHasSuspect={setHasSuspect}
                  scrollRef={scrollRef}
                />
              )}
              {step === 3 && (
                <Step3
                  caseD={caseD}
                  uCase={uCase}
                  formErr={formErr}
                  activePick={activePick}
                  setActivePick={setActivePick}
                  offs={offs}
                  uO={uO}
                  topPl={topPl}
                  setTopPl={setTopPl}
                  modus={modus}
                  selM={selM}
                  setSelM={setSelM}
                  loadModus={loadModus}
                  geoJSON={geoJSON}
                  scrollRef={scrollRef}
                  modalAttachments={modalAttachments}
                  setModalAttachments={setModalAttachments}
                  pendingFiles={pendingFiles}
                  setPendingFiles={setPendingFiles}
                  lightboxImage={lightboxImage}
                  setLightboxImage={setLightboxImage}
                  onPickImage={pickImage}
                  onTakePhoto={takePhoto}
                  onPickVideo={pickVideo}
                  onTakeVideo={takeVideo}
                  onUseMyLocation={
                    !editMode ? () => setShowGpsForPin(true) : null
                  }
                  gpsLoading={gpsLoading}
                  streetSuggestions={streetSuggestions}
                  showStreetModal={showStreetModal}
                  setShowStreetModal={setShowStreetModal}
                  streetQuery={streetQuery}
                  setStreetQuery={setStreetQuery}
                  onStreetSearch={(q) =>
                    fetchStreetSuggestions(q, caseD.place_barangay, geoJSON)
                  }
                  onDeleteSaved={(attachmentId) => {
                    setModalAttachments((prev) =>
                      prev.filter((a) => a.attachment_id !== attachmentId),
                    );
                    setPendingDeletes((prev) => [...prev, attachmentId]);
                  }}
                />
              )}
              <FormFooter
                step={step}
                steps={STEPS}
                saving={saving}
                acceptMode={acceptMode}
                editMode={editMode}
                onBack={() => goStep(-1)}
                onNext={() => goStep(1)}
                onSubmit={submit}
              />
            </KeyboardAvoidingView>
          )}
        </View>
      </Modal>

      <TrashModal
        visible={trashModal}
        onClose={() => setTrashModal(false)}
        list={trashList}
        loading={trashLoad}
        page={trashPage}
        onPage={setTrashPage}
        onRestore={handleRestore}
        fmt={fmt}
        confirm={confirm}
        onCancelConfirm={hideConfirm}
      />

      <SuccessModal
        visible={successModal.show}
        message={successModal.message}
        reportId={successModal.reportId}
        onClose={closeSuccessModal}
      />

      <Lightbox item={lightboxImage} onClose={() => setLightboxImage(null)} />

      <ViewReferralModal
        visible={showReferralModal}
        item={viewReferralData}
        fmt={fmt}
        onClose={() => {
          setShowReferralModal(false);
          setViewReferralData(null);
        }}
        onViewFull={(id) => {
          setShowReferralModal(false);
          setViewReferralData(null);
          handleView(id);
        }}
      />

      <RemindPatrolModal
        visible={!!remindTarget}
        blotterId={remindTarget?.blotterId}
        blotterNumber={remindTarget?.blotterNumber}
        onClose={() => setRemindTarget(null)}
        api={api}
        onSent={(count) => {
          showConfirm(
            "Reminders Sent",
            `Sent to ${count} officer(s).`,
            "OK",
            C.navyMid,
            hideConfirm,
          );
          load(filters, activeReportTab);
        }}
      />

      <Animated.View
        style={{
          position: "absolute",
          right: 16,
          bottom: tabBarHeight + 14,
          transform: [{ scale: fabScale }],
        }}
      >
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            height: 52,
            paddingHorizontal: 20,
            borderRadius: 26,
            backgroundColor: C.red,
            elevation: 8,
            shadowColor: C.red,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 8,
          }}
          activeOpacity={0.85}
          onPressIn={pressIn}
          onPressOut={pressOut}
          onPress={() => {
            reset();
            setModal(true);
          }}
        >
          <Ionicons name="add" size={22} color={C.white} />
          <Text style={{ color: C.white, fontSize: 14, fontWeight: "800" }}>
            New Report
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}
