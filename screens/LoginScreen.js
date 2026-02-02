import React, { useState, useEffect } from 'react';
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
import { login, checkBackendConnection } from './services/api';

export default function LoginScreen({ navigation }) {
  const nav = navigation || useNavigation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backendConnected, setBackendConnected] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);
  
      const [errors, setErrors] = useState({
        general: ''
      });
    useEffect(() => {
      if (errors.general !== '') {
        setErrors({ general: '' });
      }
    }, [username, password]);

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

  const validateForm = () => {
    if (!username || username.trim() === '') {
      return false;
    }
    if (username.length < 4) {
      return false;
    }
    if (!password || password.trim() === '') {
      return false;
    }
    if (password.length < 8) {
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
  console.log('=== Login Attempt Started ===');

  setErrors({ general: '' });

  await new Promise(resolve => setTimeout(resolve, 100));

  if (!username || username.trim() === '' || username.length < 4 ||
      !password || password.trim() === '' || password.length < 8) {
    setErrors({ general: 'Login Failed!' });
    console.log('Form validation failed');
    return;
  }

  if (!backendConnected) {
    setErrors({ general: 'Backend server is not responding. Please start the backend.' });
    return;
  }

  try {
    setLoading(true);
    console.log('Calling login API...');
    
    const data = await login(username, password);
    
    console.log('Login API response:', {
      success: data.success,
      message: data.message,
      hasUser: !!data.user,
      role: data.user?.role
    });

    if (data.success) {
      console.log('✅ Login successful!');
      
      setUsername('');
      setPassword('');
      setErrors({ general: '' });
      
      nav.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Dashboard' } }],
      });
    } else {
      console.log('❌ Login failed:', data.message);
      // Show backend's actual error (e.g., "Account does not exist", "Invalid password")
      setErrors({ general: data.message || 'Invalid credentials' });
    }
    
  } catch (err) {
    console.error('❌ Login error:', err);
    setErrors({ general: 'Failed to connect to server. Please check if backend is running.' });
  } finally {
    setLoading(false);
    console.log('=== Login Attempt Ended ===\n');
  }
};

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
            <View style={[
              styles.statusBadge, 
              { backgroundColor: backendConnected ? '#22c55e' : '#ef4444' }
            ]}>
              <Text style={styles.statusText}>
                {backendConnected ? '● Server Connected' : '● Server Offline'}
              </Text>
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>Secure Access</Text>
              <Text style={styles.subtitle}>
                Enter your authorized credentials to access the system
              </Text>
            </View>

            {errors.general !== '' && (
              <View style={styles.alertError}>
                <Text style={styles.alertIcon}>⚠</Text>
                <Text style={styles.alertText}>{errors.general}</Text>
              </View>
            )}

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
              onPress={() => Alert.alert(
                'Password Recovery', 
                'Please contact your administrator to reset your password.'
              )}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.loginButton, 
                (loading || !backendConnected) && styles.loginButtonDisabled
              ]}
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
                  <Text style={styles.noticeTextBold}>Security Notice:</Text> This system is restricted to authorized personnel only. All access attempts are logged and monitored for security purposes.
                </Text>
              </View>
            </View>

            <View style={styles.devInfo}>
              <Text style={styles.devInfoText}>
                Backend: http://localhost:5000
              </Text>
              <Text style={styles.devInfoText}>
                Status: {backendConnected ? 'Connected ✓' : 'Disconnected ✗'}
              </Text>
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
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  loadingText: { 
    color: '#cbd5e1', 
    marginTop: 16, 
    fontSize: 14 
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  header: { marginBottom: 32 },
  title: { 
    fontSize: 36, 
    fontWeight: '700', 
    color: '#FFFFFF', 
    marginBottom: 8 
  },
  subtitle: { 
    fontSize: 14, 
    color: '#cbd5e1', 
    lineHeight: 20 
  },
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
  alertIcon: {
    color: '#fca5a5',
    fontSize: 18,
  },
  alertText: {
    flex: 1,
    color: '#fca5a5',
    fontSize: 13,
    lineHeight: 18,
  },
  inputGroup: { marginBottom: 20 },
  label: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#cbd5e1', 
    marginBottom: 8, 
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  showButton: { 
    position: 'absolute', 
    right: 12, 
    top: 12, 
    paddingHorizontal: 8, 
    paddingVertical: 4 
  },
  showButtonText: { color: '#60a5fa', fontWeight: '600' },
  forgotPassword: { 
    alignSelf: 'flex-end', 
    marginBottom: 24, 
    marginTop: -10 
  },
  forgotPasswordText: { color: '#60a5fa', fontSize: 13 },
  loginButton: { 
    backgroundColor: '#dc2626', 
    padding: 16, 
    borderRadius: 10, 
    alignItems: 'center',
  },
  loginButtonDisabled: { 
    opacity: 0.6,
  },
  loginButtonText: { 
    color: '#FFFFFF', 
    fontSize: 14, 
    fontWeight: '700', 
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  securityNotice: { 
    flexDirection: 'row', 
    marginTop: 32,
  },
  noticeBar: { 
    width: 3, 
    backgroundColor: '#3b82f6', 
    borderRadius: 2, 
    marginRight: 12 
  },
  noticeContent: { 
    flex: 1, 
    backgroundColor: 'rgba(30, 41, 59, 0.6)', 
    padding: 18, 
    borderRadius: 6,
  },
  noticeText: { 
    color: '#cbd5e1', 
    fontSize: 13, 
    lineHeight: 20,
  },
  noticeTextBold: { 
    fontWeight: '700',
    color: '#e2e8f0',
  },
  devInfo: {
    marginTop: 20,
    padding: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 6,
  },
  devInfoText: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
});
