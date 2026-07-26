import AsyncStorage from "@react-native-async-storage/async-storage";

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const validateResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Request failed");
  }
  return response.json();
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export const login = async (username, password) => {
  try {
    if (!username || !password) {
      return { success: false, message: "Username and password are required" };
    }
    if (username.length < 4) {
      return {
        success: false,
        message: "Username must be at least 4 characters",
      };
    }
    if (password.length < 8) {
      return {
        success: false,
        message: "Password must be at least 8 characters",
      };
    }

    const response = await fetch(`${BASE_URL}/auth/mobile/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        username: username.trim(),
        password: password.trim(),
      }),
    });

    const data = await validateResponse(response);

    if (data.success && data.token) {
      await saveSession(data.token, data.user);
    }

    return data;
  } catch (error) {
    if (
      error.message === "Failed to fetch" ||
      error.message.includes("Network")
    ) {
      return { success: false, message: "Cannot connect to server." };
    }
    return { success: false, message: error.message || "Login failed" };
  }
};

export const logout = async (token) => {
  try {
    if (token) {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    }
    await clearSession();
    return { success: true };
  } catch (error) {
    console.error("Logout Error:", error);
    await clearSession();
    return { success: false };
  }
};

export const getProfile = async (token) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/profile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    return validateResponse(response);
  } catch (error) {
    console.error("Get Profile Error:", error);
    throw error;
  }
};

// ─── SESSION MANAGEMENT ───────────────────────────────────────────────────────

export const saveSession = async (token, user) => {
  await AsyncStorage.setItem("auth_token", token);
  await AsyncStorage.setItem("auth_user", JSON.stringify(user));
};

// ✅ FIX: Only remove auth keys, don't wipe all of AsyncStorage
export const clearSession = async () => {
  await AsyncStorage.multiRemove(["auth_token", "auth_user"]);
};

export const getSession = async () => {
  const token = await AsyncStorage.getItem("auth_token");
  const userRaw = await AsyncStorage.getItem("auth_user");
  if (!token || !userRaw) return null;
  return { token, user: JSON.parse(userRaw) };
};

// ✅ FIX: Add timeout + don't kill session on network failure
export const validateToken = async (token) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${BASE_URL}/auth/validate-token`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 401) {
      // Explicitly unauthorized — token is truly invalid
      return false;
    }

    const data = await res.json();
    return data.success === true;
  } catch {
    // Network error or timeout — don't kill the session, assume still valid
    return true;
  }
};

// ─── BACKEND HEALTH ───────────────────────────────────────────────────────────

export const checkBackendConnection = async () => {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    return data.status === "✅ ok";
  } catch (error) {
    return false;
  }
};

// ─── CRIME DASHBOARD ──────────────────────────────────────────────────────────
// NOTE: preset range + granularity logic below is kept IDENTICAL to the web
// app (frontend/src/components/views/CrimeDashboard.jsx) so both surfaces
// always compute the same date windows and chart granularity from a preset.

// PHT = UTC+8. Web computes "today" in PHT so both apps agree on date
// boundaries even if the phone's local timezone differs.
const getPhtToday = () => {
  const now = new Date();
  const phtMs = now.getTime() + 8 * 60 * 60 * 1000;
  return new Date(phtMs);
};

const offsetDate = (days) => {
  const now = new Date();
  const phtMs = now.getTime() + 8 * 60 * 60 * 1000 + days * 86400000;
  return new Date(phtMs).toISOString().slice(0, 10);
};

export const getPresetRange = (key) => {
  const phtToday = getPhtToday();
  const t = phtToday.toISOString().slice(0, 10);

  if (key === "this_month") {
    const from = `${phtToday.getFullYear()}-${String(phtToday.getMonth() + 1).padStart(2, "0")}-01`;
    return { from, to: t };
  }
  if (key === "7d") return { from: offsetDate(-6), to: t };
  if (key === "3m") {
    // 3-month range: start from 2 months ago (1st) → today, same as web
    const from = new Date(phtToday.getFullYear(), phtToday.getMonth() - 2, 1);
    return {
      from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`,
      to: t,
    };
  }
  if (key === "365d") {
    // Snap to 1 year ago, 1st of that month — same as web
    const from = new Date(phtToday.getFullYear() - 1, phtToday.getMonth(), 1);
    return {
      from: `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}-01`,
      to: t,
    };
  }
  return null;
};

export const getGranularity = (preset, dateFrom, dateTo) => {
  if (preset === "this_month") return "daily";
  if (preset === "7d") return "daily";
  if (preset === "3m") return "monthly";
  if (preset === "365d") return "monthly";

  if (!dateFrom || !dateTo) return "monthly";

  const from = new Date(dateFrom + "T00:00:00");
  const to = new Date(dateTo + "T00:00:00");
  const diffDays = Math.round((to - from) / 86400000) + 1;

  if (diffDays <= 31) return "daily";
  return "monthly";
};

export const getCrimeDashboard = async (filters) => {
  try {
    const session = await getSession();
    if (!session?.token) throw new Error("No auth token found");

    const granularity = getGranularity(
      filters.preset,
      filters.dateFrom,
      filters.dateTo,
    );

    const params = new URLSearchParams();
    if (filters.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters.dateTo) params.set("date_to", filters.dateTo);
    if (filters.crimeTypes?.length)
      params.set("crime_types", filters.crimeTypes.join(","));
    if (filters.barangays?.length)
      params.set("barangays", filters.barangays.join(","));
    params.set("granularity", granularity);
    params.set("preset", filters.preset);

    const response = await fetch(
      `${BASE_URL}/crime-dashboard/overview?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = await validateResponse(response);
    return data;
  } catch (error) {
    console.error("getCrimeDashboard Error:", error);
    throw error;
  }
};

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────

export const sendOTP = async (email) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return await response.json();
  } catch (error) {
    console.error("sendOTP Error:", error);
    return {
      success: false,
      message: "Failed to connect to server. Please try again.",
    };
  }
};

export const verifyOTP = async (email, code) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/otp/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    return await response.json();
  } catch (error) {
    console.error("verifyOTP Error:", error);
    return {
      success: false,
      message: "Failed to verify code. Please try again.",
    };
  }
};

export const resendOTP = async (email) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/otp/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return await response.json();
  } catch (error) {
    console.error("resendOTP Error:", error);
    return {
      success: false,
      message: "Failed to resend code. Please try again.",
    };
  }
};

export const resetPassword = async (email, newPassword) => {
  try {
    const response = await fetch(`${BASE_URL}/auth/password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPassword }),
    });
    return await response.json();
  } catch (error) {
    console.error("resetPassword Error:", error);
    return { success: false, message: "An unexpected error occurred." };
  }
};

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

export const getNotifications = async () => {
  try {
    const session = await getSession();
    if (!session?.token) return { success: false, data: [], unread: 0 };
    const res = await fetch(`${BASE_URL}/notifications`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    return await res.json();
  } catch (err) {
    console.error("getNotifications error:", err);
    return { success: false, data: [], unread: 0 };
  }
};

export const markNotificationRead = async (id) => {
  try {
    const session = await getSession();
    if (!session?.token) return;
    await fetch(`${BASE_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.token}` },
    });
  } catch (err) {
    console.error("markNotificationRead error:", err);
  }
};

export const markAllNotificationsRead = async () => {
  try {
    const session = await getSession();
    if (!session?.token) return;
    await fetch(`${BASE_URL}/notifications/read-all`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.token}` },
    });
  } catch (err) {
    console.error("markAllNotificationsRead error:", err);
  }
};
