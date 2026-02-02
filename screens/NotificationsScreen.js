import React from 'react';
import { Dimensions, Platform } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';

 const { width, height } = Dimensions.get('window');

export default function NotificationsScreen({ navigation }) {

  const notifications = [
    {
      id: 5,
      type: 'Referral',
      title: 'New Barangay Referral',
      message: 'Noise Complaint - Brgy. Molino III',
      time: '5 minutes ago',
      read: false,
    },
    {
      id: 1,
      type: 'Patrol',
      title: 'New Patrol Assignment',
      message: 'Brgy. Molino III - Tomorrow 08:00 AM',
      time: '2 hours ago',
      read: false,
    },
    {
      id: 2,
      type: 'Schedule',
      title: 'Schedule Updated',
      message: 'Your patrol schedule has been modified',
      time: '5 hours ago',
      read: false,
    },
    {
      id: 3,
      type: 'Case',
      title: 'Case Assignment',
      message: 'You have been assigned to Case #2024-089',
      time: '1 day ago',
      read: true,
    },
    {
      id: 4,
      type: 'Alert',
      title: 'High Alert',
      message: 'New hotspot detected in your patrol area',
      time: '2 days ago',
      read: true,
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

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Patrol': return '🛡️';
      case 'Schedule': return '📅';
      case 'Case': return '📋';
      case 'Alert': return '⚠️';
      case 'Referral': return '📄';  // ✅ NEW: Referral icon
      default: return '📢';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <TouchableOpacity>
          <Text style={styles.markAllRead}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>New ({notifications.filter(n => !n.read).length})</Text>

        {notifications
          .filter((n) => !n.read)
          .map((notification) => (
            <TouchableOpacity
              key={notification.id}
              style={styles.notificationCard}
              onPress={() => handleNotificationPress(notification)}
            >
              <View style={styles.notificationLeft}>
                <Text style={styles.notificationIcon}>
                  {getTypeIcon(notification.type)}
                </Text>
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
                  <Text style={styles.actionText}>View Details →</Text>
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
                <Text style={styles.notificationIcon}>
                  {getTypeIcon(notification.type)}
                </Text>
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
  markAllRead: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
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
  notificationIcon: {
    fontSize: 28,
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
