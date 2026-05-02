module.exports = {
  expo: {
    name: "BANTAY",
    slug: "BANTAY",
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
      bundleIdentifier: "com.anonymous.bantay",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // Required for iOS background GPS (like Waze)
        NSLocationWhenInUseUsageDescription:
          "BANTAY needs your location to track your patrol area in real time.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "BANTAY needs your location in the background to share with dispatchers while GPS is active.",
        NSLocationAlwaysUsageDescription:
          "BANTAY needs your location in the background to share with dispatchers while GPS is active.",
        UIBackgroundModes: ["location"],
      },
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
          locationAlwaysPermission:
            "BANTAY needs your location in the background to share with dispatchers while GPS is active.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          notificationChannelName: "BANTAY Location", // ← top-level, not nested under android:{}
        },
      ],
      [
        "@rnmapbox/maps",
        {
          RNMapboxMapsDownloadToken: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN,
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "530d6325-6acc-4b87-b517-85fa25600c86",
      },
    },
  },
};
