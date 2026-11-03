// screens/eblotter/ViewContent.js
import React, { memo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MapView, Camera, MarkerView } from "@rnmapbox/maps";
import { C, INCIDENT_COLORS } from "./constants";
import { StatusPill } from "./ListUI";
import { Thumb, getVideoThumb } from "./FormSteps";

const vw = StyleSheet.create({
  hero: {
    margin: 14,
    backgroundColor: C.navyMid,
    borderRadius: 20,
    padding: 18,
    gap: 10,
    overflow: "hidden",
  },
  heroId: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroChip: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  heroType: { fontSize: 21, fontWeight: "800", color: C.white, flex: 1 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroMetaTxt: { fontSize: 12, color: "rgba(255,255,255,0.7)", flex: 1 },
  facts: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 12,
  },
  fact: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  factNum: { fontSize: 20, fontWeight: "800", color: C.navy },
  factLbl: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sec: { marginBottom: 8 },
  secHd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  secTt: { fontSize: 11, fontWeight: "800", color: C.white, letterSpacing: 1 },
  card: {
    backgroundColor: C.white,
    marginHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: C.navyMid,
    padding: 12,
    backgroundColor: C.navy50,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  item: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  value: { fontSize: 14, color: C.text, fontWeight: "500", lineHeight: 20 },
});

const VI = (label, value) =>
  !value && value !== 0 && value !== false ? null : (
    <View style={vw.item} key={label}>
      <Text style={vw.label}>{label}</Text>
      <Text style={vw.value}>{String(value)}</Text>
    </View>
  );

function Sec({ title, icon, color, children }) {
  return (
    <View style={vw.sec}>
      <View style={[vw.secHd, { backgroundColor: color || C.navyMid }]}>
        <Ionicons name={icon || "document-outline"} size={13} color={C.white} />
        <Text style={vw.secTt}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const ViewContent = memo(function ViewContent({
  viewData,
  fmt,
  modalAttachments,
  setLightboxImage,
  auditSummary,
}) {
  const d = viewData || {};
  const [showMap, setShowMap] = useState(false);
  const [thumbs, setThumbs] = useState({});

  useEffect(() => {
    (modalAttachments || []).forEach(async (a) => {
      if (a.file_type?.startsWith("video") && !thumbs[a.file_url]) {
        const t = await getVideoThumb(a.file_url);
        if (t) setThumbs((prev) => ({ ...prev, [a.file_url]: t }));
      }
    });
  }, [modalAttachments]);

  useEffect(() => {
    if (d.lat && d.lng) {
      const timer = setTimeout(() => setShowMap(true), 300);
      return () => clearTimeout(timer);
    }
  }, [d.lat, d.lng]);

  if (!viewData) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={C.navyMid} />
      </View>
    );
  }

  const isReferred = (d.blotter_entry_number || "")
    .toUpperCase()
    .startsWith("BRGY");
  const crimeColor = INCIDENT_COLORS[d.incident_type] || "#c1272d";

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={vw.hero}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={vw.heroId}>{d.blotter_entry_number}</Text>
          <StatusPill status={d.status || "Pending"} />
        </View>
        <View style={vw.heroRow}>
          <View style={[vw.heroChip, { backgroundColor: crimeColor }]}>
            <Ionicons name="alert-circle" size={22} color={C.white} />
          </View>
          <Text style={vw.heroType}>{d.incident_type}</Text>
        </View>
        <View style={{ gap: 5 }}>
          <View style={vw.heroMeta}>
            <Ionicons
              name="location-outline"
              size={13}
              color="rgba(255,255,255,0.7)"
            />
            <Text style={vw.heroMetaTxt}>
              Brgy. {d.place_barangay}, {d.place_city_municipality}
            </Text>
          </View>
          <View style={vw.heroMeta}>
            <Ionicons
              name="time-outline"
              size={13}
              color="rgba(255,255,255,0.7)"
            />
            <Text style={vw.heroMetaTxt}>
              Reported {fmt(d.date_time_reported)}
            </Text>
          </View>
        </View>
      </View>

      <View style={vw.facts}>
        <View style={vw.fact}>
          <Text style={vw.factNum}>{(d.complainants || []).length}</Text>
          <Text style={vw.factLbl}>PERSONS</Text>
        </View>
        {!isReferred && (
          <View style={vw.fact}>
            <Text style={vw.factNum}>{(d.suspects || []).length}</Text>
            <Text style={vw.factLbl}>SUSPECTS</Text>
          </View>
        )}
        <View style={vw.fact}>
          <Text style={vw.factNum}>{(modalAttachments || []).length}</Text>
          <Text style={vw.factLbl}>EVIDENCE</Text>
        </View>
      </View>

      <Sec title="PERSONS INVOLVED" icon="people-outline" color={C.navyMid}>
        {(d.complainants || []).map((c, i) => (
          <View key={i} style={vw.card}>
            <Text style={vw.cardTitle}>
              {c.role || "Victim"} #{i + 1}
            </Text>
            {VI(
              "Name",
              [c.first_name, c.middle_name, c.last_name, c.qualifier]
                .filter(Boolean)
                .join(" "),
            )}
            {VI("Gender", c.gender)}
            {VI("Nationality", c.nationality)}
            {VI("Contact", c.contact_number || "N/A")}
            {!isReferred && VI("Alias", c.alias || "N/A")}
            {!isReferred && VI("Occupation", c.occupation || "N/A")}
            {VI(
              "Address",
              [
                c.house_street,
                c.barangay,
                c.city_municipality,
                c.district_province,
                c.region,
              ]
                .filter(
                  (v) =>
                    v &&
                    v !== "null" &&
                    String(v).trim() &&
                    v.toUpperCase() !== "N/A",
                )
                .join(", ") || "—",
            )}
            {VI("Info Obtained", c.info_obtained)}
            {c.role === "Complainant" && c.relationship_to_victim
              ? VI("Relationship to Victim", c.relationship_to_victim)
              : null}
            {c.role === "Witness" && c.witness_statement
              ? VI("Witness Statement", c.witness_statement)
              : null}
          </View>
        ))}
      </Sec>

      {!isReferred && (
        <Sec
          title="SUSPECT INFORMATION"
          icon="alert-circle-outline"
          color={C.navy}
        >
          {(d.suspects || []).length === 0 ? (
            <View
              style={[vw.card, { padding: 20, alignItems: "center", gap: 8 }]}
            >
              <Ionicons
                name="person-remove-outline"
                size={28}
                color={C.faint}
              />
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.muted }}>
                No Suspect Identified
              </Text>
              <Text
                style={{ fontSize: 12, color: C.faint, textAlign: "center" }}
              >
                Suspect information was not provided for this report
              </Text>
            </View>
          ) : (
            (d.suspects || []).map((s, i) => (
              <View key={i} style={vw.card}>
                <Text style={vw.cardTitle}>Suspect #{i + 1}</Text>
                {VI(
                  "Name",
                  [s.first_name, s.middle_name, s.last_name, s.qualifier]
                    .filter(Boolean)
                    .join(" ") || "Unknown",
                )}
                {VI("Alias", s.alias || "N/A")}
                {VI("Gender", s.gender)}
                {VI("Status", s.status)}
                {VI("Degree of Participation", s.degree_participation)}
                {VI("Birthday", s.birthday || "N/A")}
                {VI("Age", s.age || "N/A")}
                {VI("Birth Place", s.birth_place || "N/A")}
                {VI("Nationality", s.nationality)}
                {VI(
                  "Educational Attainment",
                  s.educational_attainment || "N/A",
                )}
                {VI("Height", s.height_cm ? `${s.height_cm} cm` : "N/A")}
                {VI("Drug Used", s.drug_used ? "Yes" : "No")}
                {VI("Occupation", s.occupation || "N/A")}
                {VI("Relation to Victim", s.relation_to_victim || "N/A")}
                {s.location_if_arrested
                  ? VI("Arrest Location", s.location_if_arrested)
                  : null}
                {VI(
                  "Address",
                  [
                    s.house_street,
                    s.barangay,
                    s.city_municipality,
                    s.district_province,
                    s.region,
                  ]
                    .filter(
                      (v) => v && String(v).trim() && v.toUpperCase() !== "N/A",
                    )
                    .join(", ") || "—",
                )}
                {VI("Motive", s.motive || "N/A")}
              </View>
            ))
          )}
        </Sec>
      )}

      <Sec title="CASE DETAILS" icon="clipboard-outline" color={C.slate}>
        <View style={vw.card}>
          {VI("Crime Type", d.incident_type)}
          {!isReferred &&
            (d.offenses || []).map((o, i) => (
              <React.Fragment key={`index-${i}`}>
                {VI("Index Type", o.index_type || "N/A")}
              </React.Fragment>
            ))}
          {!isReferred &&
            VI(
              "Modus Operandi",
              Array.isArray(d.modus_refs) && d.modus_refs.length > 0
                ? d.modus_refs.map((m) => m.modus_name).join(", ")
                : d.modus_text || "N/A",
            )}
          {!isReferred &&
            (d.offenses || []).map((o, i) => (
              <React.Fragment key={`stage-${i}`}>
                {VI("Stage of Felony", o.stage_of_felony || "N/A")}
              </React.Fragment>
            ))}
          {VI("Date of Commission", fmt(d.date_time_commission))}
          {VI("Date Reported", fmt(d.date_time_reported))}
          {!isReferred && VI("COP (Officer on Case)", d.cop || "N/A")}
          {!isReferred && VI("Private Place?", d.is_private_place || "N/A")}
          {!isReferred &&
            VI(
              "Amount Involved",
              d.amount_involved ? `₱${d.amount_involved}` : "N/A",
            )}
          {VI(
            "Place of Commission",
            `${d.place_street}, Brgy. ${d.place_barangay}, ${d.place_city_municipality}, ${d.place_district_province}, ${d.place_region}`,
          )}
          {!isReferred && VI("Type of Place", d.type_of_place || "N/A")}
          {d.narrative && (
            <View style={vw.item}>
              <Text style={vw.label}>Narrative</Text>
              <Text style={[vw.value, { lineHeight: 22 }]}>{d.narrative}</Text>
            </View>
          )}
          {d.lat && d.lng && VI("Coordinates", `${d.lat}, ${d.lng}`)}

          {d.lat && d.lng && (
            <View style={vw.item}>
              <Text style={vw.label}>PIN LOCATION MAP</Text>
              <View
                style={{
                  height: 320,
                  borderRadius: 12,
                  overflow: "hidden",
                  marginTop: 6,
                  borderWidth: 1,
                  borderColor: C.border,
                  backgroundColor: C.slate100,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {!showMap ? (
                  <>
                    <ActivityIndicator size="small" color={C.navyMid} />
                    <Text
                      style={{ fontSize: 12, color: C.muted, marginTop: 8 }}
                    >
                      Loading map...
                    </Text>
                  </>
                ) : (
                  <MapView
                    style={{ flex: 1, alignSelf: "stretch" }}
                    styleURL="mapbox://styles/mapbox/streets-v12"
                    zoomEnabled={false}
                    scrollEnabled={false}
                    pitchEnabled={false}
                    rotateEnabled={false}
                    attributionEnabled={false}
                    logoEnabled={false}
                    compassEnabled={false}
                    scaleBarEnabled={false}
                    pointerEvents="none"
                  >
                    <Camera
                      centerCoordinate={[
                        parseFloat(d.lng) || 0,
                        parseFloat(d.lat) || 0,
                      ]}
                      zoomLevel={16}
                      animationMode="none"
                    />
                    <MarkerView
                      id="view-crime-location"
                      coordinate={[
                        parseFloat(d.lng) || 0,
                        parseFloat(d.lat) || 0,
                      ]}
                    >
                      <View style={{ alignItems: "center" }}>
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: crimeColor,
                            borderWidth: 2.5,
                            borderColor: C.white,
                            elevation: 6,
                          }}
                        />
                        <View
                          style={{
                            width: 4,
                            height: 8,
                            backgroundColor: crimeColor,
                            borderRadius: 2,
                            marginTop: -2,
                          }}
                        />
                      </View>
                    </MarkerView>
                  </MapView>
                )}
              </View>
            </View>
          )}
        </View>
      </Sec>

      {modalAttachments?.length > 0 && (
        <Sec title="EVIDENCE & CCTV" icon="camera-outline" color="#d97706">
          <View
            style={[
              vw.card,
              { padding: 14, flexDirection: "row", flexWrap: "wrap", gap: 8 },
            ]}
          >
            {modalAttachments.map((a) => {
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
                />
              );
            })}
          </View>
        </Sec>
      )}

      <Sec title="RECORD HISTORY" icon="time-outline" color={C.slate}>
        <View style={vw.card}>
          {VI(
            "Created By",
            auditSummary?.created
              ? `${auditSummary.created.name}${auditSummary.created.imported ? " (import)" : ""}`
              : "Not recorded",
          )}
          {VI(
            "Date Created",
            auditSummary?.created
              ? fmt(auditSummary.created.at)
              : "Not recorded",
          )}
          {VI(
            "Last Updated By",
            auditSummary?.updated ? auditSummary.updated.name : "Not recorded",
          )}
          {VI(
            "Last Updated",
            auditSummary?.updated
              ? fmt(auditSummary.updated.at)
              : "Not recorded",
          )}
        </View>
      </Sec>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
});
export default ViewContent;
