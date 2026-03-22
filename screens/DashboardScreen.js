import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, StatusBar, Dimensions,
  Modal, RefreshControl, TextInput, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getCrimeDashboard, getPresetRange, getGranularity } from './services/api';

const { width: SW } = Dimensions.get('window');
// Cap at 480 so web/laptop stays 2x2 like mobile
const MAX_W  = Math.min(SW, 480);
const CARD_W = Math.floor((MAX_W - 44) / 2);

// ─── EXACT WEB COLORS ────────────────────────────────────────────────────────
const NAVY   = '#0a1628';
const NAVY_M = '#1e3a5f';
const NAVY_L = '#2d4a6f';
const RED    = '#c1272d';
const WHITE  = '#ffffff';
const G50    = '#f8f9fa';
const G100   = '#e9ecef';
const G200   = '#dee2e6';
const G400   = '#adb5bd';
const G600   = '#6c757d';
const G700   = '#495057';
const G900   = '#212529';
const GREEN  = '#22c55e';
const GREEND = '#15803d';
const BLUE   = '#3b82f6';
const BLUED  = '#1d4ed8';
const AMBER  = '#f59e0b';
const AMBERD = '#b45309';

// Web exact card gradients: cd-card-blue, cd-card-green, cd-card-teal, cd-card-amber
const CARD_BG = ['#1e3a5f', '#166534', '#0f766e', '#92400e'];

// ─── BARANGAYS ────────────────────────────────────────────────────────────────
const CURRENT_BARANGAYS = [
  "ANIBAN I","ANIBAN II","BAYANAN","DULONG BAYAN","HABAY I","HABAY II",
  "KAINGIN (POB.)","KAINGIN DIGMAN","LIGAS I","LIGAS II","MABOLO",
  "MALIKSI I","MALIKSI II","MAMBOG I","MAMBOG II","MAMBOG III","MAMBOG IV",
  "MOLINO I","MOLINO II","MOLINO III","MOLINO IV","MOLINO V","MOLINO VI","MOLINO VII",
  "NIOG","P.F. ESPIRITU I (PANAPAAN)","P.F. ESPIRITU II","P.F. ESPIRITU III",
  "P.F. ESPIRITU IV","P.F. ESPIRITU V","P.F. ESPIRITU VI",
  "QUEENS ROW CENTRAL","QUEENS ROW EAST","QUEENS ROW WEST","REAL",
  "SALINAS I","SALINAS II","SAN NICOLAS I","SAN NICOLAS II","SAN NICOLAS III",
  "SINEGUELASAN","TALABA I","TALABA II","TALABA III","ZAPOTE I","ZAPOTE II","ZAPOTE III",
];
const LEGACY_OPTIONS = [
  {label:"Alima (→ Sineguelasan)",         value:"SINEGUELASAN"},
  {label:"Banalo (→ Sineguelasan)",         value:"SINEGUELASAN"},
  {label:"Camposanto (→ Kaingin Pob.)",     value:"KAINGIN (POB.)"},
  {label:"Daang Bukid (→ Kaingin Pob.)",    value:"KAINGIN (POB.)"},
  {label:"Tabing Dagat (→ Kaingin Pob.)",   value:"KAINGIN (POB.)"},
  {label:"Kaingin (→ Kaingin Digman)",      value:"KAINGIN DIGMAN"},
  {label:"Digman (→ Kaingin Digman)",       value:"KAINGIN DIGMAN"},
  {label:"Panapaan (→ P.F. Espiritu I)",    value:"P.F. ESPIRITU I (PANAPAAN)"},
  {label:"Panapaan 2 (→ P.F. Espiritu II)", value:"P.F. ESPIRITU II"},
  {label:"Panapaan 4 (→ P.F. Espiritu IV)", value:"P.F. ESPIRITU IV"},
  {label:"Panapaan 5 (→ P.F. Espiritu V)",  value:"P.F. ESPIRITU V"},
  {label:"Panapaan 6 (→ P.F. Espiritu VI)", value:"P.F. ESPIRITU VI"},
  {label:"Mabolo 1 (→ Mabolo)",             value:"MABOLO"},
  {label:"Mabolo 2 (→ Mabolo)",             value:"MABOLO"},
  {label:"Mabolo 3 (→ Mabolo)",             value:"MABOLO"},
  {label:"Aniban 3 (→ Aniban I)",           value:"ANIBAN I"},
  {label:"Aniban 4 (→ Aniban II)",          value:"ANIBAN II"},
  {label:"Aniban 5 (→ Aniban I)",           value:"ANIBAN I"},
  {label:"Maliksi 3 (→ Maliksi II)",        value:"MALIKSI II"},
  {label:"Mambog 5 (→ Mambog II)",          value:"MAMBOG II"},
  {label:"Niog 2 (→ Niog)",                value:"NIOG"},
  {label:"Niog 3 (→ Niog)",                value:"NIOG"},
  {label:"Real 2 (→ Real)",                value:"REAL"},
  {label:"Salinas 3 (→ Salinas II)",        value:"SALINAS II"},
  {label:"Salinas 4 (→ Salinas II)",        value:"SALINAS II"},
  {label:"Talaba 4 (→ Talaba III)",         value:"TALABA III"},
  {label:"Talaba 7 (→ Talaba I)",           value:"TALABA I"},
];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const INDEX_CRIMES = [
  'MURDER','HOMICIDE','PHYSICAL INJURIES','RAPE','ROBBERY',
  'THEFT','CARNAPPING - MC','CARNAPPING - MV','SPECIAL COMPLEX CRIME',
];
const CDISPLAY = {
  'MURDER':'Murder','HOMICIDE':'Homicide','PHYSICAL INJURIES':'Physical Injuries',
  'RAPE':'Rape','ROBBERY':'Robbery','THEFT':'Theft',
  'CARNAPPING - MC':'Carnapping - MC','CARNAPPING - MV':'Carnapping - MV',
  'SPECIAL COMPLEX CRIME':'Special Complex Crime',
};
const CSHORT = {
  'MURDER':'Murder','HOMICIDE':'Homicide','PHYSICAL INJURIES':'Phys. Inj.',
  'RAPE':'Rape','ROBBERY':'Robbery','THEFT':'Theft',
  'CARNAPPING - MC':'Carnap MC','CARNAPPING - MV':'Carnap MV',
  'SPECIAL COMPLEX CRIME':'Spec. Cmplx',
};
const CCOLORS = {
  Total:NAVY,'MURDER':'#ef4444','HOMICIDE':'#f97316','PHYSICAL INJURIES':'#eab308',
  'RAPE':'#a855f7','ROBBERY':'#ec4899','THEFT':'#14b8a6',
  'CARNAPPING - MC':'#3b82f6','CARNAPPING - MV':'#6366f1','SPECIAL COMPLEX CRIME':'#84cc16',
};
const PRESETS = [
  {label:'Last 7 days',key:'7d'},{label:'Last 30 days',key:'30d'},
  {label:'Last 3 months',key:'3m'},{label:'Last 365 days',key:'365d'},{label:'Custom',key:'custom'},
];
const PAGE   = 8;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const pct     = (n,d) => d ? ((n/d)*100).toFixed(1) : '0.0';
const fmtDate = (iso) => { if(!iso) return ''; const [y,m,d]=iso.split('-'); return `${m}/${d}/${y}`; };
const fmtISO  = (d)   => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
const isoDate = (iso) => iso ? new Date(iso+'T00:00:00') : new Date();
const granLbl = (g)   => g==='daily'?'Daily':g==='bidaily'?'Every 2 Days':g==='weekly'?'Weekly':'Monthly';
const BLANK   = ()    => { const r=getPresetRange('365d'); return {preset:'365d',dateFrom:r.from,dateTo:r.to,crimeTypes:[],barangays:[]}; };
const EMPTYDB = ()    => ({summary:[],trends:[],hourly:[],byDay:[],place:[],barangay:[],modus:[]});
const valDates= (f,t) => {
  if(!f||!t) return 'Select both dates.';
  if(f>=t)   return 'Start must be before end.';
  if(Math.round((new Date(t)-new Date(f))/86400000)<7) return 'Min 7 days range.';
  return '';
};

// ─── DATE PICKER (exact EBlotter.js pattern) ─────────────────────────────────
function DatePickerBtn({label,value,onChange,maximumDate}) {
  const [show,setShow] = useState(false);
  const [temp,setTemp] = useState(new Date());
  const maxISO = fmtISO(maximumDate||new Date());
  const disp = value ? (()=>{const d=isoDate(value);return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;})() : '';

  if(Platform.OS==='web') return (
    <View style={{flex:1}}>
      <Text style={dp.lbl}>{label}</Text>
      <input type="date" value={value||''} max={maxISO}
        style={{height:42,padding:'0 10px',border:`1.5px solid ${G200}`,borderRadius:8,
          fontSize:13,fontFamily:'inherit',color:G900,background:G50,
          outline:'none',colorScheme:'light',width:'100%',boxSizing:'border-box'}}
        onChange={e=>{
          if(e.target.value){const p=e.target.value.split('-');onChange(new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2])));}
        }}/>
    </View>
  );

  if(Platform.OS==='ios') return (
    <View style={{flex:1}}>
      <Text style={dp.lbl}>{label}</Text>
      <TouchableOpacity style={dp.btn} onPress={()=>{setTemp(value?isoDate(value):new Date());setShow(true);}}>
        <Text style={[dp.btnTxt,!value&&{color:G400}]}>{disp||'Select date'}</Text>
        <Ionicons name="calendar-outline" size={15} color={G600}/>
      </TouchableOpacity>
      {show&&(
        <Modal visible transparent animationType="slide">
          <View style={dp.iosOv}>
            <View style={dp.iosSh}>
              <View style={dp.iosHdr}>
                <TouchableOpacity onPress={()=>setShow(false)}><Text style={dp.iosCan}>Cancel</Text></TouchableOpacity>
                <Text style={dp.iosTit}>{label}</Text>
                <TouchableOpacity onPress={()=>{onChange(temp);setShow(false);}}><Text style={dp.iosDone}>Done</Text></TouchableOpacity>
              </View>
              <DateTimePicker value={temp} mode="date" display="spinner"
                onChange={(_,d)=>d&&setTemp(d)} maximumDate={maximumDate||new Date()}/>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );

  return (
    <View style={{flex:1}}>
      <Text style={dp.lbl}>{label}</Text>
      <TouchableOpacity style={dp.btn} onPress={()=>setShow(true)}>
        <Text style={[dp.btnTxt,!value&&{color:G400}]}>{disp||'Select date'}</Text>
        <Ionicons name="calendar-outline" size={15} color={G600}/>
      </TouchableOpacity>
      {show&&(
        <DateTimePicker value={value?isoDate(value):new Date()} mode="date" display="calendar"
          onChange={(e,d)=>{setShow(false);if(e.type!=='dismissed'&&d)onChange(d);}}
          maximumDate={maximumDate||new Date()}/>
      )}
    </View>
  );
}

// ─── COLLAPSIBLE SECTION ──────────────────────────────────────────────────────
function Section({title,sub,iconName,iconBg,children}) {
  const [open,setOpen] = useState(false);
  return (
    <View style={s.sec}>
      <TouchableOpacity style={s.secHdr} onPress={()=>setOpen(v=>!v)} activeOpacity={0.75}>
        <View style={[s.secIcon,{backgroundColor:iconBg}]}>
          <Ionicons name={iconName} size={15} color={WHITE}/>
        </View>
        <View style={{flex:1}}>
          <Text style={s.secTitle}>{title}</Text>
          {sub?<Text style={s.secSub}>{sub}</Text>:null}
        </View>
        <Ionicons name={open?'chevron-up':'chevron-down'} size={16} color={G400}/>
      </TouchableOpacity>
      {open&&<View style={s.secBody}>{children}</View>}
    </View>
  );
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
function Bdg({val,color}) {
  const bg=color==='green'?'rgba(34,197,94,0.12)':color==='red'?'rgba(239,68,68,0.1)':'rgba(245,158,11,0.1)';
  const tc=color==='green'?GREEND:color==='red'?'#ef4444':AMBERD;
  return <View style={[s.bdg,{backgroundColor:bg}]}><Text style={[s.bdgTxt,{color:tc}]}>{val}</Text></View>;
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────
function Pgn({page,total,pageSize,onPrev,onNext,onPage}) {
  const tp  = Math.max(Math.ceil(total/pageSize),1);
  const from= total===0?0:page*pageSize+1;
  const to  = Math.min((page+1)*pageSize,total);
  return (
    <View style={s.pgRow}>
      <Text style={s.pgInfo}>{total===0?'No results':`${from}–${to} of ${total}`}</Text>
      <View style={s.pgBtns}>
        <TouchableOpacity style={[s.pgBtn,page===0&&s.pgDis]} onPress={onPrev} disabled={page===0}>
          <Ionicons name="chevron-back" size={12} color={page===0?G200:NAVY}/>
        </TouchableOpacity>
        {tp>1&&Array.from({length:Math.min(tp,5)},(_,i)=>(
          <TouchableOpacity key={i} style={[s.pgBtn,page===i&&s.pgAct]} onPress={()=>onPage(i)}>
            <Text style={[s.pgTxt,page===i&&{color:WHITE}]}>{i+1}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[s.pgBtn,page===tp-1&&s.pgDis]} onPress={onNext} disabled={page===tp-1}>
          <Ionicons name="chevron-forward" size={12} color={page===tp-1?G200:NAVY}/>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── ROW DETAIL SHEET ────────────────────────────────────────────────────────
function DetailSheet({visible,data,onClose}) {
  if(!visible||!data) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetBg}>
        <TouchableOpacity style={{flex:1}} activeOpacity={1} onPress={onClose}/>
        <View style={s.detailSh}>
          <View style={s.handle}/>
          <View style={{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:20}}>
            <View style={s.rankCircle}><Text style={s.rankTxt}>#{data.rank}</Text></View>
            <Text style={s.detailName} numberOfLines={3}>{data.name}</Text>
          </View>
          <View style={s.detailRow}>
            <View style={s.detailStat}>
              <Text style={s.detailVal}>{data.count}</Text>
              <Text style={s.detailLbl}>Incidents</Text>
            </View>
            {data.type&&(
              <View style={s.detailStat}>
                <Text style={[s.detailVal,{fontSize:14}]} numberOfLines={2}>{data.type}</Text>
                <Text style={s.detailLbl}>Category</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={s.detailClose} onPress={onClose}>
            <Text style={s.detailCloseTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── MULTI-SELECT MODAL ───────────────────────────────────────────────────────
function MultiSelect({visible,title,items,legacy,selected,onClose,onApply,searchable}) {
  const [draft,setDraft]   = useState([]);
  const [search,setSearch] = useState('');
  useEffect(()=>{if(visible){setDraft([...selected]);setSearch('');}},[visible,selected]);
  const filt    = searchable?items.filter(i=>i.toLowerCase().includes(search.toLowerCase())):items;
  const filtLeg = legacy?legacy.filter(o=>o.label.toLowerCase().includes(search.toLowerCase())):[];
  const toggle  = (v)=>setDraft(d=>d.includes(v)?d.filter(x=>x!==v):[...d,v]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.msOv}>
        <View style={s.msSh}>
          <View style={s.handle}/>
          <View style={s.msTop}>
            <Text style={s.msTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={NAVY}/></TouchableOpacity>
          </View>
          {searchable&&(
            <View style={s.msSearch}>
              <Ionicons name="search-outline" size={15} color={G400}/>
              <TextInput style={s.msSearchTxt} placeholder="Search..." value={search}
                onChangeText={setSearch} placeholderTextColor={G400}/>
              {!!search&&<TouchableOpacity onPress={()=>setSearch('')}>
                <Ionicons name="close-circle" size={16} color={G400}/></TouchableOpacity>}
            </View>
          )}
          <View style={s.msActions}>
            <TouchableOpacity onPress={()=>setDraft(draft.length===items.length?[]:[...items])}>
              <Text style={s.msActTxt}>{draft.length===items.length?'Clear all':'Select all'}</Text>
            </TouchableOpacity>
            {draft.length>0&&(
              <TouchableOpacity style={{marginLeft:16}} onPress={()=>setDraft([])}>
                <Text style={[s.msActTxt,{color:RED}]}>Clear ({draft.length})</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView style={s.msList} showsVerticalScrollIndicator={false}>
            {filt.map((item,i)=>{
              const sel=draft.includes(item);
              return (
                <TouchableOpacity key={i} style={s.msItem} onPress={()=>toggle(item)}>
                  <View style={[s.msChk,sel&&s.msChkOn]}>
                    {sel&&<Ionicons name="checkmark" size={12} color={WHITE}/>}
                  </View>
                  <Text style={[s.msItemTxt,sel&&{color:NAVY,fontWeight:'700'}]}>{item}</Text>
                </TouchableOpacity>
              );
            })}
            {filtLeg.length>0&&(
              <>
                <View style={s.msGroup}>
                  <View style={s.msGroupLine}/><Text style={s.msGroupTxt}>Pre-2023 Names (Auto-resolved)</Text><View style={s.msGroupLine}/>
                </View>
                {filtLeg.map((o,i)=>{
                  const sel=draft.includes(o.value);
                  return (
                    <TouchableOpacity key={`l${i}`} style={s.msItem} onPress={()=>toggle(o.value)}>
                      <View style={[s.msChk,sel&&s.msChkOn]}>{sel&&<Ionicons name="checkmark" size={12} color={WHITE}/>}</View>
                      <Text style={[s.msItemTxt,{color:G600},sel&&{color:NAVY,fontWeight:'700'}]}>{o.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}
            {filt.length===0&&filtLeg.length===0&&<Text style={{textAlign:'center',color:G400,padding:24,fontSize:13}}>No results</Text>}
            <View style={{height:20}}/>
          </ScrollView>
          <View style={s.msFoot}>
            <TouchableOpacity style={s.msCancel} onPress={onClose}><Text style={s.msCancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={s.msApply} onPress={()=>{onApply(draft);onClose();}}>
              <Text style={s.msApplyTxt}>Apply{draft.length>0?` (${draft.length})`:''}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── FILTER SHEET ─────────────────────────────────────────────────────────────
function FilterSheet({visible,applied,onApply,onClose}) {
  const [draft,setDraft]       = useState({...applied});
  const [dateErr,setDateErr]   = useState('');
  const [showCrime,setShowCrime]=useState(false);
  const [showBrgy,setShowBrgy] = useState(false);
  useEffect(()=>{if(visible){setDraft({...applied});setDateErr('');}},[visible,applied]);

  const handlePreset=(key)=>{
    if(key==='custom'){setDraft(f=>({...f,preset:'custom'}));setDateErr('');return;}
    const r=getPresetRange(key);
    if(r) setDraft(f=>({...f,preset:key,dateFrom:r.from,dateTo:r.to}));
    setDateErr('');
  };
  const onFrom=(d)=>{const iso=fmtISO(d);setDraft(f=>({...f,dateFrom:iso}));setDateErr(valDates(iso,draft.dateTo));};
  const onTo  =(d)=>{const iso=fmtISO(d);setDraft(f=>({...f,dateTo:iso}));  setDateErr(valDates(draft.dateFrom,iso));};
  const doApply=()=>{
    if(draft.preset==='custom'){const e=valDates(draft.dateFrom,draft.dateTo);if(e){setDateErr(e);return;}}
    onApply({...draft});onClose();
  };
  const dirty=JSON.stringify(draft)!==JSON.stringify(applied);

  return (
    <>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.fsOv}>
        <View style={s.fsSh}>
          <View style={s.handle}/>
          <View style={s.fsTop}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Ionicons name="settings-outline" size={16} color={NAVY}/>
              <Text style={s.fsTitle}>Filters &amp; Options</Text>
              {dirty&&<View style={s.fsDirty}><Text style={s.fsDirtyTxt}>modified</Text></View>}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Ionicons name="close" size={22} color={NAVY}/>
            </TouchableOpacity>
          </View>
          <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:20}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* DATE PRESETS */}
            <Text style={s.fsLbl}>Date Range</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{paddingHorizontal:20,paddingBottom:4,gap:6,flexDirection:'row'}}>
              {PRESETS.map(p=>(
                <TouchableOpacity key={p.key} style={[s.presetChip,draft.preset===p.key&&s.presetChipOn]} onPress={()=>handlePreset(p.key)}>
                  <Text style={[s.presetTxt,draft.preset===p.key&&s.presetTxtOn]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            {draft.preset!=='custom'?(
              <View style={s.rangeDisp}>
                <Ionicons name="calendar-outline" size={13} color={NAVY_M}/>
                <Text style={s.rangeDispTxt}>{fmtDate(draft.dateFrom)} — {fmtDate(draft.dateTo)}</Text>
              </View>
            ):(
              <View style={{paddingHorizontal:20,marginTop:12}}>
                <View style={{flexDirection:'row',alignItems:'flex-start',gap:8}}>
                  <DatePickerBtn label="Start Date" value={draft.dateFrom} onChange={onFrom}
                    maximumDate={draft.dateTo?isoDate(draft.dateTo):new Date()}/>
                  <View style={{paddingTop:30,paddingHorizontal:2}}><Text style={{color:G400,fontSize:16}}>→</Text></View>
                  <DatePickerBtn label="End Date" value={draft.dateTo} onChange={onTo} maximumDate={new Date()}/>
                </View>
                {!!dateErr&&(
                  <View style={s.dateErrBox}>
                    <Ionicons name="warning-outline" size={13} color="#dc2626"/>
                    <Text style={s.dateErrTxt}>{dateErr}</Text>
                  </View>
                )}
              </View>
            )}
            {/* INCIDENT TYPE */}
            <Text style={s.fsLbl}>Incident Type</Text>
            <View style={{paddingHorizontal:20}}>
              <TouchableOpacity style={s.dropBtn} onPress={()=>setShowCrime(true)}>
                <View style={s.dropInner}>
                  {draft.crimeTypes.length===0?(<Text style={s.dropPh}>All Crimes</Text>):(
                    <>
                      {draft.crimeTypes.slice(0,2).map(c=>(
                        <View key={c} style={s.pill}><Text style={s.pillTxt} numberOfLines={1}>{CSHORT[c]}</Text>
                          <TouchableOpacity hitSlop={{top:8,bottom:8,left:4,right:4}} onPress={()=>setDraft(f=>({...f,crimeTypes:f.crimeTypes.filter(x=>x!==c)}))}>
                            <Text style={s.pillX}>×</Text></TouchableOpacity>
                        </View>
                      ))}
                      {draft.crimeTypes.length>2&&<View style={[s.pill,{backgroundColor:G400}]}><Text style={s.pillTxt}>+{draft.crimeTypes.length-2}</Text></View>}
                    </>
                  )}
                </View>
                <Ionicons name="chevron-down" size={16} color={G600}/>
              </TouchableOpacity>
            </View>
            {/* BARANGAY */}
            <Text style={s.fsLbl}>Barangay</Text>
            <View style={{paddingHorizontal:20}}>
              <TouchableOpacity style={s.dropBtn} onPress={()=>setShowBrgy(true)}>
                <View style={s.dropInner}>
                  {draft.barangays.length===0?(<Text style={s.dropPh}>All Barangays</Text>):(
                    <>
                      {draft.barangays.slice(0,2).map(b=>(
                        <View key={b} style={s.pill}><Text style={s.pillTxt} numberOfLines={1}>{b}</Text>
                          <TouchableOpacity hitSlop={{top:8,bottom:8,left:4,right:4}} onPress={()=>setDraft(f=>({...f,barangays:f.barangays.filter(x=>x!==b)}))}>
                            <Text style={s.pillX}>×</Text></TouchableOpacity>
                        </View>
                      ))}
                      {draft.barangays.length>2&&<View style={[s.pill,{backgroundColor:G400}]}><Text style={s.pillTxt}>+{draft.barangays.length-2}</Text></View>}
                    </>
                  )}
                </View>
                <Ionicons name="chevron-down" size={16} color={G600}/>
              </TouchableOpacity>
            </View>
          </ScrollView>
          <View style={s.fsFoot}>
            <TouchableOpacity style={s.resetBtn} onPress={()=>{
              const blank=BLANK();
              onApply(blank);
              setTimeout(()=>onClose(),50);
            }}>
              <Text style={{fontSize:20,color:G700}}>↺</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.applyBtn} onPress={doApply}>
              <Text style={s.applyTxt}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    <MultiSelect visible={showCrime} title="Incident Type" items={INDEX_CRIMES}
      selected={draft.crimeTypes} searchable={false}
      onClose={()=>setShowCrime(false)} onApply={sel=>setDraft(f=>({...f,crimeTypes:sel}))}/>
    <MultiSelect visible={showBrgy} title="Barangay" items={CURRENT_BARANGAYS}
      legacy={LEGACY_OPTIONS} selected={draft.barangays} searchable={true}
      onClose={()=>setShowBrgy(false)} onApply={sel=>setDraft(f=>({...f,barangays:sel}))}/>
    </>
  );
}

// ─── SUMMARY CARDS — exact web cd-summary-cards, 2x2 grid ────────────────────
function SummaryCards({data}) {
  const total   = data.reduce((s,d)=>s+d.total,0);
  const cleared = data.reduce((s,d)=>s+d.cleared,0);
  const solved  = data.reduce((s,d)=>s+d.solved,0);
  const ui      = data.reduce((s,d)=>s+d.underInvestigation,0);
  const cards = [
    {label:'Total Incidents',value:String(total),           sub:'Index crimes',      icon:'document-text-outline'},
    {label:'CCE %',          value:`${pct(cleared,total)}%`,sub:`${cleared} cleared`,icon:'lock-open-outline'},
    {label:'CSE %',          value:`${pct(solved,total)}%`, sub:`${solved} solved`,  icon:'checkmark-done-outline'},
    {label:'Under Investigation',value:String(ui),          sub:'Pending resolution',icon:'search-outline'},
  ];
  return (
    <View style={s.cardGrid}>
      {cards.map((c,i)=>(
        <View key={i} style={[s.statCard,{backgroundColor:CARD_BG[i],width:CARD_W}]}>
          <View style={s.statCircle}/>
          <View style={s.statTopRow}>
            <View style={s.statIconBox}>
              <Ionicons name={c.icon} size={16} color="rgba(255,255,255,0.9)"/>
            </View>
            <Text style={s.statSubTxt} numberOfLines={2}>{c.sub}</Text>
          </View>
          <Text style={s.statVal}>{c.value}</Text>
          <Text style={s.statLbl}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── INDEX CRIME TABLE ────────────────────────────────────────────────────────
function IndexCrimeTable({data,sel}) {
  const [col,setCol]=useState('total');
  const [dir,setDir]=useState('desc');
  const vis  = sel.length>0?data.filter(d=>sel.includes(d.crime)):data;
  const rows = [...vis].sort((a,b)=>{const av=a[col]??0,bv=b[col]??0;return dir==='desc'?bv-av:av-bv;});
  const tot  = vis.reduce((a,d)=>({total:a.total+d.total,cleared:a.cleared+d.cleared,solved:a.solved+d.solved,ui:a.ui+d.underInvestigation}),{total:0,cleared:0,solved:0,ui:0});
  const sort =(c)=>{if(col===c)setDir(d=>d==='desc'?'asc':'desc');else{setCol(c);setDir('desc');}};
  return (
    <View style={s.card}>
      <View style={s.cardHdr}>
        <Text style={s.cardTitle}>Index Crime Summary Table</Text>
        <Text style={s.cardSub}>{sel.length>0?`${rows.length} of 9`:'All 9'} crimes · CCE=Cleared/Total · CSE=Solved/Total</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={s.tHead}>
            <Text style={[s.tH,{width:112}]}>Index Crime</Text>
            {[['total','Total'],['cleared','Cleared'],['solved','Solved'],['underInvestigation','Under Inv.']].map(([c,l])=>(
              <TouchableOpacity key={c} style={[s.tHBtn,{width:58}]} onPress={()=>sort(c)}>
                <Text style={s.tHTxt}>{l}</Text>
                <Ionicons name={col===c?(dir==='desc'?'arrow-down':'arrow-up'):'swap-vertical'} size={9} color="rgba(255,255,255,0.7)"/>
              </TouchableOpacity>
            ))}
            <Text style={[s.tH,{width:50,textAlign:'right'}]}>CCE%</Text>
            <Text style={[s.tH,{width:50,textAlign:'right'}]}>CSE%</Text>
          </View>
          {rows.map((r,i)=>{
            const cce=parseFloat(pct(r.cleared,r.total));
            const cse=parseFloat(pct(r.solved,r.total));
            return (
              <View key={i} style={[s.tRow,i%2===1&&s.tRowAlt]}>
                <Text style={[s.tD,{width:112,color:NAVY_M,fontWeight:'700',fontSize:11}]}>{CDISPLAY[r.crime]||r.crime}</Text>
                <Text style={[s.tD,{width:58,textAlign:'right'}]}>{r.total}</Text>
                <Text style={[s.tD,{width:58,textAlign:'right',color:GREEND}]}>{r.cleared}</Text>
                <Text style={[s.tD,{width:58,textAlign:'right',color:BLUED}]}>{r.solved}</Text>
                <Text style={[s.tD,{width:58,textAlign:'right',color:AMBERD}]}>{r.underInvestigation}</Text>
                <View style={[s.tD,{width:50,alignItems:'flex-end'}]}><Bdg val={`${cce.toFixed(1)}%`} color={cce>=50?'green':'red'}/></View>
                <View style={[s.tD,{width:50,alignItems:'flex-end'}]}><Bdg val={`${cse.toFixed(1)}%`} color={cse>=50?'green':'amber'}/></View>
              </View>
            );
          })}
          <View style={s.tFoot}>
            <Text style={[s.tD,{width:112,fontWeight:'700',color:NAVY}]}>TOTAL</Text>
            <Text style={[s.tD,{width:58,textAlign:'right',fontWeight:'700'}]}>{tot.total}</Text>
            <Text style={[s.tD,{width:58,textAlign:'right',fontWeight:'700',color:GREEND}]}>{tot.cleared}</Text>
            <Text style={[s.tD,{width:58,textAlign:'right',fontWeight:'700',color:BLUED}]}>{tot.solved}</Text>
            <Text style={[s.tD,{width:58,textAlign:'right',fontWeight:'700',color:AMBERD}]}>{tot.ui}</Text>
            <View style={[s.tD,{width:50,alignItems:'flex-end'}]}><Bdg val={`${pct(tot.cleared,tot.total)}%`} color="green"/></View>
            <View style={[s.tD,{width:50,alignItems:'flex-end'}]}><Bdg val={`${pct(tot.solved,tot.total)}%`} color="green"/></View>
          </View>
        </View>
      </ScrollView>
      <Text style={s.swipe}>← swipe to see all columns →</Text>
    </View>
  );
}

// ─── CASE STATUS ──────────────────────────────────────────────────────────────
function CaseStatus({data,sel}) {
  const vis  = sel.length>0?data.filter(d=>sel.includes(d.crime)):data;
  const maxT = Math.max(...vis.map(r=>r.cleared+r.solved+r.underInvestigation),1);
  return (
    <View style={s.card}>
      <View style={s.cardHdr}>
        <Text style={s.cardTitle}>Case Status per Index Crime</Text>
        <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
          {[[GREEN,'Cleared'],[BLUE,'Solved'],[AMBER,'U.Inv']].map(([c,l])=>(
            <View key={l} style={{flexDirection:'row',alignItems:'center',gap:3}}>
              <View style={{width:7,height:7,borderRadius:4,backgroundColor:c}}/>
              <Text style={{fontSize:9,color:G600}}>{l}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{padding:14}}>
        {vis.map((r,i)=>{
          const tot=r.cleared+r.solved+r.underInvestigation;
          const bw=((tot/maxT)*(SW-200));
          return (
            <View key={i} style={{flexDirection:'row',alignItems:'center',marginBottom:10}}>
              <Text style={{width:80,fontSize:10,fontWeight:'700',color:NAVY_M}} numberOfLines={1}>{CSHORT[r.crime]||r.crime}</Text>
              <View style={{flexDirection:'row',height:22,borderRadius:3,overflow:'hidden',flex:1,backgroundColor:G100}}>
                {r.cleared>0&&<View style={{width:(r.cleared/Math.max(tot,1))*bw,backgroundColor:GREEN}}/>}
                {r.solved>0&&<View style={{width:(r.solved/Math.max(tot,1))*bw,backgroundColor:BLUE}}/>}
                {r.underInvestigation>0&&<View style={{width:(r.underInvestigation/Math.max(tot,1))*bw,backgroundColor:AMBER}}/>}
              </View>
              <Text style={{width:26,fontSize:11,fontWeight:'700',color:NAVY,textAlign:'right',marginLeft:8}}>{tot}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── CRIME TRENDS ─────────────────────────────────────────────────────────────
function CrimeTrends({filters,data}) {
  const [mode,setMode]     = useState('total');
  const [hidden,setHidden] = useState(new Set());
  const gran   = getGranularity(filters.preset,filters.dateFrom,filters.dateTo);
  const days   = Math.round((new Date(filters.dateTo)-new Date(filters.dateFrom))/86400000)+1;
  const crimes = filters.crimeTypes.length>0?filters.crimeTypes:INDEX_CRIMES;
  const sw=(m)=>{setMode(m);setHidden(new Set());};
  const tog=(k)=>setHidden(p=>{const n=new Set(p);n.has(k)?n.delete(k):n.add(k);return n;});
  const allVis=crimes.every(c=>!hidden.has(c));

  if(!data||data.length===0) return (
    <View style={s.card}><View style={s.cardHdr}><Text style={s.cardTitle}>Crime Trends</Text></View>
      <View style={{height:80,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:12,color:G600}}>No trend data</Text></View>
    </View>
  );

  const step=Math.max(1,Math.floor(data.length/13));
  const thin=data.filter((_,i)=>i%step===0||i===data.length-1);
  const fmtL=(iso)=>{if(!iso)return '';const[,m,d]=iso.split('-');return(gran==='monthly'||gran==='weekly')?MONTHS[parseInt(m)-1]:`${parseInt(m)}/${parseInt(d)}`;};
  const PH=160,PW=Math.max(SW-64,thin.length*38);
  const PL=6,PR=6,PT=12,PB=26,IW=PW-PL-PR,IH=PH-PT-PB;
  const DS=mode==='total'?[{key:'Total',color:NAVY,sw:3,vals:thin.map(d=>d.Total||0)}]:crimes.filter(c=>!hidden.has(c)).map(c=>({key:c,color:CCOLORS[c]||'#888',sw:2,vals:thin.map(d=>d[c]||0)}));
  const maxV=Math.max(...DS.flatMap(d=>d.vals),1);
  const toX=(i)=>PL+(i/(thin.length-1||1))*IW;
  const toY=(v)=>PT+IH-(v/maxV)*IH;

  return (
    <View style={s.card}>
      <View style={s.cardHdr}>
        <Text style={s.cardTitle}>Crime Trends</Text>
        <Text style={s.cardSub}>{granLbl(gran)} · {data.length} pts · {days} days</Text>
      </View>
      <View style={s.modeRow}>
        {[['total','Total'],['crime','By Crime']].map(([m,l])=>(
          <TouchableOpacity key={m} style={[s.modeBtn,mode===m&&s.modeBtnOn]} onPress={()=>sw(m)}>
            <Text style={[s.modeTxt,mode===m&&s.modeTxtOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {mode==='crime'&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{paddingHorizontal:12,marginBottom:8}}>
          <View style={{flexDirection:'row',gap:5,alignItems:'center'}}>
            <TouchableOpacity style={s.showAllBtn} onPress={()=>setHidden(allVis?new Set(crimes):new Set())}>
              <Text style={s.showAllTxt}>{allVis?'Hide All':'Show All'}</Text>
            </TouchableOpacity>
            {crimes.map(c=>{
              const off=hidden.has(c);
              return (
                <TouchableOpacity key={c} style={[s.cpill,off&&s.cpillOff]} onPress={()=>tog(c)}>
                  <View style={[s.cpillDot,{backgroundColor:off?G400:CCOLORS[c]}]}/>
                  <Text style={[s.cpillTxt,off&&{color:G400,textDecorationLine:'line-through'}]}>{CSHORT[c]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{width:PW,height:PH+10,paddingLeft:2}}>
          {[0,0.25,0.5,0.75,1].map((r,i)=>(
            <View key={i} style={{position:'absolute',left:PL,right:PR,top:PT+IH-r*IH,height:1,backgroundColor:'#e5e7eb'}}/>
          ))}
          {DS.map((ds,di)=>{
            const pts=ds.vals.map((v,i)=>({x:toX(i),y:toY(v)}));
            return (
              <View key={di} style={{position:'absolute',top:0,left:0,width:PW,height:PH}}>
                {pts.map((pt,i)=>{
                  if(i===0)return null;
                  const pv=pts[i-1],dx=pt.x-pv.x,dy=pt.y-pv.y;
                  const len=Math.sqrt(dx*dx+dy*dy),ang=Math.atan2(dy,dx)*(180/Math.PI);
                  return <View key={i} style={{position:'absolute',left:pv.x,top:pv.y-ds.sw/2,width:len,height:ds.sw,backgroundColor:ds.color,borderRadius:1,transform:[{rotate:`${ang}deg`}],transformOrigin:'0 50%'}}/>;
                })}
                {pts.map((pt,i)=>(
                  <View key={`d${i}`} style={{position:'absolute',left:pt.x-4,top:pt.y-4,width:8,height:8,borderRadius:4,backgroundColor:ds.color,borderWidth:2,borderColor:WHITE}}/>
                ))}
              </View>
            );
          })}
          {thin.map((d,i)=>(
            <Text key={i} style={{position:'absolute',left:toX(i)-18,top:PH-18,width:36,textAlign:'center',fontSize:8,color:G600}}>{fmtL(d.label)}</Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── CRIME CLOCK ─────────────────────────────────────────────────────────────
function CrimeClock({data}) {
  if(!data||data.length===0) return null;
  const maxV=Math.max(...data.map(d=>d.count),1);
  const peak=data.reduce((b,d)=>d.count>b.count?d:b,data[0]);
  return (
    <View style={s.card}>
      <View style={s.cardHdr}><Text style={s.cardTitle}>Crime Clock — Hourly Distribution</Text><Text style={s.cardSub}>Peak: {peak?.hour||'N/A'}</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{flexDirection:'row',alignItems:'flex-end',height:80,paddingHorizontal:14,paddingBottom:4,gap:2,width:Math.max(SW-64,24*20)}}>
          {data.map((d,i)=><View key={i} style={{flex:1,height:Math.max((d.count/maxV)*64,3),backgroundColor:d.count>0&&d.count===maxV?NAVY:d.count>0?NAVY_M:G200,borderRadius:2}}/>)}
        </View>
      </ScrollView>
      <View style={{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:14,paddingBottom:10}}>
        {['00:00','06:00','12:00','18:00','23:00'].map(l=><Text key={l} style={{fontSize:9,color:G400}}>{l}</Text>)}
      </View>
    </View>
  );
}

// ─── CRIME BY DAY ─────────────────────────────────────────────────────────────
function CrimeByDay({data}) {
  if(!data||data.length===0) return null;
  const maxV=Math.max(...data.map(d=>d.count),1);
  return (
    <View style={s.card}>
      <View style={s.cardHdr}><Text style={s.cardTitle}>Crime by Day of Week</Text></View>
      <View style={{padding:14}}>
        {data.map((r,i)=>(
          <View key={i} style={{flexDirection:'row',alignItems:'center',marginBottom:10}}>
            <Text style={{width:84,fontSize:11,color:NAVY_M,fontWeight:'600'}}>{r.day}</Text>
            <View style={{flex:1,height:22,backgroundColor:G100,borderRadius:4,overflow:'hidden'}}>
              {r.count>0&&<View style={{width:Math.max((r.count/maxV)*(SW-190),4),height:'100%',backgroundColor:NAVY_M,borderRadius:4}}/>}
            </View>
            <Text style={{width:30,fontSize:12,fontWeight:'700',color:NAVY,textAlign:'right',marginLeft:8}}>{r.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── MODUS OPERANDI ───────────────────────────────────────────────────────────
function ModusChart({data,crimeTypes}) {
  const [page,setPage]    =useState(0);
  const [detail,setDetail]=useState(null);
  const all =crimeTypes.length>0?data.filter(r=>crimeTypes.includes(r.crime)):data;
  const maxV=Math.max(...all.map(d=>d.count),1);
  const pg  =all.slice(page*PAGE,(page+1)*PAGE);
  return (
    <>
    <View style={s.card}>
      <View style={s.cardHdr}>
        <Text style={s.cardTitle}>Modus Operandi</Text>
        <Text style={s.cardSub}>{crimeTypes.length===0?'All crimes':crimeTypes.length===1?CDISPLAY[crimeTypes[0]]:`${crimeTypes.length} crimes`}</Text>
      </View>
      <View style={{padding:14}}>
        {pg.map((r,i)=>(
          <TouchableOpacity key={i} style={{flexDirection:'row',alignItems:'center',marginBottom:10}}
            onPress={()=>setDetail({name:r.modus,count:r.count,rank:page*PAGE+i+1,type:CDISPLAY[r.crime]||r.crime})}>
            <Text style={{width:106,fontSize:10,color:NAVY_M,fontWeight:'600'}} numberOfLines={1}>{r.modus}</Text>
            <View style={{flex:1,height:20,backgroundColor:G100,borderRadius:4,overflow:'hidden'}}>
              {r.count>0&&<View style={{width:Math.max((r.count/maxV)*(SW-224),4),height:'100%',backgroundColor:i%2===0?NAVY:NAVY_M,borderRadius:4}}/>}
            </View>
            <Text style={{width:26,fontSize:11,fontWeight:'700',color:NAVY,textAlign:'right',marginLeft:6}}>{r.count}</Text>
            <Ionicons name="chevron-forward" size={11} color={G400} style={{marginLeft:3}}/>
          </TouchableOpacity>
        ))}
      </View>
      <Pgn page={page} total={all.length} pageSize={PAGE} onPrev={()=>setPage(p=>p-1)} onNext={()=>setPage(p=>p+1)} onPage={i=>setPage(i)}/>
    </View>
    <DetailSheet visible={!!detail} data={detail} onClose={()=>setDetail(null)}/>
    </>
  );
}

// ─── PLACE TABLE ─────────────────────────────────────────────────────────────
function PlaceTable({data}) {
  const [page,setPage]    =useState(0);
  const [dir,setDir]      =useState('desc');
  const [detail,setDetail]=useState(null);
  const sorted=[...data].sort((a,b)=>dir==='desc'?b.count-a.count:a.count-b.count).map((d,i)=>({...d,rank:i+1}));
  const pg=sorted.slice(page*PAGE,(page+1)*PAGE);
  return (
    <>
    <View style={s.card}>
      <View style={s.cardHdr}>
        <Text style={s.cardTitle}>Place of Commission</Text>
        <TouchableOpacity onPress={()=>setDir(d=>d==='desc'?'asc':'desc')} style={{flexDirection:'row',alignItems:'center',gap:3}}>
          <Text style={{fontSize:10,color:G600,fontWeight:'600'}}>Count</Text>
          <Ionicons name={dir==='desc'?'arrow-down':'arrow-up'} size={10} color={G600}/>
        </TouchableOpacity>
      </View>
      <View style={s.tHead}>
        <Text style={[s.tH,{width:28}]}>#</Text>
        <Text style={[s.tH,{flex:1}]}>Location</Text>
        <Text style={[s.tH,{width:52,textAlign:'right'}]}>Count</Text>
        <Text style={[s.tH,{width:22}]}></Text>
      </View>
      {pg.map((r,i)=>(
        <TouchableOpacity key={i} style={[s.tRow,i%2===1&&s.tRowAlt]} onPress={()=>setDetail({name:r.place,count:r.count,rank:r.rank,type:'Location'})}>
          <Text style={[s.tD,{width:28,color:G400,fontWeight:'700',fontSize:10}]}>{r.rank}</Text>
          <Text style={[s.tD,{flex:1,color:NAVY_M,fontWeight:'600',fontSize:11}]} numberOfLines={2}>{r.place}</Text>
          <Text style={[s.tD,{width:52,textAlign:'right',fontWeight:'700',color:NAVY,fontSize:12}]}>{r.count}</Text>
          <View style={[s.tD,{width:22,alignItems:'center'}]}><Ionicons name="chevron-forward" size={11} color={G400}/></View>
        </TouchableOpacity>
      ))}
      <Pgn page={page} total={sorted.length} pageSize={PAGE} onPrev={()=>setPage(p=>p-1)} onNext={()=>setPage(p=>p+1)} onPage={i=>setPage(i)}/>
    </View>
    <DetailSheet visible={!!detail} data={detail} onClose={()=>setDetail(null)}/>
    </>
  );
}

// ─── BARANGAY TABLE ───────────────────────────────────────────────────────────
function BarangayTable({data}) {
  const [page,setPage]    =useState(0);
  const [col,setCol]      =useState('count');
  const [dir,setDir]      =useState('desc');
  const [detail,setDetail]=useState(null);
  const sorted=[...data].sort((a,b)=>{
    if(col==='barangay')return dir==='desc'?b.barangay.localeCompare(a.barangay):a.barangay.localeCompare(b.barangay);
    return dir==='desc'?b.count-a.count:a.count-b.count;
  }).map((d,i)=>({...d,rank:i+1}));
  const pg=sorted.slice(page*PAGE,(page+1)*PAGE);
  const sort=(c)=>{if(col===c)setDir(d=>d==='desc'?'asc':'desc');else{setCol(c);setDir('desc');setPage(0);}};
  const SBtn=({c,l,sty})=>(
    <TouchableOpacity style={[{flexDirection:'row',alignItems:'center',gap:2},sty]} onPress={()=>sort(c)}>
      <Text style={s.tHTxt}>{l}</Text>
      <Ionicons name={col===c?(dir==='desc'?'arrow-down':'arrow-up'):'swap-vertical'} size={9} color="rgba(255,255,255,0.7)"/>
    </TouchableOpacity>
  );
  return (
    <>
    <View style={s.card}>
      <View style={s.cardHdr}>
        <Text style={s.cardTitle}>Barangay Incidents</Text>
        <Text style={s.cardSub}>{data.length} barangay{data.length!==1?'s':''} with incidents</Text>
      </View>
      <View style={s.tHead}>
        <Text style={[s.tH,{width:28}]}>#</Text>
        <SBtn c="barangay" l="Barangay" sty={{flex:1,paddingHorizontal:10,paddingVertical:8}}/>
        <SBtn c="count" l="Count" sty={{width:58,paddingHorizontal:10,paddingVertical:8,justifyContent:'flex-end'}}/>
        <Text style={[s.tH,{width:22}]}></Text>
      </View>
      {pg.map((r,i)=>(
        <TouchableOpacity key={i} style={[s.tRow,i%2===1&&s.tRowAlt]} onPress={()=>setDetail({name:r.barangay,count:r.count,rank:r.rank,type:'Barangay'})}>
          <Text style={[s.tD,{width:28,color:G400,fontWeight:'700',fontSize:10}]}>{r.rank}</Text>
          <Text style={[s.tD,{flex:1,color:NAVY_M,fontWeight:'700',fontSize:11}]}>{r.barangay}</Text>
          <Text style={[s.tD,{width:58,textAlign:'right',fontWeight:'700',color:NAVY,fontSize:12}]}>{r.count}</Text>
          <View style={[s.tD,{width:22,alignItems:'center'}]}><Ionicons name="chevron-forward" size={11} color={G400}/></View>
        </TouchableOpacity>
      ))}
      <Pgn page={page} total={sorted.length} pageSize={PAGE} onPrev={()=>setPage(p=>p-1)} onNext={()=>setPage(p=>p+1)} onPage={i=>setPage(i)}/>
    </View>
    <DetailSheet visible={!!detail} data={detail} onClose={()=>setDetail(null)}/>
    </>
  );
}

// ─── MAIN SCREEN ──────────────────────────────────────────────────────────────
export default function DashboardScreen({navigation}) {
  const [applied,setApplied]   = useState(()=>BLANK());
  const [db,setDb]             = useState(()=>EMPTYDB());
  const [loading,setLoading]   = useState(true);
  const [refreshing,setRefresh]= useState(false);
  const [filterVis,setFilterV] = useState(false);
  const [error,setError]       = useState(null);
  const [user,setUser]         = useState(null);
  const fetchId = useRef(0);

  useEffect(()=>{ loadUser(); doFetch(BLANK()); },[]);

  const loadUser=async()=>{
    try{const u=await AsyncStorage.getItem('user');if(u)setUser(JSON.parse(u));}catch(_){}
  };

  // ── FETCH: separates loading vs refreshing state properly ──
  const doFetch=useCallback(async(filters,isRefresh=false)=>{
    const id=++fetchId.current;
    if(isRefresh){
      setRefresh(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try{
      const json=await getCrimeDashboard(filters);
      if(id!==fetchId.current) return;
      if(json.success){
        setDb({
          summary:  json.summary  ??[],
          trends:   json.trends   ??[],
          hourly:   json.hourly   ??[],
          byDay:    json.byDay    ??[],
          place:    json.place    ??[],
          barangay: json.barangay ??[],
          modus:    json.modus    ??[],
        });
      } else {
        setError(json.message||'Failed to load data');
      }
    }catch(e){
      if(id!==fetchId.current) return;
      setError(e.message||'Network error. Check connection.');
    }finally{
      if(id!==fetchId.current) return;
      setLoading(false);
      setRefresh(false);
    }
  },[]);

  // Apply: update filters + re-fetch with the NEW filters directly
  const handleApply=useCallback((f)=>{
    const newF={...f};
    setApplied(newF);
    // Use setTimeout(0) to ensure state update commits before fetch reads it
    setTimeout(()=>doFetch(newF,false),0);
  },[doFetch]);

  // Refresh: re-fetch SAME applied filters (NOT reset)
  // Refresh header button = RESET all filters + re-fetch defaults
  const handleRefresh=useCallback(()=>{
    const blank=BLANK();
    setApplied(blank);
    doFetch(blank,false);
  },[doFetch]);

  const activeCount=(applied.crimeTypes.length>0?1:0)+(applied.barangays.length>0?1:0)+(applied.preset!=='365d'?1:0);
  const userName  = user?.first_name||'Officer';
  const userPic   = user?.profile_picture||null;
  const userRole=user?.role||'';
  const presetLbl=PRESETS.find(p=>p.key===applied.preset)?.label||'Custom';
  const gran=getGranularity(applied.preset,applied.dateFrom,applied.dateTo);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY}/>

      {/* HEADER */}
      <View style={s.header}>
        <View style={{flex:1}}>
          <Text style={s.hTitle}>Crime Dashboard</Text>
          <Text style={s.hSub}>Index Crime Statistics · PNP Bacoor</Text>
          <View style={s.hDatePill}>
            <Ionicons name="calendar-outline" size={10} color="rgba(255,255,255,0.65)"/>
            <Text style={s.hDateTxt}>{fmtDate(applied.dateFrom)} — {fmtDate(applied.dateTo)}</Text>
          </View>
        </View>
        <View style={{gap:8,marginLeft:10}}>
          <TouchableOpacity
            style={[s.hBtn,activeCount>0&&{backgroundColor:RED,borderColor:'#8b1a1f'}]}
            onPress={()=>setFilterV(true)}>
            <Ionicons name="options-outline" size={18} color={WHITE}/>
            {activeCount>0&&(
              <View style={s.hBtnBadge}>
                <Text style={{fontSize:8,color:WHITE,fontWeight:'700'}}>{activeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* REFRESH — re-fetches current filters, shows spinner while loading */}
          <TouchableOpacity style={s.hBtn} onPress={handleRefresh} disabled={refreshing}>
            {refreshing
              ? <ActivityIndicator size="small" color={WHITE}/>
              : <Ionicons name="refresh-outline" size={18} color={WHITE}/>
            }
          </TouchableOpacity>
        </View>
      </View>

      {/* WELCOME STRIP */}
      <View style={s.welcome}>
        {userPic ? (
          <Image source={{uri:userPic}} style={s.welcomeAvImg}/>
        ) : (
          <View style={s.welcomeAv}>
            <Text style={s.welcomeAvTxt}>
              {userName.slice(0,2).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{flex:1}}>
          <Text style={s.welcomeGreet}>Welcome back,</Text>
          <Text style={s.welcomeName} numberOfLines={1}>{userName}</Text>
        </View>
        {!!userRole&&(
          <View style={s.roleBadge}>
            <Ionicons name="shield-checkmark-outline" size={11} color="#4ade80"/>
            <Text style={s.roleTxt}>{userRole}</Text>
          </View>
        )}
      </View>

      {/* FILTER BAR */}
      <TouchableOpacity style={s.fBar} onPress={()=>setFilterV(true)} activeOpacity={0.85}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6,flex:1,minWidth:0}}>
          <Ionicons name="options-outline" size={13} color={NAVY_M}/>
          <Text style={s.fBarTxt} numberOfLines={1}>Filters &amp; Options</Text>
          {activeCount>0&&<View style={s.fActivePill}><Text style={s.fActiveTxt}>active</Text></View>}
        </View>
        <View style={{flexDirection:'row',alignItems:'center',gap:4,flexShrink:0}}>
          <View style={s.fChip}><Text style={s.fChipTxt} numberOfLines={1}>{presetLbl}</Text></View>
          {applied.crimeTypes.length===0
            ?<View style={s.fChip}><Text style={s.fChipTxt}>All Crimes</Text></View>
            :<View style={[s.fChip,{backgroundColor:'#dbeafe'}]}><Text style={[s.fChipTxt,{color:BLUED}]}>{applied.crimeTypes.length} crime(s)</Text></View>
          }
          {applied.barangays.length>0&&(
            <View style={[s.fChip,{backgroundColor:'#dcfce7'}]}>
              <Text style={[s.fChipTxt,{color:GREEND}]}>{applied.barangays.length} brgy</Text>
            </View>
          )}
          <Ionicons name="chevron-down" size={12} color={G600}/>
        </View>
      </TouchableOpacity>

      {/* ACTIVE CHIP ROW */}
      {activeCount>0&&(
        <View style={{backgroundColor:WHITE,borderBottomWidth:1,borderBottomColor:G200}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal:14,paddingVertical:7,gap:5,flexDirection:'row',alignItems:'center'}}>
            {applied.preset!=='365d'&&(
              <View style={s.aC}><Ionicons name="calendar" size={9} color={NAVY_M}/><Text style={s.aCTxt}>{presetLbl}</Text></View>
            )}
            {applied.crimeTypes.map(c=>(
              <TouchableOpacity key={c} style={s.aC}
                onPress={()=>handleApply({...applied,crimeTypes:applied.crimeTypes.filter(x=>x!==c)})}>
                <Text style={s.aCTxt}>{CSHORT[c]}</Text>
                <Text style={[s.aCTxt,{opacity:0.5}]}>×</Text>
              </TouchableOpacity>
            ))}
            {applied.barangays.map(b=>(
              <TouchableOpacity key={b} style={[s.aC,{backgroundColor:'#dcfce7'}]}
                onPress={()=>handleApply({...applied,barangays:applied.barangays.filter(x=>x!==b)})}>
                <Text style={[s.aCTxt,{color:GREEND}]} numberOfLines={1}>{b}</Text>
                <Text style={[s.aCTxt,{color:GREEND,opacity:0.5}]}>×</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[s.aC,{backgroundColor:'#fee2e2'}]} onPress={()=>{const b=BLANK();setApplied(b);doFetch(b,false);}}>
              <Text style={[s.aCTxt,{color:RED}]}>Clear all</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* CONTENT */}
      {loading?(
        <View style={s.center}>
          <ActivityIndicator size="large" color={NAVY}/>
          <Text style={s.loadTxt}>Loading crime data...</Text>
        </View>
      ):error?(
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={52} color={RED}/>
          <Text style={s.errTxt}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={()=>doFetch(applied)}>
            <Text style={s.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ):(
        <ScrollView style={{flex:1,backgroundColor:G50}}
          contentContainerStyle={{padding:12,paddingBottom:90}}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>doFetch(applied,true)} colors={[NAVY]} tintColor={NAVY}/>}>

          {/* ── OVERVIEW: 2x2 cards + table, NO section header ── */}
          <SummaryCards data={db.summary}/>
          <View style={{height:10}}/>
          <IndexCrimeTable data={db.summary} sel={applied.crimeTypes}/>

          {/* ── CASE STATUS — collapsible ── */}
          <View style={{height:10}}/>
          <Section title="Case Status" sub="Cleared · Solved · Under Inv."
            iconName="pie-chart-outline" iconBg="#0f766e">
            <CaseStatus data={db.summary} sel={applied.crimeTypes}/>
          </Section>

          {/* ── CRIME TRENDS — collapsible ── */}
          <Section title="Crime Trends"
            sub={`${granLbl(gran)} · ${db.trends.length} points`}
            iconName="trending-up-outline" iconBg="#166534">
            <CrimeTrends filters={applied} data={db.trends}/>
            <View style={{height:8}}/>
            <CrimeClock data={db.hourly}/>
            <View style={{height:8}}/>
            <CrimeByDay data={db.byDay}/>
          </Section>

          {/* ── LOCATION ANALYSIS — collapsible ── */}
          <Section title="Location Analysis" sub="Modus · Place · Barangay"
            iconName="location-outline" iconBg="#92400e">
            <ModusChart data={db.modus} crimeTypes={applied.crimeTypes}/>
            <View style={{height:8}}/>
            <PlaceTable data={db.place}/>
            <View style={{height:8}}/>
            <BarangayTable data={db.barangay}/>
          </Section>

          <View style={{height:20}}/>
        </ScrollView>
      )}

      <FilterSheet visible={filterVis} applied={applied} onApply={handleApply} onClose={()=>setFilterV(false)}/>
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:    {flex:1,backgroundColor:NAVY},
  header:  {backgroundColor:NAVY,paddingHorizontal:16,paddingTop:14,paddingBottom:12,flexDirection:'row',alignItems:'flex-start'},
  hTitle:  {fontSize:20,fontWeight:'700',color:WHITE,marginBottom:2},
  hSub:    {fontSize:11,color:'rgba(255,255,255,0.6)',marginBottom:8},
  hDatePill:{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,0.1)',alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:4,borderRadius:14},
  hDateTxt:{fontSize:10,color:'rgba(255,255,255,0.85)',fontWeight:'600'},
  hBtn:    {width:36,height:36,backgroundColor:'rgba(255,255,255,0.12)',borderRadius:10,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.1)'},
  hBtnBadge:{position:'absolute',top:-5,right:-5,width:16,height:16,borderRadius:8,backgroundColor:NAVY,alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:WHITE},

  welcome:     {backgroundColor:'#0d1f3c',paddingHorizontal:16,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.08)'},
  welcomeAv:   {width:34,height:34,borderRadius:17,backgroundColor:RED,alignItems:'center',justifyContent:'center',flexShrink:0},
  welcomeAvImg:{width:34,height:34,borderRadius:17,flexShrink:0,borderWidth:2,borderColor:'rgba(255,255,255,0.3)'},
  welcomeAvTxt:{fontSize:12,fontWeight:'700',color:WHITE},
  welcomeGreet:{fontSize:10,color:'rgba(255,255,255,0.6)'},
  welcomeName: {fontSize:13,fontWeight:'700',color:WHITE},
  roleBadge:   {flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(21,128,61,0.2)',paddingHorizontal:8,paddingVertical:4,borderRadius:10,borderWidth:1,borderColor:'rgba(21,128,61,0.3)',flexShrink:0},
  roleTxt:     {fontSize:10,color:'#4ade80',fontWeight:'600'},

  fBar:       {backgroundColor:WHITE,borderBottomWidth:1,borderBottomColor:G200,paddingHorizontal:16,paddingVertical:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  fBarTxt:    {fontSize:12,fontWeight:'600',color:NAVY},
  fActivePill:{backgroundColor:RED,paddingHorizontal:6,paddingVertical:2,borderRadius:8},
  fActiveTxt: {fontSize:9,color:WHITE,fontWeight:'700'},
  fChip:      {backgroundColor:G100,paddingHorizontal:7,paddingVertical:3,borderRadius:7},
  fChipTxt:   {fontSize:10,fontWeight:'600',color:G700},
  aC:         {flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'#e8edf5',paddingHorizontal:8,paddingVertical:4,borderRadius:12},
  aCTxt:      {fontSize:10,fontWeight:'700',color:NAVY_M},

  center:    {flex:1,backgroundColor:G50,alignItems:'center',justifyContent:'center',gap:14,padding:32},
  loadTxt:   {fontSize:14,color:G600,fontWeight:'500',marginTop:4},
  errTxt:    {fontSize:13,color:G600,textAlign:'center',lineHeight:20},
  retryBtn:  {backgroundColor:NAVY,paddingHorizontal:28,paddingVertical:12,borderRadius:10,marginTop:4},
  retryTxt:  {color:WHITE,fontWeight:'700',fontSize:14},

  // ── STAT CARDS: exact 2x2 grid, no flex tricks ──
  // Use explicit width=CARD_W computed from screen width
  cardGrid:    {flexDirection:'row',flexWrap:'wrap',gap:10},
  statCard:    {borderRadius:10,padding:13,overflow:'hidden',position:'relative'},
  statCircle:  {position:'absolute',top:-14,right:-14,width:64,height:64,borderRadius:32,backgroundColor:'rgba(255,255,255,0.08)'},
  statTopRow:  {flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',marginBottom:9},
  statIconBox: {width:32,height:32,backgroundColor:'rgba(255,255,255,0.15)',borderRadius:8,alignItems:'center',justifyContent:'center'},
  statSubTxt:  {fontSize:9,color:'rgba(255,255,255,0.65)',textAlign:'right',maxWidth:86,lineHeight:13},
  statVal:     {fontSize:26,fontWeight:'700',color:WHITE,lineHeight:30,marginBottom:3},
  statLbl:     {fontSize:11,color:'rgba(255,255,255,0.85)',fontWeight:'600'},

  // Section
  sec:      {backgroundColor:WHITE,borderRadius:12,marginTop:10,borderWidth:1,borderColor:G200,overflow:'hidden'},
  secHdr:   {flexDirection:'row',alignItems:'center',padding:14,gap:10},
  secIcon:  {width:32,height:32,borderRadius:8,alignItems:'center',justifyContent:'center',flexShrink:0},
  secTitle: {fontSize:13,fontWeight:'700',color:NAVY},
  secSub:   {fontSize:10,color:G600,marginTop:1},
  secBody:  {padding:12,paddingTop:4,borderTopWidth:1,borderTopColor:G100,backgroundColor:G50},

  // Cards
  card:     {backgroundColor:WHITE,borderRadius:8,borderWidth:1,borderColor:G200,overflow:'hidden',marginBottom:4},
  cardHdr:  {flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:14,borderBottomWidth:1,borderBottomColor:G100,flexWrap:'wrap',gap:4},
  cardTitle:{fontSize:13,fontWeight:'700',color:G900},
  cardSub:  {fontSize:10,color:G600,marginTop:2},

  // Table
  tHead:   {flexDirection:'row',backgroundColor:NAVY,alignItems:'center'},
  tH:      {paddingHorizontal:10,paddingVertical:8,fontSize:10,fontWeight:'600',color:WHITE},
  tHBtn:   {flexDirection:'row',alignItems:'center',paddingHorizontal:10,paddingVertical:8,gap:2},
  tHTxt:   {fontSize:10,fontWeight:'600',color:WHITE},
  tRow:    {flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:G100},
  tRowAlt: {backgroundColor:G50},
  tD:      {paddingHorizontal:10,paddingVertical:8,fontSize:12,color:G700},
  tFoot:   {flexDirection:'row',alignItems:'center',backgroundColor:G50,borderTopWidth:2,borderTopColor:G200},
  swipe:   {textAlign:'center',fontSize:9,color:G400,paddingVertical:5,backgroundColor:G50,borderTopWidth:1,borderTopColor:G100},

  bdg:     {paddingHorizontal:6,paddingVertical:2,borderRadius:10},
  bdgTxt:  {fontSize:10,fontWeight:'700'},

  modeRow:     {flexDirection:'row',backgroundColor:G100,borderRadius:6,margin:12,marginBottom:6,padding:3,gap:2},
  modeBtn:     {flex:1,paddingVertical:6,alignItems:'center',borderRadius:5},
  modeBtnOn:   {backgroundColor:WHITE},
  modeTxt:     {fontSize:12,fontWeight:'600',color:G600},
  modeTxtOn:   {color:NAVY,fontWeight:'700'},
  showAllBtn:  {height:26,paddingHorizontal:10,borderRadius:13,borderWidth:1,borderColor:G200,backgroundColor:WHITE,alignItems:'center',justifyContent:'center'},
  showAllTxt:  {fontSize:10,fontWeight:'700',color:G600},
  cpill:       {flexDirection:'row',alignItems:'center',gap:4,height:26,paddingHorizontal:9,borderRadius:13,borderWidth:1,borderColor:G200,backgroundColor:WHITE},
  cpillOff:    {opacity:0.4},
  cpillDot:    {width:7,height:7,borderRadius:4},
  cpillTxt:    {fontSize:11,fontWeight:'500',color:G900},

  pgRow:   {flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:10,borderTopWidth:1,borderTopColor:G100,backgroundColor:G50},
  pgInfo:  {fontSize:10,color:G600,fontWeight:'600'},
  pgBtns:  {flexDirection:'row',gap:3},
  pgBtn:   {width:26,height:26,borderWidth:1,borderColor:G200,borderRadius:5,backgroundColor:WHITE,alignItems:'center',justifyContent:'center'},
  pgAct:   {backgroundColor:NAVY_M,borderColor:NAVY_M},
  pgDis:   {opacity:0.35},
  pgTxt:   {fontSize:10,fontWeight:'700',color:NAVY},

  // Detail sheet
  sheetBg:    {flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'},
  detailSh:   {backgroundColor:WHITE,borderTopLeftRadius:20,borderTopRightRadius:20,padding:20,paddingBottom:36},
  handle:     {width:40,height:4,backgroundColor:G200,borderRadius:2,alignSelf:'center',marginBottom:16},
  rankCircle: {width:36,height:36,borderRadius:18,backgroundColor:NAVY,alignItems:'center',justifyContent:'center',flexShrink:0},
  rankTxt:    {fontSize:12,fontWeight:'700',color:WHITE},
  detailName: {flex:1,fontSize:16,fontWeight:'700',color:NAVY,lineHeight:22},
  detailRow:  {flexDirection:'row',gap:12,marginBottom:20},
  detailStat: {flex:1,backgroundColor:G50,borderRadius:10,padding:14,alignItems:'center',borderWidth:1,borderColor:G200},
  detailVal:  {fontSize:22,fontWeight:'700',color:NAVY,marginBottom:4},
  detailLbl:  {fontSize:11,color:G600,fontWeight:'600',textAlign:'center'},
  detailClose:{backgroundColor:NAVY,borderRadius:10,padding:14,alignItems:'center'},
  detailCloseTxt:{color:WHITE,fontWeight:'700',fontSize:15},

  // Multi-select
  msOv:     {flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'},
  msSh:     {backgroundColor:WHITE,borderTopLeftRadius:20,borderTopRightRadius:20,height:'75%',paddingBottom:Platform.OS==='ios'?34:24},
  msTop:    {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:12,borderBottomWidth:1,borderBottomColor:G100},
  msTitle:  {fontSize:15,fontWeight:'700',color:NAVY},
  msSearch: {flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:16,marginTop:10,marginBottom:4,backgroundColor:G50,borderRadius:10,borderWidth:1,borderColor:G200,paddingHorizontal:12,height:40},
  msSearchTxt:{flex:1,fontSize:13,color:G900,padding:0},
  msActions:{flexDirection:'row',paddingHorizontal:16,paddingVertical:8,borderBottomWidth:1,borderBottomColor:G100},
  msActTxt: {fontSize:12,fontWeight:'700',color:NAVY_M},
  msList:   {flex:1,minHeight:200},
  msItem:   {flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:10,borderBottomWidth:1,borderBottomColor:G100},
  msChk:    {width:20,height:20,borderRadius:5,borderWidth:2,borderColor:G400,alignItems:'center',justifyContent:'center',flexShrink:0},
  msChkOn:  {backgroundColor:NAVY_M,borderColor:NAVY_M},
  msItemTxt:{flex:1,fontSize:13,color:G700,fontWeight:'500'},
  msGroup:  {flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:8,gap:8},
  msGroupLine:{flex:1,height:1,backgroundColor:G200},
  msGroupTxt:{fontSize:10,color:G400,fontWeight:'600'},
  msFoot:   {flexDirection:'row',gap:10,paddingHorizontal:16,paddingTop:12,borderTopWidth:1,borderTopColor:G100},
  msCancel: {flex:1,height:44,borderWidth:1.5,borderColor:G200,borderRadius:10,alignItems:'center',justifyContent:'center'},
  msCancelTxt:{fontSize:14,fontWeight:'600',color:G700},
  msApply:  {flex:2,height:44,backgroundColor:NAVY,borderRadius:10,alignItems:'center',justifyContent:'center'},
  msApplyTxt:{fontSize:14,fontWeight:'700',color:WHITE},

  // Filter sheet — height:'88%' fixes Android not showing content
  fsOv:    {flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'},
  fsSh:    {backgroundColor:WHITE,borderTopLeftRadius:20,borderTopRightRadius:20,height:'88%',paddingBottom:Platform.OS==='ios'?34:0},
  fsTop:   {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:14,borderBottomWidth:1,borderBottomColor:G100},
  fsTitle: {fontSize:15,fontWeight:'700',color:NAVY},
  fsDirty: {backgroundColor:RED,paddingHorizontal:7,paddingVertical:2,borderRadius:8,marginLeft:6},
  fsDirtyTxt:{fontSize:9,color:WHITE,fontWeight:'700'},
  fsLbl:   {fontSize:11,fontWeight:'700',textTransform:'uppercase',letterSpacing:0.6,color:G600,marginHorizontal:20,marginTop:16,marginBottom:10},
  fsFoot:  {flexDirection:'row',gap:10,paddingHorizontal:20,paddingTop:14,borderTopWidth:1,borderTopColor:G100},
  resetBtn:{width:48,height:48,borderWidth:1,borderColor:G200,borderRadius:10,alignItems:'center',justifyContent:'center',backgroundColor:G50},
  applyBtn:{flex:1,height:48,backgroundColor:RED,borderRadius:10,alignItems:'center',justifyContent:'center'},
  applyTxt:{fontSize:15,fontWeight:'700',color:WHITE},

  presetChip:  {paddingHorizontal:14,paddingVertical:8,borderRadius:20,borderWidth:1.5,borderColor:G200,backgroundColor:WHITE},
  presetChipOn:{backgroundColor:NAVY,borderColor:NAVY},
  presetTxt:   {fontSize:12,fontWeight:'600',color:G700},
  presetTxtOn: {color:WHITE},
  rangeDisp:   {flexDirection:'row',alignItems:'center',gap:6,marginHorizontal:20,marginTop:10,backgroundColor:'rgba(30,58,95,0.07)',paddingHorizontal:12,paddingVertical:8,borderRadius:8},
  rangeDispTxt:{fontSize:12,fontWeight:'600',color:NAVY_M},
  dateErrBox:  {flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#fef2f2',borderWidth:1,borderColor:'#fecaca',borderRadius:6,padding:8,marginTop:8},
  dateErrTxt:  {fontSize:12,color:'#dc2626',flex:1},
  dropBtn:     {flexDirection:'row',alignItems:'center',minHeight:46,borderWidth:1.5,borderColor:G200,borderRadius:8,backgroundColor:G50,paddingHorizontal:12,paddingVertical:8,gap:6},
  dropInner:   {flex:1,flexDirection:'row',flexWrap:'wrap',gap:4,alignItems:'center'},
  dropPh:      {fontSize:13,color:G600},
  pill:        {flexDirection:'row',alignItems:'center',gap:3,backgroundColor:NAVY_M,paddingHorizontal:8,paddingVertical:3,borderRadius:12},
  pillTxt:     {fontSize:11,color:WHITE,fontWeight:'600',maxWidth:80},
  pillX:       {fontSize:14,color:'rgba(255,255,255,0.7)',lineHeight:16},
});

// ─── DATE PICKER STYLES ───────────────────────────────────────────────────────
const dp = StyleSheet.create({
  lbl:     {fontSize:11,fontWeight:'700',color:G600,textTransform:'uppercase',letterSpacing:0.4,marginBottom:6},
  btn:     {flexDirection:'row',alignItems:'center',justifyContent:'space-between',height:42,borderWidth:1.5,borderColor:G200,borderRadius:8,backgroundColor:G50,paddingHorizontal:10},
  btnTxt:  {fontSize:13,color:G900,flex:1},
  iosOv:   {flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'flex-end'},
  iosSh:   {backgroundColor:WHITE,borderTopLeftRadius:16,borderTopRightRadius:16,paddingBottom:34},
  iosHdr:  {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingVertical:14,borderBottomWidth:1,borderBottomColor:G100},
  iosCan:  {fontSize:15,color:G600,fontWeight:'600'},
  iosTit:  {fontSize:15,fontWeight:'700',color:NAVY},
  iosDone: {fontSize:15,color:NAVY_M,fontWeight:'700'},
});