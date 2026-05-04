import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  login,
  checkBackendConnection,
  sendOTP,
  verifyOTP,
  resendOTP,
  resetPassword,
} from './services/api';

export default function LoginScreen({ navigation }) {
  const nav = navigation || useNavigation();

  // ─── VIEWS: 'login' | 'forgot' | 'verify' | 'reset' ──────────────────────
  const [currentView, setCurrentView] = useState('login');

  // ─── LOGIN STATE ──────────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ─── FORGOT PASSWORD STATE ────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [timer, setTimer] = useState(120);
  const [canResend, setCanResend] = useState(false);

  // ─── SHARED STATE ─────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [backendConnected, setBackendConnected] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);

  // OTP input refs for auto-focus
  const otpRefs = useRef([]);

  // ─── BACKEND CHECK ────────────────────────────────────────────────────────
  useEffect(() => {
    const checkConnection = async () => {
      setCheckingBackend(true);
      const isConnected = await checkBackendConnection();
      setBackendConnected(isConnected);
      setCheckingBackend(false);

      if (!isConnected) {
        Alert.alert(
          'Backend Offline',
          'Cannot connect to server. Please ensure:\n\n1. Backend is running (npm start in backend folder)\n2. Backend is on port 5000',
          [{ text: 'Retry', onPress: checkConnection }]
        );
      }
    };
    checkConnection();
  }, []);

  // ─── OTP COUNTDOWN TIMER ─────────────────────────────────────────────────
  useEffect(() => {
    let interval;
    if (currentView === 'verify' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentView, timer]);

  // ─── CLEAR MESSAGES ON VIEW CHANGE ───────────────────────────────────────
  useEffect(() => {
    // Keep max attempts error when returning to login
    if (!errorMsg.includes('Maximum OTP requests')) {
      setErrorMsg('');
    }
    setSuccessMsg('');
  }, [currentView]);

  // ─── CLEAR LOGIN ERROR ON INPUT CHANGE ───────────────────────────────────
  useEffect(() => {
    if (errorMsg !== '') setErrorMsg('');
  }, [username, password]);

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const goToView = (view) => {
    setCurrentView(view);
  };

  const backToLogin = () => {
    setCurrentView('login');
    setEmail('');
    setOtpCode(['', '', '', '', '', '']);
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg('');
    setSuccessMsg('');
    setTimer(120);
    setCanResend(false);
  };

  const checkPasswordRequirements = (pwd) => ({
    length:    pwd.length >= 8,
    lowercase: /(?=.*[a-z])/.test(pwd),
    uppercase: /(?=.*[A-Z])/.test(pwd),
    number:    /(?=.*\d)/.test(pwd),
    special:   /(?=.*[@$!%*?&#])/.test(pwd),
  });

  const validateNewPassword = (pwd) => {
    if (!pwd) return 'Password is required';
    if (pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])/.test(pwd)) return 'Must contain at least one lowercase letter';
    if (!/(?=.*[A-Z])/.test(pwd)) return 'Must contain at least one uppercase letter';
    if (!/(?=.*\d)/.test(pwd)) return 'Must contain at least one number';
    if (!/(?=.*[@$!%*?&#])/.test(pwd)) return 'Must contain a special character (@$!%*?&#)';
    return null;
  };

  const passwordChecks = checkPasswordRequirements(newPassword);

  // ─── OTP INPUT HANDLERS ───────────────────────────────────────────────────
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const updated = [...otpCode];
    updated[index] = value.slice(-1); // only last digit
    setOtpCode(updated);
    setErrorMsg('');
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index, key) => {
    if (key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    setErrorMsg('');
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (
      !username || username.trim() === '' || username.length < 4 ||
      !password || password.trim() === '' || password.length < 8
    ) {
      setErrorMsg('Login Failed!');
      return;
    }

    if (!backendConnected) {
      setErrorMsg('Backend server is not responding. Please start the backend.');
      return;
    }

    try {
      setLoading(true);
      const data = await login(username, password);

      if (data.success) {
        setUsername('');
        setPassword('');
        setErrorMsg('');
        nav.reset({
          index: 0,
          routes: [{ name: 'Main', params: { screen: 'Dashboard' } }],
        });
      } else {
        setErrorMsg(data.message || 'Invalid credentials');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to server. Please check if backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // ─── FORGOT PASSWORD — SEND OTP ───────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    setLoading(true);
    const data = await sendOTP(email);
    setLoading(false);

    if (data.success) {
      setSuccessMsg('Verification code sent!');
      setTimeout(() => {
        setSuccessMsg('');
        setTimer(120);
        setCanResend(false);
        goToView('verify');
      }, 1500);
    } else {
      if (data.message?.includes('Maximum OTP requests')) {
        setCurrentView('login');
        setTimeout(() => setErrorMsg(data.message), 0);
        setEmail('');
      } else {
        setErrorMsg(data.message || 'Failed to send verification code');
      }
    }
  };

  // ─── FORGOT PASSWORD — VERIFY OTP ─────────────────────────────────────────
  const handleVerifyOTP = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) {
      setErrorMsg('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    const data = await verifyOTP(email, code);
    setLoading(false);

    if (data.success) {
      setSuccessMsg('Code verified successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        goToView('reset');
      }, 1500);
    } else {
      setErrorMsg(data.message || 'Invalid verification code');
    }
  };

  // ─── FORGOT PASSWORD — RESEND OTP ─────────────────────────────────────────
  const handleResendOTP = async () => {
    if (!canResend || loading) return;

    setLoading(true);
    const data = await resendOTP(email);
    setLoading(false);

    if (data.success) {
      setTimer(120);
      setCanResend(false);
      setOtpCode(['', '', '', '', '', '']);
      setSuccessMsg('New code sent! Check your email.');
      setTimeout(() => setSuccessMsg(''), 2000);
    } else {
      if (data.message?.includes('Maximum OTP requests')) {
        setCurrentView('login');
        setTimeout(() => setErrorMsg(data.message), 0);
        setEmail('');
      } else {
        setErrorMsg(data.message || 'Failed to resend code');
      }
    }
  };

  // ─── FORGOT PASSWORD — RESET PASSWORD ────────────────────────────────────
  const handleResetPassword = async () => {
    const pwdError = validateNewPassword(newPassword);
    if (pwdError) { setErrorMsg(pwdError); return; }
    if (!confirmPassword) { setErrorMsg('Please confirm your new password'); return; }
    if (newPassword !== confirmPassword) { setErrorMsg('Passwords do not match'); return; }

    setLoading(true);
    const data = await resetPassword(email, newPassword);
    setLoading(false);

    if (data.success !== false) {
      setSuccessMsg(data.message || 'Password reset successfully!');
      setTimeout(() => {
        backToLogin();
      }, 2000);
    } else {
      setErrorMsg(data.message || 'Failed to reset password');
    }
  };

  // ─── LOADING SCREEN ───────────────────────────────────────────────────────
  if (checkingBackend) {
    return (
      <LinearGradient colors={['#1e293b', '#0f172a', '#1e3a8a']} style={styles.gradient}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#60a5fa" />
            <Text style={styles.loadingText}>Connecting to server...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <LinearGradient colors={['#1e293b', '#0f172a', '#1e3a8a']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── BACK BUTTON (non-login views) ─────────────────────────── */}
            {currentView !== 'login' && (
              <TouchableOpacity
                style={[styles.backButton, (loading || successMsg !== '') && styles.disabledOpacity]}
                onPress={() => {
                  if (loading || successMsg !== '') return;
                  backToLogin();
                }}
                disabled={loading || successMsg !== ''}
              >
                <Text style={styles.backButtonText}>← Back to Login</Text>
              </TouchableOpacity>
            )}

            {/* ── ALERTS ───────────────────────────────────────────────── */}
            {errorMsg !== '' && (
              <View style={styles.alertError}>
                <Text style={styles.alertIcon}>⚠</Text>
                <Text style={styles.alertText}>{errorMsg}</Text>
              </View>
            )}
            {successMsg !== '' && (
              <View style={styles.alertSuccess}>
                <Text style={styles.alertIcon}>✓</Text>
                <Text style={styles.alertSuccessText}>{successMsg}</Text>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/*  VIEW: LOGIN                                               */}
            {/* ══════════════════════════════════════════════════════════ */}
            {currentView === 'login' && (
              <View>
                <View style={styles.header}>
                  <Text style={styles.title}>Secure Access</Text>
                  <Text style={styles.subtitle}>
                    Enter your authorized credentials to access the system
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>USERNAME</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your username"
                    placeholderTextColor="#94a3b8"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    editable={!loading}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>PASSWORD</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[styles.input, { paddingRight: 80 }]}
                      placeholder="Enter your password"
                      placeholderTextColor="#94a3b8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((s) => !s)}
                      style={styles.showButton}
                      disabled={loading}
                    >
                      <Text style={styles.showButtonText}>
                        {showPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.forgotPassword}
                  onPress={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    goToView('forgot');
                  }}
                  disabled={loading}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginButton, (loading || !backendConnected) && styles.loginButtonDisabled]}
                  onPress={handleLogin}
                  disabled={loading || !backendConnected}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {backendConnected ? 'LOGIN' : 'SERVER OFFLINE'}
                    </Text>
                  )}
                </TouchableOpacity>

                <View style={styles.securityNotice}>
                  <View style={styles.noticeBar} />
                  <View style={styles.noticeContent}>
                    <Text style={styles.noticeText}>
                      <Text style={styles.noticeTextBold}>Security Notice:</Text> This
                      system is restricted to authorized personnel only. All access
                      attempts are logged and monitored for security purposes.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/*  VIEW: FORGOT PASSWORD (email input)                       */}
            {/* ══════════════════════════════════════════════════════════ */}
            {currentView === 'forgot' && (
              <View>
                <View style={styles.header}>
                  <Text style={styles.title}>Password Recovery</Text>
                  <Text style={styles.subtitle}>
                    Enter your registered email address to receive a verification code
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#94a3b8"
                    value={email}
                    onChangeText={(text) => { setEmail(text); setErrorMsg(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSendOTP}
                    editable={!loading}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, (loading || successMsg !== '') && styles.loginButtonDisabled]}
                  onPress={handleSendOTP}
                  disabled={loading || successMsg !== ''}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {successMsg ? 'Code Sent!' : 'Send Verification Code'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/*  VIEW: VERIFY OTP                                          */}
            {/* ══════════════════════════════════════════════════════════ */}
            {currentView === 'verify' && (
              <View>
                <View style={styles.header}>
                  <Text style={styles.title}>Enter Verification Code</Text>
                  <Text style={styles.subtitle}>
                    Please enter the 6-digit code sent to
                  </Text>
                  <Text style={styles.emailDisplay}>{email}</Text>
                </View>

                {/* 6-digit OTP boxes */}
                <View style={styles.otpContainer}>
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <TextInput
                      key={index}
                      ref={(el) => (otpRefs.current[index] = el)}
                      style={styles.otpInput}
                      value={otpCode[index]}
                      onChangeText={(val) => handleOtpChange(index, val)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                      keyboardType="number-pad"
                      maxLength={1}
                      textAlign="center"
                      placeholderTextColor="#94a3b8"
                      editable={!loading}
                    />
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, (loading || successMsg !== '') && styles.loginButtonDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={loading || successMsg !== ''}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>
                      {successMsg ? 'Verified!' : 'Verify Code'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Resend button */}
                <TouchableOpacity
                  style={[styles.resendButton, (!canResend || loading) && styles.disabledOpacity]}
                  onPress={handleResendOTP}
                  disabled={!canResend || loading}
                >
                  <Text style={styles.resendButtonText}>
                    {loading ? 'Sending...' : canResend ? 'Resend Code' : `Resend in ${timer}s`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ══════════════════════════════════════════════════════════ */}
            {/*  VIEW: RESET PASSWORD                                      */}
            {/* ══════════════════════════════════════════════════════════ */}
            {currentView === 'reset' && (
              <View>
                <View style={styles.header}>
                  <Text style={styles.title}>Reset Password</Text>
                  <Text style={styles.subtitle}>Enter your new secure password</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>NEW PASSWORD</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[styles.input, { paddingRight: 80 }]}
                      placeholder="Enter new password"
                      placeholderTextColor="#94a3b8"
                      value={newPassword}
                      onChangeText={(text) => { setNewPassword(text); setErrorMsg(''); }}
                      secureTextEntry={!showNewPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword((s) => !s)}
                      style={styles.showButton}
                      disabled={loading}
                    >
                      <Text style={styles.showButtonText}>
                        {showNewPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>CONFIRM NEW PASSWORD</Text>
                  <View style={styles.passwordWrapper}>
                    <TextInput
                      style={[styles.input, { paddingRight: 80 }]}
                      placeholder="Re-enter new password"
                      placeholderTextColor="#94a3b8"
                      value={confirmPassword}
                      onChangeText={(text) => { setConfirmPassword(text); setErrorMsg(''); }}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleResetPassword}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((s) => !s)}
                      style={styles.showButton}
                      disabled={loading}
                    >
                      <Text style={styles.showButtonText}>
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Password requirements checklist */}
                <View style={styles.requirementsBox}>
                  <Text style={styles.requirementsTitle}>Password Requirements:</Text>
                  {[
                    { key: 'length',    label: 'At least 8 characters long' },
                    { key: 'uppercase', label: 'Contains uppercase letter' },
                    { key: 'lowercase', label: 'Contains lowercase letter' },
                    { key: 'number',    label: 'Contains at least one number' },
                    { key: 'special',   label: 'Contains special character (@$!%*?&#)' },
                  ].map(({ key, label }) => (
                    <Text
                      key={key}
                      style={[styles.requirementItem, passwordChecks[key] && styles.requirementMet]}
                    >
                      {passwordChecks[key] ? '✓' : '○'} {label}
                    </Text>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.loginButtonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#cbd5e1', marginTop: 16, fontSize: 14 },

  // Back button
  backButton: {
    marginBottom: 20,
  },
  backButtonText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledOpacity: { opacity: 0.5 },

  // Header
  header: { marginBottom: 32 },
  title: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },
  emailDisplay: {
    fontSize: 14,
    fontWeight: '700',
    color: '#60a5fa',
    marginTop: 4,
  },

  // Alerts
  alertError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  alertSuccess: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  alertIcon: { fontSize: 18, color: '#fca5a5' },
  alertText: { flex: 1, color: '#fca5a5', fontSize: 13, lineHeight: 18 },
  alertSuccessText: { flex: 1, color: '#86efac', fontSize: 13, lineHeight: 18 },

  // Inputs
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 11, fontWeight: '600', color: '#cbd5e1',
    marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 2,
    borderColor: 'rgba(100, 116, 139, 0.4)',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    color: '#FFFFFF',
  },
  passwordWrapper: { position: 'relative' },
  showButton: { position: 'absolute', right: 12, top: 12, paddingHorizontal: 8, paddingVertical: 4 },
  showButtonText: { color: '#60a5fa', fontWeight: '600' },

  // Forgot password link
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 24, marginTop: -10 },
  forgotPasswordText: { color: '#60a5fa', fontSize: 13 },

  // Buttons
  loginButton: {
    backgroundColor: '#dc2626', padding: 16,
    borderRadius: 10, alignItems: 'center',
  },
  loginButtonDisabled: { opacity: 0.6 },
  loginButtonText: {
    color: '#FFFFFF', fontSize: 14, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  resendButton: {
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.4)',
  },
  resendButtonText: { color: '#60a5fa', fontSize: 14, fontWeight: '600' },

  // OTP boxes
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  otpInput: {
    width: 46,
    height: 56,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 2,
    borderColor: 'rgba(100, 116, 139, 0.4)',
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Password requirements
  requirementsBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 20,
  },
  requirementsTitle: {
    color: '#cbd5e1', fontSize: 12, fontWeight: '700',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  requirementItem: { color: '#94a3b8', fontSize: 13, marginBottom: 4 },
  requirementMet: { color: '#86efac' },

  // Security notice
  securityNotice: { flexDirection: 'row', marginTop: 32 },
  noticeBar: { width: 3, backgroundColor: '#3b82f6', borderRadius: 2, marginRight: 12 },
  noticeContent: {
    flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.6)',
    padding: 18, borderRadius: 6,
  },
  noticeText: { color: '#cbd5e1', fontSize: 13, lineHeight: 20 },
  noticeTextBold: { fontWeight: '700', color: '#e2e8f0' },
});