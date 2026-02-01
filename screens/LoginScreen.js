// LoginScreen.js
import React, { useState } from 'react';
import {
  SafeAreaView,
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

export default function LoginScreen({ navigation }) {
  const nav = navigation || useNavigation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password');
      return false;
    }
    if (username.length < 4) {
      Alert.alert('Error', 'Username must be at least 4 characters');
      return false;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return false;
    }
    return true;
  };

  // Mock auth: accepts admin / password123
  const mockAuthenticate = (user, pass) =>
    new Promise((resolve, reject) => {
      setTimeout(() => {
        if (user === 'admin' && pass === 'password123') resolve({ ok: true });
        else reject(new Error('Invalid credentials'));
      }, 700);
    });

  const handleLogin = async () => {
    console.log('handleLogin called', { username, password: password ? '***' : '' });

    if (!validateForm()) return;

    try {
      setLoading(true);
      await mockAuthenticate(username.trim(), password);
      console.log('Auth success — navigating to Dashboard inside Main tabs');

      // Correct: navigate into the nested Tab navigator registered as "Main"
      nav.navigate('Main', { screen: 'Dashboard' });

      // Alternative options:
      // Replace the stack with Main (removes Login from history)
      // nav.replace('Main', { screen: 'Dashboard' });

      // Or reset the navigation state to Main -> Dashboard (full reset)
      // nav.reset({
      //   index: 0,
      //   routes: [{ name: 'Main', params: { screen: 'Dashboard' } }],
      // });
    } catch (err) {
      console.error('Login failed', err);
      Alert.alert('Login failed', err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#1e293b', '#0f172a', '#1e3a8a']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                accessible
                accessibilityLabel="Username input"
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
                  accessible
                  accessibilityLabel="Password input"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((s) => !s)}
                  style={styles.showButton}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={styles.showButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => Alert.alert('Forgot Password', 'Password recovery flow not implemented.')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Login"
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>LOGIN</Text>}
            </TouchableOpacity>

            <View style={styles.securityNotice}>
              <View style={styles.noticeBar} />
              <View style={styles.noticeContent}>
                <Text style={styles.noticeText}>
                  <Text style={styles.noticeTextBold}>Security Notice:</Text> This system is restricted to authorized personnel only. All access attempts are logged and monitored for security purposes.
                </Text>
              </View>
            </View>

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
  header: { marginBottom: 40 },
  title: { fontSize: 36, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, fontWeight: '600', color: '#cbd5e1', marginBottom: 8, letterSpacing: 1 },
  input: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 6,
    padding: 14,
    fontSize: 14,
    color: '#FFFFFF',
  },
  passwordWrapper: { position: 'relative' },
  showButton: { position: 'absolute', right: 12, top: 12, paddingHorizontal: 8, paddingVertical: 4 },
  showButtonText: { color: '#60a5fa', fontWeight: '600' },
  forgotPassword: { alignSelf: 'flex-end', marginBottom: 24, marginTop: -10 },
  forgotPasswordText: { color: '#60a5fa', fontSize: 13 },
  loginButton: { backgroundColor: '#dc2626', padding: 16, borderRadius: 6, alignItems: 'center' },
  loginButtonDisabled: { opacity: 0.7 },
  loginButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 1.5 },
  securityNotice: { flexDirection: 'row', marginTop: 30 },
  noticeBar: { width: 4, backgroundColor: '#3b82f6', borderRadius: 2, marginRight: 12 },
  noticeContent: { flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.4)', padding: 14, borderRadius: 6 },
  noticeText: { color: '#cbd5e1', fontSize: 11, lineHeight: 16 },
  noticeTextBold: { fontWeight: '700' },
});
