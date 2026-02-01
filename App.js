import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Import all your screens
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import CrimeMappingScreen from './screens/CrimeMappingScreen';
import AssignmentsScreen from './screens/AssignmentsScreen';
import ReferralsScreen from './screens/ReferralsScreen';
import ProfileScreen from './screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator (Main Dashboard)
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          let iconText = '';

          if (route.name === 'Dashboard') {
            iconText = focused ? '🏠' : '🏠';
          } else if (route.name === 'CrimeMap') {
            iconText = focused ? '🗺️' : '🗺️';
          } else if (route.name === 'Assignments') {
            iconText = focused ? '📋' : '📋';
          } else if (route.name === 'Referrals') {
            iconText = focused ? '📄' : '📄';
          } else if (route.name === 'Profile') {
            iconText = focused ? '👤' : '👤';
          }

          return (
            <div style={{ 
              fontSize: focused ? 26 : 24, 
              opacity: focused ? 1 : 0.6,
              transform: focused ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.2s'
            }}>
              {iconText}
            </div>
          );
        },
        tabBarActiveTintColor: '#2d5aa8',
        tabBarInactiveTintColor: '#6c757d',
        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#e9ecef',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="CrimeMap"
        component={CrimeMappingScreen}
        options={{ tabBarLabel: 'Map' }}
      />
      <Tab.Screen
        name="Assignments"
        component={AssignmentsScreen}
        options={{ tabBarLabel: 'Patrols' }}
      />
      <Tab.Screen
        name="Referrals"
        component={ReferralsScreen}
        options={{ tabBarLabel: 'Reports' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
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
        <Stack.Screen 
          name="Splash" 
          component={SplashScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen 
          name="Login" 
          component={LoginScreen}
          options={{ animation: 'fade' }}
        />
        <Stack.Screen 
          name="Main" 
          component={MainTabs}
          options={{ 
            gestureEnabled: false, // Prevent swipe back from main screen
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}