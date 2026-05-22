import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { BASE_URL, getSession } from "./api";
import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const registerForPushNotifications = async () => {
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
  name: "BANTAY Notifications",
  importance: Notifications.AndroidImportance.MAX,
  vibrationPattern: [0, 250, 250, 250],
  lightColor: "#c1272d",
  sound: "default",
});
  }

  const token = (await Notifications.getExpoPushTokenAsync({
  projectId: "530d6325-6acc-4b87-b517-85fa25600c86",
})).data;
  return token;
};

export const savePushToken = async (token) => {
  try {
    const session = await getSession();
    if (!session?.token) return;
    await fetch(`${BASE_URL}/notifications/push-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ push_token: token }),
    });
  } catch (err) {
    console.error("savePushToken error:", err);
  }
};

const getNavigationTarget = (linkTo, userRole) => {
  if (!linkTo) return null;
  
  if (linkTo === '/e-blotter' || linkTo === '/brgy-report') {
    if (userRole === 'Barangay') return { tab: 'Reporting' };
    return { tab: 'Reporting' };
  }
  if (linkTo === '/case-management') return { tab: 'Dashboard' };
  if (linkTo === '/patrol-scheduling') return { tab: 'Assignments' };
  return null;
};

export const setupNotificationHandlers = () => {
  const subscription = Notifications.addNotificationResponseReceivedListener(async response => {
    const linkTo = response.notification.request.content.data?.linkTo;
    
    // Get user role from storage
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const userRaw = await AsyncStorage.getItem('auth_user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const role = user?.role || '';

    const target = getNavigationTarget(linkTo, role);
    if (target && navigationRef.isReady()) {
      navigationRef.navigate('Main', { screen: target.tab });
    }
  });
  return () => subscription.remove();
};