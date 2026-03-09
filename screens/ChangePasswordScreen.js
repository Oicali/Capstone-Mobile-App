// ================================================================================
// ChangePasswordScreen.js  — BANTAY Mobile  (REDESIGNED)
// ================================================================================
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://localhost:5000';

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  navy:        '#0B2D6B',
  navyDark:    '#071D47',
  navyLight:   '#EEF3FF',
  red:         '#C1272D',
  green:       '#059669',
  greenLight:  '#D1FAE5',
  amber:       '#D97706',
  amberLight:  '#FFF3CD',
  danger:      '#EF4444',
  dangerLight: '#FFF5F5',
  gray50:      '#F8FAFC',
  gray100:     '#F1F5F9',
  gray200:     '#E2E8F0',
  gray300:     '#CBD5E1',
  gray400:     '#94A3B8',
  gray500:     '#64748B',
  gray700:     '#334155',
  gray900:     '#0F172A',
  white:       '#FFFFFF',
};

const REQUIREMENTS = [
  { id: 'length',  label: 'At least 8 characters',         test: p => p.length >= 8 },
  { id: 'upper',   label: 'Uppercase letter (A–Z)',         test: p => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Lowercase letter (a–z)',         test: p => /[a-z]/.test(p) },
  { id: 'number',  label: 'Number (0–9)',                   test: p => /[0-9]/.test(p) },
  { id: 'special', label: 'Special character (@$!%*?&#)',   test: p => /[@$!%*?&#]/.test(p) },
];

// ── OTP Input ─────────────────────────────────────────────────────────────────
function OtpRow({ values, onChange, disabled }) {
  const refs = Array.from({ length: 6 }, () => useRef(null));

  const handleChange = (val, idx) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    onChange(idx, digit);
    if (digit && idx < 5) refs[idx + 1].current?.focus();
  };
  const handleKey = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !values[idx] && idx > 0) {
      refs[idx - 1].current?.focus();
      onChange(idx - 1, '');
    }
  };

  return (
    <View style={otp.row}>
      {values.map((v, i) => (
        <TextInput
          key={i} ref={refs[i]}
          style={[otp.box, disabled && otp.off, v && otp.filled]}
          value={v} maxLength={1} keyboardType="number-pad"
          onChangeText={val => handleChange(val, i)}
          onKeyPress={e => handleKey(e, i)}
          editable={!disabled} selectTextOnFocus
        />
      ))}
    </View>
  );
}
const otp = StyleSheet.create({
  row:    { flexDirection: 'row', gap: 9, justifyContent: 'center', marginVertical: 20 },
  box:    { width: 46, height: 56, borderWidth: 2, borderColor: C.gray200, borderRadius: 14, textAlign: 'center', fontSize: 22, fontWeight: '800', color: C.navy, backgroundColor: C.gray50 },
  filled: { borderColor: C.navy, backgroundColor: C.white, shadowColor: C.navy, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  off:    { backgroundColor: C.gray100, borderColor: C.gray200, color: C.gray300 },
});

// ── Step Bar ──────────────────────────────────────────────────────────────────
function StepBar({ current, total }) {
  return (
    <View style={sb.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[sb.seg, i < current && sb.done]} />
      ))}
    </View>
  );
}
const sb = StyleSheet.create({
  row:  { flexDirection: 'row', gap: 5, marginBottom: 4 },
  seg:  { flex: 1, height: 3, borderRadius: 2, backgroundColor: C.gray200 },
  done: { backgroundColor: C.navy },
});

// ── Status Card ───────────────────────────────────────────────────────────────
function StatusCard({ iconName, iconBg, iconColor, title, titleColor, children }) {
  return (
    <View style={sc.wrap}>
      <View style={[sc.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={36} color={iconColor} />
      </View>
      <Text style={[sc.title, titleColor && { color: titleColor }]}>{title}</Text>
      {children}
    </View>
  );
}
const sc = StyleSheet.create({
  wrap:     { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 8 },
  iconWrap: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title:    { fontSize: 20, fontWeight: '800', color: C.gray900, marginBottom: 10, textAlign: 'center', letterSpacing: -0.3 },
});

// ═══════════════════════════════════════════════════════════════════════════════
export default function ChangePasswordScreen({ navigation }) {

  const [step,            setStep]           = useState('checking');
  const [curPassword,     setCurPassword]    = useState('');
  const [curPasswordErr,  setCurPasswordErr] = useState('');
  const [curPwShow,       setCurPwShow]      = useState(false);
  const [curLoading,      setCurLoading]     = useState(false);
  const [newPassword,     setNewPassword]    = useState('');
  const [confirmPassword, setConfirmPassword]= useState('');
  const [showNew,         setShowNew]        = useState(false);
  const [showConfirm,     setShowConfirm]    = useState(false);
  const [formErrors,      setFormErrors]     = useState({});
  const [isLoading,       setIsLoading]      = useState(false);
  const [blockedHours,    setBlockedHours]   = useState(0);
  const [sessionLockMins, setSessionLockMins]= useState(0);
  const [pwLockedMins,    setPwLockedMins]   = useState(0);
  const [otpValues,   setOtpValues]   = useState(['','','','','','']);
  const [otpMasked,   setOtpMasked]   = useState('');
  const [otpTimer,    setOtpTimer]    = useState(0);
  const [resendsLeft, setResendsLeft] = useState(3);
  const [otpError,    setOtpError]    = useState('');
  const [otpState,    setOtpState]    = useState('active');

  const otpTimerRef    = useRef(null);
  const isResendingRef = useRef(false);

  const canResend = resendsLeft > 0 && (otpTimer === 0 || otpState === 'attempts-exceeded');
  const reqStatus = REQUIREMENTS.map(r => ({ ...r, met: r.test(newPassword) }));
  const allMet    = reqStatus.every(r => r.met);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    checkStatus();
    return () => clearInterval(otpTimerRef.current);
  }, []);

  const checkStatus = async () => {
    setStep('checking');
    try {
      const stored = await AsyncStorage.getItem('cpm_session_locked');
      if (stored) {
        const { until } = JSON.parse(stored);
        if (Date.now() < until) {
          setSessionLockMins(Math.ceil((until - Date.now()) / 60_000));
          setStep('session-locked');
          return;
        }
        await AsyncStorage.removeItem('cpm_session_locked');
      }
    } catch { await AsyncStorage.removeItem('cpm_session_locked'); }

    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/password/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.blocked)      { setBlockedHours(d.hoursLeft ?? 0); setStep('blocked'); }
      else if (d.sessionLocked) {
        const lm = d.minsLeft ?? 15;
        setSessionLockMins(lm);
        await AsyncStorage.setItem('cpm_session_locked', JSON.stringify({ until: Date.now() + lm * 60_000 }));
        setStep('session-locked');
      } else if (d.pwLocked) { setPwLockedMins(d.minsLeft ?? 15); setStep('pw-locked'); }
      else { setStep('verify-current'); }
    } catch { setStep('verify-current'); }
  };

  const startOtpTimer = expiresAt => {
    clearInterval(otpTimerRef.current);
    setOtpState('active');
    const tick = () => {
      const secs = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setOtpTimer(secs);
      if (secs <= 0) {
        clearInterval(otpTimerRef.current);
        setOtpState(prev => prev === 'attempts-exceeded' ? 'attempts-exceeded' : 'expired');
      }
    };
    tick();
    otpTimerRef.current = setInterval(tick, 1000);
  };

  const formatTimer = secs => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleVerifyCurrent = async () => {
    if (!curPassword.trim()) { setCurPasswordErr('Current password is required'); return; }
    setCurLoading(true); setCurPasswordErr('');
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/password/verify-current`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPassword }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.locked || d.pwLocked) { setPwLockedMins(d.minutesLeft ?? 15); setStep('pw-locked'); return; }
        if (d.sessionLocked) {
          const lm = d.minutesLeft ?? 15; setSessionLockMins(lm);
          await AsyncStorage.setItem('cpm_session_locked', JSON.stringify({ until: Date.now() + lm * 60_000 }));
          setStep('session-locked'); return;
        }
        setCurPasswordErr(d.message || 'Incorrect password'); return;
      }
      setStep('form');
    } catch { setCurPasswordErr('Network error. Check your connection.'); }
    finally { setCurLoading(false); }
  };

  const validate = () => {
    const e = {};
    if (!newPassword)         e.newPassword = 'New password is required';
    else if (!allMet)         e.newPassword = 'Password does not meet all requirements';
    if (!confirmPassword)     e.confirmPassword = 'Please confirm your new password';
    else if (!passwordsMatch) e.confirmPassword = 'Passwords do not match';
    if (newPassword && curPassword && newPassword === curPassword)
      e.newPassword = 'New password must be different from current password';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRequestOtp = async () => {
    if (!validate()) return;
    setIsLoading(true); setFormErrors({});
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/password/request-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPassword, newPassword, confirmPassword }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.blocked)       { setBlockedHours(d.hoursLeft ?? 0); setStep('blocked'); return; }
        if (d.sessionLocked) {
          const lm = d.minutesLeft ?? 15; setSessionLockMins(lm);
          await AsyncStorage.setItem('cpm_session_locked', JSON.stringify({ until: Date.now() + lm * 60_000 }));
          setStep('session-locked'); return;
        }
        if (d.locked) { setFormErrors({ general: d.message }); return; }
        if (res.status === 401) { setFormErrors({ general: 'Incorrect current password — please go back' }); return; }
        if (d.errors) { const be = {}; d.errors.forEach(e => { if (e.field) be[e.field] = e.message; }); setFormErrors(be); return; }
        setFormErrors({ general: d.message || 'Failed to send code' });
        return;
      }
      setOtpMasked(d.maskedEmail || '');
      setResendsLeft(d.resendsLeft ?? 2);
      setOtpValues(['','','','','','']);
      setOtpError(''); setOtpState('active');
      setStep('otp');
      if (d.otpExpiresAt) startOtpTimer(d.otpExpiresAt);
    } catch { setFormErrors({ general: 'Network error. Check your connection.' }); }
    finally { setIsLoading(false); }
  };

  const handleResend = async () => {
    if (!canResend || isResendingRef.current) return;
    isResendingRef.current = true;
    setIsLoading(true); setOtpError(''); setOtpValues(['','','','','','']);
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/password/request-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPassword, newPassword, confirmPassword }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked) {
          const lm = d.minutesLeft ?? 15; setSessionLockMins(lm);
          await AsyncStorage.setItem('cpm_session_locked', JSON.stringify({ until: Date.now() + lm * 60_000 }));
          setStep('session-locked'); return;
        }
        if (d.blocked) { setBlockedHours(d.hoursLeft ?? 0); setStep('blocked'); return; }
        if (d.resendsLeft === 0) { setResendsLeft(0); setOtpError('No more resends available for this session.'); return; }
        setOtpError(d.message || 'Failed to resend code'); return;
      }
      setResendsLeft(d.resendsLeft ?? 0);
      setOtpState('active');
      if (d.otpExpiresAt) startOtpTimer(d.otpExpiresAt);
    } catch { setOtpError('Network error. Check your connection.'); }
    finally { setIsLoading(false); isResendingRef.current = false; }
  };

  const handleVerifyOtp = async () => {
    const code = otpValues.join('');
    if (code.length !== 6) { setOtpError('Please enter all 6 digits'); return; }
    setIsLoading(true); setOtpError('');
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/password/verify-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: code }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.sessionLocked || d.autoClose) {
          const lm = d.minutesLeft ?? 15; setSessionLockMins(lm);
          await AsyncStorage.setItem('cpm_session_locked', JSON.stringify({ until: Date.now() + lm * 60_000 }));
          setStep('session-locked'); return;
        }
        if (d.forceResend || d.attemptLocked || res.status === 429) {
          setOtpState('attempts-exceeded');
          setOtpValues(['','','','','','']);
          clearInterval(otpTimerRef.current);
          setOtpTimer(0);
          if (d.resendsLeft !== undefined) setResendsLeft(d.resendsLeft);
          setOtpError('Too many incorrect attempts. Please request a new code.');
          return;
        }
        setOtpError(d.message || 'Incorrect code');
        setOtpValues(['','','','','','']);
        return;
      }
      clearInterval(otpTimerRef.current);
      setStep('done');
      setTimeout(async () => {
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }, 3000);
    } catch { setOtpError('Network error. Check your connection.'); }
    finally { setIsLoading(false); }
  };

  // ── Step labels ───────────────────────────────────────────────────────────────
  const STEP_LABELS = {
    'verify-current': 'Step 1 of 3 — Confirm identity',
    'form':           'Step 2 of 3 — New password',
    'otp':            'Step 3 of 3 — Verify code',
  };

  const STEP_NUM = { 'verify-current': 1, 'form': 2, 'otp': 3 };

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.headerBackBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <View style={s.headerBackInner}>
            <Ionicons name="chevron-back" size={20} color={C.white} />
          </View>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Change Password</Text>
          {STEP_LABELS[step] && (
            <Text style={s.headerSub}>{STEP_LABELS[step]}</Text>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── CHECKING ── */}
          {step === 'checking' && (
            <View style={s.statusWrap}>
              <ActivityIndicator size="large" color={C.navy} />
              <Text style={s.statusCaption}>Checking availability…</Text>
            </View>
          )}

          {/* ── BLOCKED ── */}
          {step === 'blocked' && (
            <StatusCard iconName="lock-closed" iconBg={C.navyLight} iconColor={C.navy} title="Password Change Unavailable">
              <Text style={s.statusMsg}>
                You've reached the limit of{' '}
                <Text style={{ fontWeight: '800', color: C.navy }}>2 password changes</Text> within 24 hours.
              </Text>
              {blockedHours > 0 && (
                <View style={s.timeBadge}>
                  <Ionicons name="time-outline" size={15} color={C.gray500} />
                  <Text style={s.timeBadgeTxt}>
                    Try again in <Text style={{ fontWeight: '800', color: C.navy }}>{blockedHours}h</Text>
                  </Text>
                </View>
              )}
              <TouchableOpacity style={[s.primaryBtn, { marginTop: 24, alignSelf: 'stretch' }]} onPress={() => navigation.goBack()}>
                <Text style={s.primaryBtnTxt}>Go Back</Text>
              </TouchableOpacity>
            </StatusCard>
          )}

          {/* ── SESSION LOCKED ── */}
          {step === 'session-locked' && (
            <StatusCard iconName="lock-closed" iconBg={C.amberLight} iconColor="#c2410c" title="Change Password Unavailable">
              <Text style={s.statusMsg}>
                For security reasons, this process has been temporarily locked.
              </Text>
              <View style={[s.timeBadge, { backgroundColor: C.amberLight, borderColor: '#F59E0B' }]}>
                <Ionicons name="time-outline" size={15} color="#c2410c" />
                <Text style={[s.timeBadgeTxt, { color: '#c2410c' }]}>
                  Try again in{' '}
                  <Text style={{ fontWeight: '800' }}>{sessionLockMins} min{sessionLockMins !== 1 ? 's' : ''}</Text>
                </Text>
              </View>
              <TouchableOpacity style={[s.primaryBtn, { marginTop: 24, alignSelf: 'stretch', backgroundColor: '#c2410c' }]}
                onPress={() => navigation.goBack()}>
                <Text style={s.primaryBtnTxt}>Go Back</Text>
              </TouchableOpacity>
            </StatusCard>
          )}

          {/* ── PW LOCKED ── */}
          {step === 'pw-locked' && (
            <StatusCard iconName="lock-closed" iconBg={C.amberLight} iconColor="#c2410c" title="Change Password Unavailable">
              <Text style={s.statusMsg}>Too many incorrect password attempts.</Text>
              <View style={[s.timeBadge, { backgroundColor: C.amberLight, borderColor: '#F59E0B' }]}>
                <Ionicons name="time-outline" size={15} color="#c2410c" />
                <Text style={[s.timeBadgeTxt, { color: '#c2410c' }]}>
                  Try again in{' '}
                  <Text style={{ fontWeight: '800' }}>{pwLockedMins} min{pwLockedMins !== 1 ? 's' : ''}</Text>
                </Text>
              </View>
              <TouchableOpacity style={[s.primaryBtn, { marginTop: 24, alignSelf: 'stretch', backgroundColor: '#c2410c' }]}
                onPress={() => navigation.goBack()}>
                <Text style={s.primaryBtnTxt}>Go Back</Text>
              </TouchableOpacity>
            </StatusCard>
          )}

          {/* ── DONE ── */}
          {step === 'done' && (
            <StatusCard iconName="checkmark-circle" iconBg={C.greenLight} iconColor={C.green}
              title="Password Changed!" titleColor={C.green}>
              <Text style={s.statusMsg}>
                Your password has been updated. All active sessions have been revoked.
              </Text>
              <Text style={s.statusMsg}>
                A security notification has been sent to your email.
              </Text>
              <View style={[s.timeBadge, { backgroundColor: C.greenLight, borderColor: `${C.green}33`, marginTop: 16 }]}>
                <ActivityIndicator size="small" color={C.green} />
                <Text style={[s.timeBadgeTxt, { color: C.green, fontWeight: '700' }]}>
                  Signing you out…
                </Text>
              </View>
            </StatusCard>
          )}

          {/* ── STEP 1: VERIFY CURRENT PASSWORD ── */}
          {step === 'verify-current' && (
            <View>
              <StepBar current={1} total={3} />
              <Text style={s.stepHint}>Step 1 of 3 — Confirm your identity</Text>

              <View style={s.card}>
                <View style={s.cardIconRow}>
                  <View style={s.cardIconWrap}>
                    <Ionicons name="shield-checkmark" size={22} color={C.navy} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardTitle}>Verify Current Password</Text>
                    <Text style={s.cardSub}>Enter your current password to continue.</Text>
                  </View>
                </View>

                <Text style={s.fieldLabel}>CURRENT PASSWORD</Text>
                <View style={[s.inputRow, curPasswordErr && s.inputRowErr]}>
                  <TextInput
                    style={s.input}
                    placeholder="Enter current password"
                    placeholderTextColor={C.gray300}
                    value={curPassword}
                    onChangeText={v => { setCurPassword(v); setCurPasswordErr(''); }}
                    secureTextEntry={!curPwShow}
                    autoCapitalize="none" autoCorrect={false}
                    editable={!curLoading}
                  />
                  <TouchableOpacity onPress={() => setCurPwShow(v => !v)} style={s.eyeBtn}>
                    <Ionicons name={curPwShow ? 'eye' : 'eye-off'} size={20} color={C.gray400} />
                  </TouchableOpacity>
                </View>
                {curPasswordErr ? <Text style={s.fieldErr}>{curPasswordErr}</Text> : null}
              </View>

              <View style={s.actionRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()} disabled={curLoading}>
                  <Text style={s.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, s.primaryBtnFlex, (!curPassword.trim() || curLoading) && s.btnOff]}
                  onPress={handleVerifyCurrent}
                  disabled={!curPassword.trim() || curLoading}>
                  {curLoading
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Ionicons name="arrow-forward" size={16} color={C.white} />}
                  <Text style={s.primaryBtnTxt}>{curLoading ? 'Verifying…' : 'Continue'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── STEP 2: NEW PASSWORD FORM ── */}
          {step === 'form' && (
            <View>
              <StepBar current={2} total={3} />
              <Text style={s.stepHint}>Step 2 of 3 — Set your new password</Text>

              {formErrors.general && (
                <View style={s.banner}>
                  <Ionicons name="alert-circle" size={18} color={C.white} />
                  <Text style={s.bannerTxt}>{formErrors.general}</Text>
                </View>
              )}

              <View style={s.card}>
                {/* New Password */}
                <Text style={s.fieldLabel}>NEW PASSWORD</Text>
                <View style={[s.inputRow, formErrors.newPassword && s.inputRowErr]}>
                  <TextInput
                    style={s.input}
                    placeholder="Create a strong new password"
                    placeholderTextColor={C.gray300}
                    value={newPassword}
                    onChangeText={v => { setNewPassword(v); if (formErrors.newPassword) setFormErrors(p => { const n = { ...p }; delete n.newPassword; return n; }); }}
                    secureTextEntry={!showNew}
                    autoCapitalize="none" autoCorrect={false}
                    editable={!isLoading}
                  />
                  <TouchableOpacity onPress={() => setShowNew(v => !v)} style={s.eyeBtn}>
                    <Ionicons name={showNew ? 'eye' : 'eye-off'} size={20} color={C.gray400} />
                  </TouchableOpacity>
                </View>
                {formErrors.newPassword ? <Text style={s.fieldErr}>{formErrors.newPassword}</Text> : null}

                <View style={{ height: 16 }} />

                {/* Confirm Password */}
                <Text style={s.fieldLabel}>CONFIRM NEW PASSWORD</Text>
                <View style={[s.inputRow, formErrors.confirmPassword && s.inputRowErr]}>
                  <TextInput
                    style={s.input}
                    placeholder="Re-enter your new password"
                    placeholderTextColor={C.gray300}
                    value={confirmPassword}
                    onChangeText={v => { setConfirmPassword(v); if (formErrors.confirmPassword) setFormErrors(p => { const n = { ...p }; delete n.confirmPassword; return n; }); }}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none" autoCorrect={false}
                    editable={!isLoading}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
                    <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={20} color={C.gray400} />
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && (
                  <View style={s.matchRow}>
                    <View style={[s.matchDot, { backgroundColor: passwordsMatch ? C.green : C.danger }]}>
                      <Ionicons name={passwordsMatch ? 'checkmark' : 'close'} size={10} color={C.white} />
                    </View>
                    <Text style={[s.matchTxt, { color: passwordsMatch ? C.green : C.danger }]}>
                      {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                    </Text>
                  </View>
                )}
                {formErrors.confirmPassword ? <Text style={s.fieldErr}>{formErrors.confirmPassword}</Text> : null}
              </View>

              {/* Requirements card */}
              <View style={s.reqCard}>
                <Text style={s.reqCardTitle}>PASSWORD REQUIREMENTS</Text>
                {reqStatus.map(r => (
                  <View key={r.id} style={s.reqRow}>
                    <View style={[s.reqDot, r.met && s.reqDotMet, !r.met && newPassword.length > 0 && s.reqDotFail]}>
                      <Ionicons
                        name={r.met ? 'checkmark' : 'remove'}
                        size={11}
                        color={r.met || newPassword.length > 0 ? C.white : C.gray400}
                      />
                    </View>
                    <Text style={[s.reqTxt, r.met && s.reqTxtMet, !r.met && newPassword.length > 0 && s.reqTxtFail]}>
                      {r.label}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={s.actionRow}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setStep('verify-current')} disabled={isLoading}>
                  <Ionicons name="chevron-back" size={16} color={C.gray500} />
                  <Text style={s.cancelTxt}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, s.primaryBtnFlex, (!allMet || !passwordsMatch || isLoading) && s.btnOff]}
                  onPress={handleRequestOtp}
                  disabled={isLoading || !allMet || !passwordsMatch}>
                  {isLoading
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Ionicons name="send" size={15} color={C.white} />}
                  <Text style={s.primaryBtnTxt}>
                    {isLoading ? 'Sending Code…' : 'Send Verification Code →'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── STEP 3: OTP ── */}
          {step === 'otp' && (
            <View>
              <StepBar current={3} total={3} />
              <Text style={s.stepHint}>Step 3 of 3 — Enter verification code</Text>

              {/* Info box */}
              <View style={s.infoBox}>
                <View style={s.infoIconWrap}>
                  <Ionicons name="mail" size={20} color="#1d4ed8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.infoTitle}>
                    Code sent to{' '}
                    <Text style={{ fontWeight: '700', color: C.navy }}>{otpMasked}</Text>
                  </Text>
                  <Text style={s.infoSub}>
                    Expires in <Text style={{ fontWeight: '700' }}>2 minutes</Text>. Do not share.
                  </Text>
                </View>
              </View>

              {/* Timer pill — hidden when attempts-exceeded */}
              {otpState !== 'attempts-exceeded' && (
                <View style={[
                  s.timerPill,
                  otpTimer <= 30 && otpTimer > 0 && s.timerWarn,
                  otpTimer === 0 && s.timerExpired,
                ]}>
                  <Ionicons
                    name="time-outline" size={15}
                    color={otpTimer === 0 ? C.danger : otpTimer <= 30 ? C.amber : C.navy}
                  />
                  <Text style={[
                    s.timerTxt,
                    otpTimer <= 30 && otpTimer > 0 && { color: C.amber },
                    otpTimer === 0 && { color: C.danger },
                  ]}>
                    {otpTimer > 0
                      ? `Expires in ${formatTimer(otpTimer)}`
                      : 'This code is no longer valid. Request a new one.'}
                  </Text>
                </View>
              )}

              {/* Error banner */}
              {otpError !== '' && (
                <View style={[s.banner, otpState === 'attempts-exceeded' && s.bannerAmber]}>
                  <Ionicons
                    name={otpState === 'attempts-exceeded' ? 'warning' : 'close-circle'}
                    size={18} color={C.white}
                  />
                  <Text style={s.bannerTxt}>{otpError}</Text>
                </View>
              )}

              <OtpRow
                values={otpValues}
                onChange={(idx, val) =>
                  setOtpValues(prev => { const n = [...prev]; n[idx] = val; return n; })
                }
                disabled={isLoading || otpState !== 'active'}
              />

              {/* Confirm button — shown only when active */}
              {otpState === 'active' && (
                <TouchableOpacity
                  style={[s.primaryBtn, (otpValues.join('').length !== 6 || isLoading) && s.btnOff]}
                  onPress={handleVerifyOtp}
                  disabled={otpValues.join('').length !== 6 || isLoading}>
                  {isLoading
                    ? <ActivityIndicator size="small" color={C.white} />
                    : <Ionicons name="checkmark-circle" size={18} color={C.white} />}
                  <Text style={s.primaryBtnTxt}>
                    {isLoading ? 'Verifying…' : 'Confirm Password Change'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Resend */}
              <View style={s.resendWrap}>
                {resendsLeft <= 0 ? (
                  <Text style={s.resendExhausted}>No more resends available for this session</Text>
                ) : canResend ? (
                  <TouchableOpacity
                    style={[s.resendBtn, isLoading && { opacity: 0.5 }]}
                    onPress={handleResend} disabled={isLoading}>
                    <Ionicons name="refresh" size={15} color={isLoading ? C.gray300 : C.navy} />
                    <Text style={[s.resendBtnTxt, isLoading && { color: C.gray300 }]}>
                      {isLoading ? 'Sending…' : `Resend Code (${resendsLeft} left)`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: C.gray50 },
  scroll:        { flex: 1 },
  scrollContent: { padding: 20 },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.navy, paddingHorizontal: 16, paddingVertical: 14, shadowColor: C.navyDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  headerBackBtn:   { width: 44, alignItems: 'flex-start' },
  headerBackInner: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerCenter:    { flex: 1, alignItems: 'center' },
  headerTitle:     { fontSize: 17, fontWeight: '800', color: C.white, letterSpacing: -0.3 },
  headerSub:       { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: '500' },

  // Status screens
  statusWrap:    { alignItems: 'center', paddingVertical: 64, gap: 14 },
  statusCaption: { fontSize: 13, color: C.gray400, fontWeight: '500' },
  statusMsg:     { fontSize: 14, color: C.gray500, textAlign: 'center', lineHeight: 22, marginBottom: 8, paddingHorizontal: 8 },
  timeBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.navyLight, borderWidth: 1, borderColor: `${C.navy}22`, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginTop: 12 },
  timeBadgeTxt:  { fontSize: 13, color: C.gray500, fontWeight: '500' },

  // Step
  stepHint:      { fontSize: 10, fontWeight: '800', color: C.gray400, marginBottom: 18, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.6 },

  // Card
  card:          { backgroundColor: C.white, borderRadius: 18, padding: 20, marginBottom: 16, shadowColor: C.navy, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3, borderWidth: 1, borderColor: C.gray100 },
  cardIconRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20 },
  cardIconWrap:  { width: 48, height: 48, borderRadius: 24, backgroundColor: C.navyLight, alignItems: 'center', justifyContent: 'center' },
  cardTitle:     { fontSize: 16, fontWeight: '800', color: C.gray900, marginBottom: 4, letterSpacing: -0.2 },
  cardSub:       { fontSize: 13, color: C.gray500, lineHeight: 18 },

  // Fields
  fieldLabel:    { fontSize: 10, fontWeight: '800', color: C.gray400, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 2 },
  inputRow:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.gray200, borderRadius: 13, backgroundColor: C.gray50, paddingHorizontal: 14 },
  inputRowErr:   { borderColor: C.danger, backgroundColor: C.dangerLight },
  input:         { flex: 1, fontSize: 15, color: C.gray900, paddingVertical: 14 },
  eyeBtn:        { padding: 8 },
  fieldErr:      { color: C.danger, fontSize: 12, marginTop: 6, fontWeight: '500' },
  matchRow:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  matchDot:      { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  matchTxt:      { fontSize: 12, fontWeight: '600' },

  // Requirements card
  reqCard:       { backgroundColor: C.white, borderRadius: 18, padding: 18, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: C.navy, shadowColor: C.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: C.gray100 },
  reqCardTitle:  { fontSize: 10, fontWeight: '800', color: C.navy, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  reqRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  reqDot:        { width: 20, height: 20, borderRadius: 10, backgroundColor: C.gray200, alignItems: 'center', justifyContent: 'center' },
  reqDotMet:     { backgroundColor: C.green },
  reqDotFail:    { backgroundColor: C.danger },
  reqTxt:        { fontSize: 13, color: C.gray400, flex: 1 },
  reqTxtMet:     { color: C.green, fontWeight: '600' },
  reqTxtFail:    { color: C.danger },

  // Action buttons
  actionRow:     { flexDirection: 'row', gap: 12, marginTop: 4, marginBottom: 8 },
  cancelBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1.5, borderColor: C.gray200, backgroundColor: C.white },
  cancelTxt:     { fontSize: 14, fontWeight: '700', color: C.gray500 },
  primaryBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15, paddingHorizontal: 20, borderRadius: 13, backgroundColor: C.navy, shadowColor: C.navy, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 5 },
  primaryBtnFlex:{ flex: 1 },
  primaryBtnTxt: { fontSize: 15, fontWeight: '800', color: C.white, letterSpacing: -0.2 },
  btnOff:        { opacity: 0.4, shadowOpacity: 0 },

  // Banner
  banner:        { flexDirection: 'row', backgroundColor: C.danger, borderRadius: 13, padding: 13, alignItems: 'flex-start', marginBottom: 4, gap: 10 },
  bannerAmber:   { backgroundColor: C.amber },
  bannerTxt:     { color: C.white, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 19 },

  // OTP step
  infoBox:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 14, padding: 14, marginBottom: 12, gap: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  infoIconWrap:  { width: 38, height: 38, borderRadius: 19, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  infoTitle:     { fontSize: 14, color: C.gray900, marginBottom: 3, fontWeight: '500' },
  infoSub:       { fontSize: 12, color: C.gray500, lineHeight: 17 },
  timerPill:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: C.navyLight, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8, justifyContent: 'center' },
  timerWarn:     { backgroundColor: C.amberLight },
  timerExpired:  { backgroundColor: C.dangerLight },
  timerTxt:      { fontSize: 13, fontWeight: '700', color: C.navy },
  resendWrap:    { alignItems: 'center', marginTop: 18, minHeight: 36 },
  resendBtn:     { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 11, paddingHorizontal: 22, borderRadius: 12, borderWidth: 1.5, borderColor: C.navy, backgroundColor: C.navyLight },
  resendBtnTxt:  { fontSize: 14, fontWeight: '700', color: C.navy },
  resendExhausted:{ fontSize: 13, color: C.gray400, fontStyle: 'italic' },
});