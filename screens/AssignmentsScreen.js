import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';

export default function AssignmentsScreen({ navigation }) {
  const assignments = [
    {
      id: 'PTR-001',
      area: 'Brgy. Molino III',
      time: '08:00 - 12:00',
      establishments: 5,
      status: 'In Progress',
      statusColor: '#3b82f6',
    },
    {
      id: 'PTR-002',
      area: 'Brgy. Niog',
      time: '13:00 - 17:00',
      establishments: 4,
      status: 'Pending',
      statusColor: '#f59e0b',
    },
    {
      id: 'PTR-003',
      area: 'Brgy. Salinas',
      time: 'Tomorrow 09:00',
      establishments: 6,
      status: 'Scheduled',
      statusColor: '#10b981',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Assignments</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Today's Patrols</Text>

        {assignments.map((assignment) => (
          <TouchableOpacity key={assignment.id} style={styles.assignmentCard}>
            <View style={styles.assignmentHeader}>
              <Text style={styles.assignmentId}>{assignment.id}</Text>
              <View style={[styles.statusBadge, { backgroundColor: assignment.statusColor + '20' }]}>
                <Text style={[styles.statusText, { color: assignment.statusColor }]}>
                  {assignment.status}
                </Text>
              </View>
            </View>

            <Text style={styles.assignmentArea}>📍 {assignment.area}</Text>
            <Text style={styles.assignmentTime}>🕐 {assignment.time}</Text>
            <Text style={styles.assignmentEstablishments}>
              🏢 {assignment.establishments} establishments to visit
            </Text>

            <TouchableOpacity style={styles.startButton}>
              <Text style={styles.startButtonText}>View Details</Text>
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
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  assignmentId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a3a6b',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  assignmentArea: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a3a6b',
    marginBottom: 8,
  },
  assignmentTime: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  assignmentEstablishments: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  startButton: {
    backgroundColor: '#2d5aa8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
