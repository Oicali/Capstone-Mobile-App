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

  const getStatusStyle = (status) => {
    if (status === 'New') return styles.statusNew;
    if (status === 'In Review') return styles.statusReview;
    return styles.statusResolved;
  };

  return (
    <SafeAreaView style={styles.container}>
   <View style={styles.header}>
  <Text style={styles.headerTitle}>Referral Reports</Text>
  <Text style={styles.headerSubtitle}></Text>
</View>
      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Barangay Referrals</Text>

        {referrals.map((referral) => (
          <TouchableOpacity key={referral.id} style={styles.referralCard}>
            <View style={styles.referralHeader}>
              <Text style={styles.referralId}>{referral.id}</Text>
              <View style={[styles.statusBadge, getStatusStyle(referral.status)]}>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 16,
  },
  referralCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#c1272d',
    borderWidth: 1,
    borderColor: '#dee2e6',
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
    backgroundColor: '#f0f2f5',
  },
  statusReview: {
    backgroundColor: '#f0f2f5',
  },
  statusResolved: {
    backgroundColor: '#f0f2f5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e3a5f',
  },
  referralType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a1628',
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
    backgroundColor: '#c1272d',
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
