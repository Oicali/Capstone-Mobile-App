import "./tasks/locationTask";
import * as Notifications from "expo-notifications"; // ← add this

import { NavigationContainer, CommonActions, } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import {
  Text, 
  View,
  Platform,
  Alert,
  AppState,
  Modal,
  Pressable,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  BASE_URL,
  getSession,
  validateToken,
  clearSession,
  setSessionDeadHandler,
  startSessionWatch,
} from "./screens/services/api";
import {
  registerForPushNotifications,
  savePushToken,
  clearPushToken,
  setupNotificationHandlers,
  navigationRef,
} from "./screens/services/pushNotifications";
import * as NavigationBar from "expo-navigation-bar";

import LoginApprovalModal from "./screens/LoginApprovalModal";
import LoginActivityScreen from "./screens/LoginActivityScreen";
import SplashScreen from "./screens/SplashScreen";
import NotificationsPermissionScreen from "./screens/NotificationsPermissionScreen";
import LocationPermissionScreen from "./screens/LocationPermissionScreen";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import EBlotterScreen from "./screens/EBlotter";
import MapScreen from "./screens/MapScreen";
import ProfileScreen from "./screens/ProfileScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import PatrolLogScreen from "./screens/PatrolLogScreen";
import ChangePasswordScreen from "./screens/ChangePasswordScreen";
import PatrolDetailScreen from "./screens/PatrolDetailScreen";
import RoleBasedPatrolScreen from "./screens/RoleBasedPatrolScreen";
import AfterPatrolScreen from "./screens/AfterPatrolScreen";
import AfterPatrolHistoryScreen from "./screens/AfterPatrolHistoryScreen";

// Module-level — runs once before anything mounts
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,     
    shouldShowBanner: true,  
    shouldShowList: true,    
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ focused, iconName, label }) {
  return (
    <View
      style={{ alignItems: "center", justifyContent: "center", paddingTop: 8 }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: focused ? "#1e3a5f" : "transparent",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 1,
        }}
      >
        <Ionicons
          name={iconName}
          size={24}
          color={focused ? "#FFFFFF" : "#6c757d"}
        />
      </View>
    <Text
  numberOfLines={1}
  allowFontScaling={false}
  adjustsFontSizeToFit
  minimumFontScale={0.75}
  style={{
    fontSize: 9,
    fontWeight: focused ? "700" : "600",
    color: focused ? "#1e3a5f" : "#6c757d",
    textAlign: "center",
    width: 64,
  }}
>
  {label}
</Text>
    </View>
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          // Math.max(insets.bottom, 16): with the system nav bar hidden,
          // insets.bottom drops to ~0 on most Android devices, which made
          // the tab bar sit flush against the very bottom edge with no
          // padding — looking cut off. A 16px floor restores breathing
          // room while still respecting a larger inset (e.g. iPhone home
          // indicator) when one is present.
          height: 55 + Math.max(insets.bottom, 25),
          paddingBottom: Math.max(insets.bottom, 25),
          paddingTop: 8,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#dee2e6",
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          position: "absolute",
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconName={focused ? "home" : "home-outline"}
              label="Home"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Reporting"
        component={EBlotterScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconName={focused ? "document-text" : "document-text-outline"}
              label="Report"
            />
          ),
        }}
      />
      {/*
        ── Assignments tab now shows PatrolSchedulingScreen ────────
        The old AssignmentsScreen (dummy data) is replaced.
        PatrolDetailScreen is pushed onto the root Stack so it
        renders full-screen above the tab bar.
      */}
      <Tab.Screen
        name="Assignments"
        component={RoleBasedPatrolScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconName={focused ? "shield" : "shield-outline"}
              label="Patrol"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconName={focused ? "map" : "map-outline"}
              label="Map"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              iconName={focused ? "person" : "person-outline"}
              label="Profile"
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [sessionLogoutVisible, setSessionLogoutVisible] = useState(false);
const [sessionLogoutMessage, setSessionLogoutMessage] = useState("");

  useEffect(() => {
    if (Platform.OS === "android") {
    }
  }, []);

  useEffect(() => {
    const cleanup = setupNotificationHandlers(); // ← called once on mount
    checkLogin();
    return cleanup; // ← resets handlersInitialized on unmount
  }, []); // ← empty deps, good

  // ── Remote-logout detection (works from ANY screen) ─────────────────────
useEffect(() => {
  setSessionDeadHandler(async (code) => {
    console.log("🚨 GLOBAL SESSION DEAD:", code);

    await clearSession();

    setSessionLogoutMessage(
      code === "SESSION_REVOKED"
        ? "This device was logged out from another device."
        : "Your session has expired. Please log in again."
    );

    // Make sure the Login screen is the only screen left.
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Login" }],
        })
      );
    }

    // Keep the modal visible until the user chooses Cancel/OK.
    setSessionLogoutVisible(true);

    // Best-effort cleanup AFTER the modal is up.
    clearPushToken().catch(() => {});
  });

  return () => {
    setSessionDeadHandler(null);
  };
}, []);

  // ✅ Only register token once we know user is logged in
  useEffect(() => {
    if (isLoggedIn === true) {
      registerForPushNotifications().then((token) => {
        if (token) {
          console.log("✅ Got token, saving:", token);
          savePushToken(token);
        } else {
          console.log("❌ No token returned");
        }
      });
    }
  }, [isLoggedIn]);

  const checkLogin = async () => {
    try {
      const session = await getSession();
      if (!session?.token) {
        setIsLoggedIn(false);
        return;
      }
      const valid = await validateToken(session.token);
      if (!valid) {
        await clearSession();
        setIsLoggedIn(false);
        return;
      }
      setIsLoggedIn(true);
startSessionWatch();
    } catch (error) {
      console.error("checkLogin error:", error);
      await clearSession();
      setIsLoggedIn(false);
    }
  };

  const closeSessionModal = () => {
    setSessionLogoutVisible(false);
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Login" }],
        }),
      );
    }
  };

  if (isLoggedIn === null) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false, animation: "slide_from_right" }}
        >
          <Stack.Screen
            name="Splash"
            component={SplashScreen}
            initialParams={{ isLoggedIn }}
            options={{ animation: "fade" }}
          />
          <Stack.Screen
            name="NotificationsPermission"
            component={NotificationsPermissionScreen}
            options={{ animation: "fade", gestureEnabled: false }}
          />
          <Stack.Screen
            name="LocationPermission"
            component={LocationPermissionScreen}
            options={{ animation: "fade", gestureEnabled: false }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ animation: "fade" }}
          />
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="PatrolLog" component={PatrolLogScreen} />
          <Stack.Screen
            name="ChangePassword"
            component={ChangePasswordScreen}
          />
          <Stack.Screen
            name="LoginActivity"
            component={LoginActivityScreen}
          />

          {/*
            PatrolDetailScreen lives on the root stack (not inside tabs)
            so it slides in full-screen over the tab bar — matching the
            BeatCard modal feel from the web app.
          */}
          <Stack.Screen
            name="PatrolDetail"
            component={PatrolDetailScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="AfterPatrolReport"
            component={AfterPatrolScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="AfterPatrolHistory"
            component={AfterPatrolHistoryScreen}
            options={{ animation: "slide_from_right" }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      <LoginApprovalModal />
              <Modal
        visible={sessionLogoutVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          // Do nothing. Android back button cannot dismiss this modal.
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.55)",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: "#FFFFFF",
              borderRadius: 10,
              overflow: "hidden",
              elevation: 12,
            }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 18,
                paddingHorizontal: 20,
                backgroundColor: "#0B2447",
                borderBottomWidth: 3,
                borderBottomColor: "#dc2626",
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}
                >
                  Logged out
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.6)",
                    marginTop: 2,
                  }}
                >
                  Your session has ended
                </Text>
              </View>
            </View>

            {/* Body */}
            <View style={{ padding: 24 }}>
              <Text style={{ fontSize: 14, lineHeight: 22, color: "#374151" }}>
                {sessionLogoutMessage}
              </Text>
            </View>

            {/* Footer */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderTopWidth: 1,
                borderTopColor: "#e5e7eb",
                backgroundColor: "#f9fafb",
              }}
            >
              <Pressable
                onPress={closeSessionModal}
                style={{
                  minWidth: 80,
                  paddingVertical: 11,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: "#E9ECEF",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#495057" }}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={closeSessionModal}
                style={{
                  minWidth: 80,
                  paddingVertical: 11,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: "#19376D",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}
                >
                  OK
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaProvider>
  );
}
