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
 const { width, height } = Dimensions.get('window');

export default function AssignmentsScreen({ navigation }) {

  const assignments = [
    {
      id: 'PTR-001',
      area: 'Brgy. Molino III',
      time: '08:00 - 12:00',
      establishments: 5,
      status: 'In Progress',
    },
    {
      id: 'PTR-002',
      area: 'Brgy. Niog',
      time: '13:00 - 17:00',
      establishments: 4,
      status: 'Pending',
    },
    {
      id: 'PTR-003',
      area: 'Brgy. Salinas',
      time: 'Tomorrow 09:00',
      establishments: 6,
      status: 'Scheduled',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
    <View style={styles.header}>
  <Text style={styles.headerTitle}>My Assignments</Text>
  <TouchableOpacity onPress={() => navigation.navigate('PatrolLog')}>
    <View style={styles.patrolLogButton}>
      <Ionicons name="create-outline" size={20} color="#FFFFFF" />
      <Text style={styles.patrolLogText}>Log</Text>
    </View>
  </TouchableOpacity>
</View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Today's Patrols</Text>

        {assignments.map((assignment) => (
          <TouchableOpacity key={assignment.id} style={styles.assignmentCard}>
            <View style={styles.assignmentHeader}>
              <Text style={styles.assignmentId}>{assignment.id}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{assignment.status}</Text>
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
patrolLogButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
},
patrolLogText: {
  fontSize: 14,
  color: '#FFFFFF',
  fontWeight: '600',
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
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderLeftWidth: 4,
    borderLeftColor: '#c1272d',
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
    color: '#0a1628',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f0f2f5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1e3a5f',
  },
  assignmentArea: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a1628',
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
    backgroundColor: '#c1272d',
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
