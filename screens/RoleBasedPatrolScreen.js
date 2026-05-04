// screens/RoleBasedPatrolScreen.jsx
import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import PatrolSchedulingScreen from "./PatrolSchedulingScreen";
import PatrollerScheduleScreen from "./PatrollerScheduleScreen";

export default function RoleBasedPatrolScreen({ navigation }) {
  const [roleId, setRoleId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getRole = async () => {
      try {
        const raw = await AsyncStorage.getItem("auth_user");
        if (raw) {
          const user = JSON.parse(raw);
          setRoleId(user?.role ?? null);
        }
      } catch {
        setRoleId(null);
      } finally {
        setLoading(false);
      }
    };
    getRole();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f8f9fa" }}>
        <ActivityIndicator size="large" color="#1e3a5f" />
      </View>
    );
  }

  if (roleId === "Patrol") {
    return <PatrollerScheduleScreen navigation={navigation} />;
  }
  return <PatrolSchedulingScreen navigation={navigation} />;
}