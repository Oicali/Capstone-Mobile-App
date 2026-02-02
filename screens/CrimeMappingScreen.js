import React from 'react';
import { Dimensions, Platform } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
 const { width, height } = Dimensions.get('window');
export default function CrimeMappingScreen({ navigation }) {
 
  return (
    <SafeAreaView style={styles.container}>
    <View style={styles.header}>
  <Text style={styles.headerTitle}>Crime Mapping</Text>
  <Text style={styles.headerSubtitle}>DBSCAN Hotspot Analysis</Text>
</View>

      <ScrollView style={styles.content}>
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapIcon}>🗺️</Text>
          <Text style={styles.mapText}>Interactive Crime Map</Text>
          <Text style={styles.mapSubtext}>DBSCAN Hotspot Clusters</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Crime Hotspots</Text>
          
          <View style={styles.hotspotItem}>
            <Text style={styles.hotspotIcon}>🔥</Text>
            <View style={styles.hotspotInfo}>
              <Text style={styles.hotspotName}>Brgy. Molino III</Text>
              <Text style={styles.hotspotDescription}>15 incidents this week</Text>
            </View>
            <View style={[styles.riskBadge, styles.riskHigh]}>
              <Text style={styles.riskText}>HIGH</Text>
            </View>
          </View>

          <View style={styles.hotspotItem}>
            <Text style={styles.hotspotIcon}>🔥</Text>
            <View style={styles.hotspotInfo}>
              <Text style={styles.hotspotName}>Brgy. Niog</Text>
              <Text style={styles.hotspotDescription}>8 incidents this week</Text>
            </View>
            <View style={[styles.riskBadge, styles.riskMedium]}>
              <Text style={styles.riskText}>MEDIUM</Text>
            </View>
          </View>

          <View style={styles.hotspotItem}>
            <Text style={styles.hotspotIcon}>🔥</Text>
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
  paddingBottom: Platform.OS === 'ios' ? 0 : 10, // Extra padding for Android
},

// Update content padding:
content: {
  flex: 1,
  padding: width > 768 ? 30 : 20, // More padding on tablets
  paddingBottom: 100, // Space for bottom navbar
},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0a285c',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
  },
  backButton: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 20,
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
  mapIcon: {
    fontSize: 60,
    marginBottom: 10,
  },
  mapText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a1628',
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
  hotspotIcon: {
    fontSize: 28,
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
    backgroundColor: '#f0f2f5',
  },
  riskLow: {
    backgroundColor: '#f0f2f5',
  },
  riskText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e3a5f',
  },
  headerSubtitle: {
  fontSize: 13,
  color: 'rgba(255, 255, 255, 0.8)',
},
});
