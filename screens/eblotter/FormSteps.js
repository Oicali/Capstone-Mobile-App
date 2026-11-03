// screens/eblotter/FormSteps.js
import React, { memo, useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  MapView,
  Camera,
  ShapeSource,
  FillLayer,
  LineLayer,
  MarkerView,
} from "@rnmapbox/maps";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  C,
  INCIDENT_COLORS,
  INCIDENTS,
  STAGES,
  PRIV,
  TOP_PLACE,
  BACOOR_BARANGAYS,
  LEGACY_BARANGAYS,
  BACOOR_CENTER,
  ROLES,
  NATS,
  QUALIFIERS,
  INFO_OB,
  RELATIONSHIPS,
  S_STAT,
  DEGREES,
  EDU_ATT,
  mkC,
  mkS,
  lettersOnly,
  _formErrRef,
} from "./constants";
import {
  sx,
  inp,
  ff,
  FField,
  TInput,
  SelBtn,
  Toggle,
  FormCard,
  Group,
  PickerModal,
  DateTimePickerField,
  DatePickerBtn,
  AddrFields,
} from "./FormShared";

const { height: SH } = Dimensions.get("window");

/* ============================ FORM CHROME ============================ */
const STEP_META = [
  { short: "Persons", full: "Persons Involved", icon: "people" },
  { short: "Suspect", full: "Suspect Information", icon: "alert-circle" },
  { short: "Case", full: "Case & Offense", icon: "document-text" },
];

const fch = StyleSheet.create({
  header: {
    backgroundColor: C.navy,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: C.white,
    flex: 1,
    textAlign: "center",
  },
  bar: {
    backgroundColor: C.white,
    paddingTop: 12,
    paddingBottom: 10,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  barTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  stepOf: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5, color: C.red },
  stepName: { fontSize: 13, fontWeight: "800", color: C.navy },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: C.border,
    overflow: "hidden",
  },
  fill: { height: 5, borderRadius: 3, backgroundColor: C.red },
  dots: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  dotItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.slate100,
    alignItems: "center",
    justifyContent: "center",
  },
  dotA: { backgroundColor: C.red },
  dotD: { backgroundColor: C.navyMid },
  dotLbl: { fontSize: 11, fontWeight: "600", color: C.muted },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
    paddingHorizontal: 14,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  prevBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: C.navyMid,
    borderRadius: 12,
  },
  prevTxt: { fontSize: 14, fontWeight: "700", color: C.navyMid },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 24,
    backgroundColor: C.red,
    borderRadius: 12,
  },
  nextTxt: { fontSize: 14, fontWeight: "700", color: C.white },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11,36,71,0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  overlayBox: {
    backgroundColor: C.white,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    gap: 14,
    width: "75%",
  },
  overlayTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: C.navy,
    textAlign: "center",
  },
  gpsIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.navy50,
    alignItems: "center",
    justifyContent: "center",
  },
  gpsCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
  },
  gpsOk: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C.navyMid,
    alignItems: "center",
    justifyContent: "center",
  },
});

export function FormHeader({ title, onClose }) {
  return (
    <View style={fch.header}>
      <TouchableOpacity
        onPress={onClose}
        style={fch.closeBtn}
        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={18} color={C.white} />
      </TouchableOpacity>
      <Text style={fch.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={{ width: 36 }} />
    </View>
  );
}

export const StepBar = memo(function StepBar({ step }) {
  return (
    <View style={fch.bar}>
      <View style={fch.barTop}>
        <Text style={fch.stepOf}>STEP {step} OF 3</Text>
        <Text style={fch.stepName}>{STEP_META[step - 1].full}</Text>
      </View>
      <View style={fch.track}>
        <View style={[fch.fill, { width: `${(step / 3) * 100}%` }]} />
      </View>
      <View style={fch.dots}>
        {STEP_META.map((m, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <View key={n} style={fch.dotItem}>
              <View style={[fch.dot, active && fch.dotA, done && fch.dotD]}>
                {done ? (
                  <Ionicons name="checkmark" size={12} color={C.white} />
                ) : (
                  <Ionicons
                    name={m.icon}
                    size={12}
                    color={active ? C.white : C.muted}
                  />
                )}
              </View>
              <Text
                style={[
                  fch.dotLbl,
                  active && { color: C.red, fontWeight: "800" },
                  done && { color: C.navyMid },
                ]}
              >
                {m.short}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export function FormFooter({
  viewMode,
  step,
  steps,
  saving,
  acceptMode,
  editMode,
  onBack,
  onNext,
  onSubmit,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const pad = { paddingBottom: Math.max(14, insets.bottom) };
  if (viewMode) {
    return (
      <View style={[fch.footer, pad]}>
        <TouchableOpacity style={[fch.nextBtn, { flex: 1 }]} onPress={onClose}>
          <Text style={fch.nextTxt}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={[fch.footer, pad]}>
      {step > 1 && (
        <TouchableOpacity style={fch.prevBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={15} color={C.navyMid} />
          <Text style={fch.prevTxt}>Back</Text>
        </TouchableOpacity>
      )}
      {step < steps ? (
        <TouchableOpacity style={[fch.nextBtn, { flex: 1 }]} onPress={onNext}>
          <Text style={fch.nextTxt}>Next</Text>
          <Ionicons name="arrow-forward" size={15} color={C.white} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            fch.nextBtn,
            { flex: 1, backgroundColor: acceptMode ? C.green : C.red },
            saving && { opacity: 0.6 },
          ]}
          onPress={onSubmit}
          disabled={saving}
        >
          {saving ? (
            <>
              <ActivityIndicator
                size="small"
                color={C.white}
                style={{ marginRight: 8 }}
              />
              <Text style={fch.nextTxt}>Submitting…</Text>
            </>
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={15} color={C.white} />
              <Text style={fch.nextTxt}>
                {acceptMode
                  ? "Accept & Create Case"
                  : editMode
                    ? "Update Report"
                    : "Submit Report"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

export function SavingOverlay({ label, fileCount }) {
  return (
    <View style={fch.overlay}>
      <View style={fch.overlayBox}>
        <ActivityIndicator size="large" color={C.navyMid} />
        <Text style={fch.overlayTitle}>{label}</Text>
        {fileCount > 0 && (
          <>
            <Text style={{ fontSize: 13, color: C.sub, textAlign: "center" }}>
              Uploading {fileCount} file{fileCount > 1 ? "s" : ""}…
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: C.muted,
                textAlign: "center",
                paddingHorizontal: 10,
              }}
            >
              Large videos may take a moment. Please keep the app open.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

export function GpsPrompt({ loading, onCancel, onConfirm }) {
  return (
    <View style={[fch.overlay, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
      <View style={[fch.overlayBox, { width: "82%", padding: 24 }]}>
        <View style={fch.gpsIcon}>
          <Ionicons name="locate" size={24} color={C.navyMid} />
        </View>
        <Text style={fch.overlayTitle}>Set Pin to My Location</Text>
        <Text
          style={{
            fontSize: 13,
            color: C.sub,
            textAlign: "center",
            lineHeight: 20,
          }}
        >
          This will use your current GPS coordinates as the crime incident pin
          location.
        </Text>
        <View
          style={{ flexDirection: "row", gap: 10, width: "100%", marginTop: 8 }}
        >
          <TouchableOpacity style={fch.gpsCancel} onPress={onCancel}>
            <Text style={{ fontWeight: "600", color: C.sub }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={fch.gpsOk} onPress={onConfirm}>
            {loading ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <Text style={{ fontWeight: "700", color: C.white }}>
                Use My Location
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ========================== ATTACHMENT PANEL ========================== */
const thumbCache = {};
export async function getVideoThumb(uri) {
  if (thumbCache[uri]) return thumbCache[uri];
  try {
    const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, {
      time: 500,
    });
    thumbCache[uri] = thumbUri;
    return thumbUri;
  } catch {
    return null;
  }
}

export function Thumb({ uri, isVideo, thumb, onPress, onRemove, pending }) {
  return (
    <View
      style={{
        width: 100,
        height: 100,
        borderRadius: 12,
        overflow: "hidden",
        borderWidth: pending ? 2 : 1,
        borderColor: pending ? "#f59e0b" : C.border,
        backgroundColor: C.slate100,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={{ width: 100, height: 100 }}
      >
        <Image
          source={{ uri: isVideo ? thumb || undefined : uri }}
          style={{ width: 100, height: 100 }}
          resizeMode="cover"
        />
        {isVideo && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.3)",
            }}
          >
            <Ionicons
              name="play-circle"
              size={32}
              color="rgba(255,255,255,0.9)"
            />
          </View>
        )}
      </TouchableOpacity>
      {pending && (
        <View
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            backgroundColor: "#f59e0b",
            borderRadius: 4,
            paddingHorizontal: 4,
            paddingVertical: 2,
          }}
        >
          <Text style={{ fontSize: 8, fontWeight: "700", color: C.white }}>
            NEW
          </Text>
        </View>
      )}
      {onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 10,
            width: 20,
            height: 20,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={12} color={C.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const UploadBtn = ({ icon, label, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: C.navy50,
      borderRadius: 12,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: C.navyMid,
    }}
  >
    <Ionicons name={icon} size={16} color={C.navyMid} />
    <Text style={{ fontSize: 13, fontWeight: "700", color: C.navyMid }}>
      {label}
    </Text>
  </TouchableOpacity>
);

const FullNote = ({ children }) => (
  <View
    style={{
      backgroundColor: C.greenBg,
      borderRadius: 8,
      padding: 10,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
    }}
  >
    <Ionicons name="checkmark-circle" size={14} color={C.green} />
    <Text style={{ fontSize: 12, fontWeight: "600", color: C.green }}>
      {children}
    </Text>
  </View>
);

export const AttachmentPanel = memo(function AttachmentPanel({
  modalAttachments,
  pendingFiles,
  setPendingFiles,
  setLightboxImage,
  onPickImage,
  onTakePhoto,
  onPickVideo,
  onTakeVideo,
  onDeleteSaved,
  readOnly = false,
}) {
  const [mediaTab, setMediaTab] = useState("image");
  const [thumbs, setThumbs] = useState({});

  const savedImages = modalAttachments.filter(
    (a) => !a.file_type?.startsWith("video"),
  );
  const savedVideos = modalAttachments.filter((a) =>
    a.file_type?.startsWith("video"),
  );
  const pendingImages = pendingFiles.filter((f) => !f.isVideo);
  const pendingVideos = pendingFiles.filter((f) => f.isVideo);
  const imagesFull = savedImages.length + pendingImages.length >= 8;
  const videosFull = savedVideos.length + pendingVideos.length >= 3;
  const displayedSaved = mediaTab === "image" ? savedImages : savedVideos;
  const displayedPending = mediaTab === "image" ? pendingImages : pendingVideos;

  useEffect(() => {
    const uris = [
      ...modalAttachments
        .filter((a) => a.file_type?.startsWith("video"))
        .map((a) => a.file_url),
      ...pendingFiles.filter((f) => f.isVideo).map((f) => f.uri),
    ];
    uris.forEach(async (uri) => {
      if (uri && !thumbs[uri]) {
        const t = await getVideoThumb(uri);
        if (t) setThumbs((prev) => ({ ...prev, [uri]: t }));
      }
    });
  }, [modalAttachments, pendingFiles]);

  const tabs = [
    {
      key: "image",
      label: `Photos (${savedImages.length + pendingImages.length})`,
      icon: "camera-outline",
    },
    {
      key: "video",
      label: `Videos (${savedVideos.length + pendingVideos.length})`,
      icon: "videocam-outline",
    },
  ];

  return (
    <View style={{ marginTop: 4, marginBottom: 16 }}>
      <View
        style={{
          backgroundColor: C.navyMid,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 10,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Ionicons name="camera" size={14} color={C.white} />
          <Text
            style={{
              color: C.white,
              fontWeight: "700",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Evidence & CCTV
          </Text>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
          Photos {savedImages.length + pendingImages.length}/8 Videos{" "}
          {savedVideos.length + pendingVideos.length}/3
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              sx.chip,
              mediaTab === tab.key && sx.chipOn,
              { flex: 1, justifyContent: "center", paddingVertical: 10 },
            ]}
            onPress={() => setMediaTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={mediaTab === tab.key ? C.white : C.sub}
            />
            <Text
              style={[
                sx.chipTxt,
                mediaTab === tab.key && sx.chipTxtOn,
                { marginLeft: 4 },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(displayedSaved.length > 0 || displayedPending.length > 0) && (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            marginBottom: 10,
          }}
        >
          {displayedSaved.map((a) => {
            const isVideo = !!a.file_type?.startsWith("video");
            return (
              <Thumb
                key={a.attachment_id}
                uri={a.file_url}
                isVideo={isVideo}
                thumb={thumbs[a.file_url]}
                onPress={() =>
                  setLightboxImage({
                    url: a.file_url,
                    caption: a.caption,
                    ...(isVideo ? { isVideo: true } : {}),
                  })
                }
                onRemove={
                  !readOnly ? () => onDeleteSaved(a.attachment_id) : null
                }
              />
            );
          })}
          {displayedPending.map((file, index) => {
            const globalIndex = pendingFiles.indexOf(file);
            return (
              <Thumb
                key={`p${index}`}
                pending
                uri={file.uri}
                isVideo={!!file.isVideo}
                thumb={thumbs[file.uri]}
                onPress={() =>
                  setLightboxImage(
                    file.isVideo
                      ? {
                          url: file.uri,
                          caption: "Video preview",
                          isVideo: true,
                        }
                      : { url: file.uri, caption: "New photo" },
                  )
                }
                onRemove={() =>
                  setPendingFiles((prev) =>
                    prev.filter((_, i) => i !== globalIndex),
                  )
                }
              />
            );
          })}
        </View>
      )}

      {displayedSaved.length === 0 && displayedPending.length === 0 && (
        <Text
          style={{
            fontSize: 12,
            color: C.muted,
            textAlign: "center",
            marginBottom: 10,
          }}
        >
          No {mediaTab === "image" ? "photos" : "videos"} added yet
        </Text>
      )}

      {!readOnly && (
        <>
          {mediaTab === "image" && !imagesFull && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <UploadBtn
                icon="camera-outline"
                label="Camera"
                onPress={onTakePhoto}
              />
              <UploadBtn
                icon="images-outline"
                label="Gallery"
                onPress={onPickImage}
              />
            </View>
          )}
          {mediaTab === "video" && !videosFull && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <UploadBtn
                icon="videocam-outline"
                label="Record"
                onPress={onTakeVideo}
              />
              <UploadBtn
                icon="folder-open-outline"
                label="Gallery"
                onPress={onPickVideo}
              />
            </View>
          )}
          {mediaTab === "image" && imagesFull && (
            <FullNote>Maximum 8 photos added</FullNote>
          )}
          {mediaTab === "video" && videosFull && (
            <FullNote>Maximum 3 videos added</FullNote>
          )}
        </>
      )}
    </View>
  );
});

/* ============================ STEP 1: PERSONS ============================ */
const ROLE_TONE = {
  Victim: C.navyMid,
  Complainant: "#2563EB",
  Witness: C.amber,
  Respondent: C.red,
};
const ROLE_ICON = {
  Victim: "person",
  Complainant: "megaphone",
  Witness: "eye",
  Respondent: "person-circle",
};

const st1 = StyleSheet.create({
  legend: {
    fontSize: 12,
    color: C.muted,
    marginBottom: 12,
    textAlign: "center",
  },
  roleRow: { flexDirection: "row", gap: 6, marginBottom: 16 },
  rolePill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.white,
    alignItems: "center",
  },
  roleTxt: { fontSize: 11, fontWeight: "700", color: C.sub },
  addRole: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: C.border,
    borderRadius: 12,
    backgroundColor: C.white,
  },
  addRoleTxt: { fontSize: 10, fontWeight: "700", textAlign: "center" },
});

export const Step1 = memo(function Step1({
  comp,
  setComp,
  formErr,
  activePick,
  setActivePick,
  regions,
  loadingR,
  cPr,
  cCi,
  cBr,
  cLP,
  cLC,
  cLB,
  cReg,
  cPrv,
  cCit,
  uC,
  isImportedRecord,
  scrollRef,
}) {
  return (
    <ScrollView
      ref={scrollRef}
      style={sx.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={st1.legend}>
        Fields marked <Text style={{ color: C.red }}>*</Text> are required.
      </Text>

      {comp.map((c, i) => {
        const role = c.role || "Victim";
        return (
          <FormCard
            key={i}
            accent={ROLE_TONE[role]}
            icon={ROLE_ICON[role]}
            title={`${role} #${i + 1}`}
            subtitle="Person involved in this report"
            onRemove={
              comp.length > 1
                ? () => setComp((p) => p.filter((_, x) => x !== i))
                : null
            }
          >
            <Text style={ff.l}>Role</Text>
            <View style={st1.roleRow}>
              {ROLES.map((r) => {
                const on = role === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      st1.rolePill,
                      on && {
                        backgroundColor: ROLE_TONE[r],
                        borderColor: ROLE_TONE[r],
                      },
                    ]}
                    onPress={() => uC(i, "role", r)}
                  >
                    <Text style={[st1.roleTxt, on && { color: C.white }]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Group icon="person-outline" title="Identity" />
            <View style={sx.row2}>
              <View style={{ flex: 1 }}>
                <FField label="First Name" required error={formErr[`c${i}fn`]}>
                  <TInput
                    value={c.first_name}
                    onChange={(v) => uC(i, "first_name", lettersOnly(v))}
                    placeholder="First Name"
                    error={formErr[`c${i}fn`]}
                    maxLen={50}
                    fieldKey={`c${i}fn`}
                  />
                </FField>
              </View>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}>
                <FField label="Last Name" required error={formErr[`c${i}ln`]}>
                  <TInput
                    value={c.last_name}
                    onChange={(v) => uC(i, "last_name", lettersOnly(v))}
                    placeholder="Last Name"
                    error={formErr[`c${i}ln`]}
                    maxLen={50}
                    fieldKey={`c${i}ln`}
                  />
                </FField>
              </View>
            </View>
            <FField label="Middle Name" error={formErr[`c${i}mn`]}>
              <TInput
                value={c.middle_name}
                onChange={(v) => uC(i, "middle_name", lettersOnly(v))}
                placeholder="Middle Name (optional)"
                maxLen={50}
                error={formErr[`c${i}mn`]}
                fieldKey={`c${i}mn`}
              />
            </FField>
            <View style={sx.row2}>
              <View style={{ flex: 1 }}>
                <FField label="Qualifier">
                  <SelBtn
                    label="None"
                    value={c.qualifier}
                    onPress={() => setActivePick(`cq${i}`)}
                  />
                </FField>
                <PickerModal
                  noSearch
                  visible={activePick === `cq${i}`}
                  title="Qualifier"
                  options={QUALIFIERS}
                  selected={c.qualifier}
                  onSelect={(v) => {
                    uC(i, "qualifier", v);
                    setActivePick(null);
                  }}
                  onClose={() => setActivePick(null)}
                />
              </View>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}>
                <FField label="Alias" error={formErr[`c${i}alias`]}>
                  <TInput
                    value={c.alias}
                    onChange={(v) => uC(i, "alias", v)}
                    placeholder="Alias (optional)"
                    maxLen={50}
                    error={formErr[`c${i}alias`]}
                    fieldKey={`c${i}alias`}
                  />
                </FField>
              </View>
            </View>
            <FField label="Gender" required>
              <Toggle
                opts={[
                  { l: "Male", v: "Male", ic: "male" },
                  { l: "Female", v: "Female", ic: "female" },
                ]}
                value={c.gender}
                onChange={(v) => uC(i, "gender", v)}
              />
            </FField>
            <FField label="Nationality" required error={formErr[`c${i}nat`]}>
              <SelBtn
                label="Select Nationality"
                value={c.nationality}
                onPress={() => setActivePick(`cn${i}`)}
                error={formErr[`c${i}nat`]}
              />
            </FField>
            <PickerModal
              visible={activePick === `cn${i}`}
              title="Nationality"
              options={NATS}
              selected={c.nationality}
              onSelect={(v) => {
                uC(i, "nationality", v);
                setActivePick(null);
              }}
              onClose={() => setActivePick(null)}
            />

            <Group icon="call-outline" title="Contact & Work" />
            <FField
              label="Contact Number"
              error={formErr[`c${i}cn`]}
              hint="11 digits starting with 09 (optional)"
            >
              <TextInput
                style={[inp.base, formErr[`c${i}cn`] && inp.err]}
                value={String(c.contact_number ?? "")}
                onChangeText={(v) =>
                  uC(i, "contact_number", v.replace(/\D/g, ""))
                }
                placeholder="09XXXXXXXXX (optional)"
                placeholderTextColor={C.faint}
                keyboardType="number-pad"
                maxLength={11}
                autoCorrect={false}
              />
            </FField>
            <FField label="Occupation" error={formErr[`c${i}occ`]}>
              <TInput
                value={c.occupation}
                onChange={(v) => uC(i, "occupation", v)}
                placeholder="e.g. Teacher, Driver (optional)"
                maxLen={100}
                error={formErr[`c${i}occ`]}
                fieldKey={`c${i}occ`}
              />
            </FField>

            <Group icon="home-outline" title="Address" />
            {isImportedRecord ? (
              <FField label="Address (Imported)">
                <TInput
                  value={
                    [
                      c.house_street,
                      c.barangay || c.barangay_code,
                      c.city_municipality || c.municipality_code,
                      c.district_province || c.province_code,
                      c.region || c.region_code,
                    ]
                      .filter(Boolean)
                      .join(", ") || "No address on record"
                  }
                  editable={false}
                />
              </FField>
            ) : (
              <AddrFields
                data={c}
                onUpdate={(f, v) => uC(i, f, v)}
                errors={{
                  [`c${i}_reg`]: formErr[`c${i}_reg`],
                  [`c${i}_prov`]: formErr[`c${i}_prov`],
                  [`c${i}_city`]: formErr[`c${i}_city`],
                  [`c${i}_brgy`]: formErr[`c${i}_brgy`],
                }}
                pfx={`c${i}`}
                regions={regions}
                loadingR={loadingR}
                provinces={cPr[i] || []}
                cities={cCi[i] || []}
                barangays={cBr[i] || []}
                lPr={!!cLP[i]}
                lCi={!!cLC[i]}
                lBr={!!cLB[i]}
                onReg={(v) => cReg(i, v)}
                onProv={(v) => cPrv(i, v)}
                onCity={(v) => cCit(i, v)}
              />
            )}
            <FField label="House No. / Street" error={formErr[`c${i}hs`]}>
              <TInput
                value={c.house_street}
                onChange={(v) => uC(i, "house_street", v)}
                placeholder="e.g. 123 Rizal Street"
                error={formErr[`c${i}hs`]}
                maxLen={200}
                fieldKey={`c${i}hs`}
              />
            </FField>

            <Group icon="information-circle-outline" title="Report details" />
            <FField label="Info Obtained" required error={formErr[`c${i}inf`]}>
              <SelBtn
                label="Select"
                value={c.info_obtained}
                onPress={() => setActivePick(`ci${i}`)}
                error={formErr[`c${i}inf`]}
              />
            </FField>
            <PickerModal
              noSearch
              visible={activePick === `ci${i}`}
              title="Info Obtained"
              options={INFO_OB}
              selected={c.info_obtained}
              onSelect={(v) => {
                uC(i, "info_obtained", v);
                setActivePick(null);
              }}
              onClose={() => setActivePick(null)}
            />

            {c.role === "Complainant" && (
              <FField label="Relationship to Victim">
                <SelBtn
                  label="Select Relationship"
                  value={c.relationship_to_victim}
                  onPress={() => setActivePick(`crel${i}`)}
                />
                <PickerModal
                  noSearch
                  visible={activePick === `crel${i}`}
                  title="Relationship to Victim"
                  options={RELATIONSHIPS}
                  selected={c.relationship_to_victim}
                  onSelect={(v) => {
                    uC(i, "relationship_to_victim", v);
                    setActivePick(null);
                  }}
                  onClose={() => setActivePick(null)}
                />
              </FField>
            )}

            {c.role === "Witness" && (
              <FField
                label="Witness Statement"
                hint="Brief description of what was witnessed (optional)"
              >
                <TInput
                  value={c.witness_statement}
                  onChange={(v) => uC(i, "witness_statement", v)}
                  placeholder="Brief statement of what was witnessed..."
                  multiline
                  lines={3}
                  maxLen={500}
                />
                <Text
                  style={{
                    fontSize: 11,
                    color: C.muted,
                    marginTop: 4,
                    textAlign: "right",
                  }}
                >
                  {(c.witness_statement || "").length}/500
                </Text>
              </FField>
            )}
          </FormCard>
        );
      })}

      <View style={{ marginBottom: 12 }}>
        <Text style={[ff.l, { textAlign: "center", marginBottom: 8 }]}>
          ADD ANOTHER PERSON
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={st1.addRole}
              onPress={() => setComp((p) => [...p, { ...mkC(), role: r }])}
            >
              <Ionicons name="add-circle" size={18} color={ROLE_TONE[r]} />
              <Text style={[st1.addRoleTxt, { color: ROLE_TONE[r] }]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <View style={{ height: 80 }} />
    </ScrollView>
  );
});

/* ============================ STEP 2: SUSPECT ============================ */
export const Step2 = memo(function Step2({
  susp,
  setSusp,
  formErr,
  activePick,
  setActivePick,
  regions,
  loadingR,
  sPr,
  sCi,
  sBr,
  sLP,
  sLC,
  sLB,
  sReg,
  sPrv,
  sCit,
  uS,
  hasSuspect,
  setHasSuspect,
  scrollRef,
}) {
  return (
    <ScrollView
      ref={scrollRef}
      style={sx.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {!hasSuspect && (
        <View
          style={[
            sx.card,
            { alignItems: "center", paddingVertical: 28, gap: 12 },
          ]}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: C.slate100,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="person-remove-outline" size={30} color={C.muted} />
          </View>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "800",
              color: C.sub,
              textAlign: "center",
            }}
          >
            No Suspect Added
          </Text>
          <Text style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
            You can proceed without a suspect, or add one below.
          </Text>
          <TouchableOpacity
            style={[
              sx.addBtn,
              { width: "100%", marginTop: 4, marginBottom: 0 },
            ]}
            onPress={() => setHasSuspect(true)}
          >
            <Ionicons name="add-circle" size={18} color={C.navyMid} />
            <Text style={sx.addTxt}>Add Suspect</Text>
          </TouchableOpacity>
        </View>
      )}

      {hasSuspect &&
        susp.map((s, i) => (
          <FormCard
            key={i}
            accent={C.red}
            badge={i + 1}
            title={`Suspect #${i + 1}`}
            subtitle="All fields are optional"
            onRemove={() => {
              if (susp.length === 1) {
                setHasSuspect(false);
                setSusp([mkS()]);
              } else {
                setSusp((p) => p.filter((_, x) => x !== i));
              }
            }}
          >
            <Group icon="person-outline" title="Identity" />
            <View style={sx.row2}>
              <View style={{ flex: 1 }}>
                <FField label="First Name" error={formErr[`s${i}fn`]}>
                  <TInput
                    value={s.first_name}
                    onChange={(v) => uS(i, "first_name", lettersOnly(v))}
                    placeholder="First Name"
                    error={formErr[`s${i}fn`]}
                    maxLen={50}
                    fieldKey={`s${i}fn`}
                  />
                </FField>
              </View>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}>
                <FField label="Last Name" error={formErr[`s${i}ln`]}>
                  <TInput
                    value={s.last_name}
                    onChange={(v) => uS(i, "last_name", lettersOnly(v))}
                    placeholder="Last Name"
                    error={formErr[`s${i}ln`]}
                    maxLen={50}
                    fieldKey={`s${i}ln`}
                  />
                </FField>
              </View>
            </View>
            <FField label="Middle Name" error={formErr[`s${i}mn`]}>
              <TInput
                value={s.middle_name}
                onChange={(v) => uS(i, "middle_name", lettersOnly(v))}
                placeholder="Middle Name (optional)"
                maxLen={50}
                error={formErr[`s${i}mn`]}
                fieldKey={`s${i}mn`}
              />
            </FField>
            <View style={sx.row2}>
              <View style={{ flex: 1 }}>
                <FField label="Qualifier">
                  <SelBtn
                    label="None"
                    value={s.qualifier}
                    onPress={() => setActivePick(`sq${i}`)}
                  />
                </FField>
                <PickerModal
                  noSearch
                  visible={activePick === `sq${i}`}
                  title="Qualifier"
                  options={QUALIFIERS}
                  selected={s.qualifier}
                  onSelect={(v) => {
                    uS(i, "qualifier", v);
                    setActivePick(null);
                  }}
                  onClose={() => setActivePick(null)}
                />
              </View>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}>
                <FField label="Alias" error={formErr[`s${i}alias`]}>
                  <TInput
                    value={s.alias}
                    onChange={(v) => uS(i, "alias", v)}
                    placeholder="Alias (optional)"
                    maxLen={50}
                    error={formErr[`s${i}alias`]}
                    fieldKey={`s${i}alias`}
                  />
                </FField>
              </View>
            </View>
            <FField label="Gender">
              <Toggle
                opts={[
                  { l: "Male", v: "Male", ic: "male" },
                  { l: "Female", v: "Female", ic: "female" },
                ]}
                value={s.gender}
                onChange={(v) => uS(i, "gender", v)}
              />
            </FField>

            <Group icon="body-outline" title="Personal details" />
            <FField label="Birthday" error={formErr[`s${i}bday`]}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <DatePickerBtn
                    label="Birthday"
                    value={s.birthday ? new Date(s.birthday) : null}
                    onChange={(d) =>
                      uS(i, "birthday", d ? d.toISOString().split("T")[0] : "")
                    }
                    maximumDate={new Date()}
                  />
                </View>
                {s.birthday ? (
                  <TouchableOpacity
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 12,
                      paddingVertical: 12,
                      backgroundColor: C.redBg,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: "#fca5a5",
                      justifyContent: "center",
                    }}
                    onPress={() => uS(i, "birthday", "")}
                  >
                    <Ionicons name="close" size={16} color={C.red} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </FField>
            <View style={sx.row2}>
              <View style={{ flex: 1 }}>
                <FField label="Age" error={formErr[`s${i}age`]}>
                  <TInput
                    value={s.age}
                    onChange={(v) => uS(i, "age", v.replace(/\D/g, ""))}
                    placeholder="Age"
                    kb="number-pad"
                    maxLen={3}
                    error={formErr[`s${i}age`]}
                    fieldKey={`s${i}age`}
                  />
                </FField>
              </View>
              <View style={{ width: 8 }} />
              <View style={{ flex: 1 }}>
                <FField label="Height (cm)" error={formErr[`s${i}ht`]}>
                  <TInput
                    value={s.height_cm}
                    onChange={(v) => uS(i, "height_cm", v.replace(/\D/g, ""))}
                    placeholder="cm"
                    kb="number-pad"
                    maxLen={3}
                    error={formErr[`s${i}ht`]}
                    fieldKey={`s${i}ht`}
                  />
                </FField>
              </View>
            </View>
            <FField label="Birth Place" error={formErr[`s${i}bp`]}>
              <TInput
                value={s.birth_place}
                onChange={(v) => uS(i, "birth_place", v)}
                placeholder="Birth Place"
                maxLen={100}
                error={formErr[`s${i}bp`]}
                fieldKey={`s${i}bp`}
              />
            </FField>
            <FField label="Nationality" error={formErr[`s${i}nat`]}>
              <SelBtn
                label="Select Nationality"
                value={s.nationality}
                onPress={() => setActivePick(`sn${i}`)}
                error={formErr[`s${i}nat`]}
              />
            </FField>
            <PickerModal
              visible={activePick === `sn${i}`}
              title="Nationality"
              options={NATS}
              selected={s.nationality}
              onSelect={(v) => {
                uS(i, "nationality", v);
                setActivePick(null);
              }}
              onClose={() => setActivePick(null)}
            />
            <FField label="Educational Attainment">
              <SelBtn
                label="Select…"
                value={s.educational_attainment}
                onPress={() => setActivePick(`se${i}`)}
              />
            </FField>
            <PickerModal
              visible={activePick === `se${i}`}
              title="Educational Attainment"
              options={EDU_ATT}
              selected={s.educational_attainment}
              onSelect={(v) => {
                uS(i, "educational_attainment", v);
                setActivePick(null);
              }}
              onClose={() => setActivePick(null)}
            />
            <FField label="Occupation" error={formErr[`s${i}socc`]}>
              <TInput
                value={s.occupation}
                onChange={(v) => uS(i, "occupation", v)}
                placeholder="e.g. Driver"
                maxLen={100}
                error={formErr[`s${i}socc`]}
                fieldKey={`s${i}socc`}
              />
            </FField>

            <Group icon="shield-outline" title="Case involvement" />
            <FField label="Status" error={formErr[`s${i}st`]}>
              <SelBtn
                label="Select Status"
                value={s.status}
                onPress={() => setActivePick(`ss${i}`)}
                error={formErr[`s${i}st`]}
              />
            </FField>
            <PickerModal
              visible={activePick === `ss${i}`}
              title="Suspect Status"
              options={S_STAT}
              selected={s.status}
              onSelect={(v) => {
                uS(i, "status", v);
                setActivePick(null);
              }}
              onClose={() => setActivePick(null)}
            />
            {["Arrested", "In Custody", "Detained"].includes(s.status) && (
              <FField
                label="Arrest / Detention Location"
                error={formErr[`s${i}loc`]}
              >
                <TInput
                  value={s.location_if_arrested}
                  onChange={(v) => uS(i, "location_if_arrested", v)}
                  placeholder="Where detained/arrested (min. 5 chars)"
                  error={formErr[`s${i}loc`]}
                  maxLen={200}
                  fieldKey={`s${i}loc`}
                />
              </FField>
            )}
            <FField label="Degree of Participation" error={formErr[`s${i}dg`]}>
              <SelBtn
                label="Select Degree"
                value={s.degree_participation}
                onPress={() => setActivePick(`sd${i}`)}
                error={formErr[`s${i}dg`]}
              />
            </FField>
            <PickerModal
              noSearch
              visible={activePick === `sd${i}`}
              title="Degree"
              options={DEGREES}
              selected={s.degree_participation}
              onSelect={(v) => {
                uS(i, "degree_participation", v);
                setActivePick(null);
              }}
              onClose={() => setActivePick(null)}
            />
            <FField label="Relation to Victim" error={formErr[`s${i}rel`]}>
              <TInput
                value={s.relation_to_victim}
                onChange={(v) => uS(i, "relation_to_victim", v)}
                placeholder="Relation"
                maxLen={100}
                error={formErr[`s${i}rel`]}
                fieldKey={`s${i}rel`}
              />
            </FField>
            <FField label="Drug Used">
              <Toggle
                opts={[
                  { l: "Yes", v: true },
                  { l: "No", v: false },
                ]}
                value={s.drug_used}
                onChange={(v) => uS(i, "drug_used", v)}
              />
            </FField>
            <FField label="Motive" error={formErr[`s${i}mot`]}>
              <TInput
                value={s.motive}
                onChange={(v) => uS(i, "motive", v)}
                placeholder="Motive"
                maxLen={500}
                multiline
                lines={3}
                error={formErr[`s${i}mot`]}
                fieldKey={`s${i}mot`}
              />
            </FField>

            <Group icon="home-outline" title="Address" />
            <AddrFields
              data={s}
              onUpdate={(f, v) => uS(i, f, v)}
              errors={{
                [`s${i}_reg`]: formErr[`s${i}_reg`],
                [`s${i}_prov`]: formErr[`s${i}_prov`],
                [`s${i}_city`]: formErr[`s${i}_city`],
                [`s${i}_brgy`]: formErr[`s${i}_brgy`],
              }}
              pfx={`s${i}`}
              regions={regions}
              loadingR={loadingR}
              provinces={sPr[i] || []}
              cities={sCi[i] || []}
              barangays={sBr[i] || []}
              lPr={!!sLP[i]}
              lCi={!!sLC[i]}
              lBr={!!sLB[i]}
              onReg={(v) => sReg(i, v)}
              onProv={(v) => sPrv(i, v)}
              onCity={(v) => sCit(i, v)}
            />
            <FField label="House No. / Street" error={formErr[`s${i}hs`]}>
              <TInput
                value={s.house_street}
                onChange={(v) => uS(i, "house_street", v)}
                placeholder="e.g. 123 Rizal Street"
                error={formErr[`s${i}hs`]}
                maxLen={200}
                fieldKey={`s${i}hs`}
              />
            </FField>
          </FormCard>
        ))}

      {hasSuspect && (
        <TouchableOpacity
          style={sx.addBtn}
          onPress={() => setSusp((p) => [...p, mkS()])}
        >
          <Ionicons name="add-circle" size={18} color={C.navyMid} />
          <Text style={sx.addTxt}>Add Another Suspect</Text>
        </TouchableOpacity>
      )}
      <View style={{ height: 80 }} />
    </ScrollView>
  );
});

/* ============================ STEP 3: CASE ============================ */
const clearErr = (k) => {
  if (_formErrRef.setter)
    _formErrRef.setter((prev) => {
      const n = { ...prev };
      delete n[k];
      return n;
    });
};

const pointInFeature = (lng, lat, feature) => {
  if (!feature) return true;
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
        yi > lat !== yj > lat &&
        lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
      j = i;
    }
  }
  return inside;
};

const getBrgyCenter = (feature) => {
  if (!feature) return BACOOR_CENTER;
  const coords =
    feature.geometry.type === "Polygon"
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0][0];
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lng, lat];
};

const PinMarker = ({ color, size = 36, icon = 18 }) => (
  <View style={{ alignItems: "center" }}>
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: 3,
        borderColor: C.white,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name="location" size={icon} color={C.white} />
    </View>
    <View
      style={{
        width: 4,
        height: 10,
        backgroundColor: color,
        borderRadius: 2,
        marginTop: -2,
      }}
    />
  </View>
);

const BoundaryLayers = ({ feature, prefix }) =>
  feature ? (
    <ShapeSource id={`${prefix}brgy-boundary`} shape={feature}>
      <FillLayer
        id={`${prefix}brgy-fill`}
        style={{ fillColor: "#1e3a5f", fillOpacity: 0.12 }}
      />
      <LineLayer
        id={`${prefix}brgy-outline`}
        style={{ lineColor: "#1e3a5f", lineWidth: 3, lineDasharray: [3, 2] }}
      />
    </ShapeSource>
  ) : null;

export const Step3 = memo(function Step3({
  caseD,
  uCase,
  formErr,
  activePick,
  setActivePick,
  offs,
  uO,
  topPl,
  setTopPl,
  modus,
  selM,
  setSelM,
  loadModus,
  geoJSON,
  scrollRef,
  modalAttachments,
  setModalAttachments,
  pendingFiles,
  setPendingFiles,
  lightboxImage,
  setLightboxImage,
  onPickImage,
  onTakePhoto,
  onPickVideo,
  onTakeVideo,
  onDeleteSaved,
  onUseMyLocation,
  gpsLoading,
  streetSuggestions,
  showStreetModal,
  setShowStreetModal,
  streetQuery,
  setStreetQuery,
  onStreetSearch,
}) {
  const cameraRef = useRef(null);
  const pinColor = INCIDENT_COLORS[caseD.incident_type] || "#c1272d";
  const [mapFocused, setMapFocused] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [outsideBrgy, setOutsideBrgy] = useState(false);
  const [streetOutsideWarning, setStreetOutsideWarning] = useState("");
  const insets = useSafeAreaInsets();

  const selectedFeature = useMemo(() => {
    if (!geoJSON?.features || !caseD.place_barangay) return null;
    return (
      geoJSON.features.find(
        (f) => f?.properties?.name_db === caseD.place_barangay,
      ) || null
    );
  }, [geoJSON, caseD.place_barangay]);

  useEffect(() => {
    if (caseD.place_barangay && selectedFeature && geoJSON) {
      setCameraKey((prev) => prev + 1);
      setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: getBrgyCenter(selectedFeature),
          zoomLevel: 13,
          animationDuration: 500,
        });
      }, 100);
    }
  }, [caseD.place_barangay, geoJSON]);

  useEffect(() => {
    if (caseD.lat && caseD.lng && cameraRef.current) {
      setTimeout(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: [parseFloat(caseD.lng), parseFloat(caseD.lat)],
          zoomLevel: 16,
          animationMode: "flyTo",
          animationDuration: 900,
        });
      }, 150);
    }
  }, [caseD.lat, caseD.lng]);

  const handleMapPress = (e) => {
    if (!caseD.place_barangay) return;
    const [lng, lat] = e.geometry.coordinates;
    if (selectedFeature && !pointInFeature(lng, lat, selectedFeature)) {
      setOutsideBrgy(true);
      setTimeout(() => setOutsideBrgy(false), 2500);
      return;
    }
    setOutsideBrgy(false);
    uCase("lat", lat.toFixed(6));
    uCase("lng", lng.toFixed(6));
    clearErr("pin");
  };

  const pinned = !!(caseD.lat && caseD.lng);

  return (
    <ScrollView
      ref={scrollRef}
      style={sx.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={!mapFocused}
    >
      <Text
        style={{
          fontSize: 12,
          color: C.muted,
          marginBottom: 12,
          textAlign: "center",
        }}
      >
        Fields marked <Text style={{ color: C.red }}>*</Text> are required.
      </Text>

      <FormCard
        accent={C.red}
        icon="alert-circle"
        title="Offense"
        subtitle="What happened"
      >
        <FField label="Crime Type" required error={formErr.inc}>
          <SelBtn
            label="Select Crime Type"
            value={caseD.incident_type}
            onPress={() => setActivePick("inc")}
            error={formErr.inc}
          />
        </FField>
        <PickerModal
          visible={activePick === "inc"}
          title="Crime Type"
          options={INCIDENTS}
          selected={caseD.incident_type}
          onSelect={(v) => {
            uCase("incident_type", v);
            uO(0, "offense_name", v);
            uO(0, "index_type", "Index");
            loadModus(v, 0);
            setActivePick(null);
            clearErr("inc");
          }}
          onClose={() => setActivePick(null)}
        />

        <FField label="Stage of Felony" required error={formErr.stg}>
          <SelBtn
            label="Select Stage"
            value={offs[0]?.stage_of_felony}
            onPress={() => setActivePick("stg")}
            error={formErr.stg}
          />
        </FField>
        <PickerModal
          noSearch
          visible={activePick === "stg"}
          title="Stage of Felony"
          options={STAGES}
          selected={offs[0]?.stage_of_felony}
          onSelect={(v) => {
            uO(0, "stage_of_felony", v);
            setActivePick(null);
            clearErr("stg");
          }}
          onClose={() => setActivePick(null)}
        />

        <FField label="Index Type">
          <TInput value={offs[0]?.index_type || "Non-Index"} editable={false} />
        </FField>

        {modus[0]?.length > 0 && (
          <>
            <FField label="Modus Operandi" error={formErr.modus}>
              <SelBtn
                label="Select Modus"
                value={
                  modus[0].find((m) => m.id === selM[0]?.[0])?.modus_name || ""
                }
                onPress={() => setActivePick("modus")}
                error={formErr.modus}
              />
            </FField>
            <PickerModal
              visible={activePick === "modus"}
              title="Modus Operandi"
              options={modus[0].map((m) => ({
                label: m.modus_name,
                value: m.id,
              }))}
              selected={selM[0]?.[0] || ""}
              onSelect={(v) => {
                setSelM((p) => ({ ...p, [0]: v ? [v] : [] }));
                setActivePick(null);
              }}
              onClose={() => setActivePick(null)}
            />
          </>
        )}

        <FField label="Type of Place" required error={formErr.top}>
          <SelBtn
            label="Select Type of Place"
            value={topPl}
            onPress={() => setActivePick("top")}
            error={formErr.top}
          />
        </FField>
        <PickerModal
          visible={activePick === "top"}
          title="Type of Place"
          options={TOP_PLACE}
          selected={topPl}
          onSelect={(v) => {
            setTopPl(v);
            setActivePick(null);
            clearErr("top");
          }}
          onClose={() => setActivePick(null)}
        />

        <FField label="Private Place?">
          <SelBtn
            label="Select…"
            value={caseD.is_private_place}
            onPress={() => setActivePick("priv")}
          />
        </FField>
        <PickerModal
          noSearch
          visible={activePick === "priv"}
          title="Private Place?"
          options={PRIV}
          selected={caseD.is_private_place}
          onSelect={(v) => {
            uCase("is_private_place", v);
            setActivePick(null);
          }}
          onClose={() => setActivePick(null)}
        />
      </FormCard>

      <FormCard
        accent="#0891B2"
        icon="time"
        title="When"
        subtitle="Date and time of the incident"
      >
        <FField label="Date & Time of Commission" required error={formErr.dtc}>
          <DateTimePickerField
            label="Date & Time of Commission"
            value={caseD.date_time_commission}
            onChange={(v) => uCase("date_time_commission", v)}
            error={formErr.dtc}
            fieldKey="dtc"
          />
        </FField>
        <FField label="Date & Time Reported" required error={formErr.dtr}>
          <DateTimePickerField
            label="Date & Time Reported"
            value={caseD.date_time_reported}
            onChange={(v) => uCase("date_time_reported", v)}
            error={formErr.dtr}
            fieldKey="dtr"
          />
        </FField>
      </FormCard>

      <FormCard
        accent="#16A34A"
        icon="location"
        title="Where"
        subtitle="Barangay, street and map pin"
      >
        <View style={sx.fixedLoc}>
          <Ionicons name="location" size={13} color={C.navyMid} />
          <Text style={sx.fixedLocTxt}>
            Region IV-A (CALABARZON) • Cavite • Bacoor City
          </Text>
        </View>

        <FField label="Barangay" required error={formErr.brgy}>
          <SelBtn
            label="Select Barangay"
            value={caseD.place_barangay}
            onPress={() => setActivePick("brgy")}
            error={formErr.brgy}
          />
        </FField>
        <PickerModal
          visible={activePick === "brgy"}
          title="Select Barangay"
          options={[
            ...BACOOR_BARANGAYS.map((b) => ({ label: b, value: b })),
            {
              label: "── Pre-2023 Names (Auto-resolved) ──",
              value: "__divider__",
              disabled: true,
            },
            ...LEGACY_BARANGAYS,
          ]}
          selected={caseD.place_barangay}
          onSelect={(v) => {
            if (v !== "__divider__") {
              uCase("place_barangay", v);
              uCase("lat", "");
              uCase("lng", "");
              setActivePick(null);
              setCameraKey((prev) => prev + 1);
              clearErr("brgy");
            }
          }}
          onClose={() => setActivePick(null)}
        />

        <FField
          label="Street / Specific Place"
          required
          error={formErr.str}
          hint="Type your address or use the search button to auto-pin"
        >
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[
                inp.base,
                { flex: 1 },
                formErr.str && inp.err,
                !caseD.place_barangay && inp.dis,
              ]}
              value={caseD.place_street}
              onChangeText={(v) => {
                uCase("place_street", v);
                clearErr("str");
              }}
              placeholder={
                caseD.place_barangay
                  ? "e.g. 123 Rizal St., near market"
                  : "Select barangay first"
              }
              placeholderTextColor={C.faint}
              editable={!!caseD.place_barangay}
              autoCorrect={false}
            />
            <TouchableOpacity
              style={{
                width: 46,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: caseD.place_barangay ? C.navyMid : C.border,
              }}
              onPress={() => {
                if (!caseD.place_barangay) return;
                setStreetQuery(caseD.place_street || "");
                setShowStreetModal(true);
              }}
              disabled={!caseD.place_barangay}
              accessibilityLabel="Search street"
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={caseD.place_barangay ? C.white : C.muted}
              />
            </TouchableOpacity>
          </View>
        </FField>

        <View style={ff.g}>
          <Text style={ff.l}>
            Crime Location Pin<Text style={ff.r}> *</Text>
          </Text>

          {onUseMyLocation && (
            <TouchableOpacity
              onPress={onUseMyLocation}
              disabled={!caseD.place_barangay}
              style={{
                backgroundColor: caseD.place_barangay ? C.red : C.muted,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 8,
                opacity: caseD.place_barangay ? 1 : 0.5,
              }}
              activeOpacity={0.8}
            >
              {gpsLoading ? (
                <ActivityIndicator size="small" color={C.white} />
              ) : (
                <Ionicons name="locate" size={16} color={C.white} />
              )}
              <Text
                style={{
                  color: C.white,
                  fontSize: 13,
                  fontWeight: "800",
                  letterSpacing: 0.3,
                }}
              >
                {gpsLoading ? "Getting Location…" : "Use My Current Location"}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                Latitude
              </Text>
              <TextInput
                style={[inp.base, inp.dis, { fontSize: 13 }]}
                value={caseD.lat || "Not set"}
                editable={false}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                Longitude
              </Text>
              <TextInput
                style={[inp.base, inp.dis, { fontSize: 13 }]}
                value={caseD.lng || "Not set"}
                editable={false}
              />
            </View>
            {(caseD.lat || caseD.lng) && (
              <TouchableOpacity
                style={{
                  alignSelf: "flex-end",
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  backgroundColor: C.redBg,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: "#fca5a5",
                }}
                onPress={() => {
                  uCase("lat", "");
                  uCase("lng", "");
                }}
              >
                <Text style={{ fontSize: 12, color: C.red, fontWeight: "700" }}>
                  Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {!caseD.place_barangay ? (
            <View
              style={{
                height: 260,
                borderRadius: 14,
                backgroundColor: C.slate100,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <Ionicons name="location-outline" size={40} color={C.muted} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "600",
                  color: C.muted,
                  marginTop: 10,
                  textAlign: "center",
                  paddingHorizontal: 20,
                }}
              >
                Select a barangay above to activate the map
              </Text>
            </View>
          ) : (
            <View
              style={{
                height: 420,
                borderRadius: 14,
                overflow: "hidden",
                borderWidth: 2,
                borderColor: formErr.pin ? C.red : C.border,
              }}
              onTouchMove={() => setMapFocused(true)}
              onTouchEnd={() => setMapFocused(false)}
              onTouchCancel={() => setMapFocused(false)}
            >
              <MapView
                style={{ flex: 1 }}
                styleURL="mapbox://styles/mapbox/streets-v12"
                onPress={handleMapPress}
                scrollEnabled
                zoomEnabled
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Camera
                  key={cameraKey}
                  ref={cameraRef}
                  defaultSettings={{
                    centerCoordinate: getBrgyCenter(selectedFeature),
                    zoomLevel: 13,
                  }}
                  animationMode="flyTo"
                  animationDuration={800}
                />
                <BoundaryLayers feature={selectedFeature} prefix="" />
                {pinned && (
                  <MarkerView
                    coordinate={[parseFloat(caseD.lng), parseFloat(caseD.lat)]}
                  >
                    <PinMarker color={pinColor} />
                  </MarkerView>
                )}
              </MapView>

              {outsideBrgy && (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    right: 10,
                    backgroundColor: "rgba(185,28,28,0.9)",
                    borderRadius: 10,
                    padding: 10,
                    zIndex: 10,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Ionicons name="warning" size={16} color={C.white} />
                    <Text
                      style={{
                        color: C.white,
                        fontSize: 13,
                        fontWeight: "700",
                        flex: 1,
                      }}
                    >
                      Outside {caseD.place_barangay} boundary. Tap inside the
                      highlighted area.
                    </Text>
                  </View>
                </View>
              )}

              <View
                style={{
                  position: "absolute",
                  bottom: 10,
                  left: 10,
                  right: 10,
                  backgroundColor: "rgba(0,0,0,0.65)",
                  borderRadius: 10,
                  padding: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {pinned && (
                  <Ionicons name="checkmark-circle" size={14} color="#86efac" />
                )}
                <Text
                  style={{
                    color: C.white,
                    fontSize: 12,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  {pinned
                    ? "Pin placed. Tap the map to move it"
                    : "Tap inside the highlighted area to drop a pin"}
                </Text>
              </View>
              <TouchableOpacity
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderRadius: 8,
                  padding: 8,
                }}
                onPress={() => setMapFullscreen(true)}
                accessibilityLabel="Expand map"
              >
                <Ionicons name="expand-outline" size={18} color={C.white} />
              </TouchableOpacity>
            </View>
          )}

          {formErr.pin && (
            <View style={[ff.er, { marginTop: 6 }]}>
              <Ionicons name="alert-circle" size={11} color={C.red} />
              <Text style={ff.et}> {formErr.pin}</Text>
            </View>
          )}
        </View>
      </FormCard>

      <View style={sx.card}>
        <AttachmentPanel
          modalAttachments={modalAttachments}
          setModalAttachments={setModalAttachments}
          pendingFiles={pendingFiles}
          setPendingFiles={setPendingFiles}
          lightboxImage={lightboxImage}
          setLightboxImage={setLightboxImage}
          onPickImage={onPickImage}
          onTakePhoto={onTakePhoto}
          onPickVideo={onPickVideo}
          onTakeVideo={onTakeVideo}
          onDeleteSaved={onDeleteSaved}
          readOnly={false}
        />
      </View>

      <FormCard
        accent={C.navyMid}
        icon="document-text"
        title="Narrative"
        subtitle="Describe what happened"
      >
        <FField label="Narrative" required error={formErr.narr}>
          <TInput
            value={caseD.narrative}
            onChange={(v) => uCase("narrative", v)}
            placeholder="Detailed description (min. 20 chars)"
            multiline
            lines={6}
            error={formErr.narr}
            maxLen={5000}
            fieldKey="narr"
          />
          <Text
            style={{
              fontSize: 11,
              color: C.muted,
              marginTop: 4,
              textAlign: "right",
            }}
          >
            {(caseD.narrative || "").length}/5000
          </Text>
        </FField>
        <FField label="Amount Involved" error={formErr.amount_involved}>
          <TInput
            value={caseD.amount_involved}
            onChange={(v) =>
              uCase("amount_involved", v.replace(/[^0-9.]/g, ""))
            }
            placeholder="0.00"
            kb="decimal-pad"
            maxLen={15}
            error={formErr.amount_involved}
            fieldKey="amount_involved"
          />
        </FField>
      </FormCard>

      {/* STREET SEARCH MODAL */}
      <Modal
        visible={showStreetModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowStreetModal(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setShowStreetModal(false)}
          />
          <View
            style={{
              backgroundColor: C.white,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 34,
              height: SH * 0.65,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: C.border,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: "800",
                  color: C.navy,
                }}
              >
                Search Street
              </Text>
              <TouchableOpacity onPress={() => setShowStreetModal(false)}>
                <Ionicons name="close" size={20} color={C.sub} />
              </TouchableOpacity>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                margin: 14,
                backgroundColor: C.bg,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderWidth: 1,
                borderColor: C.border,
                gap: 8,
              }}
            >
              <Ionicons name="search-outline" size={15} color={C.muted} />
              <TextInput
                style={{ flex: 1, fontSize: 14, color: C.text }}
                placeholder="Type street name..."
                placeholderTextColor={C.faint}
                value={streetQuery}
                autoFocus
                onChangeText={(v) => {
                  setStreetQuery(v);
                  onStreetSearch(v);
                }}
              />
              {streetQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setStreetQuery("");
                    onStreetSearch("");
                  }}
                >
                  <Ionicons name="close-circle" size={16} color={C.muted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={streetSuggestions}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const streetName =
                  item.place_text || item.place_name.split(",")[0];
                const rest = item.place_name
                  .split(",")
                  .slice(1)
                  .join(",")
                  .trim();
                const [lng, lat] = item.center;
                return (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: 14,
                      borderBottomWidth: 0.5,
                      borderBottomColor: C.border,
                    }}
                    onPress={() => {
                      const feature = geoJSON?.features?.find(
                        (f) => f?.properties?.name_db === caseD.place_barangay,
                      );
                      if (pointInFeature(lng, lat, feature)) {
                        uCase("place_street", streetName);
                        uCase("lat", lat.toFixed(6));
                        uCase("lng", lng.toFixed(6));
                        clearErr("pin");
                        clearErr("str");
                        setShowStreetModal(false);
                      } else {
                        clearErr("str");
                        setShowStreetModal(false);
                        setTimeout(
                          () => setStreetOutsideWarning(streetName),
                          300,
                        );
                      }
                    }}
                  >
                    <Ionicons
                      name="location"
                      size={16}
                      color={C.red}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: C.navy,
                        }}
                      >
                        {streetName}
                      </Text>
                      <Text
                        style={{ fontSize: 11, color: C.muted, marginTop: 2 }}
                      >
                        {rest}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text
                  style={{ textAlign: "center", color: C.muted, padding: 24 }}
                >
                  {streetQuery.length >= 2
                    ? "No results found"
                    : "Type at least 2 characters"}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* FULLSCREEN MAP */}
      <Modal
        visible={mapFullscreen}
        animationType="slide"
        onRequestClose={() => setMapFullscreen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: insets.top + 12,
              paddingHorizontal: 12,
              paddingBottom: 12,
              backgroundColor: C.navy,
            }}
          >
            <Text style={{ color: C.white, fontWeight: "700", fontSize: 15 }}>
              {pinned ? "Tap to move pin" : "Tap to drop pin"}
            </Text>
            <TouchableOpacity
              onPress={() => setMapFullscreen(false)}
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 8,
                padding: 8,
              }}
            >
              <Ionicons name="contract-outline" size={18} color={C.white} />
            </TouchableOpacity>
          </View>
          <MapView
            style={{ flex: 1 }}
            styleURL="mapbox://styles/mapbox/streets-v12"
            onPress={handleMapPress}
            scrollEnabled
            zoomEnabled
            pitchEnabled={false}
            rotateEnabled={false}
          >
            <Camera
              defaultSettings={{
                centerCoordinate: pinned
                  ? [parseFloat(caseD.lng), parseFloat(caseD.lat)]
                  : getBrgyCenter(selectedFeature),
                zoomLevel: pinned ? 16 : 14,
              }}
              animationMode="none"
            />
            <BoundaryLayers feature={selectedFeature} prefix="fs-" />
            {pinned && (
              <MarkerView
                coordinate={[parseFloat(caseD.lng), parseFloat(caseD.lat)]}
              >
                <PinMarker color={pinColor} size={44} icon={22} />
              </MarkerView>
            )}
          </MapView>
          {outsideBrgy && (
            <View
              style={{
                position: "absolute",
                top: 70,
                left: 14,
                right: 14,
                backgroundColor: "rgba(185,28,28,0.9)",
                borderRadius: 10,
                padding: 10,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Ionicons name="warning" size={16} color={C.white} />
                <Text
                  style={{ color: C.white, fontSize: 13, fontWeight: "700" }}
                >
                  Outside {caseD.place_barangay} boundary
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* OUTSIDE-BOUNDARY STREET WARNING */}
      <Modal
        visible={!!streetOutsideWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setStreetOutsideWarning("")}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              backgroundColor: C.white,
              borderRadius: 16,
              padding: 24,
              width: "82%",
              gap: 12,
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: C.amberBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="warning" size={20} color={C.amber} />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: C.navy,
                  flex: 1,
                }}
              >
                Outside Barangay Boundary
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: C.sub, lineHeight: 20 }}>
              <Text style={{ fontWeight: "700" }}>
                "{streetOutsideWarning}"
              </Text>{" "}
              is outside{" "}
              <Text style={{ fontWeight: "700" }}>{caseD.place_barangay}</Text>.
              Please select a street within the barangay boundary.
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: C.amber,
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
                marginTop: 4,
              }}
              onPress={() => setStreetOutsideWarning("")}
            >
              <Text style={{ color: C.white, fontWeight: "700", fontSize: 14 }}>
                Got it
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={{ height: 80 }} />
    </ScrollView>
  );
});
