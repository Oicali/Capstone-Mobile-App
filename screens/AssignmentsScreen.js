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

            <View style={styles.infoRow}>
              <Ionicons name="location" size={16} color="#c1272d" />
              <Text style={styles.assignmentArea}>{assignment.area}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="time" size={16} color="#6c757d" />
              <Text style={styles.assignmentTime}>{assignment.time}</Text>
            </View>
            
            <View style={styles.infoRow}>
              <Ionicons name="business" size={16} color="#6c757d" />
              <Text style={styles.assignmentEstablishments}>
                {assignment.establishments} establishments to visit
              </Text>
            </View>

            <TouchableOpacity style={styles.startButton}>
              <Text style={styles.startButtonText}>View Details</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
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
    paddingBottom: Platform.OS === 'ios' ? 0 : 10,
  },
  content: {
    flex: 1,
    padding: width > 768 ? 30 : 20,
    paddingBottom: 100,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  assignmentArea: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a1628',
  },
  assignmentTime: {
    fontSize: 14,
    color: '#6c757d',
  },
  assignmentEstablishments: {
    fontSize: 14,
    color: '#6c757d',
  },
  startButton: {
    backgroundColor: '#c1272d',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});