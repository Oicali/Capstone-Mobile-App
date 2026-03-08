// ================================================================================
// ChangePasswordScreen.js
// Mirrors web ChangePasswordModal.jsx security logic exactly:
//   • GET /users/password/status on mount → blocked / session-locked / ok
//   • POST /users/password/request-otp  → validates passwords, sends OTP
//   • POST /users/password/verify-otp   → verifies OTP, force-logs out on success
//   • 2-min live OTP countdown (MM:SS), red when expired
//   • Resend ONLY available after OTP expires (not on 60s timer)
//   • Max 3 resends, max 3 wrong attempts → 15-min session lock
//   • Max 2 password changes per 24h → blocked screen
//   • Security email sent by backend on success
//   • Auto logout 3s after success
// ================================================================================
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://localhost:5000';

const REQUIREMENTS = [
  { id: 'length',  label: 'At least 8 characters',               test: p => p.length >= 8 },
  { id: 'upper',   label: 'Uppercase letter (A–Z)',               test: p => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Lowercase letter (a–z)',               test: p => /[a-z]/.test(p) },
  { id: 'number',  label: 'Number (0–9)',                         test: p => /[0-9]/.test(p) },
  { id: 'special', label: 'Special character (@$!%*?&#)',          test: p => /[@$!%*?&#]/.test(p) },
];

// ── 6-digit OTP input ──────────────────────────────────────────────────────────
function OtpBoxes({ values, onChange, disabled }) {
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];

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
          style={[otp.box, disabled && otp.boxDisabled, v && otp.boxFilled]}
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
  row:        { flexDirection: 'row', gap: 10, justifyContent: 'center', marginVertical: 20 },
  box:        { width: 46, height: 56, borderWidth: 2, borderColor: '#dee2e6', borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#0a285c', backgroundColor: '#f8fafc' },
  boxFilled:  { borderColor: '#0a285c', backgroundColor: '#fff' },
  boxDisabled:{ backgroundColor: '#f0f0f0', borderColor: '#e0e0e0', color: '#adb5bd' },
});

// ═══════════════════════════════════════════════════════════════════════════════
export default function ChangePasswordScreen({ navigation }) {

  // step: 'checking' | 'blocked' | 'session-locked' | 'form' | 'otp' | 'done'
  const [step,            setStep]           = useState('checking');

  // Form fields
  const [currentPassword, setCurrentPassword]= useState('');
  const [newPassword,     setNewPassword]    = useState('');
  const [confirmPassword, setConfirmPassword]= useState('');
  const [showCurrent,     setShowCurrent]    = useState(false);
  const [showNew,         setShowNew]        = useState(false);
  const [showConfirm,     setShowConfirm]    = useState(false);
  const [errors,          setErrors]         = useState({});
  const [isLoading,       setIsLoading]      = useState(false);

  // Blocked / locked info
  const [blockedHours,    setBlockedHours]   = useState(0);
  const [sessionLockMins, setSessionLockMins]= useState(0);

  // OTP step
  const [otpValues,   setOtpValues]   = useState(['','','','','','']);
  const [otpMasked,   setOtpMasked]   = useState('');
  const [otpTimer,    setOtpTimer]    = useState(0);
  const [resendsLeft, setResendsLeft] = useState(3);
  const [otpError,    setOtpError]    = useState('');
  const [lockedMins,  setLockedMins]  = useState(0);

  const otpTimerRef = useRef(null);

  const reqStatus      = REQUIREMENTS.map(r => ({ ...r, met: r.test(newPassword) }));
  const allMet         = reqStatus.every(r => r.met);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // ── Mount: check status first (no form flash) ────────────────────────────
  useEffect(() => {
    checkStatus();
    return () => clearInterval(otpTimerRef.current);
  }, []);

  const checkStatus = async () => {
    setStep('checking');
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/password/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.blocked)       { setBlockedHours(d.hoursLeft ?? 0); setStep('blocked'); }
      else if (d.sessionLocked) { setSessionLockMins(d.minsLeft ?? 15); setStep('session-locked'); }
      else                 { setStep('form'); }
    } catch {
      setStep('form');
    }
  };

  // ── 2-min OTP countdown ──────────────────────────────────────────────────
  const startOtpTimer = expiresAt => {
    clearInterval(otpTimerRef.current);
    const tick = () => {
      const secs = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setOtpTimer(secs);
      if (secs <= 0) clearInterval(otpTimerRef.current);
    };
    tick();
    otpTimerRef.current = setInterval(tick, 1000);
  };

  const formatTimer = secs => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const clearErr = field => {
    if (errors[field]) setErrors(p => { const n = { ...p }; delete n[field]; return n; });
  };

  // ── Validate form ────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!currentPassword.trim())  e.currentPassword = 'Current password is required';
    if (!newPassword)             e.newPassword = 'New password is required';
    else if (!allMet)             e.newPassword = 'Password does not meet all requirements';
    if (!confirmPassword)         e.confirmPassword = 'Please confirm your new password';
    else if (!passwordsMatch)     e.confirmPassword = 'Passwords do not match';
    if (currentPassword && newPassword && currentPassword === newPassword)
      e.newPassword = 'New password must be different from current password';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Step 1: Request OTP ─────────────────────────────────────────────────
  const handleRequestOtp = async () => {
    if (!validate()) return;
    setIsLoading(true); setErrors({});
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/password/request-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const d = await res.json();

      if (!res.ok) {
        if (d.blocked)       { setBlockedHours(d.hoursLeft ?? 0); setStep('blocked'); return; }
        if (d.sessionLocked) { setSessionLockMins(d.minutesLeft ?? 15); setStep('session-locked'); return; }
        if (d.locked)        { setErrors({ general: d.message }); return; }
        if (res.status === 401) { setErrors({ currentPassword: d.message || 'Incorrect password' }); return; }
        if (d.errors)        {
          const be = {};
          d.errors.forEach(e => { if (e.field) be[e.field] = e.message; });
          setErrors(be);
          return;
        }
        setErrors({ general: d.message || 'Failed to send code' });
        return;
      }

      setOtpMasked(d.maskedEmail || '');
      setResendsLeft(d.resendsLeft ?? 2);
      setOtpValues(['','','','','','']);
      setOtpError(''); setLockedMins(0);
      setStep('otp');
      if (d.otpExpiresAt) startOtpTimer(d.otpExpiresAt);

    } catch {
      setErrors({ general: 'Network error. Check your connection.' });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Resend (only when timer hits 0) ──────────────────────────────────────
  const handleResend = async () => {
    if (resendsLeft <= 0 || otpTimer > 0) return;
    setIsLoading(true); setOtpError(''); setOtpValues(['','','','','','']);
    try {
      const token = await AsyncStorage.getItem('token');
      const res   = await fetch(`${BASE_URL}/users/password/request-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const d = await res.json();

      if (!res.ok) {
        if (d.sessionLocked) { setSessionLockMins(d.minutesLeft ?? 15); setStep('session-locked'); return; }
        if (d.blocked)       { setBlockedHours(d.hoursLeft ?? 0); setStep('blocked'); return; }
        setOtpError(d.message || 'Failed to resend code');
        return;
      }

      setResendsLeft(d.resendsLeft ?? 0);
      if (d.otpExpiresAt) startOtpTimer(d.otpExpiresAt);

    } catch {
      setOtpError('Network error. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──────────────────────────────────────────────────
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
        if (d.sessionLocked) { setSessionLockMins(d.minutesLeft ?? 15); setStep('session-locked'); return; }
        if (d.locked)        { setLockedMins(d.minutesLeft ?? 15); setOtpError(d.message); return; }
        setOtpError(d.message || 'Incorrect code');
        setOtpValues(['','','','','','']);
        return;
      }

      clearInterval(otpTimerRef.current);
      setStep('done');
      // Backend revoked all tokens — force logout after 3s
      setTimeout(async () => {
        await AsyncStorage.clear();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }, 3000);

    } catch {
      setOtpError('Network error. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.headerSide}
          hitSlop={{ top:10, bottom:10, left:10, right:10 }}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Change Password</Text>
        <View style={s.headerSide} />
      </View>

      {/* ── CHECKING spinner ── */}
      {step === 'checking' && (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#0a285c" />
          <Text style={s.centerTxt}>Checking availability…</Text>
        </View>
      )}

      {/* ── BLOCKED — 24h limit ── */}
      {step === 'blocked' && (
        <View style={s.center}>
          <View style={s.statusIcon}>
            <Ionicons name="lock-closed" size={38} color="#0a285c" />
          </View>
          <Text style={s.statusTitle}>Password Change Unavailable</Text>
          <Text style={s.statusMsg}>
            You have reached the maximum of{' '}
            <Text style={{ fontWeight: '700' }}>2 password changes</Text> within 24 hours.
          </Text>
          {blockedHours > 0 && (
            <Text style={s.statusSub}>
              Try again in{' '}
              <Text style={{ fontWeight: '700' }}>{blockedHours} hour{blockedHours !== 1 ? 's' : ''}</Text>.
            </Text>
          )}
          <TouchableOpacity style={[s.fullBtn, { marginTop: 28 }]} onPress={() => navigation.goBack()}>
            <Text style={s.fullBtnTxt}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── SESSION LOCKED ── */}
      {step === 'session-locked' && (
        <View style={s.center}>
          <View style={[s.statusIcon, { backgroundColor: '#fff3cd' }]}>
            <Ionicons name="lock-closed" size={38} color="#c2410c" />
          </View>
          <Text style={s.statusTitle}>Change Password Unavailable</Text>
          <Text style={s.statusMsg}>
            For security reasons, this process has been temporarily locked.
          </Text>
          <Text style={s.statusSub}>
            Please try again after{' '}
            <Text style={{ fontWeight: '700' }}>{sessionLockMins} minute{sessionLockMins !== 1 ? 's' : ''}</Text>.
          </Text>
          <TouchableOpacity style={[s.fullBtn, { marginTop: 28 }]} onPress={() => navigation.goBack()}>
            <Text style={s.fullBtnTxt}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── DONE ── */}
      {step === 'done' && (
        <View style={s.center}>
          <View style={[s.statusIcon, { backgroundColor: '#d1fae5' }]}>
            <Ionicons name="checkmark" size={38} color="#059669" />
          </View>
          <Text style={[s.statusTitle, { color: '#059669' }]}>Password Changed!</Text>
          <Text style={s.statusMsg}>
            Your password has been updated and all active sessions have been revoked.
          </Text>
          <Text style={s.statusMsg}>
            A security notification has been sent to your email.
          </Text>
          <Text style={[s.statusSub, { marginTop: 14 }]}>Logging you out automatically…</Text>
          <ActivityIndicator size="small" color="#0a285c" style={{ marginTop: 20 }} />
        </View>
      )}

      {/* ── FORM — Step 1 ── */}
      {step === 'form' && (
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20 }}>

          <View style={s.stepRow}>
            <View style={[s.stepBar, s.stepOn]} />
            <View style={s.stepBar} />
          </View>
          <Text style={s.stepHint}>Step 1 of 2 — Enter your new password</Text>

          {errors.general != null && (
            <View style={s.banner}>
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={s.bannerTxt}>{errors.general}</Text>
            </View>
          )}

          <View style={s.card}>

            {/* Current Password */}
            <Text style={s.fieldLabel}>CURRENT PASSWORD *</Text>
            <View style={[s.inputRow, errors.currentPassword && s.inputErr]}>
              <TextInput
                style={s.input}
                placeholder="Enter current password"
                placeholderTextColor="#adb5bd"
                value={currentPassword}
                onChangeText={v => { setCurrentPassword(v); clearErr('currentPassword'); }}
                secureTextEntry={!showCurrent}
                autoCapitalize="none" autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={s.eyeBtn}>
                <Ionicons name={showCurrent ? 'eye' : 'eye-off'} size={20} color="#adb5bd" />
              </TouchableOpacity>
            </View>
            {errors.currentPassword
              ? <Text style={s.errTxt}>{errors.currentPassword}</Text> : null}

            <View style={{ height: 18 }} />

            {/* New Password */}
            <Text style={s.fieldLabel}>NEW PASSWORD *</Text>
            <View style={[s.inputRow, errors.newPassword && s.inputErr]}>
              <TextInput
                style={s.input}
                placeholder="Create a strong new password"
                placeholderTextColor="#adb5bd"
                value={newPassword}
                onChangeText={v => { setNewPassword(v); clearErr('newPassword'); }}
                secureTextEntry={!showNew}
                autoCapitalize="none" autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)} style={s.eyeBtn}>
                <Ionicons name={showNew ? 'eye' : 'eye-off'} size={20} color="#adb5bd" />
              </TouchableOpacity>
            </View>
            {errors.newPassword ? <Text style={s.errTxt}>{errors.newPassword}</Text> : null}

            <View style={{ height: 18 }} />

            {/* Confirm Password */}
            <Text style={s.fieldLabel}>CONFIRM NEW PASSWORD *</Text>
            <View style={[s.inputRow, errors.confirmPassword && s.inputErr]}>
              <TextInput
                style={s.input}
                placeholder="Re-enter your new password"
                placeholderTextColor="#adb5bd"
                value={confirmPassword}
                onChangeText={v => { setConfirmPassword(v); clearErr('confirmPassword'); }}
                secureTextEntry={!showConfirm}
                autoCapitalize="none" autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={s.eyeBtn}>
                <Ionicons name={showConfirm ? 'eye' : 'eye-off'} size={20} color="#adb5bd" />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && (
              <View style={s.matchRow}>
                <Ionicons
                  name={passwordsMatch ? 'checkmark-circle' : 'close-circle'}
                  size={15} color={passwordsMatch ? '#10b981' : '#ef4444'} />
                <Text style={[s.matchTxt, { color: passwordsMatch ? '#10b981' : '#ef4444' }]}>
                  {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                </Text>
              </View>
            )}
            {errors.confirmPassword
              ? <Text style={s.errTxt}>{errors.confirmPassword}</Text> : null}

            <View style={{ height: 18 }} />

            {/* Requirements */}
            <View style={s.reqBox}>
              <Text style={s.reqTitle}>PASSWORD REQUIREMENTS</Text>
              {reqStatus.map(r => (
                <View key={r.id} style={s.reqRow}>
                  <Ionicons
                    name={r.met ? 'checkmark-circle' : 'ellipse-outline'}
                    size={16}
                    color={r.met ? '#10b981' : newPassword.length > 0 ? '#ef4444' : '#adb5bd'}
                  />
                  <Text style={[s.reqTxt, r.met && s.reqTxtMet]}>{r.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={s.btnRow}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => navigation.goBack()} disabled={isLoading}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.submitBtn, (!allMet || !passwordsMatch || isLoading) && s.submitOff]}
              onPress={handleRequestOtp}
              disabled={isLoading || !allMet || !passwordsMatch}>
              {isLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="send" size={16} color="#fff" />}
              <Text style={s.submitTxt}>
                {isLoading ? 'Sending Code…' : 'Send Verification Code →'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── OTP — Step 2 ── */}
      {step === 'otp' && (
        <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20 }}>

          <View style={s.stepRow}>
            <View style={[s.stepBar, s.stepOn]} />
            <View style={[s.stepBar, s.stepOn]} />
          </View>
          <Text style={s.stepHint}>Step 2 of 2 — Enter the code sent to your email</Text>

          {/* Info box */}
          <View style={s.infoBox}>
            <Ionicons name="mail" size={22} color="#1d4ed8" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.infoTitle}>
                Code sent to <Text style={{ fontWeight: '700' }}>{otpMasked}</Text>
              </Text>
              <Text style={s.infoSub}>
                This code expires in{' '}
                <Text style={{ fontWeight: '700' }}>2 minutes</Text>. Do not share it with anyone.
              </Text>
            </View>
          </View>

          {/* Countdown */}
          <View style={[
            s.timerBox,
            otpTimer <= 30 && otpTimer > 0 && s.timerWarn,
            otpTimer === 0 && s.timerExpired,
          ]}>
            <Ionicons
              name="timer-outline" size={16}
              color={otpTimer === 0 ? '#842029' : otpTimer <= 30 ? '#856404' : '#0a285c'}
            />
            <Text style={[
              s.timerTxt,
              otpTimer <= 30 && otpTimer > 0 && { color: '#856404' },
              otpTimer === 0 && { color: '#842029' },
            ]}>
              {otpTimer > 0
                ? `Expires in ${formatTimer(otpTimer)}`
                : 'Code expired — request a new one'}
            </Text>
          </View>

          {otpError !== '' && (
            <View style={[s.banner, lockedMins > 0 && { backgroundColor: '#c2410c' }]}>
              <Ionicons name="close-circle" size={20} color="#fff" />
              <Text style={s.bannerTxt}>{otpError}</Text>
            </View>
          )}

          <OtpBoxes
            values={otpValues}
            onChange={(idx, val) =>
              setOtpValues(prev => { const n = [...prev]; n[idx] = val; return n; })
            }
            disabled={isLoading || lockedMins > 0 || otpTimer === 0}
          />

          <TouchableOpacity
            style={[
              s.fullBtn,
              (otpValues.join('').length !== 6 || isLoading || lockedMins > 0 || otpTimer === 0)
                && s.fullBtnOff,
            ]}
            onPress={handleVerifyOtp}
            disabled={otpValues.join('').length !== 6 || isLoading || lockedMins > 0 || otpTimer === 0}>
            {isLoading
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="checkmark-circle" size={18} color="#fff" />}
            <Text style={s.fullBtnTxt}>
              {isLoading ? 'Verifying…' : 'Confirm Password Change'}
            </Text>
          </TouchableOpacity>

          {/* Resend — only when timer hits 0 */}
          <View style={s.resendWrap}>
            {resendsLeft <= 0
              ? <Text style={s.resendExhausted}>No more resends available for this session</Text>
              : otpTimer > 0
                ? <Text style={s.resendWaiting}>Resend available after code expires</Text>
                : (
                  <TouchableOpacity onPress={handleResend} disabled={isLoading}>
                    <Text style={s.resendLink}>
                      {isLoading ? 'Sending…' : `Resend Code (${resendsLeft} left)`}
                    </Text>
                  </TouchableOpacity>
                )
            }
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f5f6f8' },
  scroll:          { flex: 1 },

  // Header
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0a285c', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle:     { fontSize: 18, fontWeight: '700', color: '#fff', flex: 1, textAlign: 'center' },
  headerSide:      { width: 40 },

  // Status screens
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerTxt:       { fontSize: 14, color: '#6c757d', marginTop: 14, fontWeight: '500' },
  statusIcon:      { width: 84, height: 84, borderRadius: 42, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  statusTitle:     { fontSize: 19, fontWeight: '700', color: '#0a1628', marginBottom: 12, textAlign: 'center' },
  statusMsg:       { fontSize: 14, color: '#495057', textAlign: 'center', lineHeight: 22, marginBottom: 6 },
  statusSub:       { fontSize: 13, color: '#6c757d', textAlign: 'center', marginTop: 6 },

  // Step bar
  stepRow:         { flexDirection: 'row', gap: 6, marginBottom: 6 },
  stepBar:         { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(10,40,92,0.15)' },
  stepOn:          { backgroundColor: '#0a285c' },
  stepHint:        { fontSize: 12, color: '#6c757d', marginBottom: 16 },

  // Banner
  banner:          { flexDirection: 'row', backgroundColor: '#ef4444', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 14, gap: 10 },
  bannerTxt:       { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },

  // Form card
  card:            { backgroundColor: '#fff', borderRadius: 14, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  fieldLabel:      { fontSize: 11, fontWeight: '700', color: '#6c757d', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  inputRow:        { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#dee2e6', borderRadius: 10, backgroundColor: '#f8f9fa', paddingHorizontal: 14 },
  inputErr:        { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  input:           { flex: 1, fontSize: 15, color: '#0a1628', paddingVertical: 13 },
  eyeBtn:          { padding: 8 },
  errTxt:          { color: '#ef4444', fontSize: 12, marginTop: 6, fontWeight: '500' },
  matchRow:        { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 5 },
  matchTxt:        { fontSize: 12, fontWeight: '500' },

  // Requirements
  reqBox:          { backgroundColor: '#f0f4ff', borderLeftWidth: 3, borderLeftColor: '#0a285c', borderRadius: 8, padding: 14, marginTop: 4 },
  reqTitle:        { fontSize: 11, fontWeight: '800', color: '#0a285c', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  reqRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  reqTxt:          { fontSize: 13, color: '#6c757d', flex: 1 },
  reqTxtMet:       { color: '#10b981', fontWeight: '600' },

  // Buttons row (form step)
  btnRow:          { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:       { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#dee2e6', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  cancelTxt:       { fontSize: 15, fontWeight: '700', color: '#6c757d' },
  submitBtn:       { flex: 2, flexDirection: 'row', paddingVertical: 14, borderRadius: 10, backgroundColor: '#0a285c', alignItems: 'center', justifyContent: 'center', gap: 8 },
  submitOff:       { opacity: 0.5 },
  submitTxt:       { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Full-width button (OTP step)
  fullBtn:         { flexDirection: 'row', paddingVertical: 14, borderRadius: 10, backgroundColor: '#0a285c', alignItems: 'center', justifyContent: 'center', gap: 8 },
  fullBtnOff:      { opacity: 0.5 },
  fullBtnTxt:      { fontSize: 15, fontWeight: '700', color: '#fff' },

  // OTP step
  infoBox:         { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f0f4ff', borderRadius: 12, padding: 14, marginBottom: 12, gap: 12 },
  infoTitle:       { fontSize: 14, color: '#0a285c', marginBottom: 4 },
  infoSub:         { fontSize: 12, color: '#64748b', lineHeight: 18 },
  timerBox:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f0fe', borderRadius: 8, padding: 10, marginBottom: 6, gap: 8, justifyContent: 'center' },
  timerWarn:       { backgroundColor: '#fff3cd' },
  timerExpired:    { backgroundColor: '#f8d7da' },
  timerTxt:        { fontSize: 13, fontWeight: '700', color: '#0a285c' },
  resendWrap:      { alignItems: 'center', marginTop: 16 },
  resendLink:      { fontSize: 14, fontWeight: '700', color: '#0a285c', textDecorationLine: 'underline' },
  resendWaiting:   { fontSize: 13, color: '#6c757d' },
  resendExhausted: { fontSize: 13, color: '#6c757d', fontStyle: 'italic' },
});