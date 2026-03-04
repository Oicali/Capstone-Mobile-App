import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, ActivityIndicator, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, Modal, TextInput, Image,
} from 'react-native';

const BASE_URL      = 'http://localhost:5000';   // change to LAN IP for physical device
const PSGC_API      = 'https://psgc.gitlab.io/api';
const POLL_INTERVAL = 15000;                     // poll every 15 s to catch web changes

const V = {
  name:(v,f,max=50,req=true)=>{
    if(!v||!v.trim())return req?`${f} is required`:null;
    if(v.length>max)return `${f} must not exceed ${max} characters`;
    if(!/^[a-zA-Z\s'\-.]+$/.test(v.trim()))return `${f} can only contain letters, spaces, hyphens, apostrophes`;
    return null;
  },
  suffix:(v)=>{
    if(!v||!v.trim())return null;
    const t=v.trim().toLowerCase();
    if(t.length>5)return 'Suffix must not exceed 5 characters';
    if(t==='sr.'||t==='jr.'||/^[ivxlcdm]+$/.test(t))return null;
    return 'Suffix must be Sr., Jr., or Roman Numeral (e.g., III)';
  },
  phone:(v,f)=>{const c=v.replace(/\D/g,'');if(!c.length)return null;if(c.length!==10)return `${f} must be exactly 10 digits`;if(!c.startsWith('9'))return `${f} must start with 9`;return null;},
  email:(v)=>{if(!v||!v.trim())return 'Email is required';if(v.length>255)return 'Email must not exceed 255 characters';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))return 'Invalid email format';return null;},
  maskPhone:(p)=>{if(!p)return '';const d=p.replace(/\D/g,'').replace(/^63/,'');return d.length<3?'*'.repeat(d.length):'*'.repeat(d.length-3)+d.slice(-3);},
  maskEmail:(e)=>{if(!e)return '';const at=e.indexOf('@');if(at<0)return e;const local=e.slice(0,at),domain=e.slice(at);if(local.length<=1)return local+domain;if(local.length<=4)return local[0]+'*'.repeat(local.length-1)+domain;return local[0]+'*'.repeat(local.length-4)+local.slice(-3)+domain;},
};

function LoadingOverlay({visible,message='Please wait...'}){
  if(!visible)return null;
  return(
    <Modal visible transparent animationType="fade">
      <View style={lo.overlay}>
        <View style={lo.box}>
          <ActivityIndicator size="large" color="#0a285c"/>
          <Text style={lo.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}
const lo=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.45)',justifyContent:'center',alignItems:'center'},
  box:{backgroundColor:'#fff',borderRadius:14,paddingVertical:28,paddingHorizontal:36,alignItems:'center',gap:14,shadowColor:'#000',shadowOffset:{width:0,height:8},shadowOpacity:0.18,shadowRadius:16,elevation:10},
  text:{fontSize:14,fontWeight:'600',color:'#0a1628',textAlign:'center',maxWidth:200},
});

function ConfirmModal({visible,title,message,onConfirm,onCancel,confirmText='Confirm',confirmColor='#0a285c'}){
  if(!visible)return null;
  return(
    <Modal visible transparent animationType="fade">
      <View style={cm.overlay}>
        <View style={cm.box}>
          <Text style={cm.title}>{title}</Text>
          <Text style={cm.message}>{message}</Text>
          <View style={cm.btnRow}>
            <TouchableOpacity style={cm.cancelBtn} onPress={onCancel}><Text style={cm.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[cm.confirmBtn,{backgroundColor:confirmColor}]} onPress={onConfirm}><Text style={cm.confirmTxt}>{confirmText}</Text></TouchableOpacity>
          </View>
        </View>
      </View>
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

export default function ProfileScreen({navigation}){
  const [profileData,setProfileData]=useState(null);
  const [formData,setFormData]=useState({first_name:'',last_name:'',middle_name:'',suffix:'',email:'',phone:'',alternate_phone:'',date_of_birth:'',gender:'Male',region_code:'',province_code:'',municipality_code:'',barangay_code:'',address_line:''});
  const [originalFormData,setOriginalFormData]=useState({});
  const [loading,setLoading]=useState(true);
  const [isSaving,setIsSaving]=useState(false);
  const [uploadingPhoto,setUploadingPhoto]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [isEditing,setIsEditing]=useState(false);
  const [errors,setErrors]=useState({});
  const [successMsg,setSuccessMsg]=useState('');
  const [errorMsg,setErrorMsg]=useState('');
  const [showPhotoModal,setShowPhotoModal]=useState(false);
  const [showDropdown,setShowDropdown]=useState(null);
  const [confirm,setConfirm]=useState({visible:false,title:'',message:'',onConfirm:null,confirmText:'Confirm',confirmColor:'#0a285c'});
  const showConfirm=(title,message,onConfirm,confirmText='Confirm',confirmColor='#0a285c')=>setConfirm({visible:true,title,message,onConfirm,confirmText,confirmColor});
  const hideConfirm=()=>setConfirm(p=>({...p,visible:false}));
  const [regions,setRegions]=useState([]);
  const [provinces,setProvinces]=useState([]);
  const [municipalities,setMunicipalities]=useState([]);
  const [barangays,setBarangays]=useState([]);
  const [psgcLoading,setPsgcLoading]=useState({});
  const [resolvedAddr,setResolvedAddr]=useState({region:'',province:'',municipality:'',barangay:''});
  const [phoneChanged,setPhoneChanged]=useState(false);
  const [altPhoneChanged,setAltPhoneChanged]=useState(false);
  const [emailChanged,setEmailChanged]=useState(false);
  const pollTimer=useRef(null);
  const appStateRef=useRef(AppState.currentState);
  const lastEtag=useRef(null);
  const isEditingRef=useRef(false);
  useEffect(()=>{isEditingRef.current=isEditing;},[isEditing]);
  useEffect(()=>{if(successMsg){const t=setTimeout(()=>setSuccessMsg(''),5000);return()=>clearTimeout(t);}},[successMsg]);
  useEffect(()=>{if(errorMsg){const t=setTimeout(()=>setErrorMsg(''),5000);return()=>clearTimeout(t);}},[errorMsg]);

  useEffect(()=>{
    loadProfile(true);
    startPolling();
    const sub=AppState.addEventListener('change',nextState=>{
      if(appStateRef.current.match(/inactive|background/)&&nextState==='active')silentRefresh();
      appStateRef.current=nextState;
    });
    return()=>{stopPolling();sub.remove();};
  },[]);

  const startPolling=()=>{
    stopPolling();
    pollTimer.current=setInterval(()=>{if(!isEditingRef.current)silentRefresh();},POLL_INTERVAL);
  };
  const stopPolling=()=>{if(pollTimer.current){clearInterval(pollTimer.current);pollTimer.current=null;}};

  const silentRefresh=async()=>{
    try{
      const token=await AsyncStorage.getItem('token');
      if(!token)return;
      setRefreshing(true);
      const res=await fetch(`${BASE_URL}/users/profile`,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
      if(res.status===401){stopPolling();await AsyncStorage.clear();navigation.reset({index:0,routes:[{name:'Login'}]});return;}
      if(!res.ok)return;
      const json=await res.json();
      if(!json.success||!json.user)return;
      const newStr=JSON.stringify(json.user);
      if(newStr===lastEtag.current)return;
      lastEtag.current=newStr;
      await AsyncStorage.setItem('user',JSON.stringify(json.user));
      applyToState(json.user);
      await resolveAddressNames(json.user);
    }catch(_){}finally{setRefreshing(false);}
  };

  const loadProfile=async(showSpinner=false)=>{
    try{
      if(showSpinner)setLoading(true);
      const token=await AsyncStorage.getItem('token');
      if(!token){setLoading(false);return;}
      const res=await fetch(`${BASE_URL}/users/profile`,{headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}});
      if(res.status===401){await AsyncStorage.clear();navigation.reset({index:0,routes:[{name:'Login'}]});return;}
      const json=await res.json();
      if(res.ok&&json.success&&json.user){
        lastEtag.current=JSON.stringify(json.user);
        await AsyncStorage.setItem('user',JSON.stringify(json.user));
        applyToState(json.user);
        await resolveAddressNames(json.user);
      }else{
        const cached=await AsyncStorage.getItem('user');
        if(cached){const u=JSON.parse(cached);applyToState(u);await resolveAddressNames(u);}
        setErrorMsg(json.message||'Could not load profile');
      }
    }catch(e){
      console.error('loadProfile:',e);
      try{const cached=await AsyncStorage.getItem('user');if(cached){const u=JSON.parse(cached);applyToState(u);await resolveAddressNames(u);}}catch(_){}
      setErrorMsg('Network error - showing cached data');
    }finally{setLoading(false);}
  };

  const applyToState=(u)=>{
    const phone=u.phone?u.phone.replace(/^\+63/,''):'';
    const altPhone=u.alternate_phone?u.alternate_phone.replace(/^\+63/,''):'';
    const fv={first_name:u.first_name||'',last_name:u.last_name||'',middle_name:u.middle_name||'',suffix:u.suffix||'',date_of_birth:u.date_of_birth?u.date_of_birth.split('T')[0]:'',gender:u.gender||'Male',phone,alternate_phone:altPhone,email:u.email||'',region_code:u.region_code||'',province_code:u.province_code||'',municipality_code:u.municipality_code||'',barangay_code:u.barangay_code||'',address_line:u.address_line||''};
    setProfileData(u);setFormData(fv);setOriginalFormData(fv);
  };

  const loadRegions=useCallback(async()=>{
    setPsgcLoading(p=>({...p,regions:true}));let arr=[];
    try{const d=await(await fetch(`${PSGC_API}/regions/`)).json();arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[];setRegions(arr);}catch{}
    setPsgcLoading(p=>({...p,regions:false}));return arr;
  },[]);
  const loadProvinces=useCallback(async(rc)=>{
    if(!rc){setProvinces([]);setMunicipalities([]);setBarangays([]);return[];}
    setPsgcLoading(p=>({...p,provinces:true}));let arr=[];
    try{const d=await(await fetch(`${PSGC_API}/regions/${rc}/provinces/`)).json();arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[];setProvinces(arr);}catch{}
    setMunicipalities([]);setBarangays([]);setPsgcLoading(p=>({...p,provinces:false}));return arr;
  },[]);
  const loadMunicipalities=useCallback(async(pc)=>{
    if(!pc){setMunicipalities([]);setBarangays([]);return[];}
    setPsgcLoading(p=>({...p,municipalities:true}));let arr=[];
    try{const d=await(await fetch(`${PSGC_API}/provinces/${pc}/cities-municipalities/`)).json();arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[];setMunicipalities(arr);}catch{}
    setBarangays([]);setPsgcLoading(p=>({...p,municipalities:false}));return arr;
  },[]);
  const loadBarangays=useCallback(async(mc)=>{
    if(!mc){setBarangays([]);return[];}
    setPsgcLoading(p=>({...p,barangays:true}));let arr=[];
    try{const d=await(await fetch(`${PSGC_API}/cities-municipalities/${mc}/barangays/`)).json();arr=Array.isArray(d)?d.sort((a,b)=>a.name.localeCompare(b.name)):[];setBarangays(arr);}catch{}
    setPsgcLoading(p=>({...p,barangays:false}));return arr;
  },[]);

  const resolveAddressNames=async(u)=>{
    if(u.region&&u.province){setResolvedAddr({region:u.region||'',province:u.province||'',municipality:u.municipality||u.city||'',barangay:u.barangay||''});return;}
    if(!u.region_code)return;
    try{
      const[rArr,pArr,mArr,bArr]=await Promise.all([
        fetch(`${PSGC_API}/regions/`).then(r=>r.json()).catch(()=>[]),
        u.region_code?fetch(`${PSGC_API}/regions/${u.region_code}/provinces/`).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
        u.province_code?fetch(`${PSGC_API}/provinces/${u.province_code}/cities-municipalities/`).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
        u.municipality_code?fetch(`${PSGC_API}/cities-municipalities/${u.municipality_code}/barangays/`).then(r=>r.json()).catch(()=>[]):Promise.resolve([]),
      ]);
      setResolvedAddr({
        region:(Array.isArray(rArr)?rArr.find(x=>x.code===u.region_code)?.name:'')||'',
        province:(Array.isArray(pArr)?pArr.find(x=>x.code===u.province_code)?.name:'')||'',
        municipality:(Array.isArray(mArr)?mArr.find(x=>x.code===u.municipality_code)?.name:'')||'',
        barangay:(Array.isArray(bArr)?bArr.find(x=>x.code===u.barangay_code)?.name:'')||'',
      });
    }catch(e){console.error('resolveAddressNames:',e);}
  };

  const resolveFromArrays=(rc,pc,mc,bc)=>{
    setResolvedAddr({
      region:regions.find(x=>x.code===rc)?.name||'',
      province:provinces.find(x=>x.code===pc)?.name||'',
      municipality:municipalities.find(x=>x.code===mc)?.name||'',
      barangay:barangays.find(x=>x.code===bc)?.name||'',
    });
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
    if(ep&&eap&&ep.replace(/\D/g,'')==eap.replace(/\D/g,''))e.alternate_phone='Alternate phone cannot be same as primary';
    if(emailChanged&&formData.email){const ee=V.email(formData.email);if(ee)e.email=ee;}
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
    else if(name==='email'){value=value.slice(0,255);setEmailChanged(value.length>0);}
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
  const onRegion=async(code)=>{setFormData(p=>({...p,region_code:code,province_code:'',municipality_code:'',barangay_code:''}));setShowDropdown(null);await loadProvinces(code);};
  const onProvince=async(code)=>{setFormData(p=>({...p,province_code:code,municipality_code:'',barangay_code:''}));setShowDropdown(null);await loadMunicipalities(code);};
  const onMunicipality=async(code)=>{setFormData(p=>({...p,municipality_code:code,barangay_code:''}));setShowDropdown(null);await loadBarangays(code);};
  const onBarangay=(code)=>{setFormData(p=>({...p,barangay_code:code}));setShowDropdown(null);};

  const startEdit=()=>{
    stopPolling();
    setFormData({...originalFormData,phone:'',alternate_phone:'',email:''});
    setPhoneChanged(false);setAltPhoneChanged(false);setEmailChanged(false);
    setErrors({});setIsEditing(true);
    loadRegions();
    if(originalFormData.region_code){
      loadProvinces(originalFormData.region_code);
      if(originalFormData.province_code){
        loadMunicipalities(originalFormData.province_code);
        if(originalFormData.municipality_code)loadBarangays(originalFormData.municipality_code);
      }
    }
  };
  const cancelEdit=()=>{
    setFormData(originalFormData);setErrors({});
    setPhoneChanged(false);setAltPhoneChanged(false);setEmailChanged(false);
    setIsEditing(false);startPolling();
  };

  const onSavePress=()=>{
    if(!validate()){setErrorMsg('Please fix the errors before saving.');return;}
    showConfirm('Save Changes','Are you sure you want to save these changes to your profile?',()=>{hideConfirm();doSave();},'Yes');
  };

  const doSave=async()=>{
    setIsSaving(true);setSuccessMsg('');setErrorMsg('');
    try{
      const token=await AsyncStorage.getItem('token');
      if(!token){setErrorMsg('Not authenticated');setIsSaving(false);return;}
      const cap=s=>s?.trim().split(' ').map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase()).join(' ');
      let fmt={...formData};
      if(fmt.first_name)fmt.first_name=cap(fmt.first_name);
      if(fmt.last_name)fmt.last_name=cap(fmt.last_name);
      if(fmt.middle_name)fmt.middle_name=cap(fmt.middle_name);
      if(fmt.suffix){const t=fmt.suffix.trim();fmt.suffix=t.toLowerCase()==='sr.'?'Sr.':t.toLowerCase()==='jr.'?'Jr.':/^[ivxlcdm]+$/i.test(t)?t.toUpperCase():t;}
      fmt.phone=phoneChanged&&fmt.phone?`+63${fmt.phone.trim()}`:originalFormData.phone?`+63${originalFormData.phone}`:'';
      fmt.alternate_phone=altPhoneChanged&&fmt.alternate_phone?`+63${fmt.alternate_phone.trim()}`:originalFormData.alternate_phone?`+63${originalFormData.alternate_phone}`:'';
      fmt.email=(emailChanged&&fmt.email)?fmt.email:(originalFormData.email||'');
      const fd=new FormData();
      ['first_name','last_name','middle_name','suffix','gender','email','phone','alternate_phone','region_code','province_code','municipality_code','barangay_code','address_line','date_of_birth'].forEach(k=>{
        if(fmt[k]!=null&&fmt[k].toString().trim()!=='')fd.append(k,fmt[k].toString());
      });
      const res=await fetch(`${BASE_URL}/users/profile/${String(profileData.user_id)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`},body:fd});
      const json=await res.json();
      if(!res.ok||!json.success){
        if(json.errors&&Array.isArray(json.errors)){const be={};json.errors.forEach(e=>{if(e.field)be[e.field]=e.message;});if(Object.keys(be).length)setErrors(be);}
        setErrorMsg(json.message||'Failed to update profile');setIsSaving(false);return;
      }
      resolveFromArrays(fmt.region_code,fmt.province_code,fmt.municipality_code,fmt.barangay_code);
      const fresh=json.user||{...profileData,...fmt};
      lastEtag.current=JSON.stringify(fresh);
      await AsyncStorage.setItem('user',JSON.stringify(fresh));
      applyToState(fresh);
      setSuccessMsg('Profile updated successfully!');
      setIsEditing(false);setPhoneChanged(false);setAltPhoneChanged(false);setEmailChanged(false);
      startPolling();
    }catch(err){console.error('doSave:',err);setErrorMsg('Network error. Check your connection.');}
    finally{setIsSaving(false);}
  };

  const pickFromGallery=async()=>{
    const perm=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!perm.granted){setErrorMsg('Gallery permission required');return;}
    const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8});
    if(!r.canceled&&r.assets[0]){setShowPhotoModal(false);confirmUploadPhoto(r.assets[0].uri);}
  };
  const takeWithCamera=async()=>{
    const perm=await ImagePicker.requestCameraPermissionsAsync();
    if(!perm.granted){setErrorMsg('Camera permission required');return;}
    const r=await ImagePicker.launchCameraAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8});
    if(!r.canceled&&r.assets[0]){setShowPhotoModal(false);confirmUploadPhoto(r.assets[0].uri);}
  };
  const confirmUploadPhoto=(uri)=>showConfirm('Update Profile Photo','Are you sure you want to update your profile photo?',()=>{hideConfirm();uploadPhoto(uri);},'Yes');
  const uploadPhoto=async(uri)=>{
    try{
      setUploadingPhoto(true);
      const token=await AsyncStorage.getItem('token');
      const fd=new FormData();
      if(Platform.OS==='web'){const blob=await(await fetch(uri)).blob();fd.append('profilePicture',blob,'profile.jpg');}
      else{fd.append('profilePicture',{uri,type:'image/jpeg',name:'profile.jpg'});}
      const res=await fetch(`${BASE_URL}/users/profile/picture`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});
      const json=await res.json();
      if(!res.ok||!json.success){setErrorMsg(json.message||'Failed to upload photo');}
      else{
        const newPic=json.profile_picture;
        setProfileData(p=>({...p,profile_picture:newPic}));
        const cached=await AsyncStorage.getItem('user');
        if(cached){const parsed=JSON.parse(cached);parsed.profile_picture=newPic;lastEtag.current=JSON.stringify(parsed);await AsyncStorage.setItem('user',JSON.stringify(parsed));}
        setSuccessMsg('Profile photo updated!');
      }
    }catch(err){console.error('uploadPhoto:',err);setErrorMsg('Error uploading photo. Check your connection.');}
    finally{setUploadingPhoto(false);}
  };

  const logout=()=>showConfirm('Logout','Are you sure you want to logout?',async()=>{hideConfirm();stopPolling();await AsyncStorage.clear();navigation.reset({index:0,routes:[{name:'Login'}]});},'Logout','#c1272d');

  const ZMAP={region:4000,province:3000,municipality:2000,barangay:1000};
  const Dropdown=({id,label,value,items,onSelect,loading:dLoad,disabled,error})=>(
    <View style={[styles.formGroup,{zIndex:showDropdown===id?ZMAP[id]:10}]}>
      <Text style={styles.formLabel}>{label}</Text>
      <TouchableOpacity style={[styles.dropdown,error&&styles.dropdownError,disabled&&styles.dropdownDisabled]}
        onPress={()=>!disabled&&!isSaving&&setShowDropdown(showDropdown===id?null:id)} activeOpacity={0.7}>
        <Text style={[styles.dropdownText,!value&&styles.dropdownPlaceholder]}>
          {items.find(i=>i.code===value)?.name||`Select ${label.replace(' *','')}`}
        </Text>
        <Ionicons name={showDropdown===id?'chevron-up':'chevron-down'} size={20} color={disabled?'#adb5bd':'#0a285c'}/>
      </TouchableOpacity>
      {showDropdown===id&&(
        <View style={styles.dropdownList}>
          {dLoad?(<View style={styles.ddLoading}><ActivityIndicator size="small" color="#0a285c"/><Text style={styles.ddLoadingText}>Loading...</Text></View>):(
            <ScrollView style={{maxHeight:200}} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {items.map(item=>(
                <TouchableOpacity key={item.code} style={[styles.ddItem,value===item.code&&styles.ddItemSelected]} onPress={()=>onSelect(item.code)}>
                  <Text style={[styles.ddItemText,value===item.code&&styles.ddItemTextSelected]}>{item.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
      {error?<Text style={styles.errorText}>{error}</Text>:null}
    </View>
  );

  if(loading)return(<SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator size="large" color="#0a285c"/><Text style={styles.centerLabel}>Loading profile...</Text></View></SafeAreaView>);
  if(!profileData)return(<SafeAreaView style={styles.container}><View style={styles.center}><Ionicons name="person-circle-outline" size={64} color="#adb5bd"/><Text style={styles.errorTitle}>No profile data</Text><TouchableOpacity style={[styles.btn,{marginTop:16,paddingHorizontal:32}]} onPress={()=>navigation.reset({index:0,routes:[{name:'Login'}]})}><Text style={styles.btnText}>Go to Login</Text></TouchableOpacity></View></SafeAreaView>);

  return(
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>My Profile</Text>
            <Text style={styles.headerSub}>PNP Bacoor Officer</Text>
          </View>
          {refreshing&&(<View style={styles.syncBadge}><ActivityIndicator size="small" color="rgba(255,255,255,0.9)"/><Text style={styles.syncTxt}>Syncing...</Text></View>)}
        </View>

        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            {profileData.profile_picture
              ?<Image source={{uri:profileData.profile_picture}} style={styles.avatarImg}/>
              :<View style={styles.avatar}><Text style={styles.avatarTxt}>{profileData.first_name?.[0]??''}{profileData.last_name?.[0]??''}</Text></View>
            }
          </View>
          <Text style={styles.cardName}>{[profileData.first_name,profileData.middle_name,profileData.last_name,profileData.suffix].filter(Boolean).join(' ')||'Officer Name'}</Text>
          <Text style={styles.cardRole}>{profileData.role||'Position'}</Text>
          {!!profileData.rank&&<Text style={styles.cardRank}>{profileData.rank}</Text>}
          <TouchableOpacity style={[styles.photoBtn,uploadingPhoto&&styles.btnDisabled]} onPress={()=>!uploadingPhoto&&setShowPhotoModal(true)}>
            <Ionicons name="camera" size={16} color="#fff"/>
            <Text style={styles.photoBtnTxt}>Update Photo</Text>
          </TouchableOpacity>
        </View>

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

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.btn} onPress={startEdit}><Ionicons name="create-outline" size={18} color="#fff"/><Text style={styles.btnText}>Edit Profile</Text></TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={() => navigation.navigate('ChangePassword')}><Ionicons name="lock-closed-outline" size={18} color="#0a285c"/><Text style={styles.btnOutlineTxt}>Change Password</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}><Ionicons name="log-out-outline" size={18} color="#fff"/><Text style={styles.btnText}>Logout</Text></TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerTxt}>PNP BANTAY v1.0.0</Text>
          <Text style={styles.footerTxt}>Crime Intelligence and Patrol Management System</Text>
          <Text style={styles.footerTxt}>2026 PNP Bacoor, Cavite</Text>
        </View>
        <View style={{height:20}}/>
      </ScrollView>

      {!!successMsg&&<View style={styles.toastWrap}><View style={[styles.toast,styles.toastOk]}><Ionicons name="checkmark-circle" size={20} color="#fff"/><Text style={styles.toastTxt}>{successMsg}</Text></View></View>}
      {!!errorMsg&&<View style={styles.toastWrap}><View style={[styles.toast,styles.toastErr]}><Ionicons name="close-circle" size={20} color="#fff"/><Text style={styles.toastTxt}>{errorMsg}</Text></View></View>}

      <Modal visible={isEditing} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={cancelEdit} hitSlop={{top:10,bottom:10,left:10,right:10}}><Ionicons name="chevron-back" size={24} color="#0a285c"/></TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={{width:40}}/>
          </View>
          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            <SectionTitle>Personal Information</SectionTitle>
            {[{name:'first_name',label:'First Name *',max:50},{name:'last_name',label:'Last Name *',max:50},{name:'middle_name',label:'Middle Name',max:50},{name:'suffix',label:'Suffix (e.g. Jr., III)',max:5}].map(f=>(
              <View key={f.name} style={styles.formGroup}>
                <Text style={styles.formLabel}>{f.label}</Text>
                <TextInput style={[styles.input,errors[f.name]&&styles.inputErr]} placeholder={`Enter ${f.label.replace(' *','')}`} value={formData[f.name]} onChangeText={v=>onChange(f.name,v)} maxLength={f.max} editable={!isSaving}/>
                {errors[f.name]?<Text style={styles.errorText}>{errors[f.name]}</Text>:null}
              </View>
            ))}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Date of Birth</Text>
              <View style={styles.readOnly}>
                <Ionicons name="calendar-outline" size={18} color="#adb5bd" style={{marginRight:8}}/>
                <Text style={styles.readOnlyTxt}>{formData.date_of_birth?new Date(formData.date_of_birth).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}):'Not set'}</Text>
                <Text style={styles.readOnlyBadge}>Read-only</Text>
              </View>
              <Text style={styles.hint}>Contact admin to update date of birth.</Text>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Gender</Text>
              <View style={styles.genderRow}>
                {['Male','Female'].map(g=>(
                  <TouchableOpacity key={g} style={[styles.genderBtn,formData.gender===g&&styles.genderBtnOn]} onPress={()=>onChange('gender',g)}>
                    <Ionicons name={g==='Male'?'male':'female'} size={16} color={formData.gender===g?'#0a285c':'#6c757d'} style={{marginRight:4}}/>
                    <Text style={[styles.genderTxt,formData.gender===g&&styles.genderTxtOn]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <SectionTitle>Contact Information</SectionTitle>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Phone Number</Text>
              <View style={[styles.phoneRow,errors.phone&&styles.phoneRowErr]}><Text style={styles.phonePrefix}>+63</Text><TextInput style={styles.phoneInput} placeholder="9XXXXXXXXX" value={formData.phone} onChangeText={v=>onPhone('phone',v)} maxLength={10} keyboardType="phone-pad" editable={!isSaving}/></View>
              <Text style={styles.hint}>{phoneChanged?'New number will replace current on save':'Leave blank to keep current number'}</Text>
              {errors.phone?<Text style={styles.errorText}>{errors.phone}</Text>:null}
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Alternate Phone</Text>
              <View style={[styles.phoneRow,errors.alternate_phone&&styles.phoneRowErr]}><Text style={styles.phonePrefix}>+63</Text><TextInput style={styles.phoneInput} placeholder="Optional" value={formData.alternate_phone} onChangeText={v=>onPhone('alternate_phone',v)} maxLength={10} keyboardType="phone-pad" editable={!isSaving}/></View>
              {errors.alternate_phone?<Text style={styles.errorText}>{errors.alternate_phone}</Text>:null}
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email Address</Text>
              <TextInput style={[styles.input,errors.email&&styles.inputErr]} placeholder="email@example.com" value={formData.email} onChangeText={v=>onChange('email',v)} keyboardType="email-address" autoCapitalize="none" maxLength={255} editable={!isSaving}/>
              <Text style={styles.hint}>{emailChanged?'New email will replace current on save':'Leave blank to keep current email'}</Text>
              {errors.email?<Text style={styles.errorText}>{errors.email}</Text>:null}
            </View>
            <SectionTitle>Address Information</SectionTitle>
            <Dropdown id="region" label="Region *" value={formData.region_code} items={regions} onSelect={onRegion} loading={psgcLoading.regions} disabled={false} error={errors.region_code}/>
            <Dropdown id="province" label="Province *" value={formData.province_code} items={provinces} onSelect={onProvince} loading={psgcLoading.provinces} disabled={!formData.region_code} error={errors.province_code}/>
            <Dropdown id="municipality" label="City / Municipality *" value={formData.municipality_code} items={municipalities} onSelect={onMunicipality} loading={psgcLoading.municipalities} disabled={!formData.province_code} error={errors.municipality_code}/>
            <Dropdown id="barangay" label="Barangay *" value={formData.barangay_code} items={barangays} onSelect={onBarangay} loading={psgcLoading.barangays} disabled={!formData.municipality_code} error={errors.barangay_code}/>
            <View style={[styles.formGroup,{zIndex:5}]}>
              <Text style={styles.formLabel}>Address Line (Optional)</Text>
              <TextInput style={[styles.input,styles.textarea,errors.address_line&&styles.inputErr]} placeholder="House/Unit No., Street, Subdivision, etc." value={formData.address_line} onChangeText={v=>onChange('address_line',v)} maxLength={255} multiline numberOfLines={4} editable={!isSaving}/>
              <Text style={styles.counter}>{(formData.address_line||'').length}/255</Text>
              {errors.address_line?<Text style={styles.errorText}>{errors.address_line}</Text>:null}
            </View>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.btn,{flex:1},isSaving&&{opacity:0.6}]} onPress={onSavePress} disabled={isSaving}>
                <Ionicons name="checkmark" size={18} color="#fff"/>
                <Text style={styles.btnText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOutline,{flex:1}]} onPress={cancelEdit} disabled={isSaving}><Text style={styles.btnOutlineTxt}>Cancel</Text></TouchableOpacity>
            </View>
            <View style={{height:40}}/>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={showPhotoModal} animationType="fade" transparent>
        <View style={styles.photoOverlay}>
          <View style={styles.photoSheet}>
            <Text style={styles.photoSheetTitle}>Update Profile Photo</Text>
            <TouchableOpacity style={styles.photoOpt} onPress={takeWithCamera}><View style={styles.photoIcon}><Ionicons name="camera" size={28} color="#0a285c"/></View><View><Text style={styles.photoOptTxt}>Take a Photo</Text><Text style={styles.photoOptSub}>Use your camera</Text></View></TouchableOpacity>
            <TouchableOpacity style={styles.photoOpt} onPress={pickFromGallery}><View style={styles.photoIcon}><Ionicons name="image" size={28} color="#0a285c"/></View><View><Text style={styles.photoOptTxt}>Choose from Gallery</Text><Text style={styles.photoOptSub}>Pick an existing photo</Text></View></TouchableOpacity>
            <TouchableOpacity style={[styles.photoOpt,styles.photoCancel]} onPress={()=>setShowPhotoModal(false)}><Text style={styles.photoCancelTxt}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <LoadingOverlay visible={isSaving} message="Saving your profile..."/>
      <LoadingOverlay visible={uploadingPhoto} message="Uploading photo..."/>
      <ConfirmModal visible={confirm.visible} title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onCancel={hideConfirm} confirmText={confirm.confirmText} confirmColor={confirm.confirmColor}/>
    </SafeAreaView>
  );
}

function InfoSection({title,children}){return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;}
function Row2({children}){return <View style={styles.row2}>{children}</View>;}
function InfoItem({label,value,full=false}){return <View style={full?styles.itemFull:styles.item}><Text style={styles.itemLabel}>{label}</Text><Text style={styles.itemValue}>{value||'\u2014'}</Text></View>;}
function SectionTitle({children}){return <Text style={styles.modalSectionTitle}>{children}</Text>;}

const styles=StyleSheet.create({
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
  avatarCam:{position:'absolute',bottom:0,right:0,backgroundColor:'#0a285c',borderRadius:12,padding:4,borderWidth:2,borderColor:'#fff'},
  avatarSpinner:{position:'absolute',bottom:0,right:0,backgroundColor:'#c1272d',borderRadius:12,padding:4,borderWidth:2,borderColor:'#fff'},
  cardName:{fontSize:20,fontWeight:'700',color:'#0a1628',marginBottom:4,textAlign:'center'},cardRole:{fontSize:14,color:'#6c757d',textAlign:'center'},
  cardRank:{fontSize:13,color:'#0a285c',fontWeight:'600',marginTop:2,textAlign:'center'},
  photoBtn:{flexDirection:'row',backgroundColor:'#0a285c',paddingHorizontal:16,paddingVertical:10,borderRadius:8,alignItems:'center',gap:6,marginTop:12},
  photoBtnTxt:{color:'#fff',fontSize:13,fontWeight:'600'},btnDisabled:{opacity:0.6},
  section:{backgroundColor:'#fff',marginHorizontal:16,marginVertical:8,borderRadius:12,padding:16,shadowColor:'#000',shadowOffset:{width:0,height:1},shadowOpacity:0.05,shadowRadius:4,elevation:2},
  sectionTitle:{fontSize:16,fontWeight:'700',color:'#0a1628',marginBottom:16,paddingBottom:12,borderBottomWidth:1,borderBottomColor:'#e9ecef'},
  row2:{flexDirection:'row',marginBottom:12,gap:12},item:{flex:1},itemFull:{marginBottom:12},
  itemLabel:{fontSize:11,fontWeight:'700',color:'#adb5bd',textTransform:'uppercase',letterSpacing:0.5,marginBottom:6},
  itemValue:{fontSize:15,fontWeight:'600',color:'#0a1628'},
  btnRow:{marginHorizontal:16,marginVertical:16,gap:10},
  btn:{flexDirection:'row',backgroundColor:'#0a285c',paddingVertical:14,borderRadius:10,alignItems:'center',justifyContent:'center',gap:8},
  btnText:{color:'#fff',fontSize:15,fontWeight:'700'},
  btnOutline:{flexDirection:'row',backgroundColor:'#fff',borderWidth:1.5,borderColor:'#0a285c',paddingVertical:14,borderRadius:10,alignItems:'center',justifyContent:'center',gap:8},
  btnOutlineTxt:{color:'#0a285c',fontSize:15,fontWeight:'700'},
  logoutBtn:{flexDirection:'row',backgroundColor:'#c1272d',marginHorizontal:16,paddingVertical:14,borderRadius:10,alignItems:'center',justifyContent:'center',gap:8},
  footer:{paddingVertical:16,paddingHorizontal:20,alignItems:'center'},footerTxt:{fontSize:11,color:'#adb5bd',marginBottom:3},
  toastWrap:{position:'absolute',bottom:20,left:16,right:16},
  toast:{flexDirection:'row',paddingHorizontal:16,paddingVertical:12,borderRadius:8,alignItems:'center',gap:12},
  toastOk:{backgroundColor:'#10b981'},toastErr:{backgroundColor:'#ef4444'},toastTxt:{color:'#fff',fontSize:13,fontWeight:'500',flex:1},
  modalWrap:{flex:1,backgroundColor:'#f5f6f8'},
  modalHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#e9ecef'},
  modalTitle:{fontSize:18,fontWeight:'700',color:'#0a1628',flex:1,textAlign:'center'},modalSave:{fontSize:16,fontWeight:'700',color:'#0a285c'},
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
  phoneRowErr:{borderColor:'#c1272d',backgroundColor:'#fff5f5'},phonePrefix:{fontSize:15,fontWeight:'600',color:'#6c757d',marginRight:4},phoneInput:{flex:1,paddingVertical:11,fontSize:15,color:'#0a1628'},
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