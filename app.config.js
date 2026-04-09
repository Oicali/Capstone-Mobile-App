module.exports = {
  expo: {
    name: "B.A.N.T.A.Y.",
    slug: "capstone-mobile-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.anonymous.bantay"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
      package: "com.anonymous.CapstoneMobileApp",
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    updates: {
      enabled: false,
    },
    plugins: [
      "@react-native-community/datetimepicker",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "BANTAY needs your location to track your patrol area in real time.",
          locationWhenInUsePermission:
            "BANTAY needs your location to track your patrol area in real time.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
        },
      ],
      "@rnmapbox/maps",
    ],
    extra: {
      eas: {
        projectId: "7555693d-268a-4ff0-a15b-8fd2809dea26",
      },
    },
  },
};