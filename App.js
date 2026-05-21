import "./tasks/locationTask";
// App.js — updated to include patrol scheduling screens
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { getSession, validateToken, clearSession } from "./screens/services/api";

import SplashScreen from "./screens/SplashScreen";
import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import EBlotterScreen from "./screens/EBlotter";
import AssignmentsScreen from "./screens/AssignmentsScreen";
import MapScreen from "./screens/MapScreen";
import ProfileScreen from "./screens/ProfileScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import PatrolLogScreen from "./screens/PatrolLogScreen";
import ChangePasswordScreen from "./screens/ChangePasswordScreen";
import { setupNotificationHandlers } from './screens/services/pushNotifications';
// ── NEW patrol screens ──────────────────────────────────────────
import PatrolSchedulingScreen from "./screens/PatrolSchedulingScreen";
import PatrolDetailScreen from "./screens/PatrolDetailScreen";
import RoleBasedPatrolScreen from "./screens/RoleBasedPatrolScreen";
import AfterPatrolScreen from "./screens/AfterPatrolScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ focused, iconName, label }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingTop: 8 }}>
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
        <Ionicons name={iconName} size={24} color={focused ? "#FFFFFF" : "#6c757d"} />
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 9,
          fontWeight: focused ? "700" : "600",
          color: focused ? "#1e3a5f" : "#6c757d",
          textAlign: "center",
          maxWidth: 70,
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
          height: 55 + insets.bottom,
          paddingBottom: insets.bottom,
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
            <TabIcon focused={focused} iconName={focused ? "home" : "home-outline"} label="Home" />
          ),
        }}
      />
      <Tab.Screen
        name="Reporting"
        component={EBlotterScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? "document-text" : "document-text-outline"} label="Report" />
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
            <TabIcon focused={focused} iconName={focused ? "map" : "map-outline"} label="Map" />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? "person" : "person-outline"} label="Profile" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  useEffect(() => {
    const cleanup = setupNotificationHandlers();
    checkLogin();
  return cleanup;
  }, []);

  const checkLogin = async () => {
    try {
      const session = await getSession();
      if (!session?.token) { setIsLoggedIn(false); return; }
      const valid = await validateToken(session.token);
      if (!valid) { await clearSession(); setIsLoggedIn(false); return; }
      setIsLoggedIn(true);
    } catch (error) {
      console.error("checkLogin error:", error);
      await clearSession();
      setIsLoggedIn(false);
    }
  };

  if (isLoggedIn === null) return null;

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false, animation: "slide_from_right" }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} initialParams={{ isLoggedIn }} options={{ animation: "fade" }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ animation: "fade" }} />
          <Stack.Screen name="Main" component={MainTabs} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="PatrolLog" component={PatrolLogScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />

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
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}