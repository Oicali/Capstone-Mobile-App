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

export default function PatrolLogScreen({ navigation }) {
  const [isOnPatrol, setIsOnPatrol] = useState(false);
  const [patrolStartTime, setPatrolStartTime] = useState(null);
  const [remarks, setRemarks] = useState('');

  const handleStartPatrol = () => {
    Alert.alert(
      'Start Patrol',
      'Begin patrol duty now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: () => {
            setIsOnPatrol(true);
            setPatrolStartTime(new Date());
            Alert.alert('Patrol Started', 'GPS tracking active');
          },
        },
      ]
    );
  };

  const handleEndPatrol = () => {
    Alert.alert(
      'End Patrol',
      'End patrol duty now?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End',
          onPress: () => {
            setIsOnPatrol(false);
            setPatrolStartTime(null);
            setRemarks('');
            Alert.alert('Patrol Ended', 'Log saved successfully');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patrol Log</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Card */}
        <View style={[styles.statusCard, isOnPatrol && styles.statusCardActive]}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusLabel}>Current Status</Text>
            <View style={[styles.statusBadge, isOnPatrol && styles.statusBadgeActive]}>
              <View style={[styles.statusDot, isOnPatrol && styles.statusDotActive]} />
              <Text style={[styles.statusText, isOnPatrol && styles.statusTextActive]}>
                {isOnPatrol ? 'ON PATROL' : 'OFF DUTY'}
              </Text>
            </View>
          </View>

          {isOnPatrol && (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📍 GPS Tracking:</Text>
                <Text style={styles.infoValue}>Active</Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>🕐 Started:</Text>
                <Text style={styles.infoValue}>
                  {patrolStartTime?.toLocaleTimeString()}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Action Button */}
        {!isOnPatrol ? (
          <TouchableOpacity style={styles.startButton} onPress={handleStartPatrol}>
            <Text style={styles.startButtonIcon}>▶️</Text>
            <Text style={styles.startButtonText}>START PATROL</Text>
          </TouchableOpacity>
        ) : (
          <View>
            {/* Remarks Input */}
            <View style={styles.formCard}>
              <Text style={styles.label}>REMARKS (OPTIONAL)</Text>
              <TextInput
                style={styles.textArea}
                placeholder="Add any notes or observations..."
                placeholderTextColor="#adb5bd"
                value={remarks}
                onChangeText={setRemarks}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity style={styles.endButton} onPress={handleEndPatrol}>
              <Text style={styles.endButtonIcon}>⏹️</Text>
              <Text style={styles.endButtonText}>END PATROL</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Patrol History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Recent Patrol Logs</Text>

          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyDate}>Jan 20, 2026</Text>
              <Text style={styles.historyDuration}>4h 30m</Text>
            </View>
            <Text style={styles.historyTime}>08:00 AM - 12:30 PM</Text>
            <Text style={styles.historyRemarks}>Routine patrol completed</Text>
          </View>

          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyDate}>Jan 19, 2026</Text>
              <Text style={styles.historyDuration}>3h 45m</Text>
            </View>
            <Text style={styles.historyTime}>02:00 PM - 05:45 PM</Text>
            <Text style={styles.historyRemarks}>No incidents reported</Text>
          </View>

          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyDate}>Jan 18, 2026</Text>
              <Text style={styles.historyDuration}>5h 15m</Text>
            </View>
            <Text style={styles.historyTime}>09:00 AM - 02:15 PM</Text>
            <Text style={styles.historyRemarks}>Community engagement activities</Text>
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
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#dee2e6',
  },
  statusCardActive: {
    borderColor: '#c1272d',
    backgroundColor: '#fff5f5',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
  },
  statusBadgeActive: {
    backgroundColor: '#c1272d',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6c757d',
    marginRight: 6,
  },
  statusDotActive: {
    backgroundColor: '#ffffff',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6c757d',
  },
  statusTextActive: {
    color: '#ffffff',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0a1628',
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: '#c1272d',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  startButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0a1628',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    color: '#0a1628',
    height: 100,
    textAlignVertical: 'top',
  },
  endButton: {
    flexDirection: 'row',
    backgroundColor: '#0a1628',
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  endButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  endButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  historySection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 16,
  },
  historyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderLeftWidth: 4,
    borderLeftColor: '#1e3a5f',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyDate: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0a1628',
  },
  historyDuration: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c757d',
  },
  historyTime: {
    fontSize: 13,
    color: '#6c757d',
    marginBottom: 6,
  },
  historyRemarks: {
    fontSize: 13,
    color: '#495057',
    fontStyle: 'italic',
  },
});
