import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://localhost:5000';

const REQUIREMENTS = [
  { id: 'length',  label: 'At least 8 characters long',           test: (p) => p.length >= 8 },
  { id: 'upper',   label: 'Contains uppercase letter (A-Z)',       test: (p) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Contains lowercase letter (a-z)',       test: (p) => /[a-z]/.test(p) },
  { id: 'number',  label: 'Contains at least one number (0-9)',    test: (p) => /[0-9]/.test(p) },
  { id: 'special', label: 'Contains special character (@$!%*?&#)', test: (p) => /[@$!%*?&#]/.test(p) },
];

export default function ChangePasswordScreen({ navigation }) {
  const [currentPassword,  setCurrentPassword]  = useState('');
  const [newPassword,      setNewPassword]       = useState('');
  const [confirmPassword,  setConfirmPassword]   = useState('');
  const [showCurrent,      setShowCurrent]       = useState(false);
  const [showNew,          setShowNew]           = useState(false);
  const [showConfirm,      setShowConfirm]       = useState(false);
  const [errors,           setErrors]            = useState({});
  const [isLoading,        setIsLoading]         = useState(false);
  const [successMsg,       setSuccessMsg]        = useState('');

  const reqStatus = REQUIREMENTS.map(r => ({ ...r, met: r.test(newPassword) }));
  const allMet    = reqStatus.every(r => r.met);
  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;

  const clearError = (field) => {
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validate = () => {
    const e = {};
    if (!currentPassword.trim()) e.currentPassword = 'Current password is required';
    if (!newPassword)            e.newPassword = 'New password is required';
    else if (!allMet)            e.requirements = 'Password does not meet all requirements';
    if (!confirmPassword)        e.confirmPassword = 'Please confirm your new password';
    else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (currentPassword && newPassword && currentPassword === newPassword)
      e.newPassword = 'New password must be different from current password';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) { setErrors({ general: 'Not authenticated. Please log in again.' }); return; }
      const res = await fetch(BASE_URL + '/users/change-password', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setErrors({ currentPassword: data.message || 'Current password is incorrect' });
        else setErrors({ general: data.message || 'Failed to change password' });
        return;
      }
      setSuccessMsg('Password changed! Logging you out for security...');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setErrors({});
      setTimeout(async () => {
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }, 2000);
    } catch (err) {
      setErrors({ general: 'Network error. Check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Change Password</Text>
        <View style={s.backBtn} />
      </View>

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>

        {successMsg !== '' && (
          <View style={s.successBanner}>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.successTitle}>Success!</Text>
              <Text style={s.successSub}>{successMsg}</Text>
            </View>
          </View>
        )}

        {errors.general !== undefined && (
          <View style={s.errorBanner}>
            <Ionicons name="close-circle" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, marginLeft: 10 }}>{errors.general}</Text>
          </View>
        )}

        <View style={s.card}>

          <Text style={s.label}>CURRENT PASSWORD</Text>
          <View style={[s.inputRow, errors.currentPassword ? s.inputRowErr : null]}>
            <TextInput
              style={s.input}
              placeholder="Enter current password"
              placeholderTextColor="#adb5bd"
              value={currentPassword}
              onChangeText={(v) => { setCurrentPassword(v); clearError('currentPassword'); }}
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)} style={s.eyeBtn}>
              <Ionicons name={showCurrent ? 'eye' : 'eye-off'} size={20} color="#adb5bd" />
            </TouchableOpacity>
          </View>
          {errors.currentPassword ? <Text style={s.errTxt}>{errors.currentPassword}</Text> : null}

          <View style={{ height: 20 }} />

          <Text style={s.label}>NEW PASSWORD *</Text>
          <View style={[s.inputRow, errors.newPassword ? s.inputRowErr : null]}>
            <TextInput
              style={s.input}
              placeholder="Enter new password"
              placeholderTextColor="#adb5bd"
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); clearError('newPassword'); clearError('requirements'); }}
              secureTextEntry={!showNew}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)} style={s.eyeBtn}>
              <Ionicons name={showNew ? 'eye' : 'eye-off'} size={20} color="#adb5bd" />
            </TouchableOpacity>
          </View>
          {errors.newPassword ? <Text style={s.errTxt}>{errors.newPassword}</Text> : null}
          {errors.requirements ? <Text style={s.errTxt}>{errors.requirements}</Text> : null}

          <View style={{ height: 20 }} />

          <Text style={s.label}>CONFIRM NEW PASSWORD *</Text>
          <View style={[s.inputRow, errors.confirmPassword ? s.inputRowErr : null]}>
            <TextInput
              style={s.input}
              placeholder="Confirm new password"
              placeholderTextColor="#adb5bd"
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); clearError('confirmPassword'); }}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={s.eyeBtn}>
              <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={20} color="#adb5bd" />
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && (
            <View style={s.matchRow}>
              <Ionicons
                name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                size={15}
                color={passwordsMatch ? '#10b981' : '#ef4444'}
              />
              <Text style={{ fontSize: 12, fontWeight: '500', marginLeft: 5, color: passwordsMatch ? '#10b981' : '#ef4444' }}>
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </Text>
            </View>
          )}
          {errors.confirmPassword ? <Text style={s.errTxt}>{errors.confirmPassword}</Text> : null}

          <View style={{ height: 20 }} />

          <View style={s.reqBox}>
            <Text style={s.reqTitle}>PASSWORD REQUIREMENTS:</Text>
            {reqStatus.map(r => (
              <View key={r.id} style={s.reqRow}>
                <Ionicons
                  name={r.met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={r.met ? '#10b981' : newPassword.length > 0 ? '#ef4444' : '#adb5bd'}
                />
                <Text style={[s.reqTxt, r.met ? s.reqTxtMet : null]}>{r.label}</Text>
              </View>
            ))}
          </View>

        </View>

        <View style={s.btnRow}>
          <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()} disabled={isLoading}>
            <Text style={s.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.submitBtn, (!allMet || isLoading) ? s.submitBtnDisabled : null]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="lock-closed" size={16} color="#fff" />
            )}
            <Text style={s.submitTxt}>{isLoading ? 'Changing...' : 'Change Password'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:         { flex: 1, backgroundColor: '#f5f6f8' },
  scroll:            { flex: 1 },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0a285c', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle:       { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  backBtn:           { width: 40 },
  successBanner:     { flexDirection: 'row', backgroundColor: '#10b981', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  successTitle:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  successSub:        { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },
  errorBanner:       { flexDirection: 'row', backgroundColor: '#ef4444', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  card:              { backgroundColor: '#fff', borderRadius: 14, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  label:             { fontSize: 11, fontWeight: '700', color: '#6c757d', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  inputRow:          { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#dee2e6', borderRadius: 10, backgroundColor: '#f8f9fa', paddingHorizontal: 14 },
  inputRowErr:       { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  input:             { flex: 1, fontSize: 15, color: '#0a1628', paddingVertical: 13 },
  eyeBtn:            { padding: 8 },
  errTxt:            { color: '#ef4444', fontSize: 12, marginTop: 6, fontWeight: '500' },
  matchRow:          { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  reqBox:            { backgroundColor: '#f0f4ff', borderLeftWidth: 3, borderLeftColor: '#0a285c', borderRadius: 8, padding: 14 },
  reqTitle:          { fontSize: 11, fontWeight: '800', color: '#0a285c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  reqRow:            { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  reqTxt:            { fontSize: 13, color: '#6c757d', flex: 1, marginLeft: 8 },
  reqTxtMet:         { color: '#10b981', fontWeight: '600' },
  btnRow:            { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:         { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#dee2e6', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  cancelTxt:         { fontSize: 15, fontWeight: '700', color: '#6c757d' },
  submitBtn:         { flex: 2, flexDirection: 'row', paddingVertical: 14, borderRadius: 10, backgroundColor: '#c1272d', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitTxt:         { fontSize: 15, fontWeight: '700', color: '#fff' },
});