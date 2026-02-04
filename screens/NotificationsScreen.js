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
  Alert,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function NotificationsScreen({ navigation }) {
  const notifications = [
    {
      id: 5,
      type: 'Referral',
      title: 'New Barangay Referral',
      message: 'Noise Complaint - Brgy. Molino III',
      time: '5 minutes ago',
      read: false,
      icon: 'document-text',
    },
    {
      id: 1,
      type: 'Patrol',
      title: 'New Patrol Assignment',
      message: 'Brgy. Molino III - Tomorrow 08:00 AM',
      time: '2 hours ago',
      read: false,
      icon: 'shield-checkmark',
    },
    {
      id: 2,
      type: 'Schedule',
      title: 'Schedule Updated',
      message: 'Your patrol schedule has been modified',
      time: '5 hours ago',
      read: false,
      icon: 'calendar',
    },
    {
      id: 3,
      type: 'Case',
      title: 'Case Assignment',
      message: 'You have been assigned to Case #2024-089',
      time: '1 day ago',
      read: true,
      icon: 'clipboard',
    },
    {
      id: 4,
      type: 'Alert',
      title: 'High Alert',
      message: 'New hotspot detected in your patrol area',
      time: '2 days ago',
      read: true,
      icon: 'warning',
    },
  ];

  const handleNotificationPress = (notification) => {
    Alert.alert(
      notification.title,
      notification.message,
      [
        { text: 'Acknowledge', onPress: () => console.log('Acknowledged') },
        { text: 'View Details', onPress: () => console.log('View Details') },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity>
          <Text style={styles.markAllRead}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>
          New ({notifications.filter(n => !n.read).length})
        </Text>

        {notifications
          .filter((n) => !n.read)
          .map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={styles.notificationCard}
              onPress={() => handleNotificationPress(notification)}
            >
              <View style={styles.notificationLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons name={notification.icon} size={24} color="#c1272d" />
                </View>
              </View>

              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{notification.type}</Text>
                  </View>
                  <Text style={styles.notificationTime}>{notification.time}</Text>
                </View>

                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>

                <View style={styles.notificationActions}>
                  <Text style={styles.actionText}>View Details</Text>
                  <Ionicons name="arrow-forward" size={14} color="#c1272d" />
                </View>
              </View>

              <View style={styles.unreadDot} />
            </TouchableOpacity>
          ))}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Earlier</Text>

        {notifications
          .filter((n) => n.read)
          .map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={[styles.notificationCard, styles.notificationCardRead]}
              onPress={() => handleNotificationPress(notification)}
            >
              <View style={styles.notificationLeft}>
                <View style={[styles.iconContainer, styles.iconContainerRead]}>
                  <Ionicons name={notification.icon} size={24} color="#6c757d" />
                </View>
              </View>

              <View style={styles.notificationContent}>
                <View style={styles.notificationHeader}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{notification.type}</Text>
                  </View>
                  <Text style={styles.notificationTime}>{notification.time}</Text>
                </View>

                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
              </View>
            </TouchableOpacity>
          ))}

        <View style={{ height: 40 }} />
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
  markAllRead: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderLeftWidth: 4,
    borderLeftColor: '#c1272d',
    position: 'relative',
  },
  notificationCardRead: {
    borderLeftColor: '#dee2e6',
    opacity: 0.7,
  },
  notificationLeft: {
    marginRight: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(193, 39, 45, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerRead: {
    backgroundColor: '#f8f9fa',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f0f2f5',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#1e3a5f',
  },
  notificationTime: {
    fontSize: 12,
    color: '#6c757d',
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0a1628',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18,
  },
  notificationActions: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontSize: 13,
    color: '#c1272d',
    fontWeight: '600',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c1272d',
  },
});