// ================================================================================
// ProfileScreen.js
// All profile features + full email-change OTP flow matching web exactly:
//
// Email Change Flow (4-step, matches web ProfileSettings.jsx):
//   Step 1 — GET /users/email/status → blocked / sessionLocked / pwLocked / ok
//   Step 2 — POST /users/email/verify-password  (5 attempts → 15-min lock)
//   Step 3 — POST /users/email/request-old-otp  → OTP to current email
//             POST /users/email/verify-old-otp   (3 attempts, 3 resends, 2-min timer)
//   Step 4 — POST /users/email/request-new-otp  → OTP to new email
//             POST /users/email/verify-new-otp   (3 attempts, 3 resends, 2-min timer)
//   Save  — PUT  /users/profile/:id (email field sent, backend consumeSession)
//
// Security rules:
//   • 24h cooldown between email changes (DB-persisted)
//   • Resend only available AFTER OTP expires (no 60s timer)
//   • Max 3 resends per 15-min window (persists across modal close/reopen)
//   • 3 wrong OTP attempts + resends exhausted → 15-min full session lock
//   • Security notifications to both old and new email on change
//   • Status check on modal open (no form flash)
// ================================================================================
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, ActivityIndicator, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Modal, TextInput, Image,
} from 'react-native';

const BASE_URL      = 'http://localhost:5000';
const PSGC_API      = 'https://psgc.gitlab.io/api';
const POLL_INTERVAL = 15000;

// ── Validators ──────────────────────────────────────────────────────────────────
const V = {
  name:(v,f,max=50,req=true)=>{if(!v||!v.trim())return req?`${f} is required`:null;if(v.length>max)return `${f} must not exceed ${max} characters`;if(!/^[a-zA-Z\s'\-.]+$/.test(v.trim()))return `${f} can only contain letters, spaces, hyphens, apostrophes`;return null;},
  suffix:(v)=>{if(!v||!v.trim())return null;const t=v.trim().toLowerCase();if(t.length>5)return 'Suffix must not exceed 5 characters';if(t==='sr.'||t==='jr.'||/^[ivxlcdm]+$/.test(t))return null;return 'Suffix must be Sr., Jr., or Roman Numeral (e.g., III)';},
  phone:(v,f)=>{const c=v.replace(/\D/g,'');if(!c.length)return null;if(c.length!==10)return `${f} must be exactly 10 digits`;if(!c.startsWith('9'))return `${f} must start with 9`;return null;},
  email:(v)=>{if(!v||!v.trim())return 'Email is required';if(v.length>255)return 'Email must not exceed 255 characters';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))return 'Invalid email format';return null;},
  maskPhone:(p)=>{if(!p)return '';const d=p.replace(/\D/g,'').replace(/^63/,'');return d.length<3?'*'.repeat(d.length):'*'.repeat(d.length-3)+d.slice(-3);},
  maskEmail:(e)=>{if(!e)return '';const at=e.indexOf('@');if(at<0)return e;const local=e.slice(0,at),domain=e.slice(at);if(local.length<=1)return local+domain;if(local.length<=4)return local[0]+'*'.repeat(local.length-1)+domain;return local[0]+'*'.repeat(local.length-4)+local.slice(-3)+domain;},
};

// ── LoadingOverlay ───────────────────────────────────────────────────────────────
function LoadingOverlay({visible,message='Please wait...'}){
  if(!visible)return null;
  return(
    <Modal visible transparent animationType="fade">
      <View style={lo.overlay}><View style={lo.box}><ActivityIndicator size="large" color="#0a285c"/><Text style={lo.text}>{message}</Text></View></View>
    </Modal>
  );
}
const lo=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.45)',justifyContent:'center',alignItems:'center'},
  box:{backgroundColor:'#fff',borderRadius:14,paddingVertical:28,paddingHorizontal:36,alignItems:'center',gap:14,shadowColor:'#000',shadowOffset:{width:0,height:8},shadowOpacity:0.18,shadowRadius:16,elevation:10},
  text:{fontSize:14,fontWeight:'600',color:'#0a1628',textAlign:'center',maxWidth:200},
});

// ── ConfirmModal ─────────────────────────────────────────────────────────────────
function ConfirmModal({visible,title,message,onConfirm,onCancel,confirmText='Confirm',confirmColor='#0a285c'}){
  if(!visible)return null;
  return(
    <Modal visible transparent animationType="fade">
      <View style={cm.overlay}><View style={cm.box}><Text style={cm.title}>{title}</Text><Text style={cm.message}>{message}</Text><View style={cm.btnRow}><TouchableOpacity style={cm.cancelBtn} onPress={onCancel}><Text style={cm.cancelTxt}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[cm.confirmBtn,{backgroundColor:confirmColor}]} onPress={onConfirm}><Text style={cm.confirmTxt}>{confirmText}</Text></TouchableOpacity></View></View></View>
    </Modal>
  );
}
const cm=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.55)',justifyContent:'center',alignItems:'center',padding:24},
  box:{backgroundColor:'#fff',borderRadius:14,padding:24,width:'100%',maxWidth:340,shadowColor:'#000',shadowOffset:{width:0,height:8},shadowOpacity:0.2,shadowRadius:16,elevation:10},
  title:{fontSize:17,fontWeight:'700',color:'#0a1628',marginBottom:10,textAlign:'center'},
  message:{fontSize:14,color:'#6c757d',marginBottom:24,textAlign:'center',lineHeight:20},
  btnRow:{flexDirection:'row',gap:10},
  cancelBtn:{flex:1,paddingVertical:12,borderRadius:8,borderWidth:1.5,borderColor:'#dee2e6',alignItems:'center'},
  cancelTxt:{fontSize:14,fontWeight:'600',color:'#6c757d'},
  confirmBtn:{flex:1,paddingVertical:12,borderRadius:8,alignItems:'center'},
  confirmTxt:{fontSize:14,fontWeight:'700',color:'#fff'},
});

// ── OTP Boxes ────────────────────────────────────────────────────────────────────
function OtpBoxes({ values, onChange, disabled }) {
  const refs = [useRef(),useRef(),useRef(),useRef(),useRef(),useRef()];
  const handleChange = (val, idx) => {
    const digit = val.replace(/\D/g,'').slice(-1);
    onChange(idx, digit);
    if (digit && idx < 5) refs[idx+1].current?.focus();
  };
  const handleKey = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !values[idx] && idx > 0) {
      refs[idx-1].current?.focus(); onChange(idx-1,'');
    }
  };
  return (
    <View style={ob.row}>
      {values.map((v,i) => (
        <TextInput key={i} ref={refs[i]}
          style={[ob.box, disabled && ob.boxOff, v && ob.boxFilled]}
          value={v} maxLength={1} keyboardType="number-pad"
          onChangeText={val => handleChange(val,i)}
          onKeyPress={e => handleKey(e,i)}
          editable={!disabled} selectTextOnFocus />
      ))}
    </View>
  );
}
const ob = StyleSheet.create({
  row:      { flexDirection:'row', gap:10, justifyContent:'center', marginVertical:18 },
  box:      { width:46, height:56, borderWidth:2, borderColor:'#dee2e6', borderRadius:12, textAlign:'center', fontSize:22, fontWeight:'700', color:'#0a285c', backgroundColor:'#f8fafc' },
  boxFilled:{ borderColor:'#0a285c', backgroundColor:'#fff' },
  boxOff:   { backgroundColor:'#f0f0f0', borderColor:'#e0e0e0', color:'#adb5bd' },
});

// ═══════════════════════════════════════════════════════════════════════════════
export default function ProfileScreen({ navigation }) {

  // ── Profile state ───────────────────────────────────────────────────────────
  const [profileData,setProfileData]           = useState(null);
  const [formData,setFormData]                 = useState({first_name:'',last_name:'',middle_name:'',suffix:'',email:'',phone:'',alternate_phone:'',date_of_birth:'',gender:'Male',region_code:'',province_code:'',municipality_code:'',barangay_code:'',address_line:''});
  const [originalFormData,setOriginalFormData] = useState({});
  const [loading,setLoading]                   = useState(true);
  const [isSaving,setIsSaving]                 = useState(false);
  const [uploadingPhoto,setUploadingPhoto]     = useState(false);
  const [refreshing,setRefreshing]             = useState(false);
  const [isEditing,setIsEditing]               = useState(false);
  const [errors,setErrors]                     = useState({});
  const [successMsg,setSuccessMsg]             = useState('');
  const [errorMsg,setErrorMsg]                 = useState('');
  const [showPhotoModal,setShowPhotoModal]     = useState(false);
  const [showDropdown,setShowDropdown]         = useState(null);
  const [confirm,setConfirm]                   = useState({visible:false,title:'',message:'',onConfirm:null,confirmText:'Confirm',confirmColor:'#0a285c'});
  const showConfirm = (title,message,onConfirm,confirmText='Confirm',confirmColor='#0a285c') => setConfirm({visible:true,title,message,onConfirm,confirmText,confirmColor});
  const hideConfirm = () => setConfirm(p=>({...p,visible:false}));

  // ── PSGC ────────────────────────────────────────────────────────────────────
  const [regions,setRegions]               = useState([]);
  const [provinces,setProvinces]           = useState([]);
  const [municipalities,setMunicipalities] = useState([]);
  const [barangays,setBarangays]           = useState([]);
  const [psgcLoading,setPsgcLoading]       = useState({});
  const [resolvedAddr,setResolvedAddr]     = useState({region:'',province:'',municipality:'',barangay:''});

  // ── Dirty flags ──────────────────────────────────────────────────────────────
  const [phoneChanged,setPhoneChanged]       = useState(false);
  const [altPhoneChanged,setAltPhoneChanged] = useState(false);
  const [emailChanged,setEmailChanged]       = useState(false);

  // ── Polling ──────────────────────────────────────────────────────────────────
  const pollTimer   = useRef(null);
  const appStateRef = useRef(AppState.currentState);
  const lastEtag    = useRef(null);
  const isEditingRef= useRef(false);
  useEffect(()=>{ isEditingRef.current = isEditing; },[isEditing]);
  useEffect(()=>{ if(successMsg){ const t=setTimeout(()=>setSuccessMsg(''),5000); return()=>clearTimeout(t); } },[successMsg]);
  useEffect(()=>{ if(errorMsg){  const t=setTimeout(()=>setErrorMsg(''),5000);  return()=>clearTimeout(t); } },[errorMsg]);

  // ── Email Change Modal state ─────────────────────────────────────────────────
  // emailStep: 'checking'|'cooldown'|'session-locked'|'pw-locked'|'password'|
  //            'old-send'|'old-otp'|'new-email'|'new-otp'|'done'
  const [emailModalVisible,  setEmailModalVisible]  = useState(false);
  const [emailStep,          setEmailStep]          = useState('checking');
  const [emailPassword,      setEmailPassword]      = useState('');
  const [emailPasswordShow,  setEmailPasswordShow]  = useState(false);
  const [emailPasswordErr,   setEmailPasswordErr]   = useState('');
  const [emailPasswordLoading,setEmailPasswordLoading] = useState(false);
  const [emailCooldownHours, setEmailCooldownHours] = useState(0);
  const [emailLockedMins,    setEmailLockedMins]    = useState(0);   // pw-locked
  const [emailSessionMins,   setEmailSessionMins]   = useState(0);   // session-locked
  const [emailOldMasked,     setEmailOldMasked]     = useState('');
  const [emailNewAddress,    setEmailNewAddress]    = useState('');
  const [emailNewErr,        setEmailNewErr]        = useState('');
  const [emailModalLoading,  setEmailModalLoading]  = useState(false);

  // OTP old-email
  const [oldOtpValues,    setOldOtpValues]    = useState(['','','','','','']);
  const [oldOtpError,     setOldOtpError]     = useState('');
  const [oldOtpTimer,     setOldOtpTimer]     = useState(0);
  const [oldResendsLeft,  setOldResendsLeft]  = useState(3);
  const oldOtpTimerRef = useRef(null);

  // OTP new-email
  const [newOtpValues,    setNewOtpValues]    = useState(['','','','','','']);
  const [newOtpError,     setNewOtpError]     = useState('');
  const [newOtpTimer,     setNewOtpTimer]     = useState(0);
  const [newResendsLeft,  setNewResendsLeft]  = useState(3);
  const [newOtpMasked,    setNewOtpMasked]    = useState('');
  const newOtpTimerRef = useRef(null);

  // ── OTP timer helpers ────────────────────────────────────────────────────────
  const startTimer = (expiresAt, setTimer, timerRef) => {
    clearInterval(timerRef.current);
    const tick = () => {
      const secs = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimer(secs);
      if (secs <= 0) clearInterval(timerRef.current);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  };
  const formatTimer = secs => {
    const m = Math.floor(secs/60).toString().padStart(2,'0');
    const s = (secs%60).toString().padStart(2,'0');
    return `${m}:${s}`;
  };

  // ── Mount ─────────────────────────────────────────────────────────────────────
  useEffect(()=>{
    loadProfile(true); startPolling();
    const sub = AppState.addEventListener('change', nextState => {
      if (appStateRef.current.match(/inactive|background/) && nextState==='active') silentRefresh();
      appStateRef.current = nextState;
    });
    return () => {
      stopPolling(); sub.remove();
      clearInterval(oldOtpTimerRef.current);
      clearInterval(newOtpTimerRef.current);
    };
  },[]);

  const startPolling = () => { stopPolling(); pollTimer.current = setInterval(()=>{ if(!isEditingRef.current) silentRefresh(); }, POLL_INTERVAL); };
  const stopPolling  = () => { if(pollTimer.current){ clearInterval(pollTimer.current); pollTimer.current=null; } };

  const silentRefresh = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      setRefreshing(true);
      const res  = await fetch(`${BASE_URL}/users/profile`,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
      if (res.status===401){ stopPolling(); await AsyncStorage.clear(); navigation.reset({index:0,routes:[{name:'Login'}]}); return; }
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success||!json.user) return;
      const newStr = JSON.stringify(json.user);
      if (newStr===lastEtag.current) return;
      lastEtag.current = newStr;
      await AsyncStorage.setItem('user',JSON.stringify(json.user));
      applyToState(json.user);
      await resolveAddressNames(json.user);
    } catch(_){} finally { setRefreshing(false); }
  };

  const loadProfile = async (showSpinner=false) => {
    try {
      if (showSpinner) setLoading(true);
      const token = await AsyncStorage.getItem('token');
      if (!token){ setLoading(false); return; }
      const res  = await fetch(`${BASE_URL}/users/profile`,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
      if (res.status===401){ await AsyncStorage.clear(); navigation.reset({index:0,routes:[{name:'Login'}]}); return; }
      const json = await res.json();
      if (res.ok && json.success && json.user){
        lastEtag.current = JSON.stringify(json.user);
        await AsyncStorage.setItem('user',JSON.stringify(json.user));
        applyToState(json.user);
        await resolveAddressNames(json.user);
      } else {
        const cached = await AsyncStorage.getItem('user');
        if (cached){ const u=JSON.parse(cached); applyToState(u); await resolveAddressNames(u); }
        setErrorMsg(json.message||'Could not load profile');
      }
    } catch(e){
      console.error('loadProfile:',e);
      try{ const cached=await AsyncStorage.getItem('user'); if(cached){ const u=JSON.parse(cached); applyToState(u); await resolveAddressNames(u); } }catch(_){}
      setErrorMsg('Network error - showing cached data');
    } finally { setLoading(false); }
  };

  const applyToState = u => {
    const phone    = u.phone           ? u.phone.replace(/^\+63/,'')           : '';
    const altPhone = u.alternate_phone ? u.alternate_phone.replace(/^\+63/,'') : '';
    const fv = {first_name:u.first_name||'',last_name:u.last_name||'',middle_name:u.middle_name||'',suffix:u.suffix||'',date_of_birth:u.date_of_birth?u.date_of_birth.split('T')[0]:'',gender:u.gender||'Male',phone,alternate_phone:altPhone,email:u.email||'',region_code:u.region_code||'',province_code:u.province_code||'',municipality_code:u.municipality_code||'',barangay_code:u.barangay_code||'',address_line:u.address_line||''};
    setProfileData(u); setFormData(fv); setOriginalFormData(fv);
  };

  // ── PSGC loaders ─────────────────────────────────────────────────────────────
  const loadRegions       = useCallback(async()=>{ setPsgcLoading(p=>({...p,regions:true})); let arr=[]; try{ const d=await(await fetch(`${PSGC_API}/regions/`)).json(); arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[]; setRegions(arr); }catch{} setPsgcLoading(p=>({...p,regions:false})); return arr; },[]);
  const loadProvinces     = useCallback(async rc=>{ if(!rc){setProvinces([]);setMunicipalities([]);setBarangays([]);return[];} setPsgcLoading(p=>({...p,provinces:true})); let arr=[]; try{ const d=await(await fetch(`${PSGC_API}/regions/${rc}/provinces/`)).json(); arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[]; setProvinces(arr); }catch{} setMunicipalities([]);setBarangays([]); setPsgcLoading(p=>({...p,provinces:false})); return arr; },[]);
  const loadMunicipalities= useCallback(async pc=>{ if(!pc){setMunicipalities([]);setBarangays([]);return[];} setPsgcLoading(p=>({...p,municipalities:true})); let arr=[]; try{ const d=await(await fetch(`${PSGC_API}/provinces/${pc}/cities-municipalities/`)).json(); arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[]; setMunicipalities(arr); }catch{} setBarangays([]); setPsgcLoading(p=>({...p,municipalities:false})); return arr; },[]);
  const loadBarangays     = useCallback(async mc=>{ if(!mc){setBarangays([]);return[];} setPsgcLoading(p=>({...p,barangays:true})); let arr=[]; try{ const d=await(await fetch(`${PSGC_API}/cities-municipalities/${mc}/barangays/`)).json(); arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[]; setBarangays(arr); }catch{} setPsgcLoading(p=>({...p,barangays:false})); return arr; },[]);

  const resolveAddressNames = async u => {
    if (u.region&&u.province){ setResolvedAddr({region:u.region||'',province:u.province||'',municipality:u.municipality||u.city||'',barangay:u.barangay||''}); return; }
    if (!u.region_code) return;
    try {
      const[rArr,pArr,mArr,bArr]=await Promise.all([
        fetch(`${PSGC_API}/regions/`).then(r=>r.json()).catch(()=>[]),
        u.region_code      ?fetch(`${PSGC_API}/regions/${u.region_code}/provinces/`).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
        u.province_code    ?fetch(`${PSGC_API}/provinces/${u.province_code}/cities-municipalities/`).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
        u.municipality_code?fetch(`${PSGC_API}/cities-municipalities/${u.municipality_code}/barangays/`).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
      ]);
      setResolvedAddr({
        region:     (Array.isArray(rArr)?rArr.find(x=>x.code===u.region_code)?.name:'')||'',
        province:   (Array.isArray(pArr)?pArr.find(x=>x.code===u.province_code)?.name:'')||'',
        municipality:(Array.isArray(mArr)?mArr.find(x=>x.code===u.municipality_code)?.name:'')||'',
        barangay:   (Array.isArray(bArr)?bArr.find(x=>x.code===u.barangay_code)?.name:'')||'',
      });
    } catch(e){ console.error('resolveAddressNames:',e); }
  };

  const resolveFromArrays = async (rc,pc,mc,bc) => {
    let bArr=barangays;
    const bMatch=bArr.find(x=>x.code===bc);
    if(!bMatch&&mc) bArr=await loadBarangays(mc);
    setResolvedAddr({
      region:      regions.find(x=>x.code===rc)?.name||'',
      province:    provinces.find(x=>x.code===pc)?.name||'',
      municipality:municipalities.find(x=>x.code===mc)?.name||'',
      barangay:    bArr.find(x=>x.code===bc)?.name||'',
    });
  };

  // ── Form validation ───────────────────────────────────────────────────────────
  const validate = () => {
    const e={};
    const fn=V.name(formData.first_name,'First name');if(fn)e.first_name=fn;
    const ln=V.name(formData.last_name,'Last name');if(ln)e.last_name=ln;
    if(formData.middle_name){const mn=V.name(formData.middle_name,'Middle name',50,false);if(mn)e.middle_name=mn;}
    const sf=V.suffix(formData.suffix);if(sf)e.suffix=sf;
    if(phoneChanged&&formData.phone){const pe=V.phone(formData.phone,'Phone');if(pe)e.phone=pe;}
    if(altPhoneChanged&&formData.alternate_phone){const ape=V.phone(formData.alternate_phone,'Alternate phone');if(ape)e.alternate_phone=ape;}
    const ep=phoneChanged?formData.phone:originalFormData.phone;
    const eap=altPhoneChanged?formData.alternate_phone:originalFormData.alternate_phone;
    if(ep&&eap&&ep.replace(/\D/g,'')==eap.replace(/\D/g,''))e.alternate_phone='Alternate phone cannot be same as primary';
    if((formData.address_line||'').length>255)e.address_line='Max 255 characters';
    if(!formData.region_code)e.region_code='Region is required';
    if(!formData.province_code)e.province_code='Province is required';
    if(!formData.municipality_code)e.municipality_code='City / Municipality is required';
    if(!formData.barangay_code)e.barangay_code='Barangay is required';
    setErrors(e); return Object.keys(e).length===0;
  };

  const onChange = (name,value) => {
    if(['first_name','last_name','middle_name'].includes(name)) value=value.replace(/[^a-zA-Z\s'\-.]/g,'').slice(0,50);
    else if(name==='suffix') value=value.replace(/[^ivxlcdmjrsr.\s]/gi,'').slice(0,5);
    else if(name==='address_line') value=value.slice(0,255);
    setFormData(p=>({...p,[name]:value}));
    if(errors[name]) setErrors(p=>{const n={...p};delete n[name];return n;});
  };
  const onPhone = (name,value) => {
    const d=value.replace(/\D/g,'').slice(0,10);
    setFormData(p=>({...p,[name]:d}));
    if(name==='phone') setPhoneChanged(d.length>0);
    if(name==='alternate_phone') setAltPhoneChanged(d.length>0);
    if(errors[name]) setErrors(p=>{const n={...p};delete n[name];return n;});
  };
  const onRegion       = async code=>{ setFormData(p=>({...p,region_code:code,province_code:'',municipality_code:'',barangay_code:''})); setShowDropdown(null); await loadProvinces(code); };
  const onProvince     = async code=>{ setFormData(p=>({...p,province_code:code,municipality_code:'',barangay_code:''})); setShowDropdown(null); await loadMunicipalities(code); };
  const onMunicipality = async code=>{ setFormData(p=>({...p,municipality_code:code,barangay_code:''})); setShowDropdown(null); await loadBarangays(code); };
  const onBarangay     =      code=>{ setFormData(p=>({...p,barangay_code:code})); setShowDropdown(null); };

  const startEdit = async () => {
    stopPolling();
    setFormData({...originalFormData,phone:'',alternate_phone:''});
    setPhoneChanged(false); setAltPhoneChanged(false); setEmailChanged(false);
    setErrors({}); setIsEditing(true);
    await loadRegions();
    if(originalFormData.region_code){
      await loadProvinces(originalFormData.region_code);
      if(originalFormData.province_code){
        await loadMunicipalities(originalFormData.province_code);
        if(originalFormData.municipality_code) await loadBarangays(originalFormData.municipality_code);
      }
    }
  };
  const cancelEdit = () => {
    setFormData(originalFormData); setErrors({});
    setPhoneChanged(false); setAltPhoneChanged(false); setEmailChanged(false);
    setIsEditing(false); startPolling();
  };

  const onSavePress = () => {
    if(!validate()){ setErrorMsg('Please fix the errors before saving.'); return; }
    showConfirm('Save Changes','Are you sure you want to save these changes to your profile?',()=>{ hideConfirm(); doSave(); },'Yes, Save');
  };

  const doSave = async () => {
    setIsSaving(true); setSuccessMsg(''); setErrorMsg('');
    try {
      const token = await AsyncStorage.getItem('token');
      if(!token){ setErrorMsg('Not authenticated'); setIsSaving(false); return; }
      const cap = s=>s?.trim().split(' ').map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join(' ');
      let fmt = {...formData};
      if(fmt.first_name)  fmt.first_name  = cap(fmt.first_name);
      if(fmt.last_name)   fmt.last_name   = cap(fmt.last_name);
      if(fmt.middle_name) fmt.middle_name = cap(fmt.middle_name);
      if(fmt.suffix){ const t=fmt.suffix.trim(); fmt.suffix=t.toLowerCase()==='sr.'?'Sr.':t.toLowerCase()==='jr.'?'Jr.':/^[ivxlcdm]+$/i.test(t)?t.toUpperCase():t; }
      fmt.phone           = phoneChanged&&fmt.phone    ?`+63${fmt.phone.trim()}`    :originalFormData.phone           ?`+63${originalFormData.phone}`:'';
      fmt.alternate_phone = altPhoneChanged&&fmt.alternate_phone?`+63${fmt.alternate_phone.trim()}`:originalFormData.alternate_phone?`+63${originalFormData.alternate_phone}`:'';
      // Email: only send if changed through the OTP flow (emailChanged flag)
      // The verified new email is picked up by the backend from the session
      fmt.email = (emailChanged&&fmt.email) ? fmt.email : (originalFormData.email||'');
      const fd = new FormData();
      ['first_name','last_name','middle_name','suffix','gender','email','phone','alternate_phone','region_code','province_code','municipality_code','barangay_code','address_line','date_of_birth'].forEach(k=>{
        if(fmt[k]!=null&&fmt[k].toString().trim()!=='') fd.append(k,fmt[k].toString());
      });
      const res  = await fetch(`${BASE_URL}/users/profile/${String(profileData.user_id)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:fd});
      const json = await res.json();
      if(!res.ok||!json.success){
        if(json.errors&&Array.isArray(json.errors)){ const be={}; json.errors.forEach(e=>{if(e.field)be[e.field]=e.message;}); if(Object.keys(be).length)setErrors(be); }
        setErrorMsg(json.message||'Failed to update profile'); setIsSaving(false); return;
      }
      await resolveFromArrays(fmt.region_code,fmt.province_code,fmt.municipality_code,fmt.barangay_code);
      const fresh = json.user||{...profileData,...fmt};
      lastEtag.current = JSON.stringify(fresh);
      await AsyncStorage.setItem('user',JSON.stringify(fresh));
      applyToState(fresh);
      setSuccessMsg('Profile updated successfully!');
      setIsEditing(false); setPhoneChanged(false); setAltPhoneChanged(false); setEmailChanged(false);
      startPolling();
    } catch(err){ console.error('doSave:',err); setErrorMsg('Network error. Check your connection.'); }
    finally { setIsSaving(false); }
  };

  // ── Photo ─────────────────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!perm.granted){ setErrorMsg('Gallery permission required'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8});
    if(!r.canceled&&r.assets[0]){ setShowPhotoModal(false); confirmUploadPhoto(r.assets[0].uri); }
  };
  const takeWithCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if(!perm.granted){ setErrorMsg('Camera permission required'); return; }
    const r = await ImagePicker.launchCameraAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8});
    if(!r.canceled&&r.assets[0]){ setShowPhotoModal(false); confirmUploadPhoto(r.assets[0].uri); }
  };
  const confirmUploadPhoto = uri => showConfirm('Update Profile Photo','Are you sure you want to update your profile photo?',()=>{ hideConfirm(); uploadPhoto(uri); },'Yes, Update');
  const uploadPhoto = async uri => {
    try {
      setUploadingPhoto(true);
      const token = await AsyncStorage.getItem('token');
      const fd = new FormData();
      if(Platform.OS==='web'){ const blob=await(await fetch(uri)).blob(); fd.append('profilePicture',blob,'profile.jpg'); }
      else { fd.append('profilePicture',{uri,type:'image/jpeg',name:'profile.jpg'}); }
      const res  = await fetch(`${BASE_URL}/users/profile/picture`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});
      const json = await res.json();
      if(!res.ok||!json.success){ setErrorMsg(json.message||'Failed to upload photo'); }
      else {
        const newPic = json.profile_picture;
        setProfileData(p=>({...p,profile_picture:newPic}));
        const cached = await AsyncStorage.getItem('user');
        if(cached){ const parsed=JSON.parse(cached); parsed.profile_picture=newPic; lastEtag.current=JSON.stringify(parsed); await AsyncStorage.setItem('user',JSON.stringify(parsed)); }
        setSuccessMsg('Profile photo updated!');
      }
    } catch(err){ console.error('uploadPhoto:',err); setErrorMsg('Error uploading photo. Check your connection.'); }
    finally { setUploadingPhoto(false); }
  };

  const logout = () => showConfirm('Logout','Are you sure you want to logout?',async()=>{ hideConfirm(); stopPolling(); await AsyncStorage.clear(); navigation.reset({index:0,routes:[{name:'Login'}]}); },'Logout','#c1272d');

  // ════════════════════════════════════════════════════════════════════════════
  // EMAIL CHANGE FLOW
  // ════════════════════════════════════════════════════════════════════════════

  const resetEmailModal = () => {
    setEmailPassword(''); setEmailPasswordShow(false); setEmailPasswordErr('');
    setEmailNewAddress(''); setEmailNewErr('');
    setOldOtpValues(['','','','','','']); setOldOtpError(''); setOldOtpTimer(0); setOldResendsLeft(3);
    setNewOtpValues(['','','','','','']); setNewOtpError(''); setNewOtpTimer(0); setNewResendsLeft(3);
    setNewOtpMasked(''); setEmailOldMasked('');
    clearInterval(oldOtpTimerRef.current); clearInterval(newOtpTimerRef.current);
  };

  const openEmailModal = async () => {
    resetEmailModal();
    setEmailModalVisible(true);
    setEmailStep('checking');
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/email/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.blocked)       { setEmailCooldownHours(d.hoursLeft ?? 0); setEmailStep('cooldown'); }
      else if (d.sessionLocked) { setEmailSessionMins(d.minsLeft ?? 15); setEmailStep('session-locked'); }
      else if (d.pwLocked) { setEmailLockedMins(d.minsLeft ?? 15); setEmailStep('pw-locked'); }
      else                 { setEmailStep('password'); }
    } catch {
      setEmailStep('password');
    }
  };

  const closeEmailModal = () => {
    setEmailModalVisible(false);
    clearInterval(oldOtpTimerRef.current);
    clearInterval(newOtpTimerRef.current);
  };

  // Step 2: Verify current password
  const handleEmailVerifyPassword = async () => {
    if (!emailPassword.trim()) { setEmailPasswordErr('Password is required'); return; }
    setEmailPasswordLoading(true); setEmailPasswordErr('');
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/email/verify-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: emailPassword }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.pwLocked)      { setEmailLockedMins(d.minutesLeft ?? 15); setEmailStep('pw-locked'); return; }
        if (d.blocked)       { setEmailCooldownHours(d.hoursLeft ?? 0); setEmailStep('cooldown'); return; }
        if (d.sessionLocked) { setEmailSessionMins(d.minutesLeft ?? 15); setEmailStep('session-locked'); return; }
        setEmailPasswordErr(d.message || 'Incorrect password');
        return;
      }
      setEmailStep('old-send');
    } catch {
      setEmailPasswordErr('Network error. Try again.');
    } finally {
      setEmailPasswordLoading(false);
    }
  };

  // Step 3a: Send OTP to old email
  const handleSendOldOtp = async () => {
    setEmailModalLoading(true); setOldOtpError('');
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/email/request-old-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked) { setEmailSessionMins(d.minutesLeft ?? 15); setEmailStep('session-locked'); return; }
        setOldOtpError(d.message || 'Failed to send code'); return;
      }
      setEmailOldMasked(d.maskedEmail || '');
      setOldResendsLeft(d.resendsLeft ?? 2);
      setOldOtpValues(['','','','','','']);
      setEmailStep('old-otp');
      if (d.otpExpiresAt) startTimer(d.otpExpiresAt, setOldOtpTimer, oldOtpTimerRef);
    } catch {
      setOldOtpError('Network error. Try again.');
    } finally {
      setEmailModalLoading(false);
    }
  };

  // Step 3b: Verify OTP from old email
  const handleVerifyOldOtp = async () => {
    const code = oldOtpValues.join('');
    if (code.length !== 6) { setOldOtpError('Please enter all 6 digits'); return; }
    setEmailModalLoading(true); setOldOtpError('');
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/email/verify-old-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: code }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked) { setEmailSessionMins(d.minutesLeft ?? 15); setEmailStep('session-locked'); return; }
        setOldOtpError(d.message || 'Incorrect code');
        setOldOtpValues(['','','','','','']);
        return;
      }
      clearInterval(oldOtpTimerRef.current);
      setEmailStep('new-email');
    } catch {
      setOldOtpError('Network error. Try again.');
    } finally {
      setEmailModalLoading(false);
    }
  };

  // Step 4a: Request OTP to new email
  const handleSendNewOtp = async () => {
    const err = V.email(emailNewAddress);
    if (err) { setEmailNewErr(err); return; }
    setEmailModalLoading(true); setEmailNewErr(''); setNewOtpError('');
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/email/request-new-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: emailNewAddress.trim().toLowerCase() }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked) { setEmailSessionMins(d.minutesLeft ?? 15); setEmailStep('session-locked'); return; }
        setEmailNewErr(d.message || 'Failed to send code'); return;
      }
      setNewOtpMasked(d.maskedEmail || '');
      setNewResendsLeft(d.resendsLeft ?? 2);
      setNewOtpValues(['','','','','','']);
      setEmailStep('new-otp');
      if (d.otpExpiresAt) startTimer(d.otpExpiresAt, setNewOtpTimer, newOtpTimerRef);
    } catch {
      setEmailNewErr('Network error. Try again.');
    } finally {
      setEmailModalLoading(false);
    }
  };

  // Step 4b: Verify OTP from new email
  const handleVerifyNewOtp = async () => {
    const code = newOtpValues.join('');
    if (code.length !== 6) { setNewOtpError('Please enter all 6 digits'); return; }
    setEmailModalLoading(true); setNewOtpError('');
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/email/verify-new-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: code }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked) { setEmailSessionMins(d.minutesLeft ?? 15); setEmailStep('session-locked'); return; }
        setNewOtpError(d.message || 'Incorrect code');
        setNewOtpValues(['','','','','','']);
        return;
      }
      clearInterval(newOtpTimerRef.current);
      // Save the verified email into profile
      await saveVerifiedEmail(emailNewAddress.trim().toLowerCase());
    } catch {
      setNewOtpError('Network error. Try again.');
    } finally {
      setEmailModalLoading(false);
    }
  };

  const saveVerifiedEmail = async newEmail => {
    setEmailModalLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const fd = new FormData();
      fd.append('email', newEmail);
      ['first_name','last_name','middle_name','suffix','gender','phone','alternate_phone',
       'region_code','province_code','municipality_code','barangay_code','address_line'].forEach(k => {
        const v = originalFormData[k];
        if (v != null && v.toString().trim() !== '') fd.append(k, v.toString());
      });
      if (originalFormData.phone)           fd.set('phone',           `+63${originalFormData.phone}`);
      if (originalFormData.alternate_phone) fd.set('alternate_phone', `+63${originalFormData.alternate_phone}`);

      const res  = await fetch(`${BASE_URL}/users/profile/${String(profileData.user_id)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:fd});
      const json = await res.json();
      if (!res.ok || !json.success) {
        setNewOtpError(json.message || 'Failed to save new email');
        return;
      }
      const fresh = json.user || { ...profileData, email: newEmail };
      lastEtag.current = JSON.stringify(fresh);
      await AsyncStorage.setItem('user', JSON.stringify(fresh));
      applyToState(fresh);
      setEmailStep('done');
    } catch {
      setNewOtpError('Network error saving email. Try again.');
    } finally {
      setEmailModalLoading(false);
    }
  };

  // ── OTP Resend helpers ────────────────────────────────────────────────────────
  const handleResendOldOtp = async () => {
    if (oldResendsLeft <= 0 || oldOtpTimer > 0) return;
    await handleSendOldOtp();
  };
  const handleResendNewOtp = async () => {
    if (newResendsLeft <= 0 || newOtpTimer > 0) return;
    await handleSendNewOtp();
  };

  // ── Progress dots ─────────────────────────────────────────────────────────────
  const EMAIL_STEPS = ['password','old-send','old-otp','new-email','new-otp','done'];
  const emailStepIdx = EMAIL_STEPS.indexOf(emailStep);

  // ── Dropdown component ────────────────────────────────────────────────────────
  const ZMAP = {region:4000,province:3000,municipality:2000,barangay:1000};
  const Dropdown = ({id,label,value,items,onSelect,loading:dLoad,disabled,error}) => (
    <View style={[st.formGroup,{zIndex:showDropdown===id?ZMAP[id]:10}]}>
      <Text style={st.formLabel}>{label}</Text>
      <TouchableOpacity style={[st.dropdown,error&&st.dropdownError,disabled&&st.dropdownDisabled]}
        onPress={()=>!disabled&&!isSaving&&setShowDropdown(showDropdown===id?null:id)} activeOpacity={0.7}>
        <Text style={[st.dropdownText,!value&&st.dropdownPlaceholder]}>{items.find(i=>i.code===value)?.name||`Select ${label.replace(' *','')}`}</Text>
        <Ionicons name={showDropdown===id?'chevron-up':'chevron-down'} size={20} color={disabled?'#adb5bd':'#0a285c'}/>
      </TouchableOpacity>
      {showDropdown===id&&(
        <View style={st.dropdownList}>
          {dLoad?(<View style={st.ddLoading}><ActivityIndicator size="small" color="#0a285c"/><Text style={st.ddLoadingText}>Loading...</Text></View>):(
            <ScrollView style={{maxHeight:200}} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {items.map(item=>(
                <TouchableOpacity key={item.code} style={[st.ddItem,value===item.code&&st.ddItemSelected]} onPress={()=>onSelect(item.code)}>
                  <Text style={[st.ddItemText,value===item.code&&st.ddItemTextSelected]}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
      {error?<Text style={st.errorText}>{error}</Text>:null}
    </View>
  );

  if(loading) return (<SafeAreaView style={st.container}><View style={st.center}><ActivityIndicator size="large" color="#0a285c"/><Text style={st.centerLabel}>Loading profile...</Text></View></SafeAreaView>);
  if(!profileData) return (<SafeAreaView style={st.container}><View style={st.center}><Ionicons name="person-circle-outline" size={64} color="#adb5bd"/><Text style={st.errorTitle}>No profile data</Text><TouchableOpacity style={[st.btn,{marginTop:16,paddingHorizontal:32}]} onPress={()=>navigation.reset({index:0,routes:[{name:'Login'}]})}><Text style={st.btnText}>Go to Login</Text></TouchableOpacity></View></SafeAreaView>);

  return (
    <SafeAreaView style={st.container}>
      <ScrollView style={st.content} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={st.header}>
          <View>
            <Text style={st.headerTitle}>My Profile</Text>
            <Text style={st.headerSub}>PNP Bacoor Officer</Text>
          </View>
          {refreshing && (<View style={st.syncBadge}><ActivityIndicator size="small" color="rgba(255,255,255,0.9)"/><Text style={st.syncTxt}>Syncing...</Text></View>)}
        </View>

        {/* Avatar card */}
        <View style={st.card}>
          <View style={st.avatarWrap}>
            {profileData.profile_picture
              ? <Image source={{uri:profileData.profile_picture}} style={st.avatarImg}/>
              : <View style={st.avatar}><Text style={st.avatarTxt}>{profileData.first_name?.[0]??''}{profileData.last_name?.[0]??''}</Text></View>
            }
          </View>
          <Text style={st.cardName}>{[profileData.first_name,profileData.middle_name,profileData.last_name,profileData.suffix].filter(Boolean).join(' ')||'Officer Name'}</Text>
          <Text style={st.cardRole}>{profileData.role||'Position'}</Text>
          {!!profileData.rank&&<Text style={st.cardRank}>{profileData.rank}</Text>}
          <TouchableOpacity style={[st.photoBtn,uploadingPhoto&&st.btnDisabled]} onPress={()=>!uploadingPhoto&&setShowPhotoModal(true)}>
            <Ionicons name="camera" size={16} color="#fff"/>
            <Text style={st.photoBtnTxt}>Update Photo</Text>
          </TouchableOpacity>
        </View>

        {/* Action buttons */}
        <View style={st.btnRow}>
          <TouchableOpacity style={[st.btn,{flex:1}]} onPress={startEdit}>
            <Ionicons name="create-outline" size={16} color="#fff"/>
            <Text style={st.btnText}>Edit Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.btnOutline,{flex:1}]} onPress={()=>navigation.navigate('ChangePassword')}>
            <Ionicons name="lock-closed-outline" size={16} color="#0a285c"/>
            <Text style={st.btnOutlineTxt}>Change Password</Text>
          </TouchableOpacity>
        </View>

        {/* Update Email button */}
        <View style={[st.btnRow,{marginTop:0}]}>
          <TouchableOpacity style={[st.btnOutline,{flex:1}]} onPress={openEmailModal}>
            <Ionicons name="mail-outline" size={16} color="#0a285c"/>
            <Text style={st.btnOutlineTxt}>Update Email</Text>
          </TouchableOpacity>
        </View>

        {/* Info sections */}
        <InfoSection title="Personal Information">
          <Row2><InfoItem label="FIRST NAME" value={profileData.first_name}/><InfoItem label="LAST NAME" value={profileData.last_name}/></Row2>
          <Row2><InfoItem label="MIDDLE NAME" value={profileData.middle_name}/><InfoItem label="SUFFIX" value={profileData.suffix}/></Row2>
          <Row2><InfoItem label="DATE OF BIRTH" value={profileData.date_of_birth?new Date(profileData.date_of_birth).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}):null}/><InfoItem label="GENDER" value={profileData.gender}/></Row2>
        </InfoSection>
        <InfoSection title="Contact Information">
          <Row2><InfoItem label="PHONE" value={profileData.phone?`+63 ${V.maskPhone(profileData.phone)}`:null}/><InfoItem label="ALT PHONE" value={profileData.alternate_phone?`+63 ${V.maskPhone(profileData.alternate_phone)}`:null}/></Row2>
          <InfoItem label="EMAIL" value={profileData.email?V.maskEmail(profileData.email):null} full/>
        </InfoSection>
        <InfoSection title="Address Information">
          <Row2><InfoItem label="REGION" value={resolvedAddr.region||profileData.region}/><InfoItem label="PROVINCE" value={resolvedAddr.province||profileData.province}/></Row2>
          <Row2><InfoItem label="CITY / MUNICIPALITY" value={resolvedAddr.municipality||profileData.municipality||profileData.city}/><InfoItem label="BARANGAY" value={resolvedAddr.barangay||profileData.barangay}/></Row2>
          {!!profileData.address_line&&<InfoItem label="ADDRESS LINE" value={profileData.address_line} full/>}
        </InfoSection>
        <InfoSection title="Official Information">
          <Row2><InfoItem label="ROLE" value={profileData.role}/><InfoItem label="RANK" value={profileData.rank}/></Row2>
          <Row2><InfoItem label="DEPARTMENT" value={profileData.department}/><InfoItem label="MOBILE PATROL NO" value={profileData.mobile_patrol}/></Row2>
        </InfoSection>

        <TouchableOpacity style={st.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#fff"/>
          <Text style={st.btnText}>Logout</Text>
        </TouchableOpacity>
        <View style={{height:20}}/>
      </ScrollView>

      {/* Toasts */}
      {!!successMsg&&<View style={st.toastWrap}><View style={[st.toast,st.toastOk]}><Ionicons name="checkmark-circle" size={20} color="#fff"/><Text style={st.toastTxt}>{successMsg}</Text></View></View>}
      {!!errorMsg&&<View style={st.toastWrap}><View style={[st.toast,st.toastErr]}><Ionicons name="close-circle" size={20} color="#fff"/><Text style={st.toastTxt}>{errorMsg}</Text></View></View>}

      {/* ════════════ EMAIL CHANGE MODAL ════════════ */}
      <Modal visible={emailModalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={em.container}>

          {/* Modal header */}
          <View style={em.header}>
            <TouchableOpacity onPress={closeEmailModal} style={em.headerSide}
              hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={em.headerTitle}>Update Email</Text>
            <View style={em.headerSide}/>
          </View>

          {/* Progress dots */}
          {!['checking','cooldown','session-locked','pw-locked','done'].includes(emailStep) && (
            <View style={em.dotsRow}>
              {EMAIL_STEPS.map((_, i) => (
                <View key={i} style={[em.dot, i <= emailStepIdx && em.dotOn]} />
              ))}
            </View>
          )}

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20}}>

            {/* ── CHECKING ── */}
            {emailStep === 'checking' && (
              <View style={em.centerBox}>
                <ActivityIndicator size="large" color="#0a285c"/>
                <Text style={em.centerTxt}>Checking availability…</Text>
              </View>
            )}

            {/* ── COOLDOWN (24h) ── */}
            {emailStep === 'cooldown' && (
              <View style={em.centerBox}>
                <View style={em.statusIcon}><Ionicons name="lock-closed" size={36} color="#0a285c"/></View>
                <Text style={em.statusTitle}>Email Change Unavailable</Text>
                <Text style={em.statusMsg}>You can only change your email once every 24 hours.</Text>
                {emailCooldownHours > 0 && <Text style={em.statusSub}>Try again in <Text style={{fontWeight:'700'}}>{emailCooldownHours} hour{emailCooldownHours!==1?'s':''}</Text>.</Text>}
                <TouchableOpacity style={[em.primaryBtn,{marginTop:24}]} onPress={closeEmailModal}><Text style={em.primaryBtnTxt}>Close</Text></TouchableOpacity>
              </View>
            )}

            {/* ── SESSION LOCKED ── */}
            {emailStep === 'session-locked' && (
              <View style={em.centerBox}>
                <View style={[em.statusIcon,{backgroundColor:'#fff3cd'}]}><Ionicons name="lock-closed" size={36} color="#c2410c"/></View>
                <Text style={em.statusTitle}>Update Email Unavailable</Text>
                <Text style={em.statusMsg}>For security reasons, this process has been temporarily locked.</Text>
                <Text style={em.statusSub}>Please try again after <Text style={{fontWeight:'700'}}>{emailSessionMins} minute{emailSessionMins!==1?'s':''}</Text>.</Text>
                <TouchableOpacity style={[em.primaryBtn,{marginTop:24}]} onPress={closeEmailModal}><Text style={em.primaryBtnTxt}>Close</Text></TouchableOpacity>
              </View>
            )}

            {/* ── PW LOCKED ── */}
            {emailStep === 'pw-locked' && (
              <View style={em.centerBox}>
                <View style={[em.statusIcon,{backgroundColor:'#fff3cd'}]}><Ionicons name="lock-closed" size={36} color="#c2410c"/></View>
                <Text style={em.statusTitle}>Update Email Unavailable</Text>
                <Text style={em.statusMsg}>Too many incorrect password attempts.</Text>
                <Text style={em.statusSub}>Please try again after <Text style={{fontWeight:'700'}}>{emailLockedMins} minute{emailLockedMins!==1?'s':''}</Text>.</Text>
                <TouchableOpacity style={[em.primaryBtn,{marginTop:24}]} onPress={closeEmailModal}><Text style={em.primaryBtnTxt}>Close</Text></TouchableOpacity>
              </View>
            )}

            {/* ── DONE ── */}
            {emailStep === 'done' && (
              <View style={em.centerBox}>
                <View style={[em.statusIcon,{backgroundColor:'#d1fae5'}]}><Ionicons name="checkmark" size={36} color="#059669"/></View>
                <Text style={[em.statusTitle,{color:'#059669'}]}>Email Updated!</Text>
                <Text style={em.statusMsg}>Your email address has been successfully changed.</Text>
                <Text style={em.statusMsg}>Security notifications have been sent to both your old and new email addresses.</Text>
                <TouchableOpacity style={[em.primaryBtn,{marginTop:24,backgroundColor:'#059669'}]} onPress={closeEmailModal}><Text style={em.primaryBtnTxt}>Done</Text></TouchableOpacity>
              </View>
            )}

            {/* ── STEP 1: Verify current password ── */}
            {emailStep === 'password' && (
              <View>
                <Text style={em.stepTitle}>Verify Your Identity</Text>
                <Text style={em.stepSub}>Enter your current password to continue.</Text>
                <Text style={em.fieldLabel}>CURRENT PASSWORD *</Text>
                <View style={[em.inputRow, emailPasswordErr && em.inputErr]}>
                  <TextInput
                    style={em.input}
                    placeholder="Enter your password"
                    placeholderTextColor="#adb5bd"
                    value={emailPassword}
                    onChangeText={v => { setEmailPassword(v); setEmailPasswordErr(''); }}
                    secureTextEntry={!emailPasswordShow}
                    autoCapitalize="none" autoCorrect={false}
                    editable={!emailPasswordLoading}
                  />
                  <TouchableOpacity onPress={()=>setEmailPasswordShow(v=>!v)} style={em.eyeBtn}>
                    <Ionicons name={emailPasswordShow?'eye':'eye-off'} size={20} color="#adb5bd"/>
                  </TouchableOpacity>
                </View>
                {emailPasswordErr ? <Text style={em.errTxt}>{emailPasswordErr}</Text> : null}
                <TouchableOpacity
                  style={[em.primaryBtn, (!emailPassword.trim()||emailPasswordLoading) && em.primaryBtnOff]}
                  onPress={handleEmailVerifyPassword}
                  disabled={!emailPassword.trim()||emailPasswordLoading}>
                  {emailPasswordLoading
                    ? <ActivityIndicator size="small" color="#fff"/>
                    : <Ionicons name="arrow-forward" size={18} color="#fff"/>}
                  <Text style={em.primaryBtnTxt}>{emailPasswordLoading?'Verifying…':'Verify Password →'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 2: Send OTP to old email ── */}
            {emailStep === 'old-send' && (
              <View style={em.centerBox}>
                <View style={em.statusIcon}><Ionicons name="mail" size={36} color="#0a285c"/></View>
                <Text style={em.statusTitle}>Verify Current Email</Text>
                <Text style={em.statusMsg}>We'll send a verification code to your current email address to confirm it's you.</Text>
                <TouchableOpacity
                  style={[em.primaryBtn, emailModalLoading && em.primaryBtnOff]}
                  onPress={handleSendOldOtp} disabled={emailModalLoading}>
                  {emailModalLoading
                    ? <ActivityIndicator size="small" color="#fff"/>
                    : <Ionicons name="send" size={16} color="#fff"/>}
                  <Text style={em.primaryBtnTxt}>{emailModalLoading?'Sending…':'Send Code to Current Email'}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 3: OTP from old email ── */}
            {emailStep === 'old-otp' && (
              <View>
                <View style={em.infoBox}>
                  <Ionicons name="mail" size={20} color="#1d4ed8" style={{marginTop:2}}/>
                  <View style={{flex:1}}>
                    <Text style={em.infoTitle}>Code sent to <Text style={{fontWeight:'700'}}>{emailOldMasked}</Text></Text>
                    <Text style={em.infoSub}>This code expires in <Text style={{fontWeight:'700'}}>2 minutes</Text>. Do not share it with anyone.</Text>
                  </View>
                </View>

                <View style={[em.timerBox, oldOtpTimer<=30&&oldOtpTimer>0&&em.timerWarn, oldOtpTimer===0&&em.timerExpired]}>
                  <Ionicons name="timer-outline" size={15} color={oldOtpTimer===0?'#842029':oldOtpTimer<=30?'#856404':'#0a285c'}/>
                  <Text style={[em.timerTxt, oldOtpTimer<=30&&oldOtpTimer>0&&{color:'#856404'}, oldOtpTimer===0&&{color:'#842029'}]}>
                    {oldOtpTimer>0?`Expires in ${formatTimer(oldOtpTimer)}`:'Code expired — request a new one'}
                  </Text>
                </View>

                {oldOtpError!==''&&<View style={em.banner}><Ionicons name="close-circle" size={18} color="#fff"/><Text style={em.bannerTxt}>{oldOtpError}</Text></View>}

                <OtpBoxes values={oldOtpValues}
                  onChange={(idx,val)=>setOldOtpValues(p=>{const n=[...p];n[idx]=val;return n;})}
                  disabled={emailModalLoading||oldOtpTimer===0}/>

                <TouchableOpacity
                  style={[em.primaryBtn,(oldOtpValues.join('').length!==6||emailModalLoading||oldOtpTimer===0)&&em.primaryBtnOff]}
                  onPress={handleVerifyOldOtp}
                  disabled={oldOtpValues.join('').length!==6||emailModalLoading||oldOtpTimer===0}>
                  {emailModalLoading?<ActivityIndicator size="small" color="#fff"/>:<Ionicons name="checkmark" size={18} color="#fff"/>}
                  <Text style={em.primaryBtnTxt}>{emailModalLoading?'Verifying…':'Verify Code'}</Text>
                </TouchableOpacity>

                <View style={em.resendWrap}>
                  {oldResendsLeft<=0
                    ?<Text style={em.resendExhausted}>No more resends available for this session</Text>
                    :oldOtpTimer>0
                      ?<Text style={em.resendWaiting}>Resend available after code expires</Text>
                      :<TouchableOpacity onPress={handleResendOldOtp} disabled={emailModalLoading}>
                         <Text style={em.resendLink}>{emailModalLoading?'Sending…':`Resend Code (${oldResendsLeft} left)`}</Text>
                       </TouchableOpacity>
                  }
                </View>
              </View>
            )}

            {/* ── STEP 4: Enter new email ── */}
            {emailStep === 'new-email' && (
              <View>
                <Text style={em.stepTitle}>Enter New Email</Text>
                <Text style={em.stepSub}>Enter the email address you want to use for your account.</Text>
                <Text style={em.fieldLabel}>NEW EMAIL ADDRESS *</Text>
                <TextInput
                  style={[em.inputSolo, emailNewErr && em.inputErr]}
                  placeholder="newaddress@example.com"
                  placeholderTextColor="#adb5bd"
                  value={emailNewAddress}
                  onChangeText={v=>{ setEmailNewAddress(v); setEmailNewErr(''); }}
                  keyboardType="email-address" autoCapitalize="none"
                  autoCorrect={false} editable={!emailModalLoading}
                />
                {emailNewErr?<Text style={em.errTxt}>{emailNewErr}</Text>:null}
                <TouchableOpacity
                  style={[em.primaryBtn,(!emailNewAddress.trim()||emailModalLoading)&&em.primaryBtnOff]}
                  onPress={handleSendNewOtp}
                  disabled={!emailNewAddress.trim()||emailModalLoading}>
                  {emailModalLoading?<ActivityIndicator size="small" color="#fff"/>:<Ionicons name="send" size={16} color="#fff"/>}
                  <Text style={em.primaryBtnTxt}>{emailModalLoading?'Sending…':'Send Code to New Email'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={em.backBtn} onPress={()=>setEmailStep('old-send')}>
                  <Text style={em.backBtnTxt}>← Back</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 5: OTP from new email ── */}
            {emailStep === 'new-otp' && (
              <View>
                <View style={em.infoBox}>
                  <Ionicons name="mail" size={20} color="#1d4ed8" style={{marginTop:2}}/>
                  <View style={{flex:1}}>
                    <Text style={em.infoTitle}>Code sent to <Text style={{fontWeight:'700'}}>{newOtpMasked}</Text></Text>
                    <Text style={em.infoSub}>This code expires in <Text style={{fontWeight:'700'}}>2 minutes</Text>. Do not share it with anyone.</Text>
                  </View>
                </View>

                <View style={[em.timerBox, newOtpTimer<=30&&newOtpTimer>0&&em.timerWarn, newOtpTimer===0&&em.timerExpired]}>
                  <Ionicons name="timer-outline" size={15} color={newOtpTimer===0?'#842029':newOtpTimer<=30?'#856404':'#0a285c'}/>
                  <Text style={[em.timerTxt, newOtpTimer<=30&&newOtpTimer>0&&{color:'#856404'}, newOtpTimer===0&&{color:'#842029'}]}>
                    {newOtpTimer>0?`Expires in ${formatTimer(newOtpTimer)}`:'Code expired — request a new one'}
                  </Text>
                </View>

                {newOtpError!==''&&<View style={em.banner}><Ionicons name="close-circle" size={18} color="#fff"/><Text style={em.bannerTxt}>{newOtpError}</Text></View>}

                <OtpBoxes values={newOtpValues}
                  onChange={(idx,val)=>setNewOtpValues(p=>{const n=[...p];n[idx]=val;return n;})}
                  disabled={emailModalLoading||newOtpTimer===0}/>

                <TouchableOpacity
                  style={[em.primaryBtn,(newOtpValues.join('').length!==6||emailModalLoading||newOtpTimer===0)&&em.primaryBtnOff]}
                  onPress={handleVerifyNewOtp}
                  disabled={newOtpValues.join('').length!==6||emailModalLoading||newOtpTimer===0}>
                  {emailModalLoading?<ActivityIndicator size="small" color="#fff"/>:<Ionicons name="checkmark" size={18} color="#fff"/>}
                  <Text style={em.primaryBtnTxt}>{emailModalLoading?'Saving…':'Confirm New Email'}</Text>
                </TouchableOpacity>

                <View style={em.resendWrap}>
                  {newResendsLeft<=0
                    ?<Text style={em.resendExhausted}>No more resends available for this session</Text>
                    :newOtpTimer>0
                      ?<Text style={em.resendWaiting}>Resend available after code expires</Text>
                      :<TouchableOpacity onPress={handleResendNewOtp} disabled={emailModalLoading}>
                         <Text style={em.resendLink}>{emailModalLoading?'Sending…':`Resend Code (${newResendsLeft} left)`}</Text>
                       </TouchableOpacity>
                  }
                </View>
              </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ════════ EDIT PROFILE MODAL ════════ */}
      <Modal visible={isEditing} animationType="slide" transparent={false}>
        <SafeAreaView style={st.modalWrap}>
          <View style={st.modalHeader}>
            <TouchableOpacity onPress={cancelEdit} hitSlop={{top:10,bottom:10,left:10,right:10}}><Ionicons name="chevron-back" size={24} color="#0a285c"/></TouchableOpacity>
            <Text style={st.modalTitle}>Edit Profile</Text>
            <View style={{width:40}}/>
          </View>
          <ScrollView style={st.modalScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            <SectionTitle>Personal Information</SectionTitle>
            {[{name:'first_name',label:'First Name *',max:50},{name:'last_name',label:'Last Name *',max:50},{name:'middle_name',label:'Middle Name',max:50},{name:'suffix',label:'Suffix (e.g. Jr., III)',max:5}].map(f=>(
              <View key={f.name} style={st.formGroup}>
                <Text style={st.formLabel}>{f.label}</Text>
                <TextInput style={[st.input,errors[f.name]&&st.inputErr]} placeholder={`Enter ${f.label.replace(' *','')}`} value={formData[f.name]} onChangeText={v=>onChange(f.name,v)} maxLength={f.max} editable={!isSaving}/>
                {errors[f.name]?<Text style={st.errorText}>{errors[f.name]}</Text>:null}
              </View>
            ))}
            <View style={st.formGroup}>
              <Text style={st.formLabel}>Date of Birth</Text>
              <View style={st.readOnly}><Ionicons name="calendar-outline" size={18} color="#adb5bd" style={{marginRight:8}}/><Text style={st.readOnlyTxt}>{formData.date_of_birth?new Date(formData.date_of_birth).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}):'Not set'}</Text><Text style={st.readOnlyBadge}>Read-only</Text></View>
              <Text style={st.hint}>Contact admin to update date of birth.</Text>
            </View>
            <View style={st.formGroup}>
              <Text style={st.formLabel}>Gender</Text>
              <View style={st.genderRow}>
                {['Male','Female'].map(g=>(<TouchableOpacity key={g} style={[st.genderBtn,formData.gender===g&&st.genderBtnOn]} onPress={()=>onChange('gender',g)}><Ionicons name={g==='Male'?'male':'female'} size={16} color={formData.gender===g?'#0a285c':'#6c757d'} style={{marginRight:4}}/><Text style={[st.genderTxt,formData.gender===g&&st.genderTxtOn]}>{g}</Text></TouchableOpacity>))}
              </View>
            </View>
            <SectionTitle>Contact Information</SectionTitle>
            <View style={st.formGroup}>
              <Text style={st.formLabel}>Phone Number</Text>
              <View style={[st.phoneRow,errors.phone&&st.phoneRowErr,phoneChanged&&st.phoneRowActive]}><Text style={st.phonePrefix}>+63</Text><TextInput style={st.phoneInput} placeholder={originalFormData.phone?V.maskPhone(originalFormData.phone):'9XXXXXXXXX'} value={formData.phone} onChangeText={v=>onPhone('phone',v)} maxLength={10} keyboardType="phone-pad" editable={!isSaving}/></View>
              <Text style={[st.hint,phoneChanged&&st.hintActive]}>{phoneChanged?'New number will replace current on save':'Leave blank to keep current number'}</Text>
              {errors.phone?<Text style={st.errorText}>{errors.phone}</Text>:null}
            </View>
            <View style={st.formGroup}>
              <Text style={st.formLabel}>Alternate Phone</Text>
              <View style={[st.phoneRow,errors.alternate_phone&&st.phoneRowErr,altPhoneChanged&&st.phoneRowActive]}><Text style={st.phonePrefix}>+63</Text><TextInput style={st.phoneInput} placeholder={originalFormData.alternate_phone?V.maskPhone(originalFormData.alternate_phone):'Optional'} value={formData.alternate_phone} onChangeText={v=>onPhone('alternate_phone',v)} maxLength={10} keyboardType="phone-pad" editable={!isSaving}/></View>
              {originalFormData.alternate_phone&&<Text style={[st.hint,altPhoneChanged&&st.hintActive]}>{altPhoneChanged?'New number will replace current on save':'Leave blank to keep current number'}</Text>}
              {errors.alternate_phone?<Text style={st.errorText}>{errors.alternate_phone}</Text>:null}
            </View>
            <View style={st.formGroup}>
              <Text style={st.formLabel}>Email Address</Text>
              <View style={[st.readOnly]}><Ionicons name="mail-outline" size={18} color="#adb5bd" style={{marginRight:8}}/><Text style={st.readOnlyTxt}>{V.maskEmail(originalFormData.email)||'—'}</Text><Text style={st.readOnlyBadge}>Use Update Email</Text></View>
              <Text style={st.hint}>To change email, use the "Update Email" button on your profile.</Text>
            </View>
            <SectionTitle>Address Information</SectionTitle>
            <Dropdown id="region" label="Region *" value={formData.region_code} items={regions} onSelect={onRegion} loading={psgcLoading.regions} disabled={false} error={errors.region_code}/>
            <Dropdown id="province" label="Province *" value={formData.province_code} items={provinces} onSelect={onProvince} loading={psgcLoading.provinces} disabled={!formData.region_code} error={errors.province_code}/>
            <Dropdown id="municipality" label="City / Municipality *" value={formData.municipality_code} items={municipalities} onSelect={onMunicipality} loading={psgcLoading.municipalities} disabled={!formData.province_code} error={errors.municipality_code}/>
            <Dropdown id="barangay" label="Barangay *" value={formData.barangay_code} items={barangays} onSelect={onBarangay} loading={psgcLoading.barangays} disabled={!formData.municipality_code} error={errors.barangay_code}/>
            <View style={[st.formGroup,{zIndex:5}]}>
              <Text style={st.formLabel}>Address Line (Optional)</Text>
              <TextInput style={[st.input,st.textarea,errors.address_line&&st.inputErr]} placeholder="House/Unit No., Street, Subdivision, etc." value={formData.address_line} onChangeText={v=>onChange('address_line',v)} maxLength={255} multiline numberOfLines={4} editable={!isSaving}/>
              <Text style={st.counter}>{(formData.address_line||'').length}/255</Text>
              {errors.address_line?<Text style={st.errorText}>{errors.address_line}</Text>:null}
            </View>
            <View style={st.modalBtnRow}>
              <TouchableOpacity style={[st.btn,{flex:1},isSaving&&{opacity:0.6}]} onPress={onSavePress} disabled={isSaving}>
                <Ionicons name="checkmark" size={18} color="#fff"/>
                <Text style={st.btnText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.btnOutline,{flex:1}]} onPress={cancelEdit} disabled={isSaving}><Text style={st.btnOutlineTxt}>Cancel</Text></TouchableOpacity>
            </View>
            <View style={{height:40}}/>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Photo picker modal */}
      <Modal visible={showPhotoModal} animationType="fade" transparent>
        <View style={st.photoOverlay}>
          <View style={st.photoSheet}>
            <Text style={st.photoSheetTitle}>Update Profile Photo</Text>
            <TouchableOpacity style={st.photoOpt} onPress={takeWithCamera}><View style={st.photoIcon}><Ionicons name="camera" size={28} color="#0a285c"/></View><View><Text style={st.photoOptTxt}>Take a Photo</Text><Text style={st.photoOptSub}>Use your camera</Text></View></TouchableOpacity>
            <TouchableOpacity style={st.photoOpt} onPress={pickFromGallery}><View style={st.photoIcon}><Ionicons name="image" size={28} color="#0a285c"/></View><View><Text style={st.photoOptTxt}>Choose from Gallery</Text><Text style={st.photoOptSub}>Pick an existing photo</Text></View></TouchableOpacity>
            <TouchableOpacity style={[st.photoOpt,st.photoCancel]} onPress={()=>setShowPhotoModal(false)}><Text style={st.photoCancelTxt}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LoadingOverlay visible={isSaving} message="Saving your profile..."/>
      <LoadingOverlay visible={uploadingPhoto} message="Uploading photo..."/>
      <ConfirmModal visible={confirm.visible} title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={hideConfirm} confirmText={confirm.confirmText} confirmColor={confirm.confirmColor}/>
    </SafeAreaView>
  );
}

function InfoSection({title,children}){return <View style={st.section}><Text style={st.sectionTitle}>{title}</Text>{children}</View>;}
function Row2({children}){return <View style={st.row2}>{children}</View>;}
function InfoItem({label,value,full=false}){return <View style={full?st.itemFull:st.item}><Text style={st.itemLabel}>{label}</Text><Text style={st.itemValue}>{value||'—'}</Text></View>;}
function SectionTitle({children}){return <Text style={st.modalSectionTitle}>{children}</Text>;}

// ── Email Modal Styles ──────────────────────────────────────────────────────────
const em = StyleSheet.create({
  container:      { flex:1, backgroundColor:'#f5f6f8' },
  header:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#0a285c', paddingHorizontal:16, paddingVertical:14 },
  headerTitle:    { fontSize:18, fontWeight:'700', color:'#fff', flex:1, textAlign:'center' },
  headerSide:     { width:40 },
  dotsRow:        { flexDirection:'row', gap:6, paddingHorizontal:20, paddingTop:12, paddingBottom:4 },
  dot:            { flex:1, height:3, borderRadius:2, backgroundColor:'rgba(10,40,92,0.15)' },
  dotOn:          { backgroundColor:'#0a285c' },
  centerBox:      { alignItems:'center', paddingVertical:32 },
  centerTxt:      { fontSize:14, color:'#6c757d', marginTop:14, fontWeight:'500' },
  statusIcon:     { width:80, height:80, borderRadius:40, backgroundColor:'#e8f0fe', alignItems:'center', justifyContent:'center', marginBottom:18 },
  statusTitle:    { fontSize:18, fontWeight:'700', color:'#0a1628', marginBottom:10, textAlign:'center' },
  statusMsg:      { fontSize:14, color:'#495057', textAlign:'center', lineHeight:22, marginBottom:6 },
  statusSub:      { fontSize:13, color:'#6c757d', textAlign:'center', marginTop:4 },
  stepTitle:      { fontSize:17, fontWeight:'700', color:'#0a1628', marginBottom:6 },
  stepSub:        { fontSize:13, color:'#6c757d', marginBottom:20, lineHeight:19 },
  fieldLabel:     { fontSize:11, fontWeight:'700', color:'#6c757d', textTransform:'uppercase', letterSpacing:0.6, marginBottom:8 },
  inputRow:       { flexDirection:'row', alignItems:'center', borderWidth:1.5, borderColor:'#dee2e6', borderRadius:10, backgroundColor:'#f8f9fa', paddingHorizontal:14, marginBottom:4 },
  inputSolo:      { borderWidth:1.5, borderColor:'#dee2e6', borderRadius:10, backgroundColor:'#f8f9fa', paddingHorizontal:14, paddingVertical:13, fontSize:15, color:'#0a1628', marginBottom:4 },
  inputErr:       { borderColor:'#ef4444', backgroundColor:'#fff5f5' },
  input:          { flex:1, fontSize:15, color:'#0a1628', paddingVertical:13 },
  eyeBtn:         { padding:8 },
  errTxt:         { color:'#ef4444', fontSize:12, marginBottom:12, fontWeight:'500' },
  primaryBtn:     { flexDirection:'row', backgroundColor:'#0a285c', borderRadius:10, paddingVertical:14, alignItems:'center', justifyContent:'center', gap:8, marginTop:16 },
  primaryBtnOff:  { opacity:0.5 },
  primaryBtnTxt:  { fontSize:15, fontWeight:'700', color:'#fff' },
  backBtn:        { alignItems:'center', marginTop:12 },
  backBtnTxt:     { fontSize:13, color:'#6c757d' },
  infoBox:        { flexDirection:'row', alignItems:'flex-start', backgroundColor:'#f0f4ff', borderRadius:12, padding:14, marginBottom:10, gap:12 },
  infoTitle:      { fontSize:14, color:'#0a285c', marginBottom:4 },
  infoSub:        { fontSize:12, color:'#64748b', lineHeight:18 },
  timerBox:       { flexDirection:'row', alignItems:'center', backgroundColor:'#e8f0fe', borderRadius:8, padding:10, marginBottom:8, gap:8, justifyContent:'center' },
  timerWarn:      { backgroundColor:'#fff3cd' },
  timerExpired:   { backgroundColor:'#f8d7da' },
  timerTxt:       { fontSize:13, fontWeight:'700', color:'#0a285c' },
  banner:         { flexDirection:'row', backgroundColor:'#ef4444', borderRadius:10, padding:12, alignItems:'center', marginBottom:10, gap:8 },
  bannerTxt:      { color:'#fff', fontSize:13, fontWeight:'600', flex:1 },
  resendWrap:     { alignItems:'center', marginTop:14 },
  resendLink:     { fontSize:14, fontWeight:'700', color:'#0a285c', textDecorationLine:'underline' },
  resendWaiting:  { fontSize:13, color:'#6c757d' },
  resendExhausted:{ fontSize:13, color:'#6c757d', fontStyle:'italic' },
});

// ── Profile Styles ──────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f5f6f8'},content:{flex:1},
  center:{flex:1,justifyContent:'center',alignItems:'center',gap:12,padding:20},
  centerLabel:{fontSize:14,color:'#6c757d',fontWeight:'500'},errorTitle:{fontSize:18,fontWeight:'700',color:'#0a1628'},
  header:{paddingHorizontal:20,paddingVertical:16,backgroundColor:'#0a285c',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  headerTitle:{fontSize:24,fontWeight:'700',color:'#fff',marginBottom:4},headerSub:{fontSize:13,color:'rgba(255,255,255,0.8)'},
  syncBadge:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'rgba(255,255,255,0.15)',paddingHorizontal:10,paddingVertical:5,borderRadius:20},
  syncTxt:{fontSize:12,color:'rgba(255,255,255,0.9)',fontWeight:'500'},
  card:{backgroundColor:'#fff',marginHorizontal:16,marginVertical:16,borderRadius:12,padding:20,alignItems:'center',shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.08,shadowRadius:8,elevation:3},
  avatarWrap:{position:'relative',marginBottom:12},
  avatar:{width:100,height:100,borderRadius:50,backgroundColor:'#0a285c',borderWidth:3,borderColor:'#c1272d',justifyContent:'center',alignItems:'center'},
  avatarImg:{width:100,height:100,borderRadius:50,borderWidth:3,borderColor:'#c1272d'},avatarTxt:{fontSize:40,fontWeight:'700',color:'#fff'},
  cardName:{fontSize:20,fontWeight:'700',color:'#0a1628',marginBottom:4,textAlign:'center'},cardRole:{fontSize:14,color:'#6c757d',textAlign:'center'},
  cardRank:{fontSize:13,color:'#0a285c',fontWeight:'600',marginTop:2,textAlign:'center'},
  photoBtn:{flexDirection:'row',backgroundColor:'#0a285c',paddingHorizontal:16,paddingVertical:10,borderRadius:8,alignItems:'center',gap:6,marginTop:12},
  photoBtnTxt:{color:'#fff',fontSize:13,fontWeight:'600'},btnDisabled:{opacity:0.6},
  section:{backgroundColor:'#fff',marginHorizontal:16,marginVertical:8,borderRadius:12,padding:16,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:4,elevation:2},
  sectionTitle:{fontSize:16,fontWeight:'700',color:'#0a1628',marginBottom:16,paddingBottom:12,borderBottomWidth:1,borderBottomColor:'#e9ecef'},
  row2:{flexDirection:'row',marginBottom:12,gap:12},item:{flex:1},itemFull:{marginBottom:12},
  itemLabel:{fontSize:11,fontWeight:'700',color:'#adb5bd',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6},
  itemValue:{fontSize:15,fontWeight:'600',color:'#0a1628'},
  btnRow:{marginHorizontal:16,marginVertical:8,gap:10},
  btn:{flexDirection:'row',backgroundColor:'#0a285c',paddingVertical:14,borderRadius:10,alignItems:'center',justifyContent:'center',gap:8},
  btnText:{color:'#fff',fontSize:15,fontWeight:'700'},
  btnOutline:{flexDirection:'row',backgroundColor:'#fff',borderWidth:1.5,borderColor:'#0a285c',paddingVertical:14,borderRadius:10,alignItems:'center',justifyContent:'center',gap:8},
  btnOutlineTxt:{color:'#0a285c',fontSize:15,fontWeight:'700'},
  logoutBtn:{flexDirection:'row',backgroundColor:'#c1272d',marginHorizontal:16,marginTop:8,paddingVertical:14,borderRadius:10,alignItems:'center',justifyContent:'center',gap:8},
  toastWrap:{position:'absolute',bottom:20,left:16,right:16},
  toast:{flexDirection:'row',paddingHorizontal:16,paddingVertical:12,borderRadius:8,alignItems:'center',gap:12},
  toastOk:{backgroundColor:'#10b981'},toastErr:{backgroundColor:'#ef4444'},toastTxt:{color:'#fff',fontSize:13,fontWeight:'500',flex:1},
  modalWrap:{flex:1,backgroundColor:'#f5f6f8'},
  modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#e9ecef'},
  modalTitle:{fontSize:18,fontWeight:'700',color:'#0a1628',flex:1,textAlign:'center'},
  modalScroll:{flex:1,padding:16},
  modalSectionTitle:{fontSize:14,fontWeight:'700',color:'#0a1628',marginTop:20,marginBottom:14,paddingBottom:8,borderBottomWidth:1,borderBottomColor:'#e9ecef'},
  modalBtnRow:{flexDirection:'row',gap:10,marginTop:24},
  formGroup:{marginBottom:16,position:'relative'},
  formLabel:{fontSize:11,fontWeight:'700',color:'#6c757d',textTransform:'uppercase',letterSpacing:0.5,marginBottom:8},
  input:{borderWidth:1,borderColor:'#dee2e6',borderRadius:8,paddingHorizontal:12,paddingVertical:11,fontSize:15,color:'#0a1628',backgroundColor:'#f8f9fa'},
  inputErr:{borderColor:'#c1272d',backgroundColor:'#fff5f5'},errorText:{color:'#c1272d',fontSize:12,marginTop:6,fontWeight:'500'},
  hint:{color:'#6c757d',fontSize:12,marginTop:6},textarea:{textAlignVertical:'top',paddingTop:11,minHeight:100},counter:{fontSize:11,color:'#adb5bd',marginTop:6,textAlign:'right'},
  readOnly:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#dee2e6',borderRadius:8,paddingHorizontal:12,paddingVertical:11,backgroundColor:'#e9ecef'},
  readOnlyTxt:{fontSize:15,color:'#6c757d',flex:1},readOnlyBadge:{fontSize:10,fontWeight:'700',color:'#fff',backgroundColor:'#adb5bd',paddingHorizontal:6,paddingVertical:2,borderRadius:4,overflow:'hidden'},
  genderRow:{flexDirection:'row',gap:10},
  genderBtn:{flex:1,flexDirection:'row',paddingVertical:11,paddingHorizontal:12,borderWidth:1,borderColor:'#dee2e6',borderRadius:8,backgroundColor:'#f8f9fa',alignItems:'center',justifyContent:'center'},
  genderBtnOn:{borderColor:'#0a285c',backgroundColor:'#e7f0ff'},genderTxt:{fontSize:14,fontWeight:'600',color:'#6c757d'},genderTxtOn:{color:'#0a285c'},
  phoneRow:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#dee2e6',borderRadius:8,backgroundColor:'#f8f9fa',paddingHorizontal:12},
  phoneRowErr:{borderColor:'#c1272d',backgroundColor:'#fff5f5'},phoneRowActive:{borderColor:'#d4a017',backgroundColor:'#fffbeb'},
  phonePrefix:{fontSize:15,fontWeight:'600',color:'#6c757d',marginRight:4},phoneInput:{flex:1,paddingVertical:11,fontSize:15,color:'#0a1628'},
  hintActive:{color:'#d4a017',fontWeight:'600'},
  dropdown:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:'#dee2e6',borderRadius:8,paddingHorizontal:12,paddingVertical:11,backgroundColor:'#f8f9fa'},
  dropdownError:{borderColor:'#c1272d',backgroundColor:'#fff5f5'},dropdownDisabled:{backgroundColor:'#e9ecef',opacity:0.6},
  dropdownText:{fontSize:15,color:'#0a1628',fontWeight:'500',flex:1},dropdownPlaceholder:{color:'#adb5bd'},
  dropdownList:{position:'absolute',top:46,left:0,right:0,backgroundColor:'#fff',borderWidth:1,borderColor:'#dee2e6',borderRadius:8,zIndex:9999,elevation:20,shadowColor:'#000',shadowOffset:{width:0,height:4},shadowOpacity:0.15,shadowRadius:8,overflow:'hidden'},
  ddItem:{paddingHorizontal:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#f0f0f0'},ddItemSelected:{backgroundColor:'#e7f0ff'},
  ddItemText:{fontSize:14,color:'#0a1628',fontWeight:'500'},ddItemTextSelected:{color:'#0a285c',fontWeight:'700'},
  ddLoading:{paddingVertical:20,alignItems:'center'},ddLoadingText:{fontSize:12,color:'#6c757d',marginTop:8},
  photoOverlay:{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'},
  photoSheet:{backgroundColor:'#fff',borderTopLeftRadius:20,borderTopRightRadius:20,paddingHorizontal:20,paddingTop:24,paddingBottom:32},
  photoSheetTitle:{fontSize:18,fontWeight:'700',color:'#0a1628',textAlign:'center',marginBottom:20},
  photoOpt:{flexDirection:'row',alignItems:'center',paddingHorizontal:16,paddingVertical:14,marginBottom:10,backgroundColor:'#f8f9fa',borderRadius:10,gap:14},
  photoIcon:{width:48,height:48,borderRadius:24,backgroundColor:'#e7f0ff',justifyContent:'center',alignItems:'center'},
  photoOptTxt:{fontSize:15,fontWeight:'600',color:'#0a1628'},photoOptSub:{fontSize:12,color:'#6c757d',marginTop:2},
  photoCancel:{backgroundColor:'#fff',borderWidth:1,borderColor:'#dee2e6',marginTop:8,justifyContent:'center'},
  photoCancelTxt:{fontSize:15,fontWeight:'600',color:'#c1272d',flex:1,textAlign:'center'},
});