// FILE: screens/BarangayReportScreen.js - NEW MODULE
import { Dimensions, Platform } from 'react-native';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
} from 'react-native';

 const { width, height } = Dimensions.get('window');

export default function BarangayReportScreen({ navigation }) {

  const [incidentType, setIncidentType] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const incidentTypes = [
    'Disturbance',
    'Suspicious Activity',
    'Noise Complaint',
    'Public Safety Concern',
    'Property Damage',
    'Other',
  ];

  const handleSubmit = () => {
    if (!incidentType || !location || !description) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    Alert.alert(
      'Success',
      'Your barangay report has been submitted successfully!',
      [
        {
          text: 'OK',
          onPress: () => {
            // Clear form
            setIncidentType('');
            setLocation('');
            setDescription('');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Barangay Report</Text>
        <Text style={styles.headerSubtitle}>Submit Incident Report</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <View style={styles.infoText}>
            <Text style={styles.infoTitle}>For Barangay Officials Only</Text>
            <Text style={styles.infoDescription}>
              Submit incident reports from your barangay to PNP Bacoor
            </Text>
          </View>
        </View>

        {/* Incident Type Selection */}
        <View style={styles.formSection}>
          <Text style={styles.label}>
            Incident Type <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.typeGrid}>
            {incidentTypes.map((type, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.typeButton,
                  incidentType === type && styles.typeButtonActive,
                ]}
                onPress={() => setIncidentType(type)}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    incidentType === type && styles.typeButtonTextActive,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Location */}
        <View style={styles.formSection}>
          <Text style={styles.label}>
            Location/Address <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Enter specific location or address"
            placeholderTextColor="#adb5bd"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Description */}
        <View style={styles.formSection}>
          <Text style={styles.label}>
            Incident Description <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Provide detailed description of the incident..."
            placeholderTextColor="#adb5bd"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Photo Upload (Optional) */}
        <View style={styles.formSection}>
          <Text style={styles.label}>Photos (Optional)</Text>
          <TouchableOpacity style={styles.uploadButton}>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadText}>Take or Upload Photos</Text>
          </TouchableOpacity>
          <Text style={styles.helpText}>You can attach photos as evidence</Text>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit Report</Text>
        </TouchableOpacity>

        {/* Recent Submissions */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Recent Submissions</Text>

          <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportId}>REP-2024-001</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Pending</Text>
              </View>
            </View>
            <Text style={styles.reportType}>Noise Complaint</Text>
            <Text style={styles.reportLocation}>📍 Brgy. Molino III</Text>
            <Text style={styles.reportDate}>📅 Jan 18, 2026</Text>
          </View>

          <View style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportId}>REP-2024-002</Text>
              <View style={[styles.statusBadge, styles.statusResolved]}>
                <Text style={styles.statusText}>Resolved</Text>
              </View>
            </View>
            <Text style={styles.reportType}>Suspicious Activity</Text>
            <Text style={styles.reportLocation}>📍 Brgy. Niog</Text>
            <Text style={styles.reportDate}>📅 Jan 15, 2026</Text>
          </View>
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
    padding: 20,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#e7f3ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#1e3a5f',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e3a5f',
    marginBottom: 2,
  },
  infoDescription: {
    fontSize: 11,
    color: '#6c757d',
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a1628',
    marginBottom: 8,
  },
  required: {
    color: '#c1272d',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  typeButtonActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#1e3a5f',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c757d',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#0a1628',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  uploadButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#dee2e6',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
  },
  helpText: {
    fontSize: 12,
    color: '#adb5bd',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: '#1e3a5f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 32,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  recentSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 16,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderLeftWidth: 4,
    borderLeftColor: '#28a745',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportId: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c757d',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  statusResolved: {
    backgroundColor: '#d1fae5',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0a1628',
  },
  reportType: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 8,
  },
  reportLocation: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 13,
    color: '#6c757d',
  },
});