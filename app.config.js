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
        NSLocationWhenInUseUsageDescription:
          "BANTAY needs your location to track your patrol area in real time.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "BANTAY needs your location in the background to share with dispatchers while GPS is active.",
        NSLocationAlwaysUsageDescription:
          "BANTAY needs your location in the background to share with dispatchers while GPS is active.",
        UIBackgroundModes: ["location", "fetch", "remote-notification"],
      },
    },
    android: {
  googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./android/app/google-services.json",
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
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "android.permission.VIBRATE",
    "android.permission.POST_NOTIFICATIONS",
  ],
},
    web: {
      favicon: "./assets/favicon.png",
    },
    updates: {
      enabled: false,
    },
    plugins: [
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",

      // ← Fixes the Firebase manifest merger conflict during EAS build
      function withFirebaseManifestFix(config) {
        const { withAndroidManifest } = require("@expo/config-plugins");
        return withAndroidManifest(config, (config) => {
          const manifest = config.modResults;

          // Ensure tools namespace is declared
          if (!manifest.manifest.$["xmlns:tools"]) {
            manifest.manifest.$["xmlns:tools"] =
              "http://schemas.android.com/tools";
          }

          const app = manifest.manifest.application[0];
          if (!app["meta-data"]) app["meta-data"] = [];

          // Remove existing conflicting entries if any
          app["meta-data"] = app["meta-data"].filter(
            (item) =>
              item.$["android:name"] !==
                "com.google.firebase.messaging.default_notification_channel_id" &&
              item.$["android:name"] !==
                "com.google.firebase.messaging.default_notification_color"
          );

          // Add with tools:replace to override Firebase's injected values
          app["meta-data"].push({
            $: {
              "android:name":
                "com.google.firebase.messaging.default_notification_channel_id",
              "android:value": "default",
              "tools:replace": "android:value",
            },
          });
          app["meta-data"].push({
            $: {
              "android:name":
                "com.google.firebase.messaging.default_notification_color",
              "android:resource": "@color/notification_icon_color",
              "tools:replace": "android:resource",
            },
          });

          return config;
        });
      },

      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#0a1628",
          defaultChannel: "default",
        },
      ],
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
          notificationChannelName: "BANTAY Location",
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