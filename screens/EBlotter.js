/**
 * EBlotter.js — B.A.N.T.A.Y. Mobile Reporting Module
 * COMPLETE FIX — All issues resolved
 *
 * FIXES:
 * 1. Barangay filter uses exact same hardcoded list as web (matches DB names)
 * 2. Date picker: web browser uses <input type="date"> native calendar,
 *    Android uses DateTimePicker calendar, iOS uses spinner modal
 * 3. "All Status" shows properly (not dash)
 * 4. Status filter matches web: Under Investigation, Pending, Urgent, Cleared
 * 5. Incident type filter: case-insensitive frontend filter
 * 6. View mode shows ALL fields matching web
 * 7. Missing fields added: Qualifier, Alias, Birthday, Birth Place, Education
 * 8. Name fields letters-only (no numbers)
 * 9. All validations match web
 * 10. NCR address fix
 * 11. ConfirmModal replaces Alert.alert (works on Expo web)
 * 12. Steps outside main component — typing/address works
 */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, TextInput, Modal, ActivityIndicator,
  Platform, Dimensions, FlatList, KeyboardAvoidingView,
  RefreshControl, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

const { height: SH } = Dimensions.get('window');
const API      = 'https://bantay-system-production.up.railway.app';
const PAGE_SIZE = 10;
const PSGC     = 'https://psgc.gitlab.io/api';
const NCR_CODE = '130000000';
const BLANK_F  = { search:'', status:'', incident_type:'', barangay:'', date_from:null, date_to:null };

/* ─── Palette ─────────────────────────────────────────────────────────────── */
const C = {
  navy:'#0B2447', navyMid:'#19376D', navy50:'#EEF3FF',
  red:'#B91C1C', redBg:'#FEE2E2',
  green:'#15803D', greenBg:'#DCFCE7',
  amber:'#B45309', amberBg:'#FEF3C7',
  slate:'#334155', slate100:'#F1F5F9',
  white:'#FFFFFF', bg:'#F1F5F9', border:'#E2E8F0',
  text:'#0F172A', sub:'#475569', muted:'#94A3B8', faint:'#CBD5E1',
};

const STATUS_CFG = {
  'Pending':             { bg:'#EFF6FF', fg:'#1D4ED8', dot:'#3B82F6' },
  'Under Investigation': { bg:C.amberBg, fg:C.amber,   dot:'#F59E0B' },
  'Resolved':            { bg:C.greenBg, fg:C.green,   dot:C.green   },
  'Cleared':             { bg:C.greenBg, fg:C.green,   dot:C.green   },
  'Solved':              { bg:'#FEF9C3', fg:'#854D0E', dot:'#CA8A04' },
  'Referred to Case':    { bg:C.slate100,fg:C.slate,   dot:C.muted   },
  'Urgent':              { bg:C.redBg,   fg:C.red,     dot:C.red     },
};

/* ─── Constants ───────────────────────────────────────────────────────────── */
const CRIME_MAP = {
  'Murder':'MURDER','Homicide':'HOMICIDE','Physical Injury':'PHYSICAL INJURIES',
  'Rape':'RAPE','Robbery':'ROBBERY','Theft':'THEFT',
  'Carnapping - MC':'CARNAPPING - MC','Carnapping - MV':'CARNAPPING - MV',
  'Special Complex Crime':'SPECIAL COMPLEX CRIME',
};
const INCIDENTS  = ['Murder','Homicide','Physical Injury','Rape','Robbery','Theft','Carnapping - MC','Carnapping - MV','Special Complex Crime'];
const NATS       = ['FILIPINO','AMERICAN','CHINESE','JAPANESE','KOREAN','INDIAN','BRITISH','AUSTRALIAN','CANADIAN','GERMAN','FRENCH','SPANISH','INDONESIAN','MALAYSIAN','SINGAPOREAN','THAI','VIETNAMESE','Other'];
// FIX 4: Status matches web exactly
const STATUSES = ['Under Investigation','Pending','Urgent','Cleared','Solved'];
const S_STAT     = ['At Large','In Custody','Arrested','Detained','Released on Bail','Deceased','Unknown'];
const DEGREES    = ['Principal','Accomplice','Accessory'];
const INFO_OB    = ['Personal','Telephone','Walk-in','Online','Email','Third Party'];
const STAGES     = ['COMPLETED','ATTEMPTED','FRUSTRATED'];
const PRIV       = ['Yes','No','Unknown'];
const QUALIFIERS = ['Jr.','Sr.','II','III','IV','V'];
const EDU_ATT    = ['No Formal Education','Elementary Undergraduate','Elementary Graduate','High School Undergraduate','High School Graduate','Vocational','College Undergraduate','College Graduate','Post Graduate'];
const TOP_PLACE  = ['Abandoned Structure (house, bldg, apartment/condo)','Along the street','Commercial/Business Establishment','Construction/Industrial Barracks','Farm/Ricefield','Government Office/Establishment','Onboard a vehicle (riding in/on)','Parking Area (vacant lot, in bldg/structure, open parking)','Recreational Place (resorts/parks)','Residential (house/condo)','River/Lake','School (Grade/High School/College/University)','Transportation Terminals (Tricycle, Jeep, FX, Bus, Train Station)','Vacant Lot (unused/unoccupied open area)'];
const BRGY_MAP   = {'ANIBAN 1':'ANIBAN I','ANIBAN 2':'ANIBAN II','HABAY 1':'HABAY I','HABAY 2':'HABAY II','MOLINO 1':'MOLINO I','MOLINO 2':'MOLINO II','MOLINO 3':'MOLINO III','MOLINO 4':'MOLINO IV','MOLINO 5':'MOLINO V','MOLINO 6':'MOLINO VI','MOLINO 7':'MOLINO VII','NIOG 1':'NIOG I','TALABA 1':'TALABA I','TALABA 2':'TALABA II','TALABA 3':'TALABA III','SALINAS 1':'SALINAS I','SALINAS 2':'SALINAS II','MALIKSI 1':'MALIKSI I','MALIKSI 2':'MALIKSI II','LIGAS 1':'LIGAS I','LIGAS 2':'LIGAS II'};

// FIX 1: Exact same barangay list as web — matches database names exactly
// Exact same as web barangayOptions.js
const BACOOR_BARANGAYS = [
  "ANIBAN I","ANIBAN II","BAYANAN","DULONG BAYAN",
  "HABAY I","HABAY II","KAINGIN (POB.)",
  "KAINGIN DIGMAN",
  "LIGAS I","LIGAS II",
  "MABOLO","MALIKSI I","MALIKSI II",
  "MAMBOG I","MAMBOG II","MAMBOG III","MAMBOG IV",
  "MOLINO I","MOLINO II","MOLINO III","MOLINO IV",
  "MOLINO V","MOLINO VI","MOLINO VII",
  "NIOG",
  "P.F. ESPIRITU I (PANAPAAN)","P.F. ESPIRITU II",
  "P.F. ESPIRITU III","P.F. ESPIRITU IV",
  "P.F. ESPIRITU V","P.F. ESPIRITU VI",
  "QUEENS ROW CENTRAL","QUEENS ROW EAST","QUEENS ROW WEST",
  "REAL",
  "SALINAS I","SALINAS II",
  "SAN NICOLAS I","SAN NICOLAS II","SAN NICOLAS III",
  "SINEGUELASAN",
  "TALABA I","TALABA II","TALABA III",
  "ZAPOTE I","ZAPOTE II","ZAPOTE III",
];

// Exact same as web LEGACY_BARANGAY_OPTIONS
const LEGACY_BARANGAYS = [
  { label:"Alima (→ Sineguelasan)",        value:"SINEGUELASAN" },
  { label:"Banalo (→ Sineguelasan)",       value:"SINEGUELASAN" },
  { label:"Camposanto (→ Kaingin Pob.)",   value:"KAINGIN (POB.)" },
  { label:"Daang Bukid (→ Kaingin Pob.)",  value:"KAINGIN (POB.)" },
  { label:"Tabing Dagat (→ Kaingin Pob.)", value:"KAINGIN (POB.)" },
  { label:"Kaingin (→ Kaingin Digman)",    value:"KAINGIN DIGMAN" },
  { label:"Digman (→ Kaingin Digman)",     value:"KAINGIN DIGMAN" },
  { label:"Panapaan (→ P.F. Espiritu I)",    value:"P.F. ESPIRITU I (PANAPAAN)" },
  { label:"Panapaan 2 (→ P.F. Espiritu II)", value:"P.F. ESPIRITU II" },
  { label:"Panapaan 4 (→ P.F. Espiritu IV)", value:"P.F. ESPIRITU IV" },
  { label:"Panapaan 5 (→ P.F. Espiritu V)",  value:"P.F. ESPIRITU V" },
  { label:"Panapaan 6 (→ P.F. Espiritu VI)", value:"P.F. ESPIRITU VI" },
  { label:"Mabolo 1 (→ Mabolo)",      value:"MABOLO" },
  { label:"Mabolo 2 (→ Mabolo)",      value:"MABOLO" },
  { label:"Mabolo 3 (→ Mabolo)",      value:"MABOLO" },
  { label:"Aniban 3 (→ Aniban I)",    value:"ANIBAN I" },
  { label:"Aniban 4 (→ Aniban II)",   value:"ANIBAN II" },
  { label:"Aniban 5 (→ Aniban I)",    value:"ANIBAN I" },
  { label:"Maliksi 3 (→ Maliksi II)", value:"MALIKSI II" },
  { label:"Mambog 5 (→ Mambog II)",   value:"MAMBOG II" },
  { label:"Niog 2 (→ Niog)",          value:"NIOG" },
  { label:"Niog 3 (→ Niog)",          value:"NIOG" },
  { label:"Real 2 (→ Real)",          value:"REAL" },
  { label:"Salinas 3 (→ Salinas II)", value:"SALINAS II" },
  { label:"Salinas 4 (→ Salinas II)", value:"SALINAS II" },
  { label:"Talaba 4 (→ Talaba III)",  value:"TALABA III" },
  { label:"Talaba 7 (→ Talaba I)",    value:"TALABA I" },
];
/* FIX: Letter-only helper for name fields */
const lettersOnly = (v) => v.replace(/[^A-Za-zÑñ\s'-]/g, '');

const mkC = () => ({
  first_name:'',middle_name:'',last_name:'',qualifier:'',alias:'',
  gender:'Male',nationality:'FILIPINO',contact_number:'',
  region_code:'',province_code:'',municipality_code:'',barangay_code:'',
  house_street:'',info_obtained:'Personal',occupation:'',
});
const mkS = () => ({
  first_name:'',middle_name:'',last_name:'',qualifier:'',alias:'',
  gender:'Male',birthday:'',age:'',birth_place:'',nationality:'FILIPINO',
  region_code:'',province_code:'',municipality_code:'',barangay_code:'',
  house_street:'',status:'At Large',location_if_arrested:'',
  degree_participation:'Principal',relation_to_victim:'',
  educational_attainment:'',height_cm:'',drug_used:false,motive:'',occupation:'',
});
const mkO    = (p=true) => ({ is_principal_offense:p,offense_name:'',stage_of_felony:'',index_type:'Non-Index',investigator_on_case:'',most_investigator:'' });
const mkCase = () => ({
  incident_type:'Theft',cop:'',date_time_commission:'',date_time_reported:'',
  place_region:'Region IV-A (CALABARZON)',place_district_province:'Cavite',
  place_city_municipality:'Bacoor City',place_barangay:'',place_street:'',
  is_private_place:'',narrative:'',amount_involved:'',
  referred_by_barangay:false,referred_by_dilg:false,
});

/* ═══════════════════════════════════════════════════════════════════════════
   PSGC HOOK
═══════════════════════════════════════════════════════════════════════════ */
function usePSGC() {
  const [regions, setRegions]   = useState([]);
  const [loadingR, setLoadingR] = useState(false);
  const cache = useRef({});

  useEffect(() => {
    setLoadingR(true);
    fetch(`${PSGC}/regions/`)
      .then(r => r.json())
      .then(d => setRegions(Array.isArray(d) ? d.sort((a,b) => a.name.localeCompare(b.name)) : []))
      .catch(() => {})
      .finally(() => setLoadingR(false));
  }, []);

  const get = useCallback(async (url) => {
    if (cache.current[url]) return cache.current[url];
    try {
      const r = await fetch(url);
      const d = await r.json();
      const s = Array.isArray(d) ? d.sort((a,b) => a.name.localeCompare(b.name)) : [];
      cache.current[url] = s;
      return s;
    } catch { return []; }
  }, []);

  return {
    regions, loadingR,
    getProvinces: code => get(`${PSGC}/regions/${code}/provinces/`),
    // NCR fix: use region endpoint for NCR
    getCities: code => code === NCR_CODE
      ? get(`${PSGC}/regions/${code}/cities-municipalities/`)
      : get(`${PSGC}/provinces/${code}/cities-municipalities/`),
    getBarangays: code => get(`${PSGC}/cities-municipalities/${code}/barangays/`),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIRM MODAL — replaces Alert.alert, works on Expo web
═══════════════════════════════════════════════════════════════════════════ */
const ConfirmModal = memo(function ConfirmModal({ visible, title, message, confirmText, confirmColor, onConfirm, onCancel }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={cm.overlay}>
        <View style={cm.box}>
          <Text style={cm.title}>{title}</Text>
          <Text style={cm.msg}>{message}</Text>
          <View style={cm.row}>
            <TouchableOpacity style={cm.cancelBtn} onPress={onCancel}>
              <Text style={cm.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cm.confirmBtn, { backgroundColor: confirmColor || C.red }]} onPress={onConfirm}>
              <Text style={cm.confirmTxt}>{confirmText || 'Confirm'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
});
const cm = StyleSheet.create({
  overlay:   { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:30 },
  box:       { backgroundColor:C.white, borderRadius:16, padding:24, width:'100%', maxWidth:340 },
  title:     { fontSize:17, fontWeight:'800', color:C.text, marginBottom:10 },
  msg:       { fontSize:14, color:C.sub, lineHeight:22, marginBottom:24 },
  row:       { flexDirection:'row', gap:10 },
  cancelBtn: { flex:1, paddingVertical:12, borderRadius:10, borderWidth:1.5, borderColor:C.border, alignItems:'center' },
  cancelTxt: { fontSize:14, fontWeight:'600', color:C.sub },
  confirmBtn:{ flex:1, paddingVertical:12, borderRadius:10, alignItems:'center' },
  confirmTxt:{ fontSize:14, fontWeight:'700', color:C.white },
});

/* ═══════════════════════════════════════════════════════════════════════════
   FIX 2: DATE PICKER — web uses native HTML calendar, mobile uses DateTimePicker
═══════════════════════════════════════════════════════════════════════════ */
function DatePickerBtn({ label, value, onChange, maximumDate }) {
  const [show, setShow] = useState(false);
  const [temp, setTemp] = useState(new Date());

  const fmtDisplay = (d) => d
    ? `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`
    : '';

  const fmtISO = (d) => d
    ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    : '';

  const maxISO = fmtISO(maximumDate || new Date());

  // WEB BROWSER — use native HTML <input type="date"> — shows calendar on click
if (Platform.OS === 'web') {
    return (
      <View style={[inp.base, { padding:0, overflow:'hidden', flexDirection:'row', alignItems:'center' }]}>
        <input
          type="date"
          value={fmtISO(value)}
          max={maxISO}
          onChange={e => {
            if (e.target.value) {
              const parts = e.target.value.split('-');
              const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
              onChange(d);
            }
          }}
          style={{
            border: 'none',
            outline: 'none',
            padding: '12px 14px',
            fontSize: 14,
            color: value ? '#0F172A' : '#CBD5E1',
            width: '100%',
            backgroundColor: 'white',
            cursor: 'pointer',
            fontFamily: 'inherit',
            height: '46px',
            boxSizing: 'border-box',
          }}
        />
      </View>
    );
  }

  // ANDROID — native calendar popup
  // IOS — modal with spinner
  return (
    <View>
      <TouchableOpacity
        style={[inp.base, { flexDirection:'row', justifyContent:'space-between', alignItems:'center' }]}
        onPress={() => { setTemp(value || new Date()); setShow(true); }}
      >
        <Text style={{ fontSize:14, color: value ? C.text : C.faint, flex:1 }}>
          {fmtDisplay(value) || 'mm/dd/yyyy'}
        </Text>
        <Ionicons name="calendar-outline" size={16} color={C.muted} />
      </TouchableOpacity>

      {Platform.OS === 'ios' && show && (
        <Modal visible transparent animationType="slide">
          <View style={dpk.iosOverlay}>
            <View style={dpk.iosSheet}>
              <View style={dpk.iosHdr}>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text style={dpk.iosCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={dpk.iosTitle}>{label}</Text>
                <TouchableOpacity onPress={() => { onChange(temp); setShow(false); }}>
                  <Text style={dpk.iosDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={temp}
                mode="date"
                display="spinner"
                onChange={(_, d) => d && setTemp(d)}
                maximumDate={maximumDate || new Date()}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={temp}
          mode="date"
          display="calendar"
          onChange={(evt, d) => {
            setShow(false);
            if (evt.type !== 'dismissed' && d) onChange(d);
          }}
          maximumDate={maximumDate || new Date()}
        />
      )}
    </View>
  );
}
const dpk = StyleSheet.create({
  iosOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.4)', justifyContent:'flex-end' },
  iosSheet:  { backgroundColor:C.white, borderTopLeftRadius:20, borderTopRightRadius:20, paddingBottom:36 },
  iosHdr:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:C.border },
  iosTitle:  { fontSize:16, fontWeight:'700', color:C.text },
  iosCancel: { fontSize:15, color:C.sub },
  iosDone:   { fontSize:15, fontWeight:'700', color:C.navyMid },
});

/* ═══════════════════════════════════════════════════════════════════════════
   PICKER MODAL
═══════════════════════════════════════════════════════════════════════════ */
const PickerModal = memo(function PickerModal({ visible, title, options, selected, onSelect, onClose }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (!visible) setQ(''); }, [visible]);
  if (!visible) return null;

  const filtered = (options || []).filter(o => {
    const l = typeof o === 'string' ? o : (o.name || '');
    return l.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={pk.overlay}>
        <TouchableOpacity style={pk.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={pk.sheet}>
          <View style={pk.pill} />
          <View style={pk.header}>
            <Text style={pk.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={pk.xBtn} hitSlop={{ top:14, bottom:14, left:14, right:14 }}>
              <Ionicons name="close" size={16} color={C.sub} />
            </TouchableOpacity>
          </View>
          <View style={pk.searchRow}>
            <Ionicons name="search-outline" size={14} color={C.muted} />
            <TextInput style={pk.searchIn} placeholder="Search…" value={q} onChangeText={setQ} placeholderTextColor={C.muted} autoFocus />
            {q.length > 0 && (
              <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
                <Ionicons name="close-circle" size={14} color={C.muted} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(_, i) => String(i)}
            style={{ maxHeight: SH * 0.45 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              // FIX 3: Handle {label, value} objects for "All Status" type options
       const isObj = typeof item === 'object' && item !== null && !item.code;
              const l   = isObj ? item.label : (typeof item === 'string' ? item : (item.name || ''));
              const val = isObj ? item.value : (typeof item === 'string' ? item : (item.code || item.name || ''));
              const sel = selected === val;
              const isDivider = val === '__divider__';
              // Render divider differently
              if (isDivider) {
                return (
                  <View style={{ paddingHorizontal:20, paddingVertical:10, backgroundColor:C.slate100 }}>
                    <Text style={{ fontSize:11, fontWeight:'700', color:C.muted, letterSpacing:0.5 }}>{l}</Text>
                  </View>
                );
              }
              return (
                <TouchableOpacity style={[pk.option, sel && pk.optSel]} onPress={() => { onSelect(val); onClose(); }}>
                  <Text style={[pk.optTxt, sel && pk.optTxtSel]} numberOfLines={2}>{l || '—'}</Text>
                  {sel && <Ionicons name="checkmark-circle" size={18} color={C.navyMid} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={pk.empty}>No results</Text>}
          />
        </View>
      </View>
    </Modal>
  );
});
const pk = StyleSheet.create({
  overlay:   { flex:1, justifyContent:'flex-end' },
  backdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(11,36,71,0.55)' },
  sheet:     { backgroundColor:C.white, borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom:36, maxHeight:SH*0.8 },
  pill:      { width:40, height:4, backgroundColor:C.border, borderRadius:2, alignSelf:'center', marginTop:10, marginBottom:4 },
  header:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:C.border },
  title:     { fontSize:16, fontWeight:'800', color:C.navy },
  xBtn:      { width:30, height:30, borderRadius:15, backgroundColor:C.bg, alignItems:'center', justifyContent:'center' },
  searchRow: { flexDirection:'row', alignItems:'center', gap:8, margin:14, backgroundColor:C.bg, borderRadius:12, paddingHorizontal:12, paddingVertical:9, borderWidth:1, borderColor:C.border },
  searchIn:  { flex:1, fontSize:14, color:C.text },
  option:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingVertical:14, borderBottomWidth:0.5, borderBottomColor:C.border },
  optSel:    { backgroundColor:C.navy50 },
  optTxt:    { fontSize:14, color:C.sub, flex:1, marginRight:8 },
  optTxtSel: { color:C.navyMid, fontWeight:'700' },
  empty:     { textAlign:'center', color:C.muted, padding:24, fontSize:14 },
});

/* ─── Form primitives ─────────────────────────────────────────────────────── */
function FField({ label, required, error, hint, children }) {
  return (
    <View style={ff.g}>
      <Text style={ff.l}>{label}{required && <Text style={ff.r}> *</Text>}</Text>
      {children}
      {hint && !error && <Text style={ff.h}>{hint}</Text>}
      {error && <View style={ff.er}><Ionicons name="alert-circle" size={11} color={C.red} /><Text style={ff.et}> {error}</Text></View>}
    </View>
  );
}
const ff = StyleSheet.create({
  g: { marginBottom:14 },
  l: { fontSize:11, fontWeight:'700', color:C.slate, marginBottom:6, letterSpacing:0.4, textTransform:'uppercase' },
  r: { color:C.red },
  h: { fontSize:11, color:C.muted, marginTop:4 },
  er:{ flexDirection:'row', alignItems:'center', marginTop:5 },
  et:{ fontSize:11, color:C.red },
});

function TInput({ value, onChange, placeholder, error, multiline, lines, kb, maxLen, editable=true }) {
  return (
    <TextInput
      style={[inp.base, error&&inp.err, multiline&&{height:Math.max(96,(lines||4)*26),textAlignVertical:'top',paddingTop:12}, !editable&&inp.dis]}
      value={String(value??'')}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={C.faint}
      multiline={multiline}
      keyboardType={kb||'default'}
      maxLength={maxLen}
      editable={editable}
      autoCorrect={false}
    />
  );
}
const inp = StyleSheet.create({
  base:{ borderWidth:1.5, borderColor:C.border, borderRadius:12, paddingHorizontal:14, paddingVertical:12, fontSize:14, color:C.text, backgroundColor:C.white },
  err: { borderColor:C.red, backgroundColor:'#FFF5F5' },
  dis: { backgroundColor:C.slate100, color:C.muted },
});

function SelBtn({ label, value, onPress, error, disabled }) {
  return (
    <TouchableOpacity
      style={[inp.base,{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},error&&inp.err,disabled&&inp.dis]}
      onPress={disabled?null:onPress} activeOpacity={disabled?1:0.75}
    >
      <Text style={{fontSize:14,color:value?C.text:C.faint,flex:1}} numberOfLines={1}>{value||label}</Text>
      <Ionicons name="chevron-down" size={16} color={disabled?C.faint:C.muted}/>
    </TouchableOpacity>
  );
}

function Toggle({ opts, value, onChange }) {
  return (
    <View style={{flexDirection:'row',gap:8}}>
      {opts.map(o=>{
        const on=value===o.v;
        return(
          <TouchableOpacity key={String(o.v)} style={[tg.btn,on&&tg.on]} onPress={()=>onChange(o.v)}>
            {o.ic&&<Ionicons name={o.ic} size={13} color={on?C.white:C.sub}/>}
            <Text style={[tg.txt,on&&tg.onTxt]}>{o.l}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const tg = StyleSheet.create({
  btn:  {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:11,borderWidth:1.5,borderColor:C.border,borderRadius:12,backgroundColor:C.white},
  on:   {backgroundColor:C.navyMid,borderColor:C.navyMid},
  txt:  {fontSize:13,fontWeight:'600',color:C.sub},
  onTxt:{color:C.white},
});

function SBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG['Pending'];
  return (
    <View style={[bdg.wrap,{backgroundColor:cfg.bg}]}>
      <View style={[bdg.dot,{backgroundColor:cfg.dot}]}/>
      <Text style={[bdg.txt,{color:cfg.fg}]}>{status}</Text>
    </View>
  );
}
const bdg = StyleSheet.create({
  wrap:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:5,borderRadius:20},
  dot: {width:6,height:6,borderRadius:3},
  txt: {fontSize:11,fontWeight:'700'},
});

function Pagination({ page, total, pageSize, onChange }) {
  const pages=Math.ceil(total/pageSize);
  if(pages<=1)return null;
  const from=(page-1)*pageSize+1, to=Math.min(page*pageSize,total);
  const arr=[];
  if(pages<=5){for(let i=1;i<=pages;i++)arr.push(i);}
  else{arr.push(1);if(page>3)arr.push('…');for(let i=Math.max(2,page-1);i<=Math.min(pages-1,page+1);i++)arr.push(i);if(page<pages-2)arr.push('…');arr.push(pages);}
  return(
    <View style={pg.wrap}>
      <Text style={pg.info}>{from}–{to} of {total} records</Text>
      <View style={pg.row}>
        <TouchableOpacity style={[pg.btn,page===1&&pg.dis]} onPress={()=>page>1&&onChange(page-1)} disabled={page===1}>
          <Ionicons name="chevron-back" size={14} color={page===1?C.faint:C.navyMid}/>
        </TouchableOpacity>
        {arr.map((n,i)=>(
          <TouchableOpacity key={i} style={[pg.btn,n===page&&pg.act,n==='…'&&{borderWidth:0,backgroundColor:'transparent'}]} onPress={()=>typeof n==='number'&&onChange(n)} disabled={n==='…'}>
            <Text style={[pg.btnTxt,n===page&&pg.btnTxtAct]}>{n}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[pg.btn,page===pages&&pg.dis]} onPress={()=>page<pages&&onChange(page+1)} disabled={page===pages}>
          <Ionicons name="chevron-forward" size={14} color={page===pages?C.faint:C.navyMid}/>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const pg = StyleSheet.create({
  wrap:      {padding:16,backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.border,alignItems:'center',gap:8},
  info:      {fontSize:12,color:C.muted,fontWeight:'500'},
  row:       {flexDirection:'row',gap:4,flexWrap:'wrap',justifyContent:'center'},
  btn:       {width:32,height:32,borderRadius:8,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center',backgroundColor:C.white},
  act:       {backgroundColor:C.navyMid,borderColor:C.navyMid},
  dis:       {opacity:0.3},
  btnTxt:    {fontSize:12,fontWeight:'600',color:C.sub},
  btnTxtAct: {color:C.white},
});

/* ═══════════════════════════════════════════════════════════════════════════
   ADDRESS CASCADE — module level
═══════════════════════════════════════════════════════════════════════════ */
const AddrFields = memo(function AddrFields({ data, onUpdate, errors, pfx, regions, loadingR, provinces, cities, barangays, lPr, lCi, lBr, onReg, onProv, onCity }) {
  const [pk, setPk] = useState(null);
  const isNCR = data.region_code === NCR_CODE;

  const rName = (regions||[]).find(r=>r.code===data.region_code)?.name || '';
  const pName = isNCR ? 'N/A (NCR has no province)' : ((provinces||[]).find(p=>p.code===data.province_code)?.name||'');
  const cName = (cities||[]).find(c=>c.code===data.municipality_code)?.name || '';
  const bName = (barangays||[]).find(b=>b.code===data.barangay_code)?.name || '';

  // Check if record has no codes but has saved text address
  const hasSavedText = !data.region_code && (data.region || data.district_province || data.city_municipality || data.barangay);
  const savedAddressText = hasSavedText
    ? [data.region, data.district_province, data.city_municipality, data.barangay].filter(Boolean).join(' > ')
    : null;
return (
    <>
      {/* Show warning if record has no PSGC codes */}
      {savedAddressText && (
        <View style={{ backgroundColor:'#FEF3C7', borderRadius:10, padding:12, marginBottom:14, borderWidth:1, borderColor:'#F59E0B' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:6, marginBottom:4 }}>
            <Ionicons name="warning-outline" size={14} color="#B45309" />
            <Text style={{ fontSize:12, fontWeight:'700', color:'#B45309' }}>Previous address (please re-select below):</Text>
          </View>
          <Text style={{ fontSize:13, color:'#92400E' }}>{savedAddressText}</Text>
        </View>
      )}
      <FField label="Region" required error={errors[pfx+'_reg']}>
        <SelBtn label={loadingR?'Loading regions…':'Select Region'} value={rName} onPress={()=>setPk('r')} error={errors[pfx+'_reg']} disabled={loadingR}/>
      </FField>
      <FField label="Province" required={!isNCR} error={!isNCR?errors[pfx+'_prov']:null}>
        <SelBtn label={lPr?'Loading…':isNCR?'N/A (NCR has no province)':!data.region_code?'Select region first':'Select Province'}
          value={isNCR?'N/A (NCR has no province)':pName}
          onPress={()=>!isNCR&&setPk('p')} error={!isNCR&&errors[pfx+'_prov']}
          disabled={isNCR||!data.region_code||lPr}/>
      </FField>
      <FField label="City / Municipality" required error={errors[pfx+'_city']}>
        <SelBtn label={lCi?'Loading…':(!data.province_code&&!isNCR)?'Select province first':'Select City/Municipality'}
          value={cName} onPress={()=>setPk('c')} error={errors[pfx+'_city']}
          disabled={(!data.province_code&&!isNCR)||lCi}/>
      </FField>
      <FField label="Barangay" required error={errors[pfx+'_brgy']}>
        <SelBtn label={lBr?'Loading…':!data.municipality_code?'Select city first':'Select Barangay'}
          value={bName} onPress={()=>setPk('b')} error={errors[pfx+'_brgy']}
          disabled={!data.municipality_code||lBr}/>
      </FField>
      <PickerModal visible={pk==='r'} title="Select Region"           options={regions||[]}   selected={data.region_code}       onSelect={c=>{onReg(c);setPk(null);}} onClose={()=>setPk(null)}/>
      <PickerModal visible={pk==='p'} title="Select Province"         options={provinces||[]} selected={data.province_code}     onSelect={c=>{onProv(c);setPk(null);}} onClose={()=>setPk(null)}/>
      <PickerModal visible={pk==='c'} title="Select City/Municipality" options={cities||[]}   selected={data.municipality_code} onSelect={c=>{onCity(c);setPk(null);}} onClose={()=>setPk(null)}/>
      <PickerModal visible={pk==='b'} title="Select Barangay"         options={barangays||[]} selected={data.barangay_code}     onSelect={c=>{onUpdate('barangay_code',c);setPk(null);}} onClose={()=>setPk(null)}/>
    </>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 1 — COMPLAINANT
═══════════════════════════════════════════════════════════════════════════ */
const Step1 = memo(function Step1({ comp, setComp, formErr, activePick, setActivePick, regions, loadingR, cPr, cCi, cBr, cLP, cLC, cLB, cReg, cPrv, cCit, uC }) {
  return (
    <ScrollView style={sx.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {comp.map((c,i)=>(
        <View key={i} style={sx.card}>
          <View style={sx.cardHdr}>
            <View style={[sx.badge,{backgroundColor:C.navyMid}]}><Text style={sx.badgeTxt}>{i+1}</Text></View>
            <Text style={sx.cardTitle}>Complainant #{i+1}</Text>
            {comp.length>1&&<TouchableOpacity onPress={()=>setComp(p=>p.filter((_,x)=>x!==i))} style={sx.rmBtn}><Ionicons name="trash-outline" size={12} color={C.red}/><Text style={sx.rmTxt}>Remove</Text></TouchableOpacity>}
          </View>
          <View style={sx.row2}>
            <View style={{flex:1}}>
              <FField label="First Name" required error={formErr[`c${i}fn`]}>
                <TInput value={c.first_name} onChange={v=>uC(i,'first_name',lettersOnly(v))} placeholder="First Name" error={formErr[`c${i}fn`]} maxLen={50}/>
              </FField>
            </View>
            <View style={{width:8}}/>
            <View style={{flex:1}}>
              <FField label="Last Name" required error={formErr[`c${i}ln`]}>
                <TInput value={c.last_name} onChange={v=>uC(i,'last_name',lettersOnly(v))} placeholder="Last Name" error={formErr[`c${i}ln`]} maxLen={50}/>
              </FField>
            </View>
          </View>
          <FField label="Middle Name"><TInput value={c.middle_name} onChange={v=>uC(i,'middle_name',lettersOnly(v))} placeholder="Middle Name" maxLen={50}/></FField>
          <View style={sx.row2}>
            <View style={{flex:1}}>
              <FField label="Qualifier">
                <SelBtn label="None" value={c.qualifier} onPress={()=>setActivePick(`cq${i}`)}/>
              </FField>
              <PickerModal visible={activePick===`cq${i}`} title="Qualifier" options={QUALIFIERS} selected={c.qualifier} onSelect={v=>{uC(i,'qualifier',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
            </View>
            <View style={{width:8}}/>
            <View style={{flex:1}}>
              <FField label="Alias"><TInput value={c.alias} onChange={v=>uC(i,'alias',v)} placeholder="Alias" maxLen={50}/></FField>
            </View>
          </View>
          <FField label="Gender" required><Toggle opts={[{l:'Male',v:'Male',ic:'male'},{l:'Female',v:'Female',ic:'female'}]} value={c.gender} onChange={v=>uC(i,'gender',v)}/></FField>
          <FField label="Nationality" required error={formErr[`c${i}nat`]}>
            <SelBtn label="Select Nationality" value={c.nationality} onPress={()=>setActivePick(`cn${i}`)} error={formErr[`c${i}nat`]}/>
          </FField>
          <PickerModal visible={activePick===`cn${i}`} title="Nationality" options={NATS} selected={c.nationality} onSelect={v=>{uC(i,'nationality',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
          <FField label="Contact Number" error={formErr[`c${i}cn`]} hint="11 digits starting with 09">
            <TextInput style={[inp.base,formErr[`c${i}cn`]&&inp.err]} value={String(c.contact_number??'')} onChangeText={v=>uC(i,'contact_number',v.replace(/\D/g,''))} placeholder="09XXXXXXXXX" placeholderTextColor={C.faint} keyboardType="number-pad" maxLength={11} autoCorrect={false}/>
          </FField>
          <FField label="Occupation"><TInput value={c.occupation} onChange={v=>uC(i,'occupation',v)} placeholder="e.g. Teacher, Driver" maxLen={100}/></FField>
          <AddrFields data={c} onUpdate={(f,v)=>uC(i,f,v)} errors={{[`c${i}_reg`]:formErr[`c${i}_reg`],[`c${i}_prov`]:formErr[`c${i}_prov`],[`c${i}_city`]:formErr[`c${i}_city`],[`c${i}_brgy`]:formErr[`c${i}_brgy`]}} pfx={`c${i}`} regions={regions} loadingR={loadingR} provinces={cPr[i]||[]} cities={cCi[i]||[]} barangays={cBr[i]||[]} lPr={!!cLP[i]} lCi={!!cLC[i]} lBr={!!cLB[i]} onReg={v=>cReg(i,v)} onProv={v=>cPrv(i,v)} onCity={v=>cCit(i,v)}/>
          <FField label="House No. / Street" required error={formErr[`c${i}hs`]}><TInput value={c.house_street} onChange={v=>uC(i,'house_street',v)} placeholder="e.g. 123 Rizal Street" error={formErr[`c${i}hs`]} maxLen={200}/></FField>
          <FField label="Info Obtained" required error={formErr[`c${i}inf`]}>
            <SelBtn label="Select" value={c.info_obtained} onPress={()=>setActivePick(`ci${i}`)} error={formErr[`c${i}inf`]}/>
          </FField>
          <PickerModal visible={activePick===`ci${i}`} title="Info Obtained" options={INFO_OB} selected={c.info_obtained} onSelect={v=>{uC(i,'info_obtained',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
        </View>
      ))}
      <TouchableOpacity style={sx.addBtn} onPress={()=>setComp(p=>[...p,mkC()])}>
        <Ionicons name="add-circle" size={18} color={C.navyMid}/><Text style={sx.addTxt}>Add Another Complainant</Text>
      </TouchableOpacity>
      <View style={{height:80}}/>
    </ScrollView>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 2 — SUSPECT
═══════════════════════════════════════════════════════════════════════════ */
const Step2 = memo(function Step2({ susp, setSusp, formErr, activePick, setActivePick, regions, loadingR, sPr, sCi, sBr, sLP, sLC, sLB, sReg, sPrv, sCit, uS }) {
  return (
    <ScrollView style={sx.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {susp.map((s,i)=>(
        <View key={i} style={sx.card}>
          <View style={sx.cardHdr}>
            <View style={[sx.badge,{backgroundColor:C.red}]}><Text style={sx.badgeTxt}>{i+1}</Text></View>
            <Text style={sx.cardTitle}>Suspect #{i+1}</Text>
            {susp.length>1&&<TouchableOpacity onPress={()=>setSusp(p=>p.filter((_,x)=>x!==i))} style={sx.rmBtn}><Ionicons name="trash-outline" size={12} color={C.red}/><Text style={sx.rmTxt}>Remove</Text></TouchableOpacity>}
          </View>
          <View style={sx.row2}>
            <View style={{flex:1}}>
              <FField label="First Name" required error={formErr[`s${i}fn`]}>
                <TInput value={s.first_name} onChange={v=>uS(i,'first_name',lettersOnly(v))} placeholder="First Name" error={formErr[`s${i}fn`]} maxLen={50}/>
              </FField>
            </View>
            <View style={{width:8}}/>
            <View style={{flex:1}}>
              <FField label="Last Name" required error={formErr[`s${i}ln`]}>
                <TInput value={s.last_name} onChange={v=>uS(i,'last_name',lettersOnly(v))} placeholder="Last Name" error={formErr[`s${i}ln`]} maxLen={50}/>
              </FField>
            </View>
          </View>
          <FField label="Middle Name"><TInput value={s.middle_name} onChange={v=>uS(i,'middle_name',lettersOnly(v))} placeholder="Middle Name" maxLen={50}/></FField>
          <View style={sx.row2}>
            <View style={{flex:1}}>
              <FField label="Qualifier">
                <SelBtn label="None" value={s.qualifier} onPress={()=>setActivePick(`sq${i}`)}/>
              </FField>
              <PickerModal visible={activePick===`sq${i}`} title="Qualifier" options={QUALIFIERS} selected={s.qualifier} onSelect={v=>{uS(i,'qualifier',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
            </View>
            <View style={{width:8}}/>
            <View style={{flex:1}}>
              <FField label="Alias"><TInput value={s.alias} onChange={v=>uS(i,'alias',v)} placeholder="Alias" maxLen={50}/></FField>
            </View>
          </View>
          <FField label="Gender" required><Toggle opts={[{l:'Male',v:'Male',ic:'male'},{l:'Female',v:'Female',ic:'female'}]} value={s.gender} onChange={v=>uS(i,'gender',v)}/></FField>
          <FField label="Birthday" error={formErr[`s${i}bday`]}>
            <DatePickerBtn label="Birthday" value={s.birthday?new Date(s.birthday):null} onChange={d=>uS(i,'birthday',d.toISOString().split('T')[0])} maximumDate={new Date()}/>
          </FField>
          <View style={sx.row2}>
            <View style={{flex:1}}><FField label="Age" error={formErr[`s${i}age`]}><TInput value={s.age} onChange={v=>uS(i,'age',v.replace(/\D/g,''))} placeholder="Age" kb="number-pad" maxLen={3} error={formErr[`s${i}age`]}/></FField></View>
            <View style={{width:8}}/>
            <View style={{flex:1}}><FField label="Height (cm)" error={formErr[`s${i}ht`]}><TInput value={s.height_cm} onChange={v=>uS(i,'height_cm',v.replace(/\D/g,''))} placeholder="cm" kb="number-pad" maxLen={3} error={formErr[`s${i}ht`]}/></FField></View>
          </View>
          <FField label="Birth Place"><TInput value={s.birth_place} onChange={v=>uS(i,'birth_place',v)} placeholder="Birth Place" maxLen={100}/></FField>
          <FField label="Status" required error={formErr[`s${i}st`]}>
            <SelBtn label="Select Status" value={s.status} onPress={()=>setActivePick(`ss${i}`)} error={formErr[`s${i}st`]}/>
          </FField>
          <PickerModal visible={activePick===`ss${i}`} title="Suspect Status" options={S_STAT} selected={s.status} onSelect={v=>{uS(i,'status',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
          {['Arrested','In Custody','Detained'].includes(s.status)&&(
            <FField label="Arrest Location" required error={formErr[`s${i}loc`]}><TInput value={s.location_if_arrested} onChange={v=>uS(i,'location_if_arrested',v)} placeholder="Where detained/arrested" error={formErr[`s${i}loc`]} maxLen={200}/></FField>
          )}
          <FField label="Degree of Participation" required error={formErr[`s${i}dg`]}>
            <SelBtn label="Select Degree" value={s.degree_participation} onPress={()=>setActivePick(`sd${i}`)} error={formErr[`s${i}dg`]}/>
          </FField>
          <PickerModal visible={activePick===`sd${i}`} title="Degree" options={DEGREES} selected={s.degree_participation} onSelect={v=>{uS(i,'degree_participation',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
          <FField label="Nationality" required error={formErr[`s${i}nat`]}>
            <SelBtn label="Select Nationality" value={s.nationality} onPress={()=>setActivePick(`sn${i}`)} error={formErr[`s${i}nat`]}/>
          </FField>
          <PickerModal visible={activePick===`sn${i}`} title="Nationality" options={NATS} selected={s.nationality} onSelect={v=>{uS(i,'nationality',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
          <FField label="Educational Attainment">
            <SelBtn label="Select…" value={s.educational_attainment} onPress={()=>setActivePick(`se${i}`)}/>
          </FField>
          <PickerModal visible={activePick===`se${i}`} title="Educational Attainment" options={EDU_ATT} selected={s.educational_attainment} onSelect={v=>{uS(i,'educational_attainment',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
          <FField label="Occupation"><TInput value={s.occupation} onChange={v=>uS(i,'occupation',v)} placeholder="e.g. Driver" maxLen={100}/></FField>
          <FField label="Relation to Victim"><TInput value={s.relation_to_victim} onChange={v=>uS(i,'relation_to_victim',v)} placeholder="e.g. Neighbor" maxLen={100}/></FField>
          <FField label="Drug Used" required error={formErr[`s${i}drug`]}><Toggle opts={[{l:'Yes',v:true},{l:'No',v:false}]} value={s.drug_used} onChange={v=>uS(i,'drug_used',v)}/></FField>
          <FField label="Motive"><TInput value={s.motive} onChange={v=>uS(i,'motive',v)} placeholder="Motive" maxLen={500} multiline lines={3}/></FField>
          <AddrFields data={s} onUpdate={(f,v)=>uS(i,f,v)} errors={{[`s${i}_reg`]:formErr[`s${i}_reg`],[`s${i}_prov`]:formErr[`s${i}_prov`],[`s${i}_city`]:formErr[`s${i}_city`],[`s${i}_brgy`]:formErr[`s${i}_brgy`]}} pfx={`s${i}`} regions={regions} loadingR={loadingR} provinces={sPr[i]||[]} cities={sCi[i]||[]} barangays={sBr[i]||[]} lPr={!!sLP[i]} lCi={!!sLC[i]} lBr={!!sLB[i]} onReg={v=>sReg(i,v)} onProv={v=>sPrv(i,v)} onCity={v=>sCit(i,v)}/>
          <FField label="House No. / Street" required error={formErr[`s${i}hs`]}><TInput value={s.house_street} onChange={v=>uS(i,'house_street',v)} placeholder="e.g. 123 Rizal Street" error={formErr[`s${i}hs`]} maxLen={200}/></FField>
        </View>
      ))}
      <TouchableOpacity style={sx.addBtn} onPress={()=>setSusp(p=>[...p,mkS()])}>
        <Ionicons name="add-circle" size={18} color={C.navyMid}/><Text style={sx.addTxt}>Add Another Suspect</Text>
      </TouchableOpacity>
      <View style={{height:80}}/>
    </ScrollView>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 3 — CASE DETAIL
═══════════════════════════════════════════════════════════════════════════ */
const Step3 = memo(function Step3({ caseD, uCase, formErr, activePick, setActivePick }) {
  return (
    <ScrollView style={sx.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={sx.card}>
        <FField label="Incident Type" required error={formErr.inc}>
          <SelBtn label="Select Incident Type" value={caseD.incident_type} onPress={()=>setActivePick('inc')} error={formErr.inc}/>
        </FField>
        <PickerModal visible={activePick==='inc'} title="Incident Type" options={INCIDENTS} selected={caseD.incident_type} onSelect={v=>{uCase('incident_type',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
        <FField label="COP (Officer on Case)" required error={formErr.cop}>
          <TInput value={caseD.cop} onChange={v=>uCase('cop',v)} placeholder="Officer Name" error={formErr.cop} maxLen={100}/>
        </FField>
        <FField label="Date & Time of Commission" required error={formErr.dtc} hint="Format: YYYY-MM-DDTHH:MM">
          <TextInput style={[inp.base,formErr.dtc&&inp.err]} value={String(caseD.date_time_commission??'')} onChangeText={v=>uCase('date_time_commission',v)} placeholder="2025-06-15T10:30" placeholderTextColor={C.faint} autoCorrect={false} autoCapitalize="none"/>
        </FField>
        <FField label="Date & Time Reported" required error={formErr.dtr} hint="Format: YYYY-MM-DDTHH:MM">
          <TextInput style={[inp.base,formErr.dtr&&inp.err]} value={String(caseD.date_time_reported??'')} onChangeText={v=>uCase('date_time_reported',v)} placeholder="2025-06-15T11:00" placeholderTextColor={C.faint} autoCorrect={false} autoCapitalize="none"/>
        </FField>
        <View style={sx.fixedLoc}><Ionicons name="location" size={13} color={C.navyMid}/><Text style={sx.fixedLocTxt}>Region IV-A (CALABARZON) • Cavite • Bacoor City</Text></View>
        <FField label="Barangay" required error={formErr.brgy}>
          <SelBtn label="Select Barangay" value={caseD.place_barangay} onPress={()=>setActivePick('brgy')} error={formErr.brgy}/>
        </FField>
        {/* FIX 1: Use hardcoded BACOOR_BARANGAYS list — matches DB exactly */}
       <PickerModal visible={activePick==='brgy'} title="Select Barangay"
          options={[
            ...BACOOR_BARANGAYS.map(b => ({ label:b, value:b })),
            { label:'── Pre-2023 Names (Auto-resolved) ──', value:'__divider__', disabled:true },
            ...LEGACY_BARANGAYS,
          ]}
          selected={caseD.place_barangay}
          onSelect={v => { if(v!=='__divider__'){ uCase('place_barangay',v); setActivePick(null); } }}
          onClose={() => setActivePick(null)}
        />
        <FField label="Street" required error={formErr.str}><TInput value={caseD.place_street} onChange={v=>uCase('place_street',v)} placeholder="Street Name" error={formErr.str} maxLen={200}/></FField>
        <FField label="Private Place?">
          <SelBtn label="Select…" value={caseD.is_private_place} onPress={()=>setActivePick('priv')}/>
        </FField>
        <PickerModal visible={activePick==='priv'} title="Private Place?" options={PRIV} selected={caseD.is_private_place} onSelect={v=>{uCase('is_private_place',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
        <FField label="Narrative" required error={formErr.narr}>
          <TInput value={caseD.narrative} onChange={v=>uCase('narrative',v)} placeholder="Detailed description (min. 20 chars)" multiline lines={6} error={formErr.narr} maxLen={5000}/>
          <Text style={{fontSize:11,color:C.muted,marginTop:4,textAlign:'right'}}>{(caseD.narrative||'').length}/5000</Text>
        </FField>
        <FField label="Referred by Barangay?"><Toggle opts={[{l:'Yes',v:true},{l:'No',v:false}]} value={caseD.referred_by_barangay} onChange={v=>uCase('referred_by_barangay',v)}/></FField>
        <FField label="Referred by DILG?"><Toggle opts={[{l:'Yes',v:true},{l:'No',v:false}]} value={caseD.referred_by_dilg} onChange={v=>uCase('referred_by_dilg',v)}/></FField>
        <FField label="Amount Involved"><TInput value={caseD.amount_involved} onChange={v=>uCase('amount_involved',v.replace(/[^0-9.]/g,''))} placeholder="0.00" kb="decimal-pad" maxLen={15}/></FField>
      </View>
      <View style={{height:80}}/>
    </ScrollView>
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   STEP 4 — OFFENSE
═══════════════════════════════════════════════════════════════════════════ */
const Step4 = memo(function Step4({ offs, setOffs, topPl, setTopPl, modus, setModus, selM, setSelM, formErr, activePick, setActivePick, uO, loadModus }) {
  return (
    <ScrollView style={sx.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {offs.map((o,i)=>(
        <View key={i} style={sx.card}>
          <View style={sx.cardHdr}>
            <View style={[sx.badge,{backgroundColor:C.slate}]}><Text style={sx.badgeTxt}>{i+1}</Text></View>
            <Text style={sx.cardTitle}>Offense #{i+1}</Text>
            {offs.length>1&&<TouchableOpacity onPress={()=>{setOffs(offs.filter((_,x)=>x!==i));const nM={},nS={};offs.forEach((_,x)=>{if(x!==i){const nx=x>i?x-1:x;nM[nx]=modus[x]||[];nS[nx]=selM[x]||[];}});setModus(nM);setSelM(nS);}} style={sx.rmBtn}><Ionicons name="trash-outline" size={12} color={C.red}/><Text style={sx.rmTxt}>Remove</Text></TouchableOpacity>}
          </View>
          <FField label="Offense" required error={formErr[`o${i}on`]}>
            <SelBtn label="Select Offense" value={o.offense_name} onPress={()=>setActivePick(`of${i}`)} error={formErr[`o${i}on`]}/>
          </FField>
          <PickerModal visible={activePick===`of${i}`} title="Select Offense" options={INCIDENTS} selected={o.offense_name} onSelect={v=>{uO(i,'offense_name',v);uO(i,'index_type','Index');loadModus(v,i);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
          <FField label="Stage of Felony" required error={formErr[`o${i}sf`]}>
            <SelBtn label="Select Stage" value={o.stage_of_felony} onPress={()=>setActivePick(`st${i}`)} error={formErr[`o${i}sf`]}/>
          </FField>
          <PickerModal visible={activePick===`st${i}`} title="Stage of Felony" options={STAGES} selected={o.stage_of_felony} onSelect={v=>{uO(i,'stage_of_felony',v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
          <FField label="Index Type"><TInput value={o.index_type} editable={false}/></FField>
          <FField label="Investigator on Case" required error={formErr[`o${i}inv`]}><TInput value={o.investigator_on_case} onChange={v=>uO(i,'investigator_on_case',v)} placeholder="e.g. PCO Roger Verano" error={formErr[`o${i}inv`]} maxLen={100}/></FField>
          <FField label="Most Investigator" required error={formErr[`o${i}mi`]}><TInput value={o.most_investigator} onChange={v=>uO(i,'most_investigator',v)} placeholder="e.g. PI RANK John Doe" error={formErr[`o${i}mi`]} maxLen={100}/></FField>
          {modus[i]?.length>0&&(
            <FField label="Modus Operandi" required error={formErr[`o${i}modus`]}>
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4}}>
                {modus[i].map(m=>{
                  const sel=(selM[i]||[]).includes(m.id);
                  return(
                    <TouchableOpacity key={m.id} style={[sx.chip,sel&&sx.chipOn]} onPress={()=>setSelM(prev=>{const cur=prev[i]||[];return{...prev,[i]:cur.includes(m.id)?cur.filter(x=>x!==m.id):[...cur,m.id]};})}>
                      {sel&&<Ionicons name="checkmark" size={11} color={C.white} style={{marginRight:3}}/>}
                      <Text style={[sx.chipTxt,sel&&sx.chipTxtOn]}>{m.modus_name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </FField>
          )}
        </View>
      ))}
      <View style={sx.card}>
        <FField label="Type of Place" required error={formErr.top}>
          <SelBtn label="Select Type of Place" value={topPl} onPress={()=>setActivePick('top')} error={formErr.top}/>
        </FField>
        <PickerModal visible={activePick==='top'} title="Type of Place" options={TOP_PLACE} selected={topPl} onSelect={v=>{setTopPl(v);setActivePick(null);}} onClose={()=>setActivePick(null)}/>
      </View>
      <TouchableOpacity style={sx.addBtn} onPress={()=>{const ni=offs.length;setOffs(p=>[...p,mkO(false)]);setModus(p=>({...p,[ni]:[]}));setSelM(p=>({...p,[ni]:[]}));}}>
        <Ionicons name="add-circle" size={18} color={C.navyMid}/><Text style={sx.addTxt}>Add Another Offense</Text>
      </TouchableOpacity>
      <View style={{height:80}}/>
    </ScrollView>
  );
});

/* ─── Step Bar ────────────────────────────────────────────────────────────── */
const StepBar = memo(function StepBar({ step }) {
  return (
    <View style={sx.stepBar}>
      {['Complainant','Suspect','Case','Offense'].map((lbl,idx)=>{
        const n=idx+1,active=step===n,done=step>n;
        return(
          <React.Fragment key={n}>
            <View style={sx.stepItem}>
              <View style={[sx.stepCircle,active&&sx.stepCircleA,done&&sx.stepCircleD]}>
                {done?<Ionicons name="checkmark" size={11} color={C.white}/>:<Text style={[sx.stepNum,(active||done)&&{color:C.white}]}>{n}</Text>}
              </View>
              <Text style={[sx.stepLabel,active&&{color:C.red,fontWeight:'700'},done&&{color:C.navyMid}]}>{lbl}</Text>
            </View>
            {idx<3&&<View style={[sx.stepLine,done&&{backgroundColor:C.navyMid}]}/>}
          </React.Fragment>
        );
      })}
    </View>
  );
});

/* ─── Blotter Card ────────────────────────────────────────────────────────── */
const BlotterCard = memo(function BlotterCard({ item, onView, onEdit, onDelete, fmt }) {
  return (
    <View style={bc.card}>
      <View style={bc.top}>
        <View style={{flex:1,marginRight:10}}>
          <Text style={bc.id} numberOfLines={1}>{item.blotter_entry_number}</Text>
          <Text style={bc.inc}>{item.incident_type}</Text>
        </View>
        <SBadge status={item.status||'Pending'}/>
      </View>
      <View style={bc.meta}>
        <View style={bc.mr}><Ionicons name="location-outline" size={12} color={C.muted}/><Text style={bc.mt} numberOfLines={1}>Brgy. {item.place_barangay}, {item.place_city_municipality}</Text></View>
        <View style={bc.mr}><Ionicons name="time-outline" size={12} color={C.muted}/><Text style={bc.mt}>{fmt(item.date_time_reported)}</Text></View>
      </View>
      <View style={bc.actions}>
        <TouchableOpacity style={bc.viewBtn} onPress={onView} hitSlop={{top:6,bottom:6,left:6,right:6}}><Ionicons name="eye-outline" size={13} color={C.navyMid}/><Text style={bc.viewTxt}>View</Text></TouchableOpacity>
        <TouchableOpacity style={bc.editBtn} onPress={onEdit} hitSlop={{top:6,bottom:6,left:6,right:6}}><Ionicons name="create-outline" size={13} color={C.navyMid}/><Text style={bc.editTxt}>Edit</Text></TouchableOpacity>
        <TouchableOpacity style={bc.delBtn} onPress={onDelete} hitSlop={{top:6,bottom:6,left:6,right:6}}><Ionicons name="trash-outline" size={13} color={C.red}/><Text style={bc.delTxt}>Delete</Text></TouchableOpacity>
      </View>
    </View>
  );
});
const bc = StyleSheet.create({
  card:   {backgroundColor:C.white,borderRadius:16,padding:14,marginBottom:10,borderWidth:1,borderColor:C.border,shadowColor:C.navy,shadowOffset:{width:0,height:2},shadowOpacity:0.07,shadowRadius:8,elevation:3},
  top:    {flexDirection:'row',alignItems:'flex-start',marginBottom:10},
  id:     {fontSize:11,fontWeight:'700',color:C.navyMid,fontFamily:Platform.OS==='ios'?'Courier':'monospace',marginBottom:3,opacity:0.8},
  inc:    {fontSize:15,fontWeight:'800',color:C.text},
  meta:   {gap:5,marginBottom:12},
  mr:     {flexDirection:'row',alignItems:'center',gap:5},
  mt:     {fontSize:12,color:C.sub,flex:1},
  actions:{flexDirection:'row',gap:8,paddingTop:10,borderTopWidth:1,borderTopColor:C.border},
  viewBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,backgroundColor:C.navy50,borderRadius:10,paddingVertical:9},
  editBtn:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,backgroundColor:C.slate100,borderRadius:10,paddingVertical:9,borderWidth:1,borderColor:C.border},
  delBtn: {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,backgroundColor:C.redBg,borderRadius:10,paddingVertical:9},
  viewTxt:{fontSize:12,fontWeight:'700',color:C.navyMid},
  editTxt:{fontSize:12,fontWeight:'700',color:C.navyMid},
  delTxt: {fontSize:12,fontWeight:'700',color:C.red},
});

/* ═══════════════════════════════════════════════════════════════════════════
   VIEW CONTENT — matches web exactly
═══════════════════════════════════════════════════════════════════════════ */
const ViewContent = memo(function ViewContent({ viewData, fmt, offenseModus, offenseSelModus }) {
  if (!viewData) return (
    <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
      <ActivityIndicator size="large" color={C.navyMid}/>
    </View>
  );
  const d = viewData;
  const VI = (label, value) => (!value && value !== 0 && value !== false) ? null : (
    <View style={vw.item} key={label}>
      <Text style={vw.label}>{label}</Text>
      <Text style={vw.value}>{String(value)}</Text>
    </View>
  );
  const Sec = ({ title, icon, color, children }) => (
    <View style={vw.sec}>
      <View style={[vw.secHd,{backgroundColor:color||C.navyMid}]}>
        <Ionicons name={icon||'document-outline'} size={13} color={C.white}/>
        <Text style={vw.secTt}>{title}</Text>
      </View>
      {children}
    </View>
  );
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={vw.hero}>
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
          <Text style={vw.heroId}>{d.blotter_entry_number}</Text>
          <SBadge status={d.status||'Pending'}/>
        </View>
        <Text style={vw.heroType}>{d.incident_type}</Text>
        <View style={{gap:5}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.65)"/><Text style={{fontSize:12,color:'rgba(255,255,255,0.65)'}}>Brgy. {d.place_barangay}, {d.place_city_municipality}</Text></View>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.65)"/><Text style={{fontSize:12,color:'rgba(255,255,255,0.65)'}}>{fmt(d.date_time_reported)}</Text></View>
        </View>
      </View>

      <Sec title="COMPLAINANT INFORMATION" icon="person-outline" color={C.navyMid}>
        {(d.complainants||[]).map((c,i)=>(
          <View key={i} style={vw.card}>
            <Text style={vw.cardTitle}>Complainant #{i+1}</Text>
            {VI('Name', [c.first_name,c.middle_name,c.last_name,c.qualifier].filter(Boolean).join(' '))}
            {VI('Gender', c.gender)}
            {VI('Nationality', c.nationality)}
            {VI('Contact', c.contact_number||'N/A')}
            {VI('Alias', c.alias||'N/A')}
            {VI('Occupation', c.occupation||'N/A')}
            {VI('Address', `${c.house_street}, ${c.barangay||c.barangay_code}, ${c.city_municipality||c.municipality_code}, ${c.district_province||c.province_code}, ${c.region||c.region_code}`)}
            {VI('Info Obtained', c.info_obtained)}
          </View>
        ))}
      </Sec>

      <Sec title="SUSPECT INFORMATION" icon="alert-circle-outline" color={C.navy}>
        {(d.suspects||[]).map((s,i)=>(
          <View key={i} style={vw.card}>
            <Text style={vw.cardTitle}>Suspect #{i+1}</Text>
            {VI('Name', [s.first_name,s.middle_name,s.last_name,s.qualifier].filter(Boolean).join(' '))}
            {VI('Alias', s.alias||'N/A')}
            {VI('Gender', s.gender)}
            {VI('Status', s.status)}
            {VI('Degree of Participation', s.degree_participation)}
            {VI('Birthday', s.birthday||'N/A')}
            {VI('Age', s.age||'N/A')}
            {VI('Birth Place', s.birth_place||'N/A')}
            {VI('Nationality', s.nationality)}
            {VI('Educational Attainment', s.educational_attainment||'N/A')}
            {VI('Height', s.height_cm?`${s.height_cm} cm`:'N/A')}
            {VI('Drug Used', s.drug_used?'Yes':'No')}
            {VI('Occupation', s.occupation||'N/A')}
            {VI('Relation to Victim', s.relation_to_victim||'N/A')}
            {s.location_if_arrested?VI('Arrest Location',s.location_if_arrested):null}
            {VI('Address', `${s.house_street}, ${s.barangay||s.barangay_code}, ${s.city_municipality||s.municipality_code}, ${s.district_province||s.province_code}`)}
            {VI('Motive', s.motive||'N/A')}
          </View>
        ))}
      </Sec>

      <Sec title="CASE DETAILS" icon="clipboard-outline" color={C.slate}>
        <View style={vw.card}>
          {VI('Incident Type', d.incident_type)}
          {VI('COP', d.cop)}
          {VI('Date of Commission', fmt(d.date_time_commission))}
          {VI('Date Reported', fmt(d.date_time_reported))}
          {VI('Location', `${d.place_street}, Brgy. ${d.place_barangay}, ${d.place_city_municipality}, ${d.place_district_province}, ${d.place_region}`)}
          {VI('Type of Place', d.type_of_place||'N/A')}
          {VI('Private Place?', d.is_private_place||'N/A')}
          {VI('Amount Involved', d.amount_involved?`₱${d.amount_involved}`:'N/A')}
          {VI('Referred by Barangay?', d.referred_by_barangay?'Yes':'No')}
          {VI('Referred by DILG?', d.referred_by_dilg?'Yes':'No')}
          {d.narrative&&<View style={vw.item}><Text style={vw.label}>Narrative</Text><Text style={[vw.value,{lineHeight:22}]}>{d.narrative}</Text></View>}
        </View>
      </Sec>

      <Sec title="OFFENSE INFORMATION" icon="shield-checkmark-outline" color="#1e3a5f">
        {(d.offenses||[]).map((o,i)=>{
          const ids=(offenseSelModus[i]||(d.modus||[]).map(m=>m.modus_reference_id));
          const modusNames=(offenseModus[i]||[]).filter(m=>ids.includes(m.id)).map(m=>m.modus_name);
          return(
            <View key={i} style={vw.card}>
              <Text style={vw.cardTitle}>Offense #{i+1}</Text>
              {VI('Principal Offense?', o.is_principal_offense?'Yes':'No')}
              {VI('Offense', o.offense_name)}
              {VI('Stage', o.stage_of_felony)}
              {VI('Index Type', o.index_type)}
              {VI('Investigator on Case', o.investigator_on_case)}
              {VI('Most Investigator', o.most_investigator)}
              {modusNames.length>0&&VI('Modus Operandi',modusNames.join(', '))}
            </View>
          );
        })}
      </Sec>
      <View style={{height:60}}/>
    </ScrollView>
  );
});
const vw = StyleSheet.create({
  hero:     {margin:14,backgroundColor:C.navyMid,borderRadius:18,padding:18,gap:10},
  heroId:   {fontSize:11,fontWeight:'700',color:'rgba(255,255,255,0.55)',fontFamily:Platform.OS==='ios'?'Courier':'monospace'},
  heroType: {fontSize:20,fontWeight:'800',color:C.white},
  sec:      {marginBottom:8},
  secHd:    {flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:20,paddingVertical:10,marginHorizontal:14,borderRadius:10,marginBottom:6},
  secTt:    {fontSize:11,fontWeight:'800',color:C.white,letterSpacing:1},
  card:     {backgroundColor:C.white,marginHorizontal:14,borderRadius:14,borderWidth:1,borderColor:C.border,overflow:'hidden',marginBottom:6},
  cardTitle:{fontSize:13,fontWeight:'700',color:C.navyMid,padding:12,backgroundColor:C.navy50,borderBottomWidth:1,borderBottomColor:C.border},
  item:     {paddingHorizontal:14,paddingVertical:11,borderBottomWidth:0.5,borderBottomColor:C.border},
  label:    {fontSize:10,fontWeight:'700',color:C.muted,textTransform:'uppercase',letterSpacing:0.6,marginBottom:3},
  value:    {fontSize:14,color:C.text,fontWeight:'500',lineHeight:20},
});

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SCREEN
═══════════════════════════════════════════════════════════════════════════ */
export default function EBlotterScreen() {
  const { regions, loadingR, getProvinces, getCities, getBarangays } = usePSGC();

  const [allData, setAllData]   = useState([]);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [refreshing, setRef]    = useState(false);
  const [filters, setFilters]   = useState(BLANK_F);
  const [tempF, setTempF]       = useState(BLANK_F);
  const [showF, setShowF]       = useState(false);
  const [fPick, setFPick]       = useState(null);

  const [confirm, setConfirm] = useState({ visible:false, title:'', message:'', confirmText:'', confirmColor:C.red, onConfirm:null });
  const showConfirm = (title, message, confirmText, confirmColor, onConfirm) =>
    setConfirm({ visible:true, title, message, confirmText, confirmColor, onConfirm });
  const hideConfirm = () => setConfirm(p => ({ ...p, visible:false }));

  const [modal, setModal]       = useState(false);
  const [step, setStep]         = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [viewData, setViewData] = useState(null);
  const [mLoad, setMLoad]       = useState(false);

  const [comp, setComp]         = useState([mkC()]);
  const [susp, setSusp]         = useState([mkS()]);
  const [offs, setOffs]         = useState([mkO(true)]);
  const [caseD, setCaseD]       = useState(mkCase());
  const [topPl, setTopPl]       = useState('');
  const [modus, setModus]       = useState({});
  const [selM, setSelM]         = useState({});
  const [formErr, setFormErr]   = useState({});
  const [saving, setSaving]     = useState(false);
  const [activePick, setActivePick] = useState(null);

  const [cPr,setCPr]=useState({}); const [cCi,setCCi]=useState({}); const [cBr,setCBr]=useState({});
  const [cLP,setCLP]=useState({}); const [cLC,setCLC]=useState({}); const [cLB,setCLB]=useState({});
  const [sPr,setSPr]=useState({}); const [sCi,setSCi]=useState({}); const [sBr,setSBr]=useState({});
  const [sLP,setSLP]=useState({}); const [sLC,setSLC]=useState({}); const [sLB,setSLB]=useState({});

  const [trashModal, setTrashModal] = useState(false);
  const [trashList, setTrashList]   = useState([]);
  const [trashLoad, setTrashLoad]   = useState(false);

  const STEPS = 4;
  const paged = allData.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  // FIX 3: Count active filters — don't count empty string as active
  const activeFC = [filters.status,filters.incident_type,filters.barangay,filters.date_from,filters.date_to].filter(v=>v&&v!=='').length;

  /* ── API ──────────────────────────────────────────────────────────────── */
  const api = useCallback(async (url, method='GET', body=null) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const opts = { method, headers:{'Content-Type':'application/json','Accept':'application/json',Authorization:`Bearer ${token}`} };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API}${url}`, opts);
      if (res.status === 401) {
        showConfirm('Session Expired','Please log in again.','OK',C.navyMid,async()=>{await AsyncStorage.clear();hideConfirm();});
        return null;
      }
      return await res.json();
    } catch(e) { console.error('api:',e); return null; }
  }, []);

  /* ── Load — FIX: incident_type filtered on frontend case-insensitive ─── */
  const load = useCallback(async (f) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (f.search)   p.append('search',   f.search);
      if (f.status)   p.append('status',   f.status);
      if (f.barangay) p.append('barangay', f.barangay);
      if (f.date_from) {
        const d=f.date_from;
        p.append('date_from',`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      }
      if (f.date_to) {
        const d=f.date_to;
        p.append('date_to',`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
      }
      const data = await api(`/blotters?${p.toString()}`);
      if (data?.success) {
        let results = data.data || [];
        // FIX: case-insensitive incident type on frontend
        if (f.incident_type) {
          results = results.filter(b =>
            b.incident_type.toLowerCase() === f.incident_type.toLowerCase()
          );
        }
        setAllData(results);
        setPage(1);
      } else if (data) {
        setAllData([]);
      }
    } finally { setLoading(false); }
  }, [api]);

  useEffect(() => { load(BLANK_F); }, []);

const fmt = useCallback((d) => {
    if (!d) return 'N/A';
    const dt = new Date(d); if (isNaN(dt)) return String(d);
    const pad = n => String(n).padStart(2,'0');
    // Use UTC values to match web display exactly
    let h = dt.getUTCHours(), ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${pad(dt.getUTCDate())}/${pad(dt.getUTCMonth()+1)}/${dt.getUTCFullYear()} ${h}:${pad(dt.getUTCMinutes())} ${ap}`;
  }, []);

  /* ── Reset ────────────────────────────────────────────────────────────── */
  const reset = () => {
    setComp([mkC()]);setSusp([mkS()]);setOffs([mkO(true)]);setCaseD(mkCase());setTopPl('');
    setModus({});setSelM({});setFormErr({});setStep(1);
    setEditMode(false);setViewMode(false);setEditId(null);setViewData(null);setMLoad(false);
    setCPr({});setCCi({});setCBr({});setCLP({});setCLC({});setCLB({});
    setSPr({});setSCi({});setSBr({});setSLP({});setSLC({});setSLB({});
    setActivePick(null);
  };
  const closeModal = () => { setModal(false); reset(); };
  const askClose = () => {
    if (viewMode) { closeModal(); return; }
    showConfirm('Close Form','Unsaved data will be lost. Are you sure?','Close',C.red,()=>{hideConfirm();closeModal();});
  };

  /* ── Modus ────────────────────────────────────────────────────────────── */
  const loadModus = useCallback(async (name, idx) => {
    const ct=CRIME_MAP[name];
    if(!ct){setModus(p=>({...p,[idx]:[]}));setSelM(p=>({...p,[idx]:[]}));return;}
    const data=await api(`/blotters/modus/${encodeURIComponent(ct)}`);
    if(data?.success){setModus(p=>({...p,[idx]:data.data}));setSelM(p=>({...p,[idx]:[]}));}
  }, [api]);

  /* ── View ─────────────────────────────────────────────────────────────── */
  const handleView = useCallback(async (id) => {
    setModal(true);setViewMode(true);setMLoad(true);
    const data=await api(`/blotters/${id}`);
    if(!data?.success){closeModal();return;}
    const d=data.data;
    const newM={},newSel={};
    for(let i=0;i<(d.offenses||[]).length;i++){
      const ct=CRIME_MAP[d.offenses[i].offense_name];
      if(ct){const md=await api(`/blotters/modus/${encodeURIComponent(ct)}`);if(md?.success){newM[i]=md.data;newSel[i]=(d.modus||[]).map(m=>m.modus_reference_id);}}
      else{newM[i]=[];newSel[i]=[];}
    }
    setModus(newM);setSelM(newSel);
    setViewData(d);setMLoad(false);
  }, [api]);

  /* ── Edit ─────────────────────────────────────────────────────────────── */
  const handleEdit = useCallback(async (id) => {
    setModal(true);setMLoad(true);
    const data=await api(`/blotters/${id}`);
    if(!data?.success){closeModal();return;}
    const dd=data.data;
    setComp(dd.complainants?.length?dd.complainants:[mkC()]);
    setSusp(dd.suspects?.length?dd.suspects:[mkS()]);
    setOffs(dd.offenses?.length?dd.offenses:[mkO(true)]);
    setTopPl(dd.type_of_place||'');
    setCaseD({incident_type:dd.incident_type||'Theft',cop:dd.cop||'',date_time_commission:dd.date_time_commission||'',date_time_reported:dd.date_time_reported||'',place_region:'Region IV-A (CALABARZON)',place_district_province:'Cavite',place_city_municipality:'Bacoor City',place_barangay:BRGY_MAP[(dd.place_barangay||'').toUpperCase()]||dd.place_barangay||'',place_street:dd.place_street||'',is_private_place:dd.is_private_place||'',narrative:dd.narrative||'',amount_involved:dd.amount_involved||'',referred_by_barangay:dd.referred_by_barangay||false,referred_by_dilg:dd.referred_by_dilg||false});
    const nCP={},nCC={},nCB={};
   for(let i=0;i<(dd.complainants||[]).length;i++){
  const c=dd.complainants[i];
  if(c.region_code){
    nCP[i]=await getProvinces(c.region_code);
    if(c.province_code){
      nCC[i]=await getCities(c.province_code);
      if(c.municipality_code){
        nCB[i]=await getBarangays(c.municipality_code);
      }
    } else if(c.region_code===NCR_CODE){
      nCC[i]=await getCities(NCR_CODE);
    }
  }
}
    setCPr(nCP);setCCi(nCC);setCBr(nCB);
    const nSP={},nSC={},nSB={};
for(let i=0;i<(dd.suspects||[]).length;i++){
  const s=dd.suspects[i];
  if(s.region_code){
    nSP[i]=await getProvinces(s.region_code);
    if(s.province_code){
      nSC[i]=await getCities(s.province_code);
      if(s.municipality_code){
        nSB[i]=await getBarangays(s.municipality_code);
      }
    } else if(s.region_code===NCR_CODE){
      nSC[i]=await getCities(NCR_CODE);
    }
  }
}
    setSPr(nSP);setSCi(nSC);setSBr(nSB);
    const nM={},nSel={};
    for(let i=0;i<(dd.offenses||[]).length;i++){const ct=CRIME_MAP[dd.offenses[i].offense_name];if(ct){const md=await api(`/blotters/modus/${encodeURIComponent(ct)}`);if(md?.success){nM[i]=md.data;nSel[i]=(dd.modus||[]).map(m=>m.modus_reference_id);}}else{nM[i]=[];nSel[i]=[];}}
    setModus(nM);setSelM(nSel);
    setEditMode(true);setEditId(id);setMLoad(false);
  }, [api,getProvinces,getCities,getBarangays]);

  /* ── Delete ───────────────────────────────────────────────────────────── */
  const handleDelete = useCallback((id) => {
    showConfirm('Delete Record','Move this blotter record to Deleted Records?','Delete',C.red,async()=>{
      hideConfirm();
      const data=await api(`/blotters/${id}`,'DELETE');
      if(data?.success)load(filters);
      else showConfirm('Error',data?.message||data?.error||'Delete failed.','OK',C.navyMid,hideConfirm);
    });
  }, [api,load,filters]);

  /* ── Trash / Restore ──────────────────────────────────────────────────── */
  const loadTrash = async () => {
    setTrashLoad(true);
    const data=await api('/blotters/deleted/all');
    if(data?.success)setTrashList(data.data||[]);
    setTrashLoad(false);
  };

  const handleRestore = useCallback((id) => {
    showConfirm('Restore Record','Move this record back to active records?','Restore',C.green,async()=>{
      hideConfirm();
      const data=await api(`/blotters/${id}/restore`,'PUT');
      if(data?.success){loadTrash();load(filters);}
      else showConfirm('Error',data?.message||data?.error||'Restore failed.','OK',C.navyMid,hideConfirm);
    });
  }, [api,load,filters]);

  /* ── Validate ─────────────────────────────────────────────────────────── */
  const validate = () => {
    const e={};
    if(step===1)comp.forEach((c,i)=>{
      if(!c.first_name?.trim()||c.first_name.trim().length<2) e[`c${i}fn`]=!c.first_name?.trim()?'Required':'At least 2 characters';
      else if(c.first_name.trim().length>50) e[`c${i}fn`]='Maximum 50 characters';
      if(!c.last_name?.trim()||c.last_name.trim().length<2) e[`c${i}ln`]=!c.last_name?.trim()?'Required':'At least 2 characters';
      else if(c.last_name.trim().length>50) e[`c${i}ln`]='Maximum 50 characters';
      if(!c.region_code) e[`c${i}_reg`]='Required';
      if(!c.province_code&&c.region_code!==NCR_CODE) e[`c${i}_prov`]='Required';
      if(!c.municipality_code) e[`c${i}_city`]='Required';
      if(!c.barangay_code) e[`c${i}_brgy`]='Required';
      if(!c.house_street?.trim()||c.house_street.trim().length<5) e[`c${i}hs`]=!c.house_street?.trim()?'Required':'At least 5 characters';
      if(!c.nationality) e[`c${i}nat`]='Required';
      if(!c.info_obtained) e[`c${i}inf`]='Required';
      if(c.contact_number?.length>0){if(c.contact_number.length!==11)e[`c${i}cn`]='Must be 11 digits';else if(!c.contact_number.startsWith('09'))e[`c${i}cn`]='Must start with 09';}
    });
    if(step===2)susp.forEach((s,i)=>{
      if(!s.first_name?.trim()||s.first_name.trim().length<2) e[`s${i}fn`]=!s.first_name?.trim()?'Required':'At least 2 characters';
      if(!s.last_name?.trim()||s.last_name.trim().length<2) e[`s${i}ln`]=!s.last_name?.trim()?'Required':'At least 2 characters';
      if(!s.status) e[`s${i}st`]='Required';
      if(!s.degree_participation) e[`s${i}dg`]='Required';
      if(!s.region_code) e[`s${i}_reg`]='Required';
      if(!s.province_code&&s.region_code!==NCR_CODE) e[`s${i}_prov`]='Required';
      if(!s.municipality_code) e[`s${i}_city`]='Required';
      if(!s.barangay_code) e[`s${i}_brgy`]='Required';
      if(!s.house_street?.trim()||s.house_street.trim().length<5) e[`s${i}hs`]=!s.house_street?.trim()?'Required':'At least 5 characters';
      if(!s.nationality) e[`s${i}nat`]='Required';
      if(typeof s.drug_used!=='boolean') e[`s${i}drug`]='Required';
      if(s.age&&String(s.age).trim()){const a=parseInt(s.age);if(isNaN(a)||a<10||a>120)e[`s${i}age`]='Must be 10–120';}
      if(s.height_cm&&String(s.height_cm).trim()){const h=parseInt(s.height_cm);if(isNaN(h)||h<50||h>250)e[`s${i}ht`]='Must be 50–250 cm';}
      if(['Arrested','In Custody','Detained'].includes(s.status)&&!s.location_if_arrested?.trim()) e[`s${i}loc`]='Required when arrested';
    });
    if(step===3){
      if(!caseD.incident_type) e.inc='Required';
      if(!caseD.cop?.trim()||caseD.cop.trim().length<5) e.cop=!caseD.cop?.trim()?'Required':'At least 5 characters';
      if(!caseD.date_time_commission) e.dtc='Required';
      if(!caseD.date_time_reported) e.dtr='Required';
      if(!caseD.place_barangay) e.brgy='Required';
      if(!caseD.place_street?.trim()||caseD.place_street.trim().length<3) e.str=!caseD.place_street?.trim()?'Required':'At least 3 characters';
      if(!caseD.narrative?.trim()||caseD.narrative.trim().length<20) e.narr=!caseD.narrative?.trim()?'Required':'Minimum 20 characters';
    }
    if(step===4){
      if(!topPl) e.top='Required';
      offs.forEach((o,i)=>{
        if(!o.offense_name) e[`o${i}on`]='Required';
        if(!o.stage_of_felony) e[`o${i}sf`]='Required';
        if(!o.investigator_on_case?.trim()||o.investigator_on_case.trim().length<5) e[`o${i}inv`]=!o.investigator_on_case?.trim()?'Required':'At least 5 characters';
        if(!o.most_investigator?.trim()||o.most_investigator.trim().length<5) e[`o${i}mi`]=!o.most_investigator?.trim()?'Required':'At least 5 characters';
        if(modus[i]?.length>0&&!selM[i]?.length) e[`o${i}modus`]='Select at least one';
      });
    }
    return e;
  };

  const goStep = dir => {
    if(dir===1){const e=validate();if(Object.keys(e).length){setFormErr(e);return;}}
    setFormErr({});setStep(p=>Math.max(1,Math.min(STEPS,p+dir)));
  };

  /* ── Submit ───────────────────────────────────────────────────────────── */
  const submit = async () => {
    const e=validate();if(Object.keys(e).length){setFormErr(e);return;}
    setSaving(true);
    try {
      const fc={...caseD};
      if(fc.amount_involved)fc.amount_involved=fc.amount_involved.replace(/,/g,'');
      fc.type_of_place=topPl;
      fc.modus_reference_ids=Object.values(selM).flat();
      const ra=(item,pr,ci,br,i)=>({...item,
        region:(regions||[]).find(r=>r.code===item.region_code)?.name||item.region_code,
        district_province:((pr[i]||[]).find(p=>p.code===item.province_code)||{}).name||item.province_code,
        city_municipality:((ci[i]||[]).find(c=>c.code===item.municipality_code)||{}).name||item.municipality_code,
        barangay:((br[i]||[]).find(b=>b.code===item.barangay_code)||{}).name||item.barangay_code,
      });
      const payload={blotterData:fc,complainants:comp.map((c,i)=>ra(c,cPr,cCi,cBr,i)),suspects:susp.map((s,i)=>ra(s,sPr,sCi,sBr,i)),offenses:offs.map((o,i)=>({...o,modus_reference_ids:selM[i]||[]}))};
      const data=await api(editMode?`/blotters/${editId}`:'/blotters',editMode?'PUT':'POST',payload);
      if(data?.success){showConfirm('Success',editMode?'Blotter updated successfully!':`Blotter created!\nID: ${data.data?.blotter_entry_number}`,'OK',C.green,()=>{hideConfirm();closeModal();load(filters);});}
      else showConfirm('Error',data?.errors?.join('\n')||data?.error||'Submission failed.','OK',C.navyMid,hideConfirm);
    }catch{showConfirm('Error','Submission failed.','OK',C.navyMid,hideConfirm);}
    setSaving(false);
  };

  /* ── Updaters ─────────────────────────────────────────────────────────── */
  const uC    = useCallback((i,f,v)=>setComp(prev=>{const a=[...prev];a[i]={...a[i],[f]:v};return a;}),[]);
  const uS    = useCallback((i,f,v)=>setSusp(prev=>{const a=[...prev];a[i]={...a[i],[f]:v};return a;}),[]);
  const uO    = useCallback((i,f,v)=>setOffs(prev=>{const a=[...prev];a[i]={...a[i],[f]:v};return a;}),[]);
  const uCase = useCallback((f,v)=>setCaseD(prev=>({...prev,[f]:v})),[]);

  /* ── PSGC complainant ─────────────────────────────────────────────────── */
  const cReg=useCallback(async(i,v)=>{
    uC(i,'region_code',v);uC(i,'province_code','');uC(i,'municipality_code','');uC(i,'barangay_code','');
    setCPr(p=>({...p,[i]:[]}));setCCi(p=>({...p,[i]:[]}));setCBr(p=>({...p,[i]:[]}));
    if(v===NCR_CODE){setCLC(p=>({...p,[i]:true}));const d=await getCities(NCR_CODE);setCCi(p=>({...p,[i]:d}));setCLC(p=>({...p,[i]:false}));}
    else{setCLP(p=>({...p,[i]:true}));const d=await getProvinces(v);setCPr(p=>({...p,[i]:d}));setCLP(p=>({...p,[i]:false}));}
  },[uC,getProvinces,getCities]);
  const cPrv=useCallback(async(i,v)=>{uC(i,'province_code',v);uC(i,'municipality_code','');uC(i,'barangay_code','');setCCi(p=>({...p,[i]:[]}));setCBr(p=>({...p,[i]:[]}));setCLC(p=>({...p,[i]:true}));const d=await getCities(v);setCCi(p=>({...p,[i]:d}));setCLC(p=>({...p,[i]:false}));},[uC,getCities]);
  const cCit=useCallback(async(i,v)=>{uC(i,'municipality_code',v);uC(i,'barangay_code','');setCBr(p=>({...p,[i]:[]}));setCLB(p=>({...p,[i]:true}));const d=await getBarangays(v);setCBr(p=>({...p,[i]:d}));setCLB(p=>({...p,[i]:false}));},[uC,getBarangays]);

  /* ── PSGC suspect ─────────────────────────────────────────────────────── */
  const sReg=useCallback(async(i,v)=>{
    uS(i,'region_code',v);uS(i,'province_code','');uS(i,'municipality_code','');uS(i,'barangay_code','');
    setSPr(p=>({...p,[i]:[]}));setSCi(p=>({...p,[i]:[]}));setSBr(p=>({...p,[i]:[]}));
    if(v===NCR_CODE){setSLC(p=>({...p,[i]:true}));const d=await getCities(NCR_CODE);setSCi(p=>({...p,[i]:d}));setSLC(p=>({...p,[i]:false}));}
    else{setSLP(p=>({...p,[i]:true}));const d=await getProvinces(v);setSPr(p=>({...p,[i]:d}));setSLP(p=>({...p,[i]:false}));}
  },[uS,getProvinces,getCities]);
  const sPrv=useCallback(async(i,v)=>{uS(i,'province_code',v);uS(i,'municipality_code','');uS(i,'barangay_code','');setSCi(p=>({...p,[i]:[]}));setSBr(p=>({...p,[i]:[]}));setSLC(p=>({...p,[i]:true}));const d=await getCities(v);setSCi(p=>({...p,[i]:d}));setSLC(p=>({...p,[i]:false}));},[uS,getCities]);
  const sCit=useCallback(async(i,v)=>{uS(i,'municipality_code',v);uS(i,'barangay_code','');setSBr(p=>({...p,[i]:[]}));setSLB(p=>({...p,[i]:true}));const d=await getBarangays(v);setSBr(p=>({...p,[i]:d}));setSLB(p=>({...p,[i]:false}));},[uS,getBarangays]);

  /* ════════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════════ */
  // FIX 3: Status options with proper labels — "All Status" shows not dash
  const STATUS_OPTIONS = [
    { label:'All Status', value:'' },
    ...STATUSES.map(s=>({ label:s, value:s })),
  ];
  const INCIDENT_OPTIONS = [
    { label:'All Types', value:'' },
    ...INCIDENTS.map(s=>({ label:s, value:s })),
  ];
 const BARANGAY_OPTIONS = [
    { label:'All Barangays', value:'' },
    ...BACOOR_BARANGAYS.map(b=>({ label:b, value:b })),
    { label:'── Pre-2023 Names (Auto-resolved) ──', value:'__divider__', disabled:true },
    ...LEGACY_BARANGAYS,
  ];

  return (
    <SafeAreaView style={{flex:1,backgroundColor:C.navy}}>
      <StatusBar barStyle="light-content" backgroundColor={C.navy}/>

      <ConfirmModal
        visible={confirm.visible} title={confirm.title} message={confirm.message}
        confirmText={confirm.confirmText} confirmColor={confirm.confirmColor}
        onConfirm={confirm.onConfirm} onCancel={hideConfirm}
      />

      {/* Header */}
      <View style={ml.header}>
        <View>
          <Text style={ml.headerTitle}>Reporting Records</Text>
          <Text style={ml.headerSub}>B.A.N.T.A.Y. E-Blotter System</Text>
        </View>
        <View style={{flexDirection:'row',gap:10}}>
          <TouchableOpacity style={ml.iconBtn} onPress={()=>{setTrashModal(true);loadTrash();}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Ionicons name="trash-outline" size={17} color={C.white}/>
          </TouchableOpacity>
          <TouchableOpacity style={[ml.iconBtn,{backgroundColor:C.red}]} onPress={()=>{reset();setModal(true);}} hitSlop={{top:8,bottom:8,left:8,right:8}}>
            <Ionicons name="add" size={22} color={C.white}/>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{flex:1,backgroundColor:C.bg}}>
        {/* Filter bar */}
        <View style={ml.filterWrap}>
          <View style={ml.searchRow}>
            <Ionicons name="search-outline" size={15} color={C.muted}/>
            <TextInput style={ml.searchInput} placeholder="Search by Report ID…" placeholderTextColor={C.muted} value={tempF.search} onChangeText={v=>setTempF(p=>({...p,search:v}))} returnKeyType="search" autoCorrect={false}
              onSubmitEditing={()=>{const nf={...tempF};setFilters(nf);load(nf);}}/>
            {tempF.search?<TouchableOpacity onPress={()=>{const nf={...tempF,search:''};setTempF(nf);setFilters(nf);load(nf);}} hitSlop={{top:8,bottom:8,left:8,right:8}}><Ionicons name="close-circle" size={15} color={C.muted}/></TouchableOpacity>:null}
            <TouchableOpacity style={[ml.filterToggle,(showF||activeFC>0)&&ml.filterToggleOn]} onPress={()=>setShowF(!showF)}>
              <Ionicons name="options-outline" size={16} color={(showF||activeFC>0)?C.white:C.sub}/>
              {activeFC>0&&<View style={ml.filterDot}><Text style={ml.filterDotTxt}>{activeFC}</Text></View>}
            </TouchableOpacity>
          </View>

          {showF&&(
            <View style={ml.filterPanel}>
              {/* Row 1: Status + Incident Type */}
              <View style={{flexDirection:'row',gap:10}}>
                <View style={{flex:1}}>
                  <Text style={ml.filterLabel}>STATUS</Text>
                  <TouchableOpacity style={[ml.filterChip,tempF.status&&ml.filterChipOn]} onPress={()=>setFPick('status')}>
                    <Text style={[ml.filterChipTxt,tempF.status&&ml.filterChipTxtOn]} numberOfLines={1}>{tempF.status||'All Status'}</Text>
                    <Ionicons name="chevron-down" size={11} color={tempF.status?C.navyMid:C.muted}/>
                  </TouchableOpacity>
                </View>
                <View style={{flex:1}}>
                  <Text style={ml.filterLabel}>INCIDENT TYPE</Text>
                  <TouchableOpacity style={[ml.filterChip,tempF.incident_type&&ml.filterChipOn]} onPress={()=>setFPick('type')}>
                    <Text style={[ml.filterChipTxt,tempF.incident_type&&ml.filterChipTxtOn]} numberOfLines={1}>{tempF.incident_type||'All Types'}</Text>
                    <Ionicons name="chevron-down" size={11} color={tempF.incident_type?C.navyMid:C.muted}/>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 2: Barangay */}
              <View>
                <Text style={ml.filterLabel}>BARANGAY</Text>
                <TouchableOpacity style={[ml.filterChip,tempF.barangay&&ml.filterChipOn]} onPress={()=>setFPick('brgy')}>
                  <Text style={[ml.filterChipTxt,tempF.barangay&&ml.filterChipTxtOn]} numberOfLines={1}>{tempF.barangay||'All Barangays'}</Text>
                  <Ionicons name="chevron-down" size={11} color={tempF.barangay?C.navyMid:C.muted}/>
                </TouchableOpacity>
              </View>

              {/* Row 3: Dates — calendar picker */}
              <View style={{flexDirection:'row',gap:10}}>
                <View style={{flex:1}}>
                  <Text style={ml.filterLabel}>DATE FROM</Text>
                  <DatePickerBtn label="Date From" value={tempF.date_from} onChange={d=>setTempF(p=>({...p,date_from:d}))} maximumDate={tempF.date_to||new Date()}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={ml.filterLabel}>DATE TO</Text>
                  <DatePickerBtn label="Date To" value={tempF.date_to} onChange={d=>setTempF(p=>({...p,date_to:d}))} maximumDate={new Date()}/>
                </View>
              </View>
              {(tempF.date_from||tempF.date_to)&&(
                <TouchableOpacity onPress={()=>setTempF(p=>({...p,date_from:null,date_to:null}))} style={{alignSelf:'flex-end'}}>
                  <Text style={{fontSize:12,color:C.red,fontWeight:'600'}}>Clear dates</Text>
                </TouchableOpacity>
              )}

              {/* Apply / Clear */}
              <View style={{flexDirection:'row',gap:10,marginTop:4}}>
                <TouchableOpacity style={ml.applyBtn} onPress={()=>{const nf={...tempF};setFilters(nf);load(nf);setShowF(false);}}>
                  <Ionicons name="search-outline" size={14} color={C.white}/><Text style={ml.applyBtnTxt}>Apply Filters</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ml.clearBtn} onPress={()=>{setFilters(BLANK_F);setTempF(BLANK_F);load(BLANK_F);setShowF(false);}}>
                  <Ionicons name="refresh-outline" size={14} color={C.red}/><Text style={[ml.applyBtnTxt,{color:C.red}]}>Clear All</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* FIX 3: Picker modals with proper {label,value} objects so "All Status" shows correctly */}
        <PickerModal visible={fPick==='status'} title="Filter by Status"        options={STATUS_OPTIONS}   selected={tempF.status}        onSelect={v=>{setTempF(p=>({...p,status:v}));setFPick(null);}}        onClose={()=>setFPick(null)}/>
        <PickerModal visible={fPick==='type'}   title="Filter by Incident Type" options={INCIDENT_OPTIONS} selected={tempF.incident_type} onSelect={v=>{setTempF(p=>({...p,incident_type:v}));setFPick(null);}} onClose={()=>setFPick(null)}/>
        <PickerModal visible={fPick==='brgy'}   title="Filter by Barangay"      options={BARANGAY_OPTIONS} selected={tempF.barangay}      onSelect={v=>{setTempF(p=>({...p,barangay:v}));setFPick(null);}}      onClose={()=>setFPick(null)}/>

        {/* Count bar */}
        <View style={ml.countBar}>
          <Text style={ml.countTxt}>{allData.length} record{allData.length!==1?'s':''}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            {activeFC>0&&<View style={ml.activePill}><Text style={ml.activePillTxt}>{activeFC} filter{activeFC>1?'s':''} active</Text></View>}
            {loading&&<ActivityIndicator size="small" color={C.navyMid}/>}
          </View>
        </View>

        {/* List */}
        <FlatList
          data={paged}
          renderItem={({item})=>(<BlotterCard item={item} fmt={fmt} onView={()=>handleView(item.blotter_id)} onEdit={()=>handleEdit(item.blotter_id)} onDelete={()=>handleDelete(item.blotter_id)}/>)}
          keyExtractor={item=>String(item.blotter_id)}
          contentContainerStyle={{padding:14,paddingBottom:20}}
          refreshControl={<RefreshControl refreshing={refreshing} colors={[C.navyMid]} tintColor={C.navyMid} onRefresh={async()=>{setRef(true);await load(filters);setRef(false);}}/>}
          ListEmptyComponent={!loading&&(
            <View style={{alignItems:'center',paddingTop:64}}>
              <View style={{width:72,height:72,borderRadius:36,backgroundColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:14}}><Ionicons name="document-text-outline" size={32} color={C.muted}/></View>
              <Text style={{fontSize:16,fontWeight:'700',color:C.sub,marginBottom:6}}>No records found</Text>
              <Text style={{fontSize:13,color:C.muted}}>{activeFC>0?'Try adjusting your filters':'Tap + to add a new blotter entry'}</Text>
            </View>
          )}
          ListFooterComponent={allData.length>PAGE_SIZE?<Pagination page={page} total={allData.length} pageSize={PAGE_SIZE} onChange={p2=>setPage(p2)}/>:null}
        />
      </View>

      {/* FORM MODAL */}
      <Modal visible={modal} animationType="slide" onRequestClose={askClose}>
        <SafeAreaView style={{flex:1,backgroundColor:C.navy}}>
          <StatusBar barStyle="light-content" backgroundColor={C.navy}/>
          <View style={ml.modalHeader}>
            <TouchableOpacity onPress={askClose} style={ml.modalCloseBtn} hitSlop={{top:14,bottom:14,left:14,right:14}}>
              <Ionicons name="close" size={18} color={C.white}/>
            </TouchableOpacity>
            <Text style={ml.modalTitle} numberOfLines={1}>{viewMode?'View Record':editMode?'Edit Record':'New Blotter Entry'}</Text>
            <View style={{width:36}}/>
          </View>
          {mLoad?(
            <View style={{flex:1,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',gap:14}}>
              <ActivityIndicator size="large" color={C.navyMid}/>
              <Text style={{fontSize:14,color:C.sub}}>Loading record…</Text>
            </View>
          ):viewMode?(
            <View style={{flex:1,backgroundColor:C.bg}}>
              <ViewContent viewData={viewData} fmt={fmt} offenseModus={modus} offenseSelModus={selM}/>
              <View style={ml.modalFooter}><TouchableOpacity style={[ml.nextBtn,{flex:1}]} onPress={closeModal}><Text style={ml.nextBtnTxt}>Close</Text></TouchableOpacity></View>
            </View>
          ):(
            <KeyboardAvoidingView style={{flex:1,backgroundColor:C.bg}} behavior={Platform.OS==='ios'?'padding':undefined}>
              <StepBar step={step}/>
              {step===1&&<Step1 comp={comp} setComp={setComp} formErr={formErr} activePick={activePick} setActivePick={setActivePick} regions={regions} loadingR={loadingR} cPr={cPr} cCi={cCi} cBr={cBr} cLP={cLP} cLC={cLC} cLB={cLB} cReg={cReg} cPrv={cPrv} cCit={cCit} uC={uC}/>}
              {step===2&&<Step2 susp={susp} setSusp={setSusp} formErr={formErr} activePick={activePick} setActivePick={setActivePick} regions={regions} loadingR={loadingR} sPr={sPr} sCi={sCi} sBr={sBr} sLP={sLP} sLC={sLC} sLB={sLB} sReg={sReg} sPrv={sPrv} sCit={sCit} uS={uS}/>}
              {step===3&&<Step3 caseD={caseD} uCase={uCase} formErr={formErr} activePick={activePick} setActivePick={setActivePick}/>}
              {step===4&&<Step4 offs={offs} setOffs={setOffs} topPl={topPl} setTopPl={setTopPl} modus={modus} setModus={setModus} selM={selM} setSelM={setSelM} formErr={formErr} activePick={activePick} setActivePick={setActivePick} uO={uO} loadModus={loadModus}/>}
              <View style={ml.modalFooter}>
                {step>1&&<TouchableOpacity style={ml.prevBtn} onPress={()=>goStep(-1)}><Ionicons name="arrow-back" size={15} color={C.navyMid}/><Text style={ml.prevBtnTxt}>Back</Text></TouchableOpacity>}
                {step<STEPS?(<TouchableOpacity style={[ml.nextBtn,{flex:1}]} onPress={()=>goStep(1)}><Text style={ml.nextBtnTxt}>Next</Text><Ionicons name="arrow-forward" size={15} color={C.white}/></TouchableOpacity>)
                :(<TouchableOpacity style={[ml.nextBtn,{flex:1},saving&&{opacity:0.6}]} onPress={submit} disabled={saving}>{saving?<ActivityIndicator size="small" color={C.white}/>:<><Ionicons name="checkmark-circle" size={15} color={C.white}/><Text style={ml.nextBtnTxt}>{editMode?'Update Blotter':'Submit Blotter'}</Text></>}</TouchableOpacity>)}
              </View>
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </Modal>

      {/* TRASH MODAL */}
      <Modal visible={trashModal} animationType="slide" onRequestClose={()=>setTrashModal(false)}>
        <SafeAreaView style={{flex:1,backgroundColor:C.navy}}>
          <StatusBar barStyle="light-content" backgroundColor={C.navy}/>
          <View style={ml.modalHeader}>
            <TouchableOpacity onPress={()=>setTrashModal(false)} style={ml.modalCloseBtn} hitSlop={{top:14,bottom:14,left:14,right:14}}><Ionicons name="close" size={18} color={C.white}/></TouchableOpacity>
            <Text style={ml.modalTitle}>Deleted Records</Text>
            <View style={{width:36}}/>
          </View>
          <View style={{flex:1,backgroundColor:C.bg}}>
            {trashLoad?(<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><ActivityIndicator size="large" color={C.navyMid}/></View>):(
              <FlatList data={trashList} keyExtractor={item=>String(item.blotter_id)} contentContainerStyle={{padding:14}}
                renderItem={({item})=>(
                  <View style={[bc.card,{borderLeftWidth:3,borderLeftColor:C.red}]}>
                    <View style={bc.top}>
                      <View style={{flex:1}}><Text style={bc.id}>{item.blotter_entry_number}</Text><Text style={bc.inc}>{item.incident_type}</Text></View>
                      <View style={[bdg.wrap,{backgroundColor:C.redBg}]}><View style={[bdg.dot,{backgroundColor:C.red}]}/><Text style={[bdg.txt,{color:C.red}]}>Deleted</Text></View>
                    </View>
                    <View style={bc.meta}>
                      <View style={bc.mr}><Ionicons name="location-outline" size={12} color={C.muted}/><Text style={bc.mt}>Brgy. {item.place_barangay}, {item.place_city_municipality}</Text></View>
<View style={bc.mr}><Ionicons name="calendar-outline" size={12} color={C.muted}/><Text style={bc.mt}>Date of Incident: {fmt(item.date_time_commission)}</Text></View>
<View style={bc.mr}><Ionicons name="time-outline" size={12} color={C.muted}/><Text style={bc.mt}>Deleted: {fmt(item.deleted_at)}</Text></View>
                    </View>
                    <View style={{paddingTop:10,borderTopWidth:1,borderTopColor:C.border}}>
                      <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.greenBg,borderRadius:10,paddingVertical:10,paddingHorizontal:16,alignSelf:'flex-start'}} onPress={()=>handleRestore(item.blotter_id)} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                        <Ionicons name="refresh-outline" size={14} color={C.green}/>
                        <Text style={{fontSize:13,fontWeight:'700',color:C.green}}>Restore Record</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                ListEmptyComponent={<View style={{alignItems:'center',paddingTop:64}}><View style={{width:72,height:72,borderRadius:36,backgroundColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:14}}><Ionicons name="trash-outline" size={32} color={C.muted}/></View><Text style={{fontSize:16,fontWeight:'700',color:C.sub}}>No deleted records</Text></View>}
              />
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── Shared styles ───────────────────────────────────────────────────────── */
const sx = StyleSheet.create({
  scroll:      {flex:1,paddingHorizontal:14,paddingTop:14},
  card:        {backgroundColor:C.white,borderRadius:16,padding:16,marginBottom:14,borderWidth:1,borderColor:C.border,shadowColor:C.navy,shadowOffset:{width:0,height:2},shadowOpacity:0.06,shadowRadius:8,elevation:2},
  cardHdr:     {flexDirection:'row',alignItems:'center',marginBottom:16,paddingBottom:12,borderBottomWidth:1,borderBottomColor:C.border},
  badge:       {width:24,height:24,borderRadius:12,alignItems:'center',justifyContent:'center',marginRight:10},
  badgeTxt:    {fontSize:11,fontWeight:'800',color:C.white},
  cardTitle:   {fontSize:14,fontWeight:'800',color:C.navy,flex:1},
  rmBtn:       {flexDirection:'row',alignItems:'center',gap:4,backgroundColor:C.redBg,paddingHorizontal:10,paddingVertical:6,borderRadius:8},
  rmTxt:       {fontSize:11,color:C.red,fontWeight:'700'},
  row2:        {flexDirection:'row'},
  addBtn:      {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,padding:14,borderWidth:1.5,borderStyle:'dashed',borderColor:C.navyMid,borderRadius:14,marginBottom:12,backgroundColor:C.navy50},
  addTxt:      {fontSize:14,fontWeight:'700',color:C.navyMid},
  chip:        {flexDirection:'row',alignItems:'center',paddingHorizontal:12,paddingVertical:7,borderRadius:20,borderWidth:1.5,borderColor:C.border,backgroundColor:C.white},
  chipOn:      {backgroundColor:C.navyMid,borderColor:C.navyMid},
  chipTxt:     {fontSize:12,fontWeight:'600',color:C.sub},
  chipTxtOn:   {color:C.white},
  fixedLoc:    {flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.navy50,borderRadius:10,padding:12,marginBottom:14},
  fixedLocTxt: {fontSize:12,fontWeight:'600',color:C.navyMid,flex:1},
  stepBar:     {flexDirection:'row',alignItems:'center',backgroundColor:C.white,paddingVertical:14,paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:C.border},
  stepItem:    {alignItems:'center'},
  stepCircle:  {width:28,height:28,borderRadius:14,backgroundColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:4},
  stepCircleA: {backgroundColor:C.red},
  stepCircleD: {backgroundColor:C.navyMid},
  stepNum:     {fontSize:11,fontWeight:'700',color:C.sub},
  stepLabel:   {fontSize:9,color:C.muted,fontWeight:'600',textAlign:'center'},
  stepLine:    {flex:1,height:2,backgroundColor:C.border,marginBottom:14,borderRadius:1},
});

const ml = StyleSheet.create({
  header:         {backgroundColor:C.navy,paddingHorizontal:20,paddingVertical:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  headerTitle:    {fontSize:19,fontWeight:'800',color:C.white},
  headerSub:      {fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:2},
  iconBtn:        {width:40,height:40,borderRadius:12,backgroundColor:'rgba(255,255,255,0.12)',alignItems:'center',justifyContent:'center'},
  filterWrap:     {backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border,paddingHorizontal:14,paddingTop:12,paddingBottom:10},
  searchRow:      {flexDirection:'row',alignItems:'center',backgroundColor:C.bg,borderRadius:14,paddingHorizontal:13,paddingVertical:10,borderWidth:1,borderColor:C.border,gap:8},
  searchInput:    {flex:1,fontSize:14,color:C.text},
  filterToggle:   {width:34,height:34,borderRadius:10,backgroundColor:C.bg,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.border},
  filterToggleOn: {backgroundColor:C.navyMid,borderColor:C.navyMid},
  filterDot:      {position:'absolute',top:-4,right:-4,width:16,height:16,borderRadius:8,backgroundColor:C.red,alignItems:'center',justifyContent:'center'},
  filterDotTxt:   {fontSize:9,fontWeight:'800',color:C.white},
  filterPanel:    {marginTop:12,gap:10,paddingBottom:4},
  filterLabel:    {fontSize:10,fontWeight:'700',color:C.muted,marginBottom:5,letterSpacing:0.5},
  filterChip:     {flexDirection:'row',alignItems:'center',gap:6,backgroundColor:C.bg,borderRadius:11,paddingHorizontal:12,paddingVertical:10,borderWidth:1.5,borderColor:C.border},
  filterChipOn:   {backgroundColor:C.navy50,borderColor:C.navyMid},
  filterChipTxt:  {fontSize:13,color:C.sub,flex:1},
  filterChipTxtOn:{color:C.navyMid,fontWeight:'700'},
  applyBtn:       {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:C.navyMid,borderRadius:12,paddingVertical:11},
  applyBtnTxt:    {fontSize:13,fontWeight:'700',color:C.white},
  clearBtn:       {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:C.redBg,borderRadius:12,paddingVertical:11,paddingHorizontal:16,borderWidth:1,borderColor:'rgba(185,28,28,0.2)'},
  countBar:       {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:16,paddingVertical:9,backgroundColor:C.white,borderBottomWidth:1,borderBottomColor:C.border},
  countTxt:       {fontSize:12,color:C.muted,fontWeight:'600'},
  activePill:     {backgroundColor:C.navy50,paddingHorizontal:8,paddingVertical:3,borderRadius:8},
  activePillTxt:  {fontSize:11,color:C.navyMid,fontWeight:'700'},
  modalHeader:    {backgroundColor:C.navy,paddingVertical:14,paddingHorizontal:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  modalCloseBtn:  {width:36,height:36,borderRadius:10,backgroundColor:'rgba(255,255,255,0.12)',alignItems:'center',justifyContent:'center'},
  modalTitle:     {fontSize:16,fontWeight:'800',color:C.white,flex:1,textAlign:'center'},
  modalFooter:    {flexDirection:'row',gap:10,padding:14,backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.border},
  prevBtn:        {flexDirection:'row',alignItems:'center',gap:6,paddingVertical:13,paddingHorizontal:18,borderWidth:1.5,borderColor:C.navyMid,borderRadius:12},
  prevBtnTxt:     {fontSize:14,fontWeight:'700',color:C.navyMid},
  nextBtn:        {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,paddingHorizontal:24,backgroundColor:C.red,borderRadius:12},
  nextBtnTxt:     {fontSize:14,fontWeight:'700',color:C.white},
});