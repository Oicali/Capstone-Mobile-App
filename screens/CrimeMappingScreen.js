import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

export default function CrimeMappingScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crime Mapping</Text>
        <View style={{ width: 60 }} />
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
    backgroundColor: '#f0f2f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    fontSize: 16,
    color: '#2d5aa8',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  mapPlaceholder: {
    height: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  mapIcon: {
    fontSize: 60,
    marginBottom: 10,
  },
  mapText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3a6b',
    marginBottom: 4,
  },
  mapSubtext: {
    fontSize: 14,
    color: '#6c757d',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3a6b',
    marginBottom: 16,
  },
  hotspotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
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
    color: '#1a3a6b',
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
    backgroundColor: '#fee2e2',
  },
  riskMedium: {
    backgroundColor: '#fef3c7',
  },
  riskLow: {
    backgroundColor: '#d1fae5',
  },
  riskText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a3a6b',
  },
});
