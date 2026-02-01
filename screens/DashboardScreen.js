import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

export default function DashboardScreen({ navigation: propNav }) {
  const navigation = propNav || useNavigation();

  const quickStats = [
    { icon: '📍', value: '8', label: 'Active Patrols', color: '#3b82f6' },
    { icon: '🔥', value: '5', label: 'Hotspots', color: '#ef4444' },
    { icon: '✓', value: '12', label: 'Completed', color: '#10b981' },
    { icon: '📝', value: '4', label: 'Pending', color: '#f59e0b' },
  ];

  const mainFeatures = [
    {
      title: 'Crime Mapping',
      description: 'View hotspots, crime clusters & AI analysis',
      icon: '🗺️',
      color: '#ef4444',
      screen: 'CrimeMapping',
    },
    {
      title: 'My Assignments',
      description: 'View patrol schedules & establishment visits',
      icon: '📋',
      color: '#3b82f6',
      badge: '3 New',
      screen: 'Assignments',
    },
    {
      title: 'Referral Reports',
      description: 'Barangay incident referrals & reports',
      icon: '📄',
      color: '#f59e0b',
      screen: 'Referrals',
    },
    {
      title: 'My Profile',
      description: 'Account settings & preferences',
      icon: '👤',
      color: '#10b981',
      screen: 'Profile',
    },
  ];

  const handleFeaturePress = (screen) => {
    if (!screen) {
      Alert.alert('Navigation error', 'No screen specified for this feature.');
      return;
    }

    try {
      // Try to navigate. If the screen name is not registered, React Navigation
      // may throw or log an error — catch and show a helpful message.
      navigation.navigate(screen);
    } catch (err) {
      console.error('Navigation error:', err);
      Alert.alert(
        'Navigation error',
        `Unable to navigate to "${screen}". Make sure the screen is registered in your navigator.`
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={['#1a3a6b', '#2d5aa8']} style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.greeting}>
            <Text style={styles.greetingText}>Good Morning!</Text>
            <Text style={styles.officerName}>Off. Juan Dela Cruz</Text>
          </View>

          <View style={styles.notificationIcon}>
            <Text style={styles.notificationIconText}>🔔</Text>
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search patrols, incidents...</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.alertBanner}>
          <Text style={styles.alertIcon}>⚠️</Text>
          <View style={styles.alertText}>
            <Text style={styles.alertTitle}>High Alert Area</Text>
            <Text style={styles.alertDescription}>New hotspot detected in Brgy. Molino III</Text>
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

        {mainFeatures.map((feature, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.featureCard, { borderLeftColor: feature.color }]}
            onPress={() => handleFeaturePress(feature.screen)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Open ${feature.title}`}
          >
            <View style={[styles.featureIcon, { backgroundColor: feature.color }]}>
              <Text style={styles.featureIconText}>{feature.icon}</Text>
            </View>

            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
              {feature.badge ? (
                <View style={styles.featureBadge}>
                  <Text style={styles.featureBadgeText}>{feature.badge}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.featureArrow}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  header: {
    padding: 20,
    paddingTop: 10,
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
    color: 'rgba(255, 255, 255, 0.9)',
  },
  notificationIcon: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationIconText: {
    fontSize: 20,
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    backgroundColor: '#dc3545',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2d5aa8',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchPlaceholder: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
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
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: '#1e3a5f', 
  },
  statIconText: {
    fontSize: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a3a6b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3a6b',
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderLeftWidth: 4,
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
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
    color: '#1a3a6b',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#6c757d',
    lineHeight: 17,
  },
  featureBadge: {
    backgroundColor: '#dc3545',
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
    fontSize: 24,
    color: '#cbd5e1',
    marginLeft: 12,
  },
});
