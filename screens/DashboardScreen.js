import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Platform } from 'react-native';
import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const user = await AsyncStorage.getItem('user');
    if (user) setUserData(JSON.parse(user));
  };

  const quickStats = [
    { icon: '📍', value: '8', label: 'Active Patrols', color: '#1e3a5f' },
    { icon: '🔥', value: '5', label: 'Hotspots', color: '#c1272d' },
    { icon: '✓', value: '12', label: 'Completed', color: '#28a745' },
    { icon: '📝', value: '4', label: 'Pending', color: '#ffc107' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.greeting}>
            <Text style={styles.greetingText}>Welcome back,</Text>
            <Text style={styles.officerName}>
              {userData?.first_name && userData?.last_name 
                ? `${userData.first_name} ${userData.last_name}` 
                : 'Loading...'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.notificationIcon}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#6c757d" />
          <Text style={styles.searchPlaceholder}>Search patrols, incidents...</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.alertBanner}>
          <Text style={styles.alertIcon}>⚠️</Text>
          <View style={styles.alertText}>
            <Text style={styles.alertTitle}>High Alert Area</Text>
            <Text style={styles.alertDescription}>
              New hotspot detected in Brgy. Molino III
            </Text>
          </View>
        </View>

        <View style={styles.quickStats}>
          {quickStats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: stat.color }]}>
                <Text style={styles.statIconText}>{stat.icon}</Text>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Main Features</Text>

        <TouchableOpacity
          style={[styles.featureCard, { borderLeftColor: '#c1272d' }]}
          onPress={() => navigation.navigate('CrimeMap')}
        >
          <View style={[styles.featureIcon, { backgroundColor: '#c1272d' }]}>
            <Text style={styles.featureIconText}>🗺️</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Crime Mapping</Text>
            <Text style={styles.featureDescription}>
              View hotspots, crime clusters & AI analysis
            </Text>
          </View>
          <Text style={styles.featureArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.featureCard, { borderLeftColor: '#1e3a5f' }]}
          onPress={() => navigation.navigate('Assignments')}
        >
          <View style={[styles.featureIcon, { backgroundColor: '#1e3a5f' }]}>
            <Text style={styles.featureIconText}>📋</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>My Assignments</Text>
            <Text style={styles.featureDescription}>
              View patrol schedules & establishment visits
            </Text>
            <View style={styles.featureBadge}>
              <Text style={styles.featureBadgeText}>3 New</Text>
            </View>
          </View>
          <Text style={styles.featureArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.featureCard, { borderLeftColor: '#ffc107' }]}
          onPress={() => navigation.navigate('Referrals')}
        >
          <View style={[styles.featureIcon, { backgroundColor: '#ffc107' }]}>
            <Text style={styles.featureIconText}>📄</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Referral Reports</Text>
            <Text style={styles.featureDescription}>
              PNP incident referrals & reports
            </Text>
          </View>
          <Text style={styles.featureArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.featureCard, { borderLeftColor: '#28a745' }]}
          onPress={() => navigation.navigate('BarangayReport')}
        >
          <View style={[styles.featureIcon, { backgroundColor: '#28a745' }]}>
            <Text style={styles.featureIconText}>📝</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>Barangay Reports</Text>
            <Text style={styles.featureDescription}>
              Submit barangay incident reports
            </Text>
          </View>
          <Text style={styles.featureArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.featureCard, { borderLeftColor: '#6c757d' }]}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={[styles.featureIcon, { backgroundColor: '#6c757d' }]}>
            <Text style={styles.featureIconText}>👤</Text>
          </View>
          <View style={styles.featureContent}>
            <Text style={styles.featureTitle}>My Profile</Text>
            <Text style={styles.featureDescription}>
              Account settings & preferences
            </Text>
          </View>
          <Text style={styles.featureArrow}>›</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingBottom: Platform.OS === 'ios' ? 0 : 10,
  },
  content: {
    padding: width > 768 ? 30 : 20,
    paddingBottom: 100,
  },
  header: {
    padding: 20,
    paddingTop: 10,
    backgroundColor: '#0a285c',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    flex: 1,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  officerName: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    backgroundColor: '#c1272d',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a285c',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
  },
  searchPlaceholder: {
    color: '#6c757d',
    fontSize: 14,
  },
  alertBanner: {
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  alertIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  alertText: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 2,
  },
  alertDescription: {
    fontSize: 11,
    color: '#856404',
  },
  quickStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statIconText: {
    fontSize: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderLeftWidth: 4,
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureIconText: {
    fontSize: 28,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 17,
  },
  featureBadge: {
    backgroundColor: '#c1272d',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  featureBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  featureArrow: {
    fontSize: 28,
    color: '#cbd5e1',
    marginLeft: 12,
  },
});
