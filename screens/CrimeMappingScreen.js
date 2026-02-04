import React from 'react';
import { Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function CrimeMappingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
    <View style={styles.header}>
  <Text style={styles.headerTitle}>Crime Mapping</Text>
</View>

      <ScrollView style={styles.content}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={60} color="#6c757d" />
          <Text style={styles.mapText}>Interactive Crime Map</Text>
          <Text style={styles.mapSubtext}>Tap to view full map</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Crime Hotspots</Text>
          
          <View style={styles.hotspotItem}>
            <View style={styles.hotspotIconContainer}>
              <Ionicons name="flame" size={24} color="#c1272d" />
            </View>
            <View style={styles.hotspotInfo}>
              <Text style={styles.hotspotName}>Brgy. Molino III</Text>
              <Text style={styles.hotspotDescription}>15 incidents this week</Text>
            </View>
            <View style={[styles.riskBadge, styles.riskHigh]}>
              <Text style={[styles.riskText, { color: '#c1272d' }]}>HIGH</Text>
            </View>
          </View>

          <View style={styles.hotspotItem}>
            <View style={styles.hotspotIconContainer}>
              <Ionicons name="flame" size={24} color="#ffc107" />
            </View>
            <View style={styles.hotspotInfo}>
              <Text style={styles.hotspotName}>Brgy. Niog</Text>
              <Text style={styles.hotspotDescription}>8 incidents this week</Text>
            </View>
            <View style={[styles.riskBadge, styles.riskMedium]}>
              <Text style={[styles.riskText, { color: '#ffc107' }]}>MEDIUM</Text>
            </View>
          </View>

          <View style={styles.hotspotItem}>
            <View style={styles.hotspotIconContainer}>
              <Ionicons name="flame-outline" size={24} color="#6c757d" />
            </View>
            <View style={styles.hotspotInfo}>
              <Text style={styles.hotspotName}>Brgy. Salinas</Text>
              <Text style={styles.hotspotDescription}>5 incidents this week</Text>
            </View>
            <View style={[styles.riskBadge, styles.riskLow]}>
              <Text style={styles.riskText}>LOW</Text>
            </View>
          </View>
        </View>
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
    flex: 1,
    padding: width > 768 ? 30 : 20,
    paddingBottom: 100,
  },
header: {
  paddingVertical: 20,
  paddingHorizontal: 20,
  backgroundColor: '#0a285c',
  borderBottomWidth: 1,
  borderBottomColor: '#1e3a5f',
  alignItems: 'center',
  justifyContent: 'center',
},
headerTitle: {
  fontSize: 18,
  fontWeight: '700',
  color: '#ffffff',
  textAlign: 'center',
},

  mapPlaceholder: {
    height: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  mapText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a1628',
    marginTop: 16,
    marginBottom: 4,
  },
  mapSubtext: {
    fontSize: 14,
    color: '#6c757d',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 16,
  },
  hotspotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  hotspotIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  hotspotInfo: {
    flex: 1,
  },
  hotspotName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a1628',
    marginBottom: 4,
  },
  hotspotDescription: {
    fontSize: 13,
    color: '#6c757d',
  },
  riskBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  riskHigh: {
    backgroundColor: 'rgba(193, 39, 45, 0.1)',
  },
  riskMedium: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
  },
  riskLow: {
    backgroundColor: '#f0f2f5',
  },
  riskText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e3a5f',
  },
});