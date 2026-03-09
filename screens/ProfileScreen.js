// ================================================================================
// ProfileScreen.js  — BANTAY Mobile  (REDESIGNED)
// ================================================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, ActivityIndicator, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Modal, TextInput, Image, KeyboardAvoidingView,
  Dimensions,
} from 'react-native';

const BASE_URL      = 'http://localhost:5000';
const PSGC_API      = 'https://psgc.gitlab.io/api';
const POLL_INTERVAL = 15000;
const { width: SW } = Dimensions.get('window');

// ── Design Tokens ─────────────────────────────────────────────────────────────
const COLORS = {
  navy:       '#0B2D6B',
  navyDark:   '#071D47',
  navyLight:  '#EEF3FF',
  red:        '#C1272D',
  redLight:   '#FDE8E8',
  green:      '#059669',
  greenLight: '#D1FAE5',
  amber:      '#D97706',
  amberLight: '#FFF3CD',
  danger:     '#EF4444',
  dangerLight:'#FFF5F5',
  gray50:     '#F8FAFC',
  gray100:    '#F1F5F9',
  gray200:    '#E2E8F0',
  gray300:    '#CBD5E1',
  gray400:    '#94A3B8',
  gray500:    '#64748B',
  gray600:    '#475569',
  gray700:    '#334155',
  gray900:    '#0F172A',
  white:      '#FFFFFF',
};

const V = {
  name:      (v,f,max=50,req=true)=>{ if(!v||!v.trim()) return req?`${f} is required`:null; if(v.length>max) return `${f} must not exceed ${max} characters`; if(!/^[a-zA-Z\s'\-.]+$/.test(v.trim())) return `${f} can only contain letters, spaces, hyphens, apostrophes`; return null; },
  suffix:    (v)=>{ if(!v||!v.trim()) return null; const t=v.trim().toLowerCase(); if(t.length>5) return 'Suffix must not exceed 5 characters'; if(t==='sr.'||t==='jr.'||/^[ivxlcdm]+$/.test(t)) return null; return 'Suffix must be Sr., Jr., or Roman Numeral (e.g., III)'; },
  phone:     (v,f)=>{ const c=v.replace(/\D/g,''); if(!c.length) return null; if(c.length!==10) return `${f} must be exactly 10 digits`; if(!c.startsWith('9')) return `${f} must start with 9`; return null; },
  email:     (v)=>{ if(!v||!v.trim()) return 'Email is required'; if(v.length>255) return 'Email must not exceed 255 characters'; if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Invalid email format'; return null; },
  maskPhone: (p)=>{ if(!p) return ''; const d=p.replace(/\D/g,'').replace(/^63/,''); return d.length<3?'*'.repeat(d.length):'*'.repeat(d.length-3)+d.slice(-3); },
  maskEmail: (e)=>{ if(!e) return ''; const at=e.indexOf('@'); if(at<0) return e; const local=e.slice(0,at),domain=e.slice(at); if(local.length<=1) return local+domain; if(local.length<=4) return local[0]+'*'.repeat(local.length-1)+domain; return local[0]+'*'.repeat(local.length-4)+local.slice(-3)+domain; },
  formatDisplayName: (first, middle, last, suffix) => {
    const parts = [first];
    if (middle && middle.trim()) parts.push(middle.trim()[0].toUpperCase() + '.');
    if (last) parts.push(last);
    if (suffix) parts.push(suffix);
    return parts.filter(Boolean).join(' ');
  },
};

// ── Loading Overlay ────────────────────────────────────────────────────────────
function LoadingOverlay({ visible, message='Please wait…' }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={lo.overlay}>
        <View style={lo.box}>
          <ActivityIndicator size="large" color={COLORS.navy}/>
          <Text style={lo.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}
const lo = StyleSheet.create({
  overlay: { flex:1, backgroundColor:'rgba(7,29,71,0.6)', justifyContent:'center', alignItems:'center' },
  box:     { backgroundColor:COLORS.white, borderRadius:24, paddingVertical:32, paddingHorizontal:40, alignItems:'center', gap:16, shadowColor:'#000', shadowOffset:{width:0,height:16}, shadowOpacity:0.2, shadowRadius:24, elevation:16 },
  text:    { fontSize:14, fontWeight:'600', color:COLORS.gray900, textAlign:'center', maxWidth:200 },
});

// ── Confirm Modal ──────────────────────────────────────────────────────────────
function ConfirmModal({ visible, title, message, onConfirm, onCancel, confirmText='Confirm', confirmColor=COLORS.navy }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={cf.overlay}>
        <View style={cf.box}>
          <Text style={cf.title}>{title}</Text>
          <Text style={cf.msg}>{message}</Text>
          <View style={cf.row}>
            <TouchableOpacity style={cf.cancel} onPress={onCancel}>
              <Text style={cf.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cf.confirm,{backgroundColor:confirmColor}]} onPress={onConfirm}>
              <Text style={cf.confirmTxt}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const cf = StyleSheet.create({
  overlay:    { flex:1, backgroundColor:'rgba(7,29,71,0.6)', justifyContent:'center', alignItems:'center', padding:24 },
  box:        { backgroundColor:COLORS.white, borderRadius:24, padding:28, width:'100%', maxWidth:340, shadowColor:'#000', shadowOffset:{width:0,height:12}, shadowOpacity:0.2, shadowRadius:24, elevation:16 },
  title:      { fontSize:18, fontWeight:'800', color:COLORS.gray900, marginBottom:10, textAlign:'center', letterSpacing:-0.3 },
  msg:        { fontSize:14, color:COLORS.gray500, marginBottom:26, textAlign:'center', lineHeight:22 },
  row:        { flexDirection:'row', gap:10 },
  cancel:     { flex:1, paddingVertical:14, borderRadius:14, borderWidth:1.5, borderColor:COLORS.gray200, alignItems:'center', backgroundColor:COLORS.gray50 },
  cancelTxt:  { fontSize:14, fontWeight:'700', color:COLORS.gray500 },
  confirm:    { flex:1, paddingVertical:14, borderRadius:14, alignItems:'center' },
  confirmTxt: { fontSize:14, fontWeight:'800', color:COLORS.white },
});

// ── OTP Boxes ─────────────────────────────────────────────────────────────────
function OtpBoxes({ values, onChange, disabled }) {
  const refs = Array.from({ length: 6 }, () => useRef(null));
  const handleChange = (val, idx) => {
    const digit = val.replace(/\D/g,'').slice(-1);
    onChange(idx, digit);
    if (digit && idx < 5) refs[idx+1].current?.focus();
  };
  const handleKey = (e, idx) => {
    if (e.nativeEvent.key==='Backspace' && !values[idx] && idx>0) {
      refs[idx-1].current?.focus(); onChange(idx-1,'');
    }
  };
  return (
    <View style={ob.row}>
      {values.map((v,i) => (
        <TextInput key={i} ref={refs[i]}
          style={[ob.box, disabled&&ob.off, v&&ob.filled]}
          value={v} maxLength={1} keyboardType="number-pad"
          onChangeText={val=>handleChange(val,i)}
          onKeyPress={e=>handleKey(e,i)}
          editable={!disabled} selectTextOnFocus/>
      ))}
    </View>
  );
}
const ob = StyleSheet.create({
  row:    { flexDirection:'row', gap:9, justifyContent:'center', marginVertical:20 },
  box:    { width:46, height:56, borderWidth:2, borderColor:COLORS.gray200, borderRadius:14, textAlign:'center', fontSize:22, fontWeight:'800', color:COLORS.navy, backgroundColor:COLORS.gray50 },
  filled: { borderColor:COLORS.navy, backgroundColor:COLORS.white, shadowColor:COLORS.navy, shadowOffset:{width:0,height:4}, shadowOpacity:0.15, shadowRadius:8, elevation:4 },
  off:    { backgroundColor:COLORS.gray100, borderColor:COLORS.gray200, color:COLORS.gray300 },
});

// ── Progress Dots ──────────────────────────────────────────────────────────────
function ProgressDots({ current, total }) {
  return (
    <View style={{flexDirection:'row', gap:5}}>
      {Array.from({length:total}).map((_,i) => (
        <View key={i} style={[pd.dot, i<current && pd.done]}/>
      ))}
    </View>
  );
}
const pd = StyleSheet.create({
  dot:  { flex:1, height:3, borderRadius:2, backgroundColor:COLORS.gray200 },
  done: { backgroundColor:COLORS.navy },
});

// ═══════════════════════════════════════════════════════════════════════════════
export default function ProfileScreen({ navigation }) {

  const [profileData, setProfileData]           = useState(null);
  const [formData, setFormData]                 = useState({ first_name:'', last_name:'', middle_name:'', suffix:'', email:'', phone:'', alternate_phone:'', date_of_birth:'', gender:'Male', region_code:'', province_code:'', municipality_code:'', barangay_code:'', address_line:'' });
  const [originalFormData, setOriginalFormData] = useState({});
  const [loading, setLoading]                   = useState(true);
  const [isSaving, setIsSaving]                 = useState(false);
  const [uploadingPhoto, setUploadingPhoto]     = useState(false);
  const [refreshing, setRefreshing]             = useState(false);
  const [isEditing, setIsEditing]               = useState(false);
  const [errors, setErrors]                     = useState({});
  const [successMsg, setSuccessMsg]             = useState('');
  const [errorMsg, setErrorMsg]                 = useState('');
  const [showPhotoModal, setShowPhotoModal]     = useState(false);
  const [showDropdown, setShowDropdown]         = useState(null);
  const [showUsername, setShowUsername]         = useState(false);
  const [confirm, setConfirm]                   = useState({ visible:false, title:'', message:'', onConfirm:null, confirmText:'Confirm', confirmColor:COLORS.navy });
  const showConfirm = (title,message,onConfirm,confirmText='Confirm',confirmColor=COLORS.navy) =>
    setConfirm({visible:true,title,message,onConfirm,confirmText,confirmColor});
  const hideConfirm = () => setConfirm(p=>({...p,visible:false}));

  const [regions, setRegions]               = useState([]);
  const [provinces, setProvinces]           = useState([]);
  const [municipalities, setMunicipalities] = useState([]);
  const [barangays, setBarangays]           = useState([]);
  const [psgcLoading, setPsgcLoading]       = useState({});
  const [resolvedAddr, setResolvedAddr]     = useState({ region:'', province:'', municipality:'', barangay:'' });
  const [phoneChanged, setPhoneChanged]       = useState(false);
  const [altPhoneChanged, setAltPhoneChanged] = useState(false);

  const pollTimer    = useRef(null);
  const appStateRef  = useRef(AppState.currentState);
  const lastEtag     = useRef(null);
  const isEditingRef = useRef(false);
  useEffect(()=>{ isEditingRef.current=isEditing; },[isEditing]);
  useEffect(()=>{ if(successMsg){const t=setTimeout(()=>setSuccessMsg(''),5000);return()=>clearTimeout(t);} },[successMsg]);
  useEffect(()=>{ if(errorMsg){const t=setTimeout(()=>setErrorMsg(''),5000);return()=>clearTimeout(t);} },[errorMsg]);

  // EMAIL MODAL STATE — all preserved exactly
  const [emailModalVisible,    setEmailModalVisible]    = useState(false);
  const [emailStep,            setEmailStep]            = useState('checking');
  const [emailPassword,        setEmailPassword]        = useState('');
  const [emailPasswordShow,    setEmailPasswordShow]    = useState(false);
  const [emailPasswordErr,     setEmailPasswordErr]     = useState('');
  const [emailPasswordLoading, setEmailPasswordLoading] = useState(false);
  const [emailCooldownHours,   setEmailCooldownHours]   = useState(0);
  const [emailLockedMins,      setEmailLockedMins]      = useState(0);
  const [emailSessionMins,     setEmailSessionMins]     = useState(0);
  const [emailOldMasked,       setEmailOldMasked]       = useState('');
  const [emailNewAddress,      setEmailNewAddress]      = useState('');
  const [emailNewErr,          setEmailNewErr]          = useState('');
  const [emailModalLoading,    setEmailModalLoading]    = useState(false);
  const [emailModalErr,        setEmailModalErr]        = useState('');
  const [oldOtpValues,         setOldOtpValues]         = useState(['','','','','','']);
  const [oldOtpError,          setOldOtpError]          = useState('');
  const [oldOtpTimer,          setOldOtpTimer]          = useState(0);
  const [oldResendsLeft,       setOldResendsLeft]       = useState(3);
  const [oldOtpState,          setOldOtpState]          = useState('active');
  const oldOtpTimerRef    = useRef(null);
  const isResendingOldRef = useRef(false);
  const [newOtpValues,         setNewOtpValues]         = useState(['','','','','','']);
  const [newOtpError,          setNewOtpError]          = useState('');
  const [newOtpTimer,          setNewOtpTimer]          = useState(0);
  const [newResendsLeft,       setNewResendsLeft]       = useState(3);
  const [newOtpMasked,         setNewOtpMasked]         = useState('');
  const [newOtpState,          setNewOtpState]          = useState('active');
  const newOtpTimerRef    = useRef(null);
  const isResendingNewRef = useRef(false);

  const canResendOld = oldResendsLeft>0 && (oldOtpTimer===0 || oldOtpState==='attempts-exceeded');
  const canResendNew = newResendsLeft>0 && (newOtpTimer===0 || newOtpState==='attempts-exceeded');
  const EMAIL_STEPS  = ['password','old-send','old-otp','new-email','new-otp','done'];
  const emailStepIdx = EMAIL_STEPS.indexOf(emailStep)+1;

  const startTimer=(expiresAt,setTimer,setOtpState,timerRef)=>{
    clearInterval(timerRef.current); setOtpState('active');
    const tick=()=>{ const secs=Math.max(0,Math.ceil((expiresAt-Date.now())/1000)); setTimer(secs); if(secs<=0){clearInterval(timerRef.current);setOtpState(prev=>prev==='attempts-exceeded'?'attempts-exceeded':'expired');} };
    tick(); timerRef.current=setInterval(tick,1000);
  };
  const formatTimer=secs=>`${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;

  useEffect(()=>{
    loadProfile(true); startPolling();
    const sub=AppState.addEventListener('change',nextState=>{
      if(appStateRef.current.match(/inactive|background/)&&nextState==='active') silentRefresh();
      appStateRef.current=nextState;
    });
    return()=>{ stopPolling(); sub.remove(); clearInterval(oldOtpTimerRef.current); clearInterval(newOtpTimerRef.current); };
  },[]);

  const startPolling=()=>{ stopPolling(); pollTimer.current=setInterval(()=>{if(!isEditingRef.current)silentRefresh();},POLL_INTERVAL); };
  const stopPolling =()=>{ if(pollTimer.current){clearInterval(pollTimer.current);pollTimer.current=null;} };

  const silentRefresh=async()=>{
    try{
      const token=await AsyncStorage.getItem('token'); if(!token) return;
      setRefreshing(true);
      const res=await fetch(`${BASE_URL}/users/profile`,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
      if(res.status===401){stopPolling();await AsyncStorage.clear();navigation.reset({index:0,routes:[{name:'Login'}]});return;}
      if(!res.ok) return;
      const json=await res.json(); if(!json.success||!json.user) return;
      const newStr=JSON.stringify(json.user); if(newStr===lastEtag.current) return;
      lastEtag.current=newStr; await AsyncStorage.setItem('user',JSON.stringify(json.user));
      applyToState(json.user); await resolveAddressNames(json.user);
    }catch(_){}finally{setRefreshing(false);}
  };

  const loadProfile=async(showSpinner=false)=>{
    try{
      if(showSpinner) setLoading(true);
      const token=await AsyncStorage.getItem('token'); if(!token){setLoading(false);return;}
      const res=await fetch(`${BASE_URL}/users/profile`,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
      if(res.status===401){await AsyncStorage.clear();navigation.reset({index:0,routes:[{name:'Login'}]});return;}
      const json=await res.json();
      if(res.ok&&json.success&&json.user){
        lastEtag.current=JSON.stringify(json.user); await AsyncStorage.setItem('user',JSON.stringify(json.user));
        applyToState(json.user); await resolveAddressNames(json.user);
      }else{
        const cached=await AsyncStorage.getItem('user');
        if(cached){const u=JSON.parse(cached);applyToState(u);await resolveAddressNames(u);}
        setErrorMsg(json.message||'Could not load profile');
      }
    }catch{
      try{const cached=await AsyncStorage.getItem('user');if(cached){const u=JSON.parse(cached);applyToState(u);await resolveAddressNames(u);}}catch{}
      setErrorMsg('Network error - showing cached data');
    }finally{setLoading(false);}
  };

  const applyToState=u=>{
    const phone=u.phone?u.phone.replace(/^\+63/,''):'';
    const altPhone=u.alternate_phone?u.alternate_phone.replace(/^\+63/,''):'';
    const fv={first_name:u.first_name||'',last_name:u.last_name||'',middle_name:u.middle_name||'',suffix:u.suffix||'',date_of_birth:u.date_of_birth?u.date_of_birth.split('T')[0]:'',gender:u.gender||'Male',phone,alternate_phone:altPhone,email:u.email||'',region_code:u.region_code||'',province_code:u.province_code||'',municipality_code:u.municipality_code||'',barangay_code:u.barangay_code||'',address_line:u.address_line||''};
    setProfileData(u); setFormData(fv); setOriginalFormData(fv);
  };

  const loadRegions        = useCallback(async()=>{ setPsgcLoading(p=>({...p,regions:true}));let arr=[];try{const d=await(await fetch(`${PSGC_API}/regions/`)).json();arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[];setRegions(arr);}catch{}setPsgcLoading(p=>({...p,regions:false}));return arr;},[]);
  const loadProvinces      = useCallback(async rc=>{if(!rc){setProvinces([]);setMunicipalities([]);setBarangays([]);return[];}setPsgcLoading(p=>({...p,provinces:true}));let arr=[];try{const d=await(await fetch(`${PSGC_API}/regions/${rc}/provinces/`)).json();arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[];setProvinces(arr);}catch{}setMunicipalities([]);setBarangays([]);setPsgcLoading(p=>({...p,provinces:false}));return arr;},[]);
  const loadMunicipalities = useCallback(async pc=>{if(!pc){setMunicipalities([]);setBarangays([]);return[];}setPsgcLoading(p=>({...p,municipalities:true}));let arr=[];try{const d=await(await fetch(`${PSGC_API}/provinces/${pc}/cities-municipalities/`)).json();arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[];setMunicipalities(arr);}catch{}setBarangays([]);setPsgcLoading(p=>({...p,municipalities:false}));return arr;},[]);
  const loadBarangays      = useCallback(async mc=>{if(!mc){setBarangays([]);return[];}setPsgcLoading(p=>({...p,barangays:true}));let arr=[];try{const d=await(await fetch(`${PSGC_API}/cities-municipalities/${mc}/barangays/`)).json();arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[];setBarangays(arr);}catch{}setPsgcLoading(p=>({...p,barangays:false}));return arr;},[]);

  const resolveAddressNames=async u=>{
    if(u.region&&u.province){setResolvedAddr({region:u.region||'',province:u.province||'',municipality:u.municipality||u.city||'',barangay:u.barangay||''});return;}
    if(!u.region_code) return;
    try{
      const[rArr,pArr,mArr,bArr]=await Promise.all([
        fetch(`${PSGC_API}/regions/`).then(r=>r.json()).catch(()=>[]),
        u.region_code?fetch(`${PSGC_API}/regions/${u.region_code}/provinces/`).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
        u.province_code?fetch(`${PSGC_API}/provinces/${u.province_code}/cities-municipalities/`).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
        u.municipality_code?fetch(`${PSGC_API}/cities-municipalities/${u.municipality_code}/barangays/`).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
      ]);
      setResolvedAddr({
        region:      (Array.isArray(rArr)?rArr.find(x=>x.code===u.region_code)?.name:'')||'',
        province:    (Array.isArray(pArr)?pArr.find(x=>x.code===u.province_code)?.name:'')||'',
        municipality:(Array.isArray(mArr)?mArr.find(x=>x.code===u.municipality_code)?.name:'')||'',
        barangay:    (Array.isArray(bArr)?bArr.find(x=>x.code===u.barangay_code)?.name:'')||'',
      });
    }catch(e){console.error('resolveAddressNames:',e);}
  };

  const resolveFromArrays=async(rc,pc,mc,bc)=>{
    let bArr=barangays; if(!bArr.find(x=>x.code===bc)&&mc) bArr=await loadBarangays(mc);
    setResolvedAddr({region:regions.find(x=>x.code===rc)?.name||'',province:provinces.find(x=>x.code===pc)?.name||'',municipality:municipalities.find(x=>x.code===mc)?.name||'',barangay:bArr.find(x=>x.code===bc)?.name||''});
  };

  const validate=()=>{
    const e={};
    const fn=V.name(formData.first_name,'First name');if(fn)e.first_name=fn;
    const ln=V.name(formData.last_name,'Last name');if(ln)e.last_name=ln;
    if(formData.middle_name){const mn=V.name(formData.middle_name,'Middle name',50,false);if(mn)e.middle_name=mn;}
    const sf=V.suffix(formData.suffix);if(sf)e.suffix=sf;
    if(phoneChanged&&formData.phone){const pe=V.phone(formData.phone,'Phone');if(pe)e.phone=pe;}
    if(altPhoneChanged&&formData.alternate_phone){const ape=V.phone(formData.alternate_phone,'Alternate phone');if(ape)e.alternate_phone=ape;}
    const ep=phoneChanged?formData.phone:originalFormData.phone;
    const eap=altPhoneChanged?formData.alternate_phone:originalFormData.alternate_phone;
    if(ep&&eap&&ep.replace(/\D/g,'')=== eap.replace(/\D/g,''))e.alternate_phone='Alternate phone cannot be same as primary';
    if((formData.address_line||'').length>255)e.address_line='Max 255 characters';
    if(!formData.region_code)e.region_code='Region is required';
    if(!formData.province_code)e.province_code='Province is required';
    if(!formData.municipality_code)e.municipality_code='City / Municipality is required';
    if(!formData.barangay_code)e.barangay_code='Barangay is required';
    setErrors(e);return Object.keys(e).length===0;
  };

  const onChange=(name,value)=>{
    if(['first_name','last_name','middle_name'].includes(name))value=value.replace(/[^a-zA-Z\s'\-.]/g,'').slice(0,50);
    else if(name==='suffix')value=value.replace(/[^ivxlcdmjrsr.\s]/gi,'').slice(0,5);
    else if(name==='address_line')value=value.slice(0,255);
    setFormData(p=>({...p,[name]:value}));
    if(errors[name])setErrors(p=>{const n={...p};delete n[name];return n;});
  };
  const onPhone=(name,value)=>{
    const d=value.replace(/\D/g,'').slice(0,10);
    setFormData(p=>({...p,[name]:d}));
    if(name==='phone')setPhoneChanged(d.length>0);
    if(name==='alternate_phone')setAltPhoneChanged(d.length>0);
    if(errors[name])setErrors(p=>{const n={...p};delete n[name];return n;});
  };
  const onRegion       =async code=>{setFormData(p=>({...p,region_code:code,province_code:'',municipality_code:'',barangay_code:''}));setShowDropdown(null);await loadProvinces(code);};
  const onProvince     =async code=>{setFormData(p=>({...p,province_code:code,municipality_code:'',barangay_code:''}));setShowDropdown(null);await loadMunicipalities(code);};
  const onMunicipality =async code=>{setFormData(p=>({...p,municipality_code:code,barangay_code:''}));setShowDropdown(null);await loadBarangays(code);};
  const onBarangay     =     code=>{setFormData(p=>({...p,barangay_code:code}));setShowDropdown(null);};

  const startEdit=async()=>{
    stopPolling();
    setFormData({...originalFormData,phone:'',alternate_phone:''});
    setPhoneChanged(false);setAltPhoneChanged(false);setErrors({});setIsEditing(true);
    await loadRegions();
    if(originalFormData.region_code){await loadProvinces(originalFormData.region_code);
      if(originalFormData.province_code){await loadMunicipalities(originalFormData.province_code);
        if(originalFormData.municipality_code)await loadBarangays(originalFormData.municipality_code);}}
  };
  const cancelEdit=()=>{setFormData(originalFormData);setErrors({});setPhoneChanged(false);setAltPhoneChanged(false);setIsEditing(false);startPolling();};

  const onSavePress=()=>{
    if(!validate()){setErrorMsg('Please fix the errors before saving.');return;}
    showConfirm('Save Changes','Are you sure you want to save these changes to your profile?',()=>{hideConfirm();doSave();},'Yes, Save');
  };

  const doSave=async()=>{
    setIsSaving(true);setSuccessMsg('');setErrorMsg('');
    try{
      const token=await AsyncStorage.getItem('token');if(!token){setErrorMsg('Not authenticated');setIsSaving(false);return;}
      const cap=s=>s?.trim().split(' ').map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join(' ');
      let fmt={...formData};
      if(fmt.first_name)fmt.first_name=cap(fmt.first_name);
      if(fmt.last_name)fmt.last_name=cap(fmt.last_name);
      if(fmt.middle_name)fmt.middle_name=cap(fmt.middle_name);
      if(fmt.suffix){const t=fmt.suffix.trim();fmt.suffix=t.toLowerCase()==='sr.'?'Sr.':t.toLowerCase()==='jr.'?'Jr.':/^[ivxlcdm]+$/i.test(t)?t.toUpperCase():t;}
      fmt.phone=phoneChanged&&fmt.phone?`+63${fmt.phone.trim()}`:originalFormData.phone?`+63${originalFormData.phone}`:'';
      fmt.alternate_phone=altPhoneChanged&&fmt.alternate_phone?`+63${fmt.alternate_phone.trim()}`:originalFormData.alternate_phone?`+63${originalFormData.alternate_phone}`:'';
      fmt.email=originalFormData.email||'';
      const fd=new FormData();
      ['first_name','last_name','middle_name','suffix','gender','email','phone','alternate_phone','region_code','province_code','municipality_code','barangay_code','address_line','date_of_birth'].forEach(k=>{if(fmt[k]!=null&&fmt[k].toString().trim()!=='')fd.append(k,fmt[k].toString());});
      const res=await fetch(`${BASE_URL}/users/profile/${String(profileData.user_id)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:fd});
      const json=await res.json();
      if(!res.ok||!json.success){
        if(json.errors&&Array.isArray(json.errors)){const be={};json.errors.forEach(e=>{if(e.field)be[e.field]=e.message;});if(Object.keys(be).length)setErrors(be);}
        setErrorMsg(json.message||'Failed to update profile');setIsSaving(false);return;
      }
      await resolveFromArrays(fmt.region_code,fmt.province_code,fmt.municipality_code,fmt.barangay_code);
      const fresh=json.user||{...profileData,...fmt};
      lastEtag.current=JSON.stringify(fresh);await AsyncStorage.setItem('user',JSON.stringify(fresh));
      applyToState(fresh);setSuccessMsg('Profile updated successfully!');
      setIsEditing(false);setPhoneChanged(false);setAltPhoneChanged(false);startPolling();
    }catch(err){console.error('doSave:',err);setErrorMsg('Network error. Check your connection.');}
    finally{setIsSaving(false);}
  };

  const pickFromGallery=async()=>{
    const perm=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!perm.granted){setErrorMsg('Gallery permission required');return;}
    const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8});
    if(!r.canceled&&r.assets[0]){setShowPhotoModal(false);confirmUploadPhoto(r.assets[0].uri);}
  };
  const takeWithCamera=async()=>{
    const perm=await ImagePicker.requestCameraPermissionsAsync();if(!perm.granted){setErrorMsg('Camera permission required');return;}
    const r=await ImagePicker.launchCameraAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8});
    if(!r.canceled&&r.assets[0]){setShowPhotoModal(false);confirmUploadPhoto(r.assets[0].uri);}
  };
  const confirmUploadPhoto=uri=>showConfirm('Update Profile Photo','Are you sure you want to update your profile photo?',()=>{hideConfirm();uploadPhoto(uri);},'Yes, Update');
  const uploadPhoto=async uri=>{
    try{
      setUploadingPhoto(true);const token=await AsyncStorage.getItem('token');const fd=new FormData();
      if(Platform.OS==='web'){const blob=await(await fetch(uri)).blob();fd.append('profilePicture',blob,'profile.jpg');}
      else{fd.append('profilePicture',{uri,type:'image/jpeg',name:'profile.jpg'});}
      const res=await fetch(`${BASE_URL}/users/profile/picture`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});
      const json=await res.json();
      if(!res.ok||!json.success){setErrorMsg(json.message||'Failed to upload photo');}
      else{
        const newPic=json.profile_picture;setProfileData(p=>({...p,profile_picture:newPic}));
        const cached=await AsyncStorage.getItem('user');
        if(cached){const parsed=JSON.parse(cached);parsed.profile_picture=newPic;lastEtag.current=JSON.stringify(parsed);await AsyncStorage.setItem('user',JSON.stringify(parsed));}
        setSuccessMsg('Profile photo updated!');
      }
    }catch(err){console.error('uploadPhoto:',err);setErrorMsg('Error uploading photo.');}
    finally{setUploadingPhoto(false);}
  };

  const logout=()=>showConfirm('Logout','Are you sure you want to logout?',async()=>{
    hideConfirm();stopPolling();await AsyncStorage.clear();navigation.reset({index:0,routes:[{name:'Login'}]});
  },'Logout',COLORS.red);

  // ── Email handlers — all preserved exactly ───────────────────────────────────
  const resetEmailModal=()=>{
    setEmailPassword('');setEmailPasswordShow(false);setEmailPasswordErr('');
    setEmailNewAddress('');setEmailNewErr('');setEmailModalErr('');
    setOldOtpValues(['','','','','','']);setOldOtpError('');setOldOtpTimer(0);setOldResendsLeft(3);setOldOtpState('active');
    setNewOtpValues(['','','','','','']);setNewOtpError('');setNewOtpTimer(0);setNewResendsLeft(3);setNewOtpMasked('');setNewOtpState('active');
    setEmailOldMasked('');clearInterval(oldOtpTimerRef.current);clearInterval(newOtpTimerRef.current);
    isResendingOldRef.current=false;isResendingNewRef.current=false;
  };
  const openEmailModal=async()=>{
    resetEmailModal();setEmailModalVisible(true);setEmailStep('checking');
    try{const stored=await AsyncStorage.getItem('cem_session_locked');if(stored){const{until}=JSON.parse(stored);if(Date.now()<until){setEmailSessionMins(Math.ceil((until-Date.now())/60_000));setEmailStep('session-locked');return;}await AsyncStorage.removeItem('cem_session_locked');}}catch{await AsyncStorage.removeItem('cem_session_locked');}
    try{
      const token=await AsyncStorage.getItem('token');
      const res=await fetch(`${BASE_URL}/users/email/status`,{headers:{Authorization:`Bearer ${token}`}});
      const d=await res.json();
      if(d.blocked){setEmailCooldownHours(d.hoursLeft??0);setEmailStep('cooldown');}
      else if(d.sessionLocked){const lm=d.minsLeft??15;setEmailSessionMins(lm);await AsyncStorage.setItem('cem_session_locked',JSON.stringify({until:Date.now()+lm*60_000}));setEmailStep('session-locked');}
      else if(d.pwLocked){setEmailLockedMins(d.minsLeft??15);setEmailStep('pw-locked');}
      else{setEmailStep('password');}
    }catch{setEmailStep('password');}
  };
  const closeEmailModal=()=>{setEmailModalVisible(false);clearInterval(oldOtpTimerRef.current);clearInterval(newOtpTimerRef.current);};
  const saveSessionLock=async(lm)=>{await AsyncStorage.setItem('cem_session_locked',JSON.stringify({until:Date.now()+lm*60_000}));};
  const goSessionLocked=async(lm)=>{setEmailSessionMins(lm);await saveSessionLock(lm);setEmailStep('session-locked');};
  const handleEmailVerifyPassword=async()=>{
    if(!emailPassword.trim()){setEmailPasswordErr('Password is required');return;}
    setEmailPasswordLoading(true);setEmailPasswordErr('');
    try{
      const token=await AsyncStorage.getItem('token');
      const res=await fetch(`${BASE_URL}/users/email/verify-password`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({password:emailPassword})});
      const d=await res.json();
      if(!res.ok){if(d.pwLocked||d.locked){setEmailLockedMins(d.minutesLeft??15);setEmailStep('pw-locked');return;}if(d.blocked){setEmailCooldownHours(d.hoursLeft??0);setEmailStep('cooldown');return;}if(d.sessionLocked){await goSessionLocked(d.minutesLeft??15);return;}setEmailPasswordErr(d.message||'Incorrect password');return;}
      setEmailStep('old-send');
    }catch{setEmailPasswordErr('Network error. Try again.');}finally{setEmailPasswordLoading(false);}
  };
  const handleSendOldOtp=async()=>{
    if(isResendingOldRef.current)return;isResendingOldRef.current=true;
    setEmailModalLoading(true);setOldOtpError('');setEmailModalErr('');
    try{
      const token=await AsyncStorage.getItem('token');
      const res=await fetch(`${BASE_URL}/users/email/request-old-otp`,{method:'POST',headers:{Authorization:`Bearer ${token}`}});
      const d=await res.json();
      if(!res.ok){if(d.sessionLocked){await goSessionLocked(d.minutesLeft??15);return;}if(d.resendLocked||res.status===429){setEmailModalErr('');if(emailStep!=='old-otp')setEmailStep('old-otp');return;}setOldOtpError(d.message||'Failed to send code');return;}
      setEmailOldMasked(d.maskedEmail||'');setOldResendsLeft(d.resendsLeft??2);setOldOtpValues(['','','','','','']);setOldOtpState('active');
      if(emailStep!=='old-otp')setEmailStep('old-otp');
      if(d.otpExpiresAt)startTimer(d.otpExpiresAt,setOldOtpTimer,setOldOtpState,oldOtpTimerRef);
    }catch{setOldOtpError('Network error. Try again.');}finally{setEmailModalLoading(false);isResendingOldRef.current=false;}
  };
  const handleVerifyOldOtp=async()=>{
    const code=oldOtpValues.join('');if(code.length!==6){setOldOtpError('Please enter all 6 digits');return;}
    setEmailModalLoading(true);setOldOtpError('');
    try{
      const token=await AsyncStorage.getItem('token');
      const res=await fetch(`${BASE_URL}/users/email/verify-old-otp`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({otp:code})});
      const d=await res.json();
      if(!res.ok){if(d.sessionLocked||d.autoClose){await goSessionLocked(d.minutesLeft??15);return;}if(d.forceResend||d.attemptLocked||res.status===429){setOldOtpState('attempts-exceeded');setOldOtpValues(['','','','','','']);clearInterval(oldOtpTimerRef.current);setOldOtpTimer(0);if(d.resendsLeft!==undefined)setOldResendsLeft(d.resendsLeft);setOldOtpError('Too many incorrect attempts. Please request a new code.');return;}setOldOtpError(d.message||'Incorrect code');setOldOtpValues(['','','','','','']);return;}
      clearInterval(oldOtpTimerRef.current);setEmailStep('new-email');
    }catch{setOldOtpError('Network error. Try again.');}finally{setEmailModalLoading(false);}
  };
  const handleSendNewOtp=async()=>{
    const err=V.email(emailNewAddress);if(err){setEmailNewErr(err);return;}
    if(isResendingNewRef.current)return;isResendingNewRef.current=true;
    setEmailModalLoading(true);setEmailNewErr('');setNewOtpError('');setEmailModalErr('');
    try{
      const token=await AsyncStorage.getItem('token');
      const res=await fetch(`${BASE_URL}/users/email/request-new-otp`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({newEmail:emailNewAddress.trim().toLowerCase()})});
      const d=await res.json();
      if(!res.ok){if(d.sessionLocked){await goSessionLocked(d.minutesLeft??15);return;}if(d.resendLocked||res.status===429){setEmailModalErr('');if(emailStep!=='new-otp')setEmailStep('new-otp');return;}setEmailNewErr(d.message||'Failed to send code');return;}
      setNewOtpMasked(d.maskedEmail||'');setNewResendsLeft(d.resendsLeft??2);setNewOtpValues(['','','','','','']);setNewOtpState('active');
      if(emailStep!=='new-otp')setEmailStep('new-otp');
      if(d.otpExpiresAt)startTimer(d.otpExpiresAt,setNewOtpTimer,setNewOtpState,newOtpTimerRef);
    }catch{setEmailNewErr('Network error. Try again.');}finally{setEmailModalLoading(false);isResendingNewRef.current=false;}
  };
  const handleVerifyNewOtp=async()=>{
    const code=newOtpValues.join('');if(code.length!==6){setNewOtpError('Please enter all 6 digits');return;}
    setEmailModalLoading(true);setNewOtpError('');
    try{
      const token=await AsyncStorage.getItem('token');
      const res=await fetch(`${BASE_URL}/users/email/verify-new-otp`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({otp:code})});
      const d=await res.json();
      if(!res.ok){if(d.sessionLocked||d.autoClose){await goSessionLocked(d.minutesLeft??15);return;}if(d.forceResend||d.attemptLocked||res.status===429){setNewOtpState('attempts-exceeded');setNewOtpValues(['','','','','','']);clearInterval(newOtpTimerRef.current);setNewOtpTimer(0);if(d.resendsLeft!==undefined)setNewResendsLeft(d.resendsLeft);setNewOtpError('Too many incorrect attempts. Please request a new code.');return;}setNewOtpError(d.message||'Incorrect code');setNewOtpValues(['','','','','','']);return;}
      clearInterval(newOtpTimerRef.current);await saveVerifiedEmail(emailNewAddress.trim().toLowerCase());
    }catch{setNewOtpError('Network error. Try again.');}finally{setEmailModalLoading(false);}
  };
  const saveVerifiedEmail=async newEmail=>{
    setEmailModalLoading(true);
    try{
      const token=await AsyncStorage.getItem('token');const fd=new FormData();fd.append('email',newEmail);
      ['first_name','last_name','middle_name','suffix','gender','phone','alternate_phone','region_code','province_code','municipality_code','barangay_code','address_line'].forEach(k=>{const v=originalFormData[k];if(v!=null&&v.toString().trim()!=='')fd.append(k,v.toString());});
      if(originalFormData.phone)fd.set('phone',`+63${originalFormData.phone}`);
      if(originalFormData.alternate_phone)fd.set('alternate_phone',`+63${originalFormData.alternate_phone}`);
      const res=await fetch(`${BASE_URL}/users/profile/${String(profileData.user_id)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:fd});
      const json=await res.json();
      if(!res.ok||!json.success){setNewOtpError(json.message||'Failed to save new email');return;}
      const fresh=json.user||{...profileData,email:newEmail};
      lastEtag.current=JSON.stringify(fresh);await AsyncStorage.setItem('user',JSON.stringify(fresh));applyToState(fresh);setEmailStep('done');
    }catch{setNewOtpError('Network error saving email. Try again.');}finally{setEmailModalLoading(false);}
  };
  const handleResendOldOtp=async()=>{if(!canResendOld)return;await handleSendOldOtp();};
  const handleResendNewOtp=async()=>{if(!canResendNew)return;await handleSendNewOtp();};

  const ZMAP={region:4000,province:3000,municipality:2000,barangay:1000};
  const Dropdown=({id,label,value,items,onSelect,loading:dLoad,disabled,error})=>(
    <View style={[st.formGroup,{zIndex:showDropdown===id?ZMAP[id]:10}]}>
      <Text style={st.formLabel}>{label}</Text>
      <TouchableOpacity style={[st.dropdown,error&&st.dropdownErr,disabled&&st.dropdownOff]}
        onPress={()=>!disabled&&!isSaving&&setShowDropdown(showDropdown===id?null:id)}>
        <Text style={[st.dropdownTxt,!value&&st.dropdownPlaceholder]}>{items.find(i=>i.code===value)?.name||`Select ${label.replace(' *','')}`}</Text>
        <Ionicons name={showDropdown===id?'chevron-up':'chevron-down'} size={18} color={disabled?COLORS.gray300:COLORS.navy}/>
      </TouchableOpacity>
      {showDropdown===id&&(
        <View style={st.ddList}>
          {dLoad?<View style={st.ddLoader}><ActivityIndicator size="small" color={COLORS.navy}/><Text style={st.ddLoaderTxt}>Loading…</Text></View>
          :<ScrollView style={{maxHeight:200}} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {items.map(item=>(
              <TouchableOpacity key={item.code} style={[st.ddItem,value===item.code&&st.ddItemOn]} onPress={()=>onSelect(item.code)}>
                <Text style={[st.ddItemTxt,value===item.code&&st.ddItemTxtOn]}>{item.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>}
        </View>
      )}
      {error?<Text style={st.errTxt}>{error}</Text>:null}
    </View>
  );

  if(loading) return(
    <SafeAreaView style={st.safe}>
      <View style={st.center}>
        <ActivityIndicator size="large" color={COLORS.navy}/>
        <Text style={st.centerLbl}>Loading profile…</Text>
      </View>
    </SafeAreaView>
  );
  if(!profileData) return(
    <SafeAreaView style={st.safe}>
      <View style={st.center}>
        <View style={st.emptyIconWrap}><Ionicons name="person-circle-outline" size={56} color={COLORS.gray300}/></View>
        <Text style={st.emptyTitle}>No profile data</Text>
        <TouchableOpacity style={st.solidBtn} onPress={()=>navigation.reset({index:0,routes:[{name:'Login'}]})}>
          <Text style={st.solidBtnTxt}>Go to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const displayName=V.formatDisplayName(profileData.first_name,profileData.middle_name,profileData.last_name,profileData.suffix)||'Officer Name';

  // ── OTP step renderer ─────────────────────────────────────────────────────────
  const renderOtpStep=({otpValues,setOtpValues,otpState,otpTimer,otpError,masked,resendsLeft,canResend,onVerify,onResend,stepTitle})=>(
    <View>
      {/* Info card */}
      <View style={em.infoBox}>
        <View style={em.infoIconWrap}><Ionicons name="mail" size={18} color="#1d4ed8"/></View>
        <View style={{flex:1}}>
          <Text style={em.infoTitle}>Code sent to <Text style={{fontWeight:'700',color:COLORS.navy}}>{masked}</Text></Text>
          <Text style={em.infoSub}>Expires in <Text style={{fontWeight:'700'}}>2 minutes</Text>. Do not share.</Text>
        </View>
      </View>

      {/* Timer */}
      {otpState!=='attempts-exceeded'&&(
        <View style={[em.timerPill,otpTimer<=30&&otpTimer>0&&em.timerWarn,otpTimer===0&&em.timerExpired]}>
          <Ionicons name="time-outline" size={14} color={otpTimer===0?COLORS.danger:otpTimer<=30?COLORS.amber:COLORS.navy}/>
          <Text style={[em.timerTxt,otpTimer<=30&&otpTimer>0&&{color:COLORS.amber},otpTimer===0&&{color:COLORS.danger}]}>
            {otpTimer>0?`Expires in ${formatTimer(otpTimer)}`:'This code has expired. Request a new one.'}
          </Text>
        </View>
      )}

      {/* Error banner */}
      {otpError!==''&&(
        <View style={[em.banner,otpState==='attempts-exceeded'&&em.bannerAmber]}>
          <Ionicons name={otpState==='attempts-exceeded'?'warning':'close-circle'} size={17} color={COLORS.white}/>
          <Text style={em.bannerTxt}>{otpError}</Text>
        </View>
      )}

      <OtpBoxes values={otpValues} onChange={(idx,val)=>setOtpValues(p=>{const n=[...p];n[idx]=val;return n;})} disabled={emailModalLoading||otpState!=='active'}/>

      {otpState==='active'&&(
        <TouchableOpacity
          style={[em.primaryBtn,(otpValues.join('').length!==6||emailModalLoading)&&em.primaryBtnOff]}
          onPress={onVerify}
          disabled={otpValues.join('').length!==6||emailModalLoading}>
          {emailModalLoading
            ?<ActivityIndicator size="small" color={COLORS.white}/>
            :<Ionicons name="checkmark" size={18} color={COLORS.white}/>}
          <Text style={em.primaryBtnTxt}>{emailModalLoading?'Verifying…':stepTitle}</Text>
        </TouchableOpacity>
      )}

      <View style={em.resendWrap}>
        {resendsLeft<=0
          ?<Text style={em.resendExhausted}>No more resends available for this session</Text>
          :canResend
            ?<TouchableOpacity style={[em.resendBtn,emailModalLoading&&{opacity:0.5}]} onPress={onResend} disabled={emailModalLoading}>
              <Ionicons name="refresh" size={14} color={emailModalLoading?COLORS.gray300:COLORS.navy}/>
              <Text style={[em.resendBtnTxt,emailModalLoading&&{color:COLORS.gray300}]}>
                {emailModalLoading?'Sending…':`Resend Code (${resendsLeft} left)`}
              </Text>
            </TouchableOpacity>
            :null
        }
      </View>
    </View>
  );

  // ─── STATUS CARD for email modal ─────────────────────────────────────────────
  const renderStatusCard=({iconName,iconBg,iconColor,title,titleColor,children})=>(
    <View style={em.statusCard}>
      <View style={[em.statusIcon,{backgroundColor:iconBg}]}>
        <Ionicons name={iconName} size={34} color={iconColor}/>
      </View>
      <Text style={[em.statusTitle,titleColor&&{color:titleColor}]}>{title}</Text>
      {children}
    </View>
  );

  return (
    <SafeAreaView style={st.safe}>
      <ScrollView style={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ══════════════ HEADER ══════════════ */}
        <View style={st.header}>
          <View style={st.headerDecorCircle1}/>
          <View style={st.headerDecorCircle2}/>

          {/* Avatar */}
          <TouchableOpacity style={st.avatarWrap} onPress={()=>!uploadingPhoto&&setShowPhotoModal(true)} activeOpacity={0.85}>
            {profileData.profile_picture
              ?<Image source={{uri:profileData.profile_picture}} style={st.avatar}/>
              :<View style={st.avatarPlaceholder}>
                <Text style={st.avatarInitials}>{profileData.first_name?.[0]??''}{profileData.last_name?.[0]??''}</Text>
              </View>
            }
            <View style={st.cameraOverlay}>
              <Ionicons name="camera" size={11} color={COLORS.white}/>
            </View>
          </TouchableOpacity>

          {/* Name */}
          <Text style={st.headerName}>{displayName}</Text>

          {/* Username pill */}
          {!!profileData.username&&(
            <View style={st.usernamePill}>
              <Ionicons name="at-outline" size={12} color="rgba(255,255,255,0.6)"/>
              <Text style={st.usernameText}>
                {showUsername ? profileData.username : '•'.repeat(Math.min(profileData.username.length,12))}
              </Text>
              <TouchableOpacity onPress={()=>setShowUsername(v=>!v)} hitSlop={{top:8,bottom:8,left:8,right:8}}>
                <Ionicons name={showUsername?'eye-outline':'eye-off-outline'} size={13} color="rgba(255,255,255,0.45)"/>
              </TouchableOpacity>
            </View>
          )}

          {/* Pills row */}
          <View style={st.pillsRow}>
            {!!profileData.role&&(
              <View style={st.rolePill}>
                <Ionicons name="shield-checkmark-outline" size={11} color="rgba(255,255,255,0.9)"/>
                <Text style={st.rolePillTxt}>{profileData.role}</Text>
              </View>
            )}
            {!!profileData.rank&&(
              <View style={st.rankPill}><Text style={st.rankPillTxt}>{profileData.rank}</Text></View>
            )}
            {!!profileData.department&&(
              <View style={st.deptPill}><Text style={st.deptPillTxt}>{profileData.department}</Text></View>
            )}
          </View>

          {refreshing&&(
            <View style={st.syncRow}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.6)"/>
              <Text style={st.syncTxt}>Syncing…</Text>
            </View>
          )}
        </View>

        {/* ══════════════ ACTIONS ══════════════ */}
        <View style={st.actionSection}>
          <View style={st.actionRow}>
            <ActionBtn icon="create-outline"      label="Edit Profile"    onPress={startEdit}/>
            <ActionBtn icon="lock-closed-outline" label="Change Password" onPress={()=>navigation.navigate('ChangePassword')}/>
            <ActionBtn icon="mail-outline"        label="Update Email"    onPress={openEmailModal}/>
          </View>
          <TouchableOpacity style={st.logoutBtn} onPress={logout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.red}/>
            <Text style={st.logoutBtnTxt}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════ INFO SECTIONS ══════════════ */}
        <InfoSection title="Personal Information" icon="person-outline">
          <InfoGrid>
            <InfoItem label="First Name"    value={profileData.first_name}/>
            <InfoItem label="Last Name"     value={profileData.last_name}/>
            <InfoItem label="Middle Name"   value={profileData.middle_name}/>
            <InfoItem label="Suffix"        value={profileData.suffix}/>
            <InfoItem label="Date of Birth" value={profileData.date_of_birth?new Date(profileData.date_of_birth).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}):null}/>
            <InfoItem label="Gender"        value={profileData.gender}/>
          </InfoGrid>
        </InfoSection>

        <InfoSection title="Contact Information" icon="call-outline">
          <InfoGrid>
            <InfoItem label="Phone"    value={profileData.phone?`+63 ${V.maskPhone(profileData.phone)}`:null}/>
            <InfoItem label="Alt Phone" value={profileData.alternate_phone?`+63 ${V.maskPhone(profileData.alternate_phone)}`:null}/>
          </InfoGrid>
          <View style={st.infoFullRow}>
            <InfoItem label="Email Address" value={profileData.email?V.maskEmail(profileData.email):null} full/>
          </View>
        </InfoSection>

        <InfoSection title="Address" icon="location-outline">
          <InfoGrid>
            <InfoItem label="Region"   value={resolvedAddr.region||profileData.region}/>
            <InfoItem label="Province" value={resolvedAddr.province||profileData.province}/>
            <InfoItem label="City / Municipality" value={resolvedAddr.municipality||profileData.municipality||profileData.city}/>
            <InfoItem label="Barangay" value={resolvedAddr.barangay||profileData.barangay}/>
          </InfoGrid>
          {!!profileData.address_line&&(
            <View style={st.infoFullRow}><InfoItem label="Address Line" value={profileData.address_line} full/></View>
          )}
        </InfoSection>

        <InfoSection title="Official Information" icon="briefcase-outline">
          <InfoGrid>
            <InfoItem label="Role"            value={profileData.role}/>
            <InfoItem label="Rank"            value={profileData.rank}/>
            <InfoItem label="Department"      value={profileData.department}/>
            <InfoItem label="Mobile Patrol #" value={profileData.mobile_patrol}/>
          </InfoGrid>
        </InfoSection>

        <View style={{height:36}}/>
      </ScrollView>

      {/* ── Toasts ── */}
      {!!successMsg&&(
        <View style={st.toastWrap}>
          <View style={st.toastOk}>
            <View style={st.toastIconWrap}><Ionicons name="checkmark-circle" size={20} color={COLORS.white}/></View>
            <Text style={st.toastTxt}>{successMsg}</Text>
          </View>
        </View>
      )}
      {!!errorMsg&&(
        <View style={st.toastWrap}>
          <View style={st.toastErr}>
            <View style={st.toastIconWrap}><Ionicons name="close-circle" size={20} color={COLORS.white}/></View>
            <Text style={st.toastTxt}>{errorMsg}</Text>
          </View>
        </View>
      )}

      {/* ══════════════ EMAIL MODAL ══════════════ */}
      <Modal visible={emailModalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={em.safe}>
          {/* Header */}
          <View style={em.header}>
            <TouchableOpacity onPress={closeEmailModal} style={em.headerBtn} hitSlop={{top:12,bottom:12,left:12,right:12}}>
              <View style={em.headerBtnInner}><Ionicons name="close" size={20} color={COLORS.white}/></View>
            </TouchableOpacity>
            <View style={em.headerCenter}>
              <Text style={em.headerTitle}>Update Email</Text>
              {!['checking','cooldown','session-locked','pw-locked','done'].includes(emailStep)&&(
                <Text style={em.headerSub}>Step {emailStepIdx} of {EMAIL_STEPS.length}</Text>
              )}
            </View>
            <View style={{width:44}}/>
          </View>

          {/* Progress bar */}
          {!['checking','cooldown','session-locked','pw-locked','done'].includes(emailStep)&&(
            <View style={em.progressWrap}>
              <ProgressDots current={emailStepIdx} total={EMAIL_STEPS.length}/>
            </View>
          )}

          <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={em.scrollContent} showsVerticalScrollIndicator={false}>

              {emailStep==='checking'&&(
                <View style={em.centerBox}>
                  <ActivityIndicator size="large" color={COLORS.navy}/>
                  <Text style={em.centerTxt}>Checking availability…</Text>
                </View>
              )}

              {emailStep==='cooldown'&&renderStatusCard({
                iconName:'lock-closed',iconBg:COLORS.navyLight,iconColor:COLORS.navy,
                title:'Email Change Unavailable',
                children:(
                  <View style={{alignItems:'center',width:'100%'}}>
                    <Text style={em.statusMsg}>You can only change your email once every 24 hours.</Text>
                    {emailCooldownHours>0&&(
                      <View style={em.timeBadge}>
                        <Ionicons name="time-outline" size={14} color={COLORS.gray500}/>
                        <Text style={em.timeBadgeTxt}>Try again in <Text style={{fontWeight:'800'}}>{emailCooldownHours}h</Text></Text>
                      </View>
                    )}
                    <TouchableOpacity style={[em.primaryBtn,{marginTop:24,alignSelf:'stretch'}]} onPress={closeEmailModal}>
                      <Text style={em.primaryBtnTxt}>Close</Text>
                    </TouchableOpacity>
                  </View>
                ),
              })}

              {emailStep==='session-locked'&&renderStatusCard({
                iconName:'lock-closed',iconBg:COLORS.amberLight,iconColor:'#c2410c',
                title:'Update Email Unavailable',
                children:(
                  <View style={{alignItems:'center',width:'100%'}}>
                    <Text style={em.statusMsg}>For security reasons, this process has been temporarily locked.</Text>
                    <View style={[em.timeBadge,{backgroundColor:COLORS.amberLight,borderColor:'#f59e0b'}]}>
                      <Ionicons name="time-outline" size={14} color="#c2410c"/>
                      <Text style={[em.timeBadgeTxt,{color:'#c2410c'}]}>Try again in <Text style={{fontWeight:'800'}}>{emailSessionMins} min{emailSessionMins!==1?'s':''}</Text></Text>
                    </View>
                    <TouchableOpacity style={[em.primaryBtn,{marginTop:24,alignSelf:'stretch',backgroundColor:'#c2410c'}]} onPress={closeEmailModal}>
                      <Text style={em.primaryBtnTxt}>Close</Text>
                    </TouchableOpacity>
                  </View>
                ),
              })}

              {emailStep==='pw-locked'&&renderStatusCard({
                iconName:'lock-closed',iconBg:COLORS.amberLight,iconColor:'#c2410c',
                title:'Update Email Unavailable',
                children:(
                  <View style={{alignItems:'center',width:'100%'}}>
                    <Text style={em.statusMsg}>Too many incorrect password attempts.</Text>
                    <View style={[em.timeBadge,{backgroundColor:COLORS.amberLight,borderColor:'#f59e0b'}]}>
                      <Ionicons name="time-outline" size={14} color="#c2410c"/>
                      <Text style={[em.timeBadgeTxt,{color:'#c2410c'}]}>Try again in <Text style={{fontWeight:'800'}}>{emailLockedMins} min{emailLockedMins!==1?'s':''}</Text></Text>
                    </View>
                    <TouchableOpacity style={[em.primaryBtn,{marginTop:24,alignSelf:'stretch',backgroundColor:'#c2410c'}]} onPress={closeEmailModal}>
                      <Text style={em.primaryBtnTxt}>Close</Text>
                    </TouchableOpacity>
                  </View>
                ),
              })}

              {emailStep==='done'&&renderStatusCard({
                iconName:'checkmark-circle',iconBg:COLORS.greenLight,iconColor:COLORS.green,
                title:'Email Updated!',titleColor:COLORS.green,
                children:(
                  <View style={{alignItems:'center',width:'100%'}}>
                    <Text style={em.statusMsg}>Your email address has been successfully changed.</Text>
                    <Text style={em.statusMsg}>Security notifications sent to both your old and new email addresses.</Text>
                    <TouchableOpacity style={[em.primaryBtn,{marginTop:24,alignSelf:'stretch',backgroundColor:COLORS.green}]} onPress={closeEmailModal}>
                      <Ionicons name="checkmark" size={18} color={COLORS.white}/>
                      <Text style={em.primaryBtnTxt}>Done</Text>
                    </TouchableOpacity>
                  </View>
                ),
              })}

              {emailStep==='password'&&(
                <View>
                  <View style={em.stepHeader}>
                    <View style={em.stepIconWrap}><Ionicons name="shield-checkmark" size={22} color={COLORS.navy}/></View>
                    <View style={{flex:1}}>
                      <Text style={em.stepTitle}>Verify Your Identity</Text>
                      <Text style={em.stepSub}>Enter your current password to continue.</Text>
                    </View>
                  </View>
                  <View style={em.fieldCard}>
                    <Text style={em.fieldLabel}>CURRENT PASSWORD</Text>
                    <View style={[em.inputRow,emailPasswordErr&&em.inputRowErr]}>
                      <TextInput style={em.input} placeholder="Enter your password" placeholderTextColor={COLORS.gray300}
                        value={emailPassword} onChangeText={v=>{setEmailPassword(v);setEmailPasswordErr('');}}
                        secureTextEntry={!emailPasswordShow} autoCapitalize="none" autoCorrect={false} editable={!emailPasswordLoading}/>
                      <TouchableOpacity onPress={()=>setEmailPasswordShow(v=>!v)} style={em.eyeBtn}>
                        <Ionicons name={emailPasswordShow?'eye':'eye-off'} size={20} color={COLORS.gray400}/>
                      </TouchableOpacity>
                    </View>
                    {emailPasswordErr?<Text style={em.errTxt}>{emailPasswordErr}</Text>:null}
                  </View>
                  <TouchableOpacity
                    style={[em.primaryBtn,(!emailPassword.trim()||emailPasswordLoading)&&em.primaryBtnOff]}
                    onPress={handleEmailVerifyPassword}
                    disabled={!emailPassword.trim()||emailPasswordLoading}>
                    {emailPasswordLoading?<ActivityIndicator size="small" color={COLORS.white}/>:<Ionicons name="arrow-forward" size={18} color={COLORS.white}/>}
                    <Text style={em.primaryBtnTxt}>{emailPasswordLoading?'Verifying…':'Verify Password →'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {emailStep==='old-send'&&(
                <View style={em.centerBox}>
                  <View style={[em.statusIcon,{backgroundColor:COLORS.navyLight}]}>
                    <Ionicons name="mail" size={34} color={COLORS.navy}/>
                  </View>
                  <Text style={em.statusTitle}>Verify Current Email</Text>
                  <Text style={em.statusMsg}>We'll send a verification code to your current email to confirm it's you.</Text>
                  <TouchableOpacity
                    style={[em.primaryBtn,{marginTop:20,alignSelf:'stretch'},emailModalLoading&&em.primaryBtnOff]}
                    onPress={handleSendOldOtp} disabled={emailModalLoading}>
                    {emailModalLoading?<ActivityIndicator size="small" color={COLORS.white}/>:<Ionicons name="send" size={16} color={COLORS.white}/>}
                    <Text style={em.primaryBtnTxt}>{emailModalLoading?'Sending…':'Send Code to Current Email'}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {emailStep==='old-otp'&&renderOtpStep({otpValues:oldOtpValues,setOtpValues:setOldOtpValues,otpState:oldOtpState,otpTimer:oldOtpTimer,otpError:oldOtpError,masked:emailOldMasked,resendsLeft:oldResendsLeft,canResend:canResendOld,onVerify:handleVerifyOldOtp,onResend:handleResendOldOtp,stepTitle:'Verify Code'})}

              {emailStep==='new-email'&&(
                <View>
                  <View style={em.stepHeader}>
                    <View style={em.stepIconWrap}><Ionicons name="mail" size={22} color={COLORS.navy}/></View>
                    <View style={{flex:1}}>
                      <Text style={em.stepTitle}>Enter New Email</Text>
                      <Text style={em.stepSub}>Enter the email address you want to use.</Text>
                    </View>
                  </View>
                  <View style={em.fieldCard}>
                    <Text style={em.fieldLabel}>NEW EMAIL ADDRESS</Text>
                    <TextInput
                      style={[em.inputSolo,emailNewErr&&em.inputRowErr]}
                      placeholder="newaddress@example.com" placeholderTextColor={COLORS.gray300}
                      value={emailNewAddress} onChangeText={v=>{setEmailNewAddress(v);setEmailNewErr('');}}
                      keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!emailModalLoading}/>
                    {emailNewErr?<Text style={em.errTxt}>{emailNewErr}</Text>:null}
                  </View>
                  <TouchableOpacity
                    style={[em.primaryBtn,(!emailNewAddress.trim()||emailModalLoading)&&em.primaryBtnOff]}
                    onPress={handleSendNewOtp} disabled={!emailNewAddress.trim()||emailModalLoading}>
                    {emailModalLoading?<ActivityIndicator size="small" color={COLORS.white}/>:<Ionicons name="send" size={16} color={COLORS.white}/>}
                    <Text style={em.primaryBtnTxt}>{emailModalLoading?'Sending…':'Send Code to New Email'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={em.backBtn} onPress={()=>setEmailStep('old-send')}>
                    <Ionicons name="chevron-back" size={14} color={COLORS.gray500}/>
                    <Text style={em.backBtnTxt}>Back</Text>
                  </TouchableOpacity>
                </View>
              )}

              {emailStep==='new-otp'&&renderOtpStep({otpValues:newOtpValues,setOtpValues:setNewOtpValues,otpState:newOtpState,otpTimer:newOtpTimer,otpError:newOtpError,masked:newOtpMasked,resendsLeft:newResendsLeft,canResend:canResendNew,onVerify:handleVerifyNewOtp,onResend:handleResendNewOtp,stepTitle:'Confirm New Email'})}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ══════════════ EDIT PROFILE MODAL ══════════════ */}
      <Modal visible={isEditing} animationType="slide" transparent={false}>
        <SafeAreaView style={st.editSafe}>
          <View style={st.editHeader}>
            <TouchableOpacity onPress={cancelEdit} style={st.editHeaderBack} hitSlop={{top:12,bottom:12,left:12,right:12}}>
              <Ionicons name="chevron-back" size={22} color={COLORS.navy}/>
            </TouchableOpacity>
            <Text style={st.editHeaderTitle}>Edit Profile</Text>
            <View style={{width:40}}/>
          </View>

          <ScrollView style={st.editScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator={false}>

            <EditSectionLabel icon="person-outline">Personal Information</EditSectionLabel>

            {[{name:'first_name',label:'First Name *',max:50},{name:'last_name',label:'Last Name *',max:50},{name:'middle_name',label:'Middle Name',max:50},{name:'suffix',label:'Suffix (e.g. Jr., III)',max:5}].map(f=>(
              <View key={f.name} style={st.formGroup}>
                <Text style={st.formLabel}>{f.label}</Text>
                <TextInput style={[st.input,errors[f.name]&&st.inputErr]} placeholder={`Enter ${f.label.replace(' *','')}`} placeholderTextColor={COLORS.gray300} value={formData[f.name]} onChangeText={v=>onChange(f.name,v)} maxLength={f.max} editable={!isSaving}/>
                {errors[f.name]?<Text style={st.errTxt}>{errors[f.name]}</Text>:null}
              </View>
            ))}

            <View style={st.formGroup}>
              <Text style={st.formLabel}>Date of Birth</Text>
              <View style={st.readOnly}>
                <Ionicons name="calendar-outline" size={17} color={COLORS.gray300} style={{marginRight:8}}/>
                <Text style={st.readOnlyTxt}>{formData.date_of_birth?new Date(formData.date_of_birth).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}):'Not set'}</Text>
                <View style={st.readOnlyBadge}><Text style={st.readOnlyBadgeTxt}>Read-only</Text></View>
              </View>
              <Text style={st.hint}>Contact admin to update.</Text>
            </View>

            <View style={st.formGroup}>
              <Text style={st.formLabel}>Gender</Text>
              <View style={st.genderRow}>
                {['Male','Female'].map(g=>(
                  <TouchableOpacity key={g} style={[st.genderBtn,formData.gender===g&&st.genderBtnOn]} onPress={()=>onChange('gender',g)}>
                    <Ionicons name={g==='Male'?'male':'female'} size={15} color={formData.gender===g?COLORS.navy:COLORS.gray400}/>
                    <Text style={[st.genderTxt,formData.gender===g&&st.genderTxtOn]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <EditSectionLabel icon="call-outline">Contact Information</EditSectionLabel>

            <View style={st.formGroup}>
              <Text style={st.formLabel}>Phone Number</Text>
              <View style={[st.phoneRow,errors.phone&&st.phoneRowErr,phoneChanged&&st.phoneRowActive]}>
                <Text style={st.phonePrefix}>+63</Text>
                <TextInput style={st.phoneInput} placeholder={originalFormData.phone?V.maskPhone(originalFormData.phone):'9XXXXXXXXX'} placeholderTextColor={COLORS.gray300} value={formData.phone} onChangeText={v=>onPhone('phone',v)} maxLength={10} keyboardType="phone-pad" editable={!isSaving}/>
              </View>
              <Text style={[st.hint,phoneChanged&&st.hintActive]}>{phoneChanged?'New number will replace current on save':'Leave blank to keep current number'}</Text>
              {errors.phone?<Text style={st.errTxt}>{errors.phone}</Text>:null}
            </View>

            <View style={st.formGroup}>
              <Text style={st.formLabel}>Alternate Phone</Text>
              <View style={[st.phoneRow,errors.alternate_phone&&st.phoneRowErr,altPhoneChanged&&st.phoneRowActive]}>
                <Text style={st.phonePrefix}>+63</Text>
                <TextInput style={st.phoneInput} placeholder={originalFormData.alternate_phone?V.maskPhone(originalFormData.alternate_phone):'Optional'} placeholderTextColor={COLORS.gray300} value={formData.alternate_phone} onChangeText={v=>onPhone('alternate_phone',v)} maxLength={10} keyboardType="phone-pad" editable={!isSaving}/>
              </View>
              {errors.alternate_phone?<Text style={st.errTxt}>{errors.alternate_phone}</Text>:null}
            </View>

            <View style={st.formGroup}>
              <Text style={st.formLabel}>Email Address</Text>
              <View style={st.readOnly}>
                <Ionicons name="mail-outline" size={17} color={COLORS.gray300} style={{marginRight:8}}/>
                <Text style={st.readOnlyTxt}>{V.maskEmail(originalFormData.email)||'—'}</Text>
                <View style={st.readOnlyBadge}><Text style={st.readOnlyBadgeTxt}>Use Update Email</Text></View>
              </View>
              <Text style={st.hint}>Use "Update Email" on your profile to change email.</Text>
            </View>

            <EditSectionLabel icon="location-outline">Address Information</EditSectionLabel>

            <Dropdown id="region"       label="Region *"              value={formData.region_code}       items={regions}        onSelect={onRegion}       loading={psgcLoading.regions}        disabled={false}                        error={errors.region_code}/>
            <Dropdown id="province"     label="Province *"            value={formData.province_code}     items={provinces}      onSelect={onProvince}     loading={psgcLoading.provinces}      disabled={!formData.region_code}        error={errors.province_code}/>
            <Dropdown id="municipality" label="City / Municipality *" value={formData.municipality_code} items={municipalities} onSelect={onMunicipality} loading={psgcLoading.municipalities} disabled={!formData.province_code}     error={errors.municipality_code}/>
            <Dropdown id="barangay"     label="Barangay *"            value={formData.barangay_code}     items={barangays}      onSelect={onBarangay}     loading={psgcLoading.barangays}      disabled={!formData.municipality_code}  error={errors.barangay_code}/>

            <View style={[st.formGroup,{zIndex:5}]}>
              <Text style={st.formLabel}>Address Line (Optional)</Text>
              <TextInput style={[st.input,st.textarea,errors.address_line&&st.inputErr]} placeholder="House/Unit No., Street, Subdivision, etc." placeholderTextColor={COLORS.gray300} value={formData.address_line} onChangeText={v=>onChange('address_line',v)} maxLength={255} multiline numberOfLines={4} editable={!isSaving}/>
              <Text style={st.counter}>{(formData.address_line||'').length}/255</Text>
              {errors.address_line?<Text style={st.errTxt}>{errors.address_line}</Text>:null}
            </View>

            <View style={st.editBtnRow}>
              <TouchableOpacity style={[st.solidBtn,{flex:1},isSaving&&{opacity:0.6}]} onPress={onSavePress} disabled={isSaving}>
                <Ionicons name="checkmark" size={18} color={COLORS.white}/>
                <Text style={st.solidBtnTxt}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.outlineBtn,{flex:1}]} onPress={cancelEdit} disabled={isSaving}>
                <Text style={st.outlineBtnTxt}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={{height:40}}/>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Photo picker sheet */}
      <Modal visible={showPhotoModal} animationType="slide" transparent>
        <View style={st.photoOverlay}>
          <View style={st.photoSheet}>
            <View style={st.photoSheetHandle}/>
            <Text style={st.photoSheetTitle}>Update Profile Photo</Text>
            <TouchableOpacity style={st.photoOpt} onPress={takeWithCamera}>
              <View style={st.photoOptIcon}><Ionicons name="camera" size={26} color={COLORS.navy}/></View>
              <View>
                <Text style={st.photoOptTxt}>Take a Photo</Text>
                <Text style={st.photoOptSub}>Use your camera</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={st.photoOpt} onPress={pickFromGallery}>
              <View style={st.photoOptIcon}><Ionicons name="image" size={26} color={COLORS.navy}/></View>
              <View>
                <Text style={st.photoOptTxt}>Choose from Gallery</Text>
                <Text style={st.photoOptSub}>Pick an existing photo</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={st.photoCancelBtn} onPress={()=>setShowPhotoModal(false)}>
              <Text style={st.photoCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LoadingOverlay visible={isSaving}       message="Saving your profile…"/>
      <LoadingOverlay visible={uploadingPhoto} message="Uploading photo…"/>
      <ConfirmModal
        visible={confirm.visible} title={confirm.title} message={confirm.message}
        onConfirm={confirm.onConfirm} onCancel={hideConfirm}
        confirmText={confirm.confirmText} confirmColor={confirm.confirmColor}/>
    </SafeAreaView>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────────
function ActionBtn({icon,label,onPress}) {
  return (
    <TouchableOpacity style={st.actionBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={st.actionIconWrap}>
        <Ionicons name={icon} size={22} color={COLORS.navy}/>
      </View>
      <Text style={st.actionBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoSection({title,icon,children}) {
  return (
    <View style={st.section}>
      <View style={st.sectionHeader}>
        <View style={st.sectionIconWrap}>
          <Ionicons name={icon} size={13} color={COLORS.navy}/>
        </View>
        <Text style={st.sectionTitle}>{title}</Text>
      </View>
      <View style={st.sectionBody}>{children}</View>
    </View>
  );
}

function InfoGrid({children}) { return <View style={st.infoGrid}>{children}</View>; }

function InfoItem({label,value,full=false}) {
  return (
    <View style={full?st.infoItemFull:st.infoItemHalf}>
      <Text style={st.infoLabel}>{label}</Text>
      <Text style={st.infoValue} numberOfLines={full?2:1}>{value||'—'}</Text>
    </View>
  );
}

function EditSectionLabel({icon,children}) {
  return (
    <View style={st.editSectionLabelRow}>
      <View style={st.editSectionLabelIcon}>
        <Ionicons name={icon} size={13} color={COLORS.navy}/>
      </View>
      <Text style={st.editSectionLabel}>{children}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL MODAL STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const em = StyleSheet.create({
  safe:           { flex:1, backgroundColor:COLORS.gray50 },
  header:         { flexDirection:'row', alignItems:'center', backgroundColor:COLORS.navy, paddingHorizontal:16, paddingVertical:14 },
  headerBtn:      { width:44, alignItems:'flex-start' },
  headerBtnInner: { width:34, height:34, borderRadius:17, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },
  headerCenter:   { flex:1, alignItems:'center' },
  headerTitle:    { fontSize:17, fontWeight:'800', color:COLORS.white, letterSpacing:-0.3 },
  headerSub:      { fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:2, fontWeight:'500' },
  progressWrap:   { paddingHorizontal:20, paddingTop:14, paddingBottom:6 },
  scrollContent:  { padding:20 },

  centerBox:      { alignItems:'center', paddingVertical:32 },
  centerTxt:      { fontSize:13, color:COLORS.gray400, marginTop:16, fontWeight:'500' },

  // Status card
  statusCard:     { alignItems:'center', paddingVertical:28, paddingHorizontal:4 },
  statusIcon:     { width:88, height:88, borderRadius:44, alignItems:'center', justifyContent:'center', marginBottom:20 },
  statusTitle:    { fontSize:20, fontWeight:'800', color:COLORS.gray900, marginBottom:10, textAlign:'center', letterSpacing:-0.3 },
  statusMsg:      { fontSize:14, color:COLORS.gray500, textAlign:'center', lineHeight:22, marginBottom:8, paddingHorizontal:4 },

  timeBadge:      { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:COLORS.navyLight, borderWidth:1, borderColor:`${COLORS.navy}22`, borderRadius:20, paddingHorizontal:14, paddingVertical:8, marginTop:12 },
  timeBadgeTxt:   { fontSize:13, color:COLORS.gray500, fontWeight:'500' },

  // Step header
  stepHeader:     { flexDirection:'row', alignItems:'flex-start', gap:14, marginBottom:20 },
  stepIconWrap:   { width:48, height:48, borderRadius:24, backgroundColor:COLORS.navyLight, alignItems:'center', justifyContent:'center' },
  stepTitle:      { fontSize:16, fontWeight:'800', color:COLORS.gray900, marginBottom:4 },
  stepSub:        { fontSize:13, color:COLORS.gray500, lineHeight:18 },

  // Field card
  fieldCard:      { backgroundColor:COLORS.white, borderRadius:16, padding:18, marginBottom:16, shadowColor:COLORS.navy, shadowOffset:{width:0,height:2}, shadowOpacity:0.06, shadowRadius:10, elevation:3, borderWidth:1, borderColor:COLORS.gray100 },
  fieldLabel:     { fontSize:10, fontWeight:'800', color:COLORS.gray400, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 },
  inputRow:       { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor:COLORS.gray200, borderRadius:13, backgroundColor:COLORS.gray50, paddingHorizontal:14 },
  inputRowErr:    { borderColor:COLORS.danger, backgroundColor:COLORS.dangerLight },
  inputSolo:      { borderWidth:1.5, borderColor:COLORS.gray200, borderRadius:13, backgroundColor:COLORS.gray50, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:COLORS.gray900 },
  input:          { flex:1, fontSize:15, color:COLORS.gray900, paddingVertical:14 },
  eyeBtn:         { padding:8 },
  errTxt:         { color:COLORS.danger, fontSize:12, marginTop:6, fontWeight:'500' },

  // Buttons
  primaryBtn:     { flexDirection:'row', backgroundColor:COLORS.navy, borderRadius:14, paddingVertical:15, alignItems:'center', justifyContent:'center', gap:8, marginTop:16, shadowColor:COLORS.navy, shadowOffset:{width:0,height:5}, shadowOpacity:0.28, shadowRadius:10, elevation:5 },
  primaryBtnOff:  { opacity:0.4, shadowOpacity:0 },
  primaryBtnTxt:  { fontSize:15, fontWeight:'800', color:COLORS.white, letterSpacing:-0.2 },
  backBtn:        { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:4, marginTop:12, paddingVertical:8 },
  backBtnTxt:     { fontSize:13, color:COLORS.gray500, fontWeight:'600' },

  // Info box (OTP step)
  infoBox:        { flexDirection:'row', alignItems:'flex-start', backgroundColor:'#EFF6FF', borderRadius:14, padding:14, marginBottom:12, gap:12, borderWidth:1, borderColor:'#BFDBFE' },
  infoIconWrap:   { width:36, height:36, borderRadius:18, backgroundColor:COLORS.white, alignItems:'center', justifyContent:'center' },
  infoTitle:      { fontSize:14, color:COLORS.gray900, marginBottom:3, fontWeight:'500' },
  infoSub:        { fontSize:12, color:COLORS.gray500, lineHeight:17 },

  // Timer
  timerPill:      { flexDirection:'row', alignItems:'center', gap:7, backgroundColor:COLORS.navyLight, borderRadius:10, paddingVertical:10, paddingHorizontal:14, marginBottom:10, justifyContent:'center' },
  timerWarn:      { backgroundColor:COLORS.amberLight },
  timerExpired:   { backgroundColor:COLORS.dangerLight },
  timerTxt:       { fontSize:13, fontWeight:'700', color:COLORS.navy },

  // Error banner
  banner:         { flexDirection:'row', backgroundColor:COLORS.danger, borderRadius:13, padding:13, alignItems:'flex-start', marginBottom:10, gap:10 },
  bannerAmber:    { backgroundColor:COLORS.amber },
  bannerTxt:      { color:COLORS.white, fontSize:13, fontWeight:'600', flex:1, lineHeight:19 },

  // Resend
  resendWrap:     { alignItems:'center', marginTop:18, minHeight:36 },
  resendBtn:      { flexDirection:'row', alignItems:'center', gap:7, paddingVertical:11, paddingHorizontal:22, borderRadius:12, borderWidth:1.5, borderColor:COLORS.navy, backgroundColor:COLORS.navyLight },
  resendBtnTxt:   { fontSize:14, fontWeight:'700', color:COLORS.navy },
  resendExhausted:{ fontSize:13, color:COLORS.gray400, fontStyle:'italic' },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const st = StyleSheet.create({
  safe:      { flex:1, backgroundColor:COLORS.gray100 },
  scroll:    { flex:1 },
  center:    { flex:1, justifyContent:'center', alignItems:'center', gap:16, padding:24 },
  centerLbl: { fontSize:14, color:COLORS.gray400, fontWeight:'500' },
  emptyIconWrap: { width:88, height:88, borderRadius:44, backgroundColor:COLORS.gray100, alignItems:'center', justifyContent:'center' },
  emptyTitle:{ fontSize:18, fontWeight:'700', color:COLORS.gray900 },

  // ── HEADER ──
  header: {
    backgroundColor:COLORS.navy,
    paddingTop:36, paddingBottom:32, paddingHorizontal:20,
    alignItems:'center',
    borderBottomLeftRadius:32, borderBottomRightRadius:32,
    shadowColor:COLORS.navyDark, shadowOffset:{width:0,height:10}, shadowOpacity:0.35, shadowRadius:20, elevation:16,
    overflow:'hidden',
  },
  headerDecorCircle1: {
    position:'absolute', top:-50, right:-50,
    width:200, height:200, borderRadius:100,
    backgroundColor:'rgba(193,39,45,0.1)',
  },
  headerDecorCircle2: {
    position:'absolute', bottom:-60, left:-40,
    width:160, height:160, borderRadius:80,
    backgroundColor:'rgba(255,255,255,0.04)',
  },
  avatarWrap:     { position:'relative', marginBottom:16 },
  avatar:         { width:96, height:96, borderRadius:48, borderWidth:4, borderColor:COLORS.red },
  avatarPlaceholder: {
    width:96, height:96, borderRadius:48,
    backgroundColor:'rgba(255,255,255,0.15)',
    borderWidth:4, borderColor:COLORS.red,
    alignItems:'center', justifyContent:'center',
    shadowColor:COLORS.red, shadowOffset:{width:0,height:0}, shadowOpacity:0.4, shadowRadius:12, elevation:8,
  },
  avatarInitials: { fontSize:32, fontWeight:'800', color:COLORS.white, letterSpacing:1 },
  cameraOverlay:  {
    position:'absolute', bottom:2, right:2,
    width:28, height:28, borderRadius:14,
    backgroundColor:COLORS.red, alignItems:'center', justifyContent:'center',
    borderWidth:2.5, borderColor:COLORS.navy,
  },
  headerName:     { fontSize:20, fontWeight:'800', color:COLORS.white, letterSpacing:-0.4, textAlign:'center', marginBottom:10 },
  usernamePill:   {
    flexDirection:'row', alignItems:'center', gap:6,
    backgroundColor:'rgba(255,255,255,0.1)', borderRadius:20,
    paddingHorizontal:14, paddingVertical:6, marginBottom:12,
    borderWidth:1, borderColor:'rgba(255,255,255,0.15)',
  },
  usernameText:   { fontSize:13, color:'rgba(255,255,255,0.82)', fontWeight:'600', letterSpacing:0.3 },
  pillsRow:       { flexDirection:'row', flexWrap:'wrap', justifyContent:'center', gap:6 },
  rolePill:       { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:20, paddingHorizontal:12, paddingVertical:5, borderWidth:1, borderColor:'rgba(255,255,255,0.2)' },
  rolePillTxt:    { fontSize:12, color:'rgba(255,255,255,0.9)', fontWeight:'700' },
  rankPill:       { backgroundColor:COLORS.red, borderRadius:20, paddingHorizontal:12, paddingVertical:5 },
  rankPillTxt:    { fontSize:12, color:COLORS.white, fontWeight:'800', letterSpacing:0.3 },
  deptPill:       { backgroundColor:'rgba(255,255,255,0.1)', borderRadius:20, paddingHorizontal:12, paddingVertical:5, borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  deptPillTxt:    { fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:'500' },
  syncRow:        { flexDirection:'row', alignItems:'center', gap:6, marginTop:10 },
  syncTxt:        { fontSize:11, color:'rgba(255,255,255,0.55)', fontWeight:'500' },

  // ── ACTIONS ──
  actionSection:  { paddingHorizontal:16, paddingTop:20, paddingBottom:4 },
  actionRow:      { flexDirection:'row', gap:10, marginBottom:10 },
  actionBtn:      {
    flex:1, backgroundColor:COLORS.white, borderRadius:18,
    paddingVertical:18, paddingHorizontal:6, alignItems:'center', gap:10,
    shadowColor:COLORS.navy, shadowOffset:{width:0,height:2}, shadowOpacity:0.07, shadowRadius:10, elevation:3,
    borderWidth:1, borderColor:COLORS.gray100,
  },
  actionIconWrap: { width:46, height:46, borderRadius:23, backgroundColor:COLORS.navyLight, alignItems:'center', justifyContent:'center' },
  actionBtnTxt:   { fontSize:11, fontWeight:'700', color:COLORS.gray700, textAlign:'center', letterSpacing:0.1 },
  logoutBtn:      {
    flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10,
    backgroundColor:'#FFF9F9', borderRadius:14, paddingVertical:14,
    borderWidth:1.5, borderColor:COLORS.redLight,
    shadowColor:COLORS.red, shadowOffset:{width:0,height:1}, shadowOpacity:0.06, shadowRadius:6, elevation:2,
  },
  logoutBtnTxt:   { fontSize:14, fontWeight:'700', color:COLORS.red, letterSpacing:0.2 },

  // ── INFO SECTIONS ──
  section:        {
    backgroundColor:COLORS.white, marginHorizontal:16, marginTop:14, borderRadius:20, overflow:'hidden',
    shadowColor:COLORS.navy, shadowOffset:{width:0,height:2}, shadowOpacity:0.05, shadowRadius:10, elevation:2,
    borderWidth:1, borderColor:COLORS.gray100,
  },
  sectionHeader:  {
    flexDirection:'row', alignItems:'center', gap:10,
    paddingHorizontal:16, paddingTop:14, paddingBottom:12,
    backgroundColor:COLORS.gray50, borderBottomWidth:1, borderBottomColor:COLORS.gray100,
  },
  sectionIconWrap:{ width:28, height:28, borderRadius:14, backgroundColor:COLORS.navyLight, alignItems:'center', justifyContent:'center' },
  sectionTitle:   { fontSize:11, fontWeight:'800', color:COLORS.gray900, letterSpacing:0.5, textTransform:'uppercase' },
  sectionBody:    { paddingHorizontal:16, paddingTop:4, paddingBottom:10 },
  infoGrid:       { flexDirection:'row', flexWrap:'wrap' },
  infoFullRow:    { borderTopWidth:1, borderTopColor:COLORS.gray100 },
  infoItemHalf:   { width:'50%', paddingVertical:12, paddingRight:8 },
  infoItemFull:   { width:'100%', paddingVertical:12 },
  infoLabel:      { fontSize:10, fontWeight:'700', color:COLORS.gray400, letterSpacing:0.5, marginBottom:4, textTransform:'uppercase' },
  infoValue:      { fontSize:14, fontWeight:'600', color:COLORS.gray900, lineHeight:20 },

  // ── TOASTS ──
  toastWrap:      { position:'absolute', bottom:28, left:16, right:16 },
  toastOk:        { flexDirection:'row', backgroundColor:COLORS.green, paddingHorizontal:16, paddingVertical:13, borderRadius:16, alignItems:'center', gap:10, shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:0.15, shadowRadius:12, elevation:8 },
  toastErr:       { flexDirection:'row', backgroundColor:COLORS.danger, paddingHorizontal:16, paddingVertical:13, borderRadius:16, alignItems:'center', gap:10, shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:0.15, shadowRadius:12, elevation:8 },
  toastIconWrap:  { width:28, height:28, borderRadius:14, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center' },
  toastTxt:       { color:COLORS.white, fontSize:13, fontWeight:'600', flex:1 },

  // ── SHARED BUTTONS ──
  solidBtn:       { flexDirection:'row', backgroundColor:COLORS.navy, paddingVertical:15, borderRadius:14, alignItems:'center', justifyContent:'center', gap:8, shadowColor:COLORS.navy, shadowOffset:{width:0,height:5}, shadowOpacity:0.28, shadowRadius:10, elevation:5 },
  solidBtnTxt:    { color:COLORS.white, fontSize:15, fontWeight:'800', letterSpacing:-0.2 },
  outlineBtn:     { flexDirection:'row', backgroundColor:COLORS.white, borderWidth:1.5, borderColor:COLORS.gray200, paddingVertical:15, borderRadius:14, alignItems:'center', justifyContent:'center', gap:8 },
  outlineBtnTxt:  { color:COLORS.gray500, fontSize:15, fontWeight:'700' },

  // ── EDIT PROFILE MODAL ──
  editSafe:            { flex:1, backgroundColor:COLORS.gray50 },
  editHeader:          { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:14, backgroundColor:COLORS.white, borderBottomWidth:1, borderBottomColor:COLORS.gray100, shadowColor:COLORS.navy, shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:6, elevation:2 },
  editHeaderBack:      { width:40 },
  editHeaderTitle:     { fontSize:17, fontWeight:'800', color:COLORS.gray900, flex:1, textAlign:'center', letterSpacing:-0.3 },
  editScroll:          { flex:1, paddingHorizontal:16 },
  editBtnRow:          { flexDirection:'row', gap:10, marginTop:24 },
  editSectionLabelRow: { flexDirection:'row', alignItems:'center', gap:8, marginTop:26, marginBottom:14 },
  editSectionLabelIcon:{ width:26, height:26, borderRadius:13, backgroundColor:COLORS.navyLight, alignItems:'center', justifyContent:'center' },
  editSectionLabel:    { fontSize:11, fontWeight:'800', color:COLORS.navy, textTransform:'uppercase', letterSpacing:0.8 },

  // ── FORM FIELDS ──
  formGroup:        { marginBottom:14, position:'relative' },
  formLabel:        { fontSize:10, fontWeight:'800', color:COLORS.gray400, textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 },
  input:            { borderWidth:1.5, borderColor:COLORS.gray200, borderRadius:13, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:COLORS.gray900, backgroundColor:COLORS.gray50 },
  inputErr:         { borderColor:COLORS.danger, backgroundColor:COLORS.dangerLight },
  errTxt:           { color:COLORS.danger, fontSize:12, marginTop:5, fontWeight:'500' },
  hint:             { color:COLORS.gray400, fontSize:12, marginTop:5 },
  hintActive:       { color:COLORS.amber, fontWeight:'600' },
  textarea:         { textAlignVertical:'top', paddingTop:13, minHeight:90 },
  counter:          { fontSize:11, color:COLORS.gray300, marginTop:4, textAlign:'right' },
  readOnly:         { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor:COLORS.gray200, borderRadius:13, paddingHorizontal:14, paddingVertical:13, backgroundColor:COLORS.gray100 },
  readOnlyTxt:      { fontSize:15, color:COLORS.gray400, flex:1 },
  readOnlyBadge:    { backgroundColor:COLORS.gray300, borderRadius:6, paddingHorizontal:7, paddingVertical:2 },
  readOnlyBadgeTxt: { fontSize:10, fontWeight:'700', color:COLORS.white },
  genderRow:        { flexDirection:'row', gap:10 },
  genderBtn:        { flex:1, flexDirection:'row', paddingVertical:13, paddingHorizontal:12, borderWidth:1.5, borderColor:COLORS.gray200, borderRadius:13, backgroundColor:COLORS.gray50, alignItems:'center', justifyContent:'center', gap:6 },
  genderBtnOn:      { borderColor:COLORS.navy, backgroundColor:COLORS.navyLight },
  genderTxt:        { fontSize:14, fontWeight:'600', color:COLORS.gray400 },
  genderTxtOn:      { color:COLORS.navy },
  phoneRow:         { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor:COLORS.gray200, borderRadius:13, backgroundColor:COLORS.gray50, paddingHorizontal:14 },
  phoneRowErr:      { borderColor:COLORS.danger, backgroundColor:COLORS.dangerLight },
  phoneRowActive:   { borderColor:COLORS.amber, backgroundColor:'#FFFBEB' },
  phonePrefix:      { fontSize:15, fontWeight:'600', color:COLORS.gray400, marginRight:4 },
  phoneInput:       { flex:1, paddingVertical:13, fontSize:15, color:COLORS.gray900 },
  dropdown:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1.5, borderColor:COLORS.gray200, borderRadius:13, paddingHorizontal:14, paddingVertical:13, backgroundColor:COLORS.gray50 },
  dropdownErr:      { borderColor:COLORS.danger, backgroundColor:COLORS.dangerLight },
  dropdownOff:      { backgroundColor:COLORS.gray100, opacity:0.65 },
  dropdownTxt:      { fontSize:15, color:COLORS.gray900, fontWeight:'500', flex:1 },
  dropdownPlaceholder: { color:COLORS.gray300 },
  ddList:           { position:'absolute', top:52, left:0, right:0, backgroundColor:COLORS.white, borderWidth:1.5, borderColor:COLORS.gray200, borderRadius:14, zIndex:9999, elevation:20, shadowColor:COLORS.navy, shadowOffset:{width:0,height:6}, shadowOpacity:0.12, shadowRadius:12, overflow:'hidden' },
  ddItem:           { paddingHorizontal:14, paddingVertical:13, borderBottomWidth:1, borderBottomColor:COLORS.gray100 },
  ddItemOn:         { backgroundColor:COLORS.navyLight },
  ddItemTxt:        { fontSize:14, color:COLORS.gray900, fontWeight:'500' },
  ddItemTxtOn:      { color:COLORS.navy, fontWeight:'700' },
  ddLoader:         { paddingVertical:20, alignItems:'center', gap:8, flexDirection:'row', justifyContent:'center' },
  ddLoaderTxt:      { fontSize:12, color:COLORS.gray400 },

  // ── PHOTO PICKER ──
  photoOverlay:     { flex:1, backgroundColor:'rgba(7,29,71,0.6)', justifyContent:'flex-end' },
  photoSheet:       { backgroundColor:COLORS.white, borderTopLeftRadius:28, borderTopRightRadius:28, paddingHorizontal:20, paddingTop:16, paddingBottom:40 },
  photoSheetHandle: { width:40, height:4, borderRadius:2, backgroundColor:COLORS.gray200, alignSelf:'center', marginBottom:20 },
  photoSheetTitle:  { fontSize:17, fontWeight:'800', color:COLORS.gray900, textAlign:'center', marginBottom:20, letterSpacing:-0.2 },
  photoOpt:         { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:15, marginBottom:10, backgroundColor:COLORS.gray50, borderRadius:16, gap:14, borderWidth:1, borderColor:COLORS.gray100 },
  photoOptIcon:     { width:48, height:48, borderRadius:24, backgroundColor:COLORS.navyLight, alignItems:'center', justifyContent:'center' },
  photoOptTxt:      { fontSize:15, fontWeight:'700', color:COLORS.gray900 },
  photoOptSub:      { fontSize:12, color:COLORS.gray400, marginTop:2 },
  photoCancelBtn:   { marginTop:8, paddingVertical:15, borderRadius:14, backgroundColor:COLORS.white, borderWidth:1.5, borderColor:COLORS.gray200, alignItems:'center' },
  photoCancelTxt:   { fontSize:15, fontWeight:'700', color:COLORS.red },
});