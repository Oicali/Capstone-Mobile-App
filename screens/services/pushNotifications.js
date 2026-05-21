import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { BASE_URL, getSession } from "./api";

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
      sound: true,
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

export const setupNotificationHandlers = () => {
  // This fires when user TAPS a notification (app was closed/background)
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const linkTo = response.notification.request.content.data?.linkTo;
    // You can handle navigation here if needed
    console.log("Notification tapped:", linkTo);
  });
  return () => subscription.remove();
};