
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useState, useEffect } from 'react';
import { Text, View } from 'react-native';  // ADD View HERE
// Import screens (keep existing imports)
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import CrimeMappingScreen from './screens/CrimeMappingScreen';
import AssignmentsScreen from './screens/AssignmentsScreen';
import ReferralsScreen from './screens/ReferralsScreen';
// import BarangayReportScreen from './screens/BarangayReportScreen';
import ProfileScreen from './screens/ProfileScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import PatrolLogScreen from './screens/PatrolLogScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ focused, iconName, label }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 8 }}>
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 14,
          backgroundColor: focused ? '#1e3a5f' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 2,
        }}
      >
        <Ionicons 
          name={iconName} 
          size={24} 
          color={focused ? '#FFFFFF' : '#6c757d'} 
        />
      </View>
      <Text
        numberOfLines={1}
        style={{
          fontSize: 10,
          fontWeight: focused ? '700' : '600',
          color: focused ? '#1e3a5f' : '#6c757d',
          marginTop: 2,
          textAlign: 'center',
          maxWidth: 70,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 80,
          paddingBottom: 8,
          paddingTop: 4,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#dee2e6',
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'home' : 'home-outline'} label="Home" />
          ),
        }}
      />
      <Tab.Screen
        name="CrimeMap"
        component={CrimeMappingScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'map' : 'map-outline'} label="Crime Map" />
          ),
        }}
      />
      <Tab.Screen
        name="Assignments"
        component={AssignmentsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'clipboard' : 'clipboard-outline'} label="Patrols" />
          ),
        }}
      />
      <Tab.Screen
        name="Referrals"
        component={ReferralsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'document-text' : 'document-text-outline'} label="Referrals" />
          ),
        }}
      />
    
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'person' : 'person-outline'} label="Profile" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  useEffect(() => {
    checkLogin();
  }, []);

  const checkLogin = async () => {
    const token = await AsyncStorage.getItem('token');
    setIsLoggedIn(!!token);
  };

  if (isLoggedIn === null) return null;

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
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="Notifications"
          component={NotificationsScreen}
        />
        <Stack.Screen
          name="PatrolLog"
          component={PatrolLogScreen}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}