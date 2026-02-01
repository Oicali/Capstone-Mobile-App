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
import { useNavigation } from '@react-navigation/native';

export default function DashboardScreen({ navigation: propNav }) {
  const navigation = propNav || useNavigation();

  const quickStats = [
    { icon: '📍', value: '8', label: 'Active Patrols' },
    { icon: '🔥', value: '5', label: 'Hotspots' },
    { icon: '✅ ', value: '12', label: 'Completed' },
    { icon: '📝', value: '4', label: 'Pending' },
  ];

  const mainFeatures = [
    {
      title: 'Crime Mapping',
      description: 'View hotspots, crime clusters & AI analysis',
      icon: '🗺️',
      screen: 'CrimeMapping',
    },
    {
      title: 'My Assignments',
      description: 'View patrol schedules & establishment visits',
      icon: '📋',
      badge: '3 New',
      screen: 'Assignments',
    },
    {
      title: 'Referral Reports',
      description: 'Barangay incident referrals & reports',
      icon: '📄',
      screen: 'Referrals',
    },
    {
      title: 'My Profile',
      description: 'Account settings & preferences',
      icon: '👤',
      screen: 'Profile',
    },
  ];

  const handleFeaturePress = (screen) => {
    if (!screen) {
      Alert.alert('Navigation error', 'No screen specified for this feature.');
      return;
    }

    try {
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.greeting}>
            <Text style={styles.greetingText}>Good Morning!</Text>
            <Text style={styles.officerName}>Off. Juan Dela Cruz</Text>
          </View>

          <TouchableOpacity 
            style={styles.notificationIcon}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Text style={styles.notificationIconText}>🔔</Text>
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>3</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>Search patrols, incidents...</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Alert Banner */}
        <View style={styles.alertBanner}>
          <Text style={styles.alertIcon}>⚠️</Text>
          <View style={styles.alertText}>
            <Text style={styles.alertTitle}>High Alert Area</Text>
            <Text style={styles.alertDescription}>New hotspot detected in Brgy. Molino III</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          {quickStats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <View style={styles.statIcon}>
                <Text style={styles.statIconText}>{stat.icon}</Text>
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Main Features */}
        <Text style={styles.sectionTitle}>Main Features</Text>

        {mainFeatures.map((feature, index) => (
          <TouchableOpacity
            key={index}
            style={styles.featureCard}
            onPress={() => handleFeaturePress(feature.screen)}
            activeOpacity={0.8}
          >
            <View style={styles.featureIcon}>
              <Text style={styles.featureIconText}>{feature.icon}</Text>
            </View>

            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>{feature.description}</Text>
              {feature.badge && (
                <View style={styles.featureBadge}>
                  <Text style={styles.featureBadgeText}>{feature.badge}</Text>
                </View>
              )}
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
    backgroundColor: '#f8f9fa',
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
    backgroundColor: 'rgba(255, 255, 255, 0)',
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
    backgroundColor: '#c1272d',
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0a1628',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 12,
    padding: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchPlaceholder: {
    color: 'rgba(2, 0, 0, 0.91)',
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
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#c1272d',
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
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: '#294d7d',
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
    borderLeftColor: '#c1272d',
  },
  featureIcon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    backgroundColor: '#294d7d',
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
    fontSize: 24,
    color: '#cbd5e1',
    marginLeft: 12,
  },
});
