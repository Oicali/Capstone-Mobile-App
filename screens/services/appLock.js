// screens/services/appLock.js
import { useEffect, useRef, useState, useCallback } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getSession } from "./api";

// Safe loader: if the installed app doesn't contain the native module yet,
// this stays null and the whole feature quietly stays off (no crash).
let LocalAuthentication = null;
try {
  LocalAuthentication = require("expo-local-authentication");
} catch (e) {
  LocalAuthentication = null;
}
export const isNativeReady = () => !!LocalAuthentication;

// How long the app can stay in the background before it locks.
// Use 10 * 1000 while testing/demoing.
export const LOCK_AFTER_MS = 30 * 1000;

// Call right before launching the camera / gallery so returning from it
// does not trigger the lock screen.
let skipUntil = 0;
export const suspendLockOnce = () => {
  skipUntil = Date.now() + 5 * 60 * 1000;
};
const consumeSkip = () => {
  const skip = Date.now() < skipUntil;
  skipUntil = 0;
  return skip;
};

// While the system fingerprint prompt is open, Android may report the app as
// "background". Ignore those events so unlocking never re-locks itself.
let authBusyUntil = 0;
const markAuthBusy = (ms) => {
  authBusyUntil = Date.now() + ms;
};
const isAuthBusy = () => Date.now() < authBusyUntil;

const getUserId = async () => {
  try {
    const raw = await AsyncStorage.getItem("auth_user");
    return raw ? (JSON.parse(raw)?.user_id ?? "anon") : "anon";
  } catch {
    return "anon";
  }
};
const lockKey = async () => `app_lock_enabled:${await getUserId()}`;

export const getLockEnabled = async () =>
  (await AsyncStorage.getItem(await lockKey())) === "1";
export const setLockEnabled = async (value) =>
  AsyncStorage.setItem(await lockKey(), value ? "1" : "0");

// True if the phone has a fingerprint OR a PIN/pattern/password set up.
export const isBiometricAvailable = async () => {
  if (!LocalAuthentication) return false;
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return false;
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
};

export const authenticate = async (message = "Unlock BANTAY") => {
  if (!LocalAuthentication) return false;
  markAuthBusy(120000);
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: message,
      cancelLabel: "Cancel",
      disableDeviceFallback: false, // allows phone PIN / pattern as a fallback
    });
    return !!res.success;
  } catch {
    return false;
  } finally {
    markAuthBusy(1500);
  }
};

// Used once in App.js
export function useAppLock(isLoggedIn) {
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const backgroundedAt = useRef(null);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  // Cold start: already logged in + lock enabled → lock immediately
  useEffect(() => {
    if (!LocalAuthentication || isLoggedIn !== true) return;
    let alive = true;
    (async () => {
      if ((await getLockEnabled()) && (await isBiometricAvailable()) && alive)
        setLocked(true);
    })();
    return () => {
      alive = false;
    };
  }, [isLoggedIn]);

  // Returning from the background
  useEffect(() => {
    if (!LocalAuthentication) return;
    const sub = AppState.addEventListener("change", async (next) => {
      if (lockedRef.current) return;

      if (next === "background") {
        if (isAuthBusy()) return;
        backgroundedAt.current = Date.now();
        return;
      }

      if (next === "active" && backgroundedAt.current) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (isAuthBusy()) return;
        if (consumeSkip()) return;
        if (away < LOCK_AFTER_MS) return;
        const session = await getSession();
        if (!session?.token) return; // not logged in, nothing to protect
        if ((await getLockEnabled()) && (await isBiometricAvailable()))
          setLocked(true);
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(() => setLocked(false), []);
  return { locked, unlock };
}
