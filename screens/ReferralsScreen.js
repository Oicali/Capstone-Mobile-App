import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

export default function ReferralsScreen({ navigation }) {
  const referrals = [
    {
      id: 'REF-2024-001',
      barangay: 'Brgy. Molino III',
      type: 'Noise Complaint',
      date: 'Jan 18, 2026',
      status: 'New',
    },
    {
      id: 'REF-2024-002',
      barangay: 'Brgy. Niog',
      type: 'Suspicious Activity',
      date: 'Jan 17, 2026',
      status: 'In Review',
    },
    {
      id: 'REF-2024-003',
      barangay: 'Brgy. Salinas',
      type: 'Public Safety Concern',
      date: 'Jan 16, 2026',
      status: 'Resolved',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Referral Reports</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Barangay Referrals</Text>

        {referrals.map((referral) => (
          <TouchableOpacity key={referral.id} style={styles.referralCard}>
            <View style={styles.referralHeader}>
              <Text style={styles.referralId}>{referral.id}</Text>
              <View style={[
                styles.statusBadge,
                referral.status === 'New' && styles.statusNew,
                referral.status === 'In Review' && styles.statusReview,
                referral.status === 'Resolved' && styles.statusResolved,
              ]}>
                <Text style={styles.statusText}>{referral.status}</Text>
              </View>
            </View>

            <Text style={styles.referralType}>{referral.type}</Text>
            <Text style={styles.referralBarangay}>📍 {referral.barangay}</Text>
            <Text style={styles.referralDate}>📅 {referral.date}</Text>

            <TouchableOpacity style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View Details</Text>
            </TouchableOpacity>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a3a6b',
    marginBottom: 16,
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  referralHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6c757d',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusNew: {
    backgroundColor: '#dbeafe',
  },
  statusReview: {
    backgroundColor: '#fef3c7',
  },
  statusResolved: {
    backgroundColor: '#d1fae5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  referralType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a3a6b',
    marginBottom: 8,
  },
  referralBarangay: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  referralDate: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  viewButton: {
    backgroundColor: '#f59e0b',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});