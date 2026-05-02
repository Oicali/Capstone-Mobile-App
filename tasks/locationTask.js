import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../screens/services/api";

export const LOCATION_TASK_NAME = "background-location-task";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.warn("[BGLocation] Task error:", error.message);
    return;
  }
  if (data) {
    const { locations } = data;
    const loc = locations[0];
    if (!loc) return;

    try {
      const token = await AsyncStorage.getItem("auth_token");
      if (!token) return;

      await fetch(`${BASE_URL}/gps/location`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? null,
          heading: loc.coords.heading ?? 0,
          speed: loc.coords.speed ?? 0,
        }),
      });
    } catch (err) {
      console.warn("[BGLocation] Push failed:", err.message);
    }
  }
});