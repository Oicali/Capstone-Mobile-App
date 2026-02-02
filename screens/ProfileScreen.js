// FILE: screens/ProfileScreen.js - FIXED LOGOUT

import React from 'react';
import { Dimensions, Platform } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';


 const { width, height } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {


const handleLogout = () => {
  Alert.alert(
    'Confirm Logout',
    'Are you sure you want to logout from BANTAY?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
        },
      },
    ],
    { cancelable: true }
  );
};

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <Text style={styles.headerSubtitle}>PNP Bacoor Officer</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>JD</Text>
          </View>
          <Text style={styles.officerName}>Off. Juan Dela Cruz</Text>
          <Text style={styles.officerRole}>Patrol Officer</Text>
          <Text style={styles.officerBadge}>Badge #12345</Text>
          <Text style={styles.officerStation}>PNP Bacoor Station</Text>
        </View>

        {/* Menu Options */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>Account Settings</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Text style={styles.menuIcon}>👤</Text>
            </View>
            <Text style={styles.menuText}>Edit Profile</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Text style={styles.menuIcon}>🔒</Text>
            </View>
            <Text style={styles.menuText}>Change Password</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Text style={styles.menuIcon}>🔔</Text>
            </View>
            <Text style={styles.menuText}>Notifications</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>System</Text>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Text style={styles.menuIcon}>⚙️</Text>
            </View>
            <Text style={styles.menuText}>Settings</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Text style={styles.menuIcon}>ℹ️</Text>
            </View>
            <Text style={styles.menuText}>About BANTAY</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIconContainer}>
              <Text style={styles.menuIcon}>📋</Text>
            </View>
            <Text style={styles.menuText}>Terms & Privacy</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutIcon}>🚪</Text>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>PNP BANTAY v1.0.0</Text>
          <Text style={styles.appInfoText}>
            Crime Intelligence & Patrol Management System
          </Text>
          <Text style={styles.appInfoText}>© 2026 PNP Bacoor, Cavite</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
 container: {
  flex: 1,
  backgroundColor: '#f8f9fa',
  paddingBottom: Platform.OS === 'ios' ? 0 : 10, // Extra padding for Android
},

// Update content padding:
content: {
  flex: 1,
  padding: width > 768 ? 30 : 20, // More padding on tablets
  paddingBottom: 100, // Space for bottom navbar
},
  header: {
    padding: 20,
    backgroundColor: '#0a285c',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1e3a5f',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#c1272d',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  officerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 4,
  },
  officerRole: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 4,
  },
  officerBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e3a5f',
    marginBottom: 4,
  },
  officerStation: {
    fontSize: 13,
    color: '#adb5bd',
  },
  menuSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 16,
    paddingTop: 12,
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#adb5bd',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#0a1628',
    fontWeight: '600',
  },
  menuArrow: {
    fontSize: 24,
    color: '#cbd5e1',
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#c1272d',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  appInfo: {
    padding: 24,
    alignItems: 'center',
  },
  appInfoText: {
    fontSize: 12,
    color: '#adb5bd',
    marginBottom: 4,
    textAlign: 'center',
  },
});