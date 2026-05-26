import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform, DeviceEventEmitter } from "react-native";
import messaging from '@react-native-firebase/messaging';
import { BASE_URL, getSession } from "./api";
import { createNavigationContainerRef } from '@react-navigation/native';

// Required by Firebase — must be at module level
messaging().setBackgroundMessageHandler(async () => {});

export const navigationRef = createNavigationContainerRef();

export const registerForPushNotifications = async () => {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'BANTAY Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#c1272d',
      sound: 'default',
    });
  }

  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log('❌ Push notification permission denied');
    return null;
  }

  const token = await messaging().getToken();
  console.log('FCM Token:', token);
  return token;
};

export const savePushToken = async (token) => {
  try {
    console.log('Saving push token to backend:', token?.substring(0, 20) + '...');
    const session = await getSession();
    if (!session?.token) {
      console.log('❌ No session token found');
      return;
    }
    const res = await fetch(`${BASE_URL}/notifications/push-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ push_token: token }),
    });
    const data = await res.json();
    console.log('✅ Token save response:', JSON.stringify(data));
  } catch (err) {
    console.error("❌ savePushToken error:", err);
  }
};

const getNavigationTarget = (linkTo) => {
  if (!linkTo) return null;
  if (linkTo === '/e-blotter' || linkTo === '/brgy-report') return { tab: 'Reporting' };
  if (linkTo === '/case-management') return { tab: 'Dashboard' };
  if (linkTo === '/patrol-scheduling') return { tab: 'Assignments' };
  return null;
};

const navigateTo = (linkTo) => {
  const target = getNavigationTarget(linkTo);
  if (!target) return;
  const waitForNav = () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Main', { screen: target.tab });
    } else {
      setTimeout(waitForNav, 100);
    }
  };
  waitForNav();
};

const handleNotificationResponse = async (response) => {
  const linkTo = response?.notification?.request?.content?.data?.linkTo;
  navigateTo(linkTo);
};

let handlersInitialized = false;

export const setupNotificationHandlers = () => {
  if (handlersInitialized) return () => {};
  handlersInitialized = true;

  const subscription = Notifications.addNotificationResponseReceivedListener(
    async (response) => {
      await handleNotificationResponse(response);
    }
  );

  const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
    DeviceEventEmitter.emit('onNewNotification');
    await Notifications.scheduleNotificationAsync({
      content: {
        title: remoteMessage.data?.title,
        body: remoteMessage.data?.body,
        data: remoteMessage.data ?? {},
        sound: 'default',
      },
      trigger: null,
    });
  });

  const unsubscribeOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
    navigateTo(remoteMessage?.data?.linkTo);
  });

  // ← add this back
  messaging().getInitialNotification().then(remoteMessage => {
    if (remoteMessage) navigateTo(remoteMessage?.data?.linkTo);
  });

  return () => {
    subscription.remove();
    unsubscribeForeground();
    unsubscribeOpenedApp();
    handlersInitialized = false;
  };
};