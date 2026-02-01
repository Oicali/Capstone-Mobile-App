import React from 'react';
import { Text } from 'react-native';  // ✅ FIXED: Import Text
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Import all screens
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import CrimeMappingScreen from './screens/CrimeMappingScreen';
import AssignmentsScreen from './screens/AssignmentsScreen';
import ReferralsScreen from './screens/ReferralsScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import PatrolLogScreen from './screens/PatrolLogScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          let iconText = '';

          if (route.name === 'Dashboard') {
            iconText = '🏠';
          } else if (route.name === 'CrimeMap') {
            iconText = '🗺️';
          } else if (route.name === 'Assignments') {
            iconText = '📋';
          } else if (route.name === 'Referrals') {
            iconText = '📄';
          } else if (route.name === 'Profile') {
            iconText = '👤';
          }

          return (
            <Text style={{ 
              fontSize: focused ? 26 : 24, 
              opacity: focused ? 1 : 0.6,
            }}>
              {iconText}
            </Text>
          );
        },
        tabBarActiveTintColor: '#1e3a5f',
        tabBarInactiveTintColor: '#6c757d',
        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#dee2e6',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="CrimeMap" component={CrimeMappingScreen} options={{ tabBarLabel: 'Map' }} />
      <Tab.Screen name="Assignments" component={AssignmentsScreen} options={{ tabBarLabel: 'Patrols' }} />
      <Tab.Screen name="Referrals" component={ReferralsScreen} options={{ tabBarLabel: 'Reports' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

// Main App Navigator
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Main" component={MainTabs} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="PatrolLog" component={PatrolLogScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}