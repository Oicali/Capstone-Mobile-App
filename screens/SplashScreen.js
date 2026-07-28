import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

export default function SplashScreen({ navigation, route }) {
  const isLoggedIn = route.params?.isLoggedIn ?? false;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    // Smooth fade-in animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Navigate to Login after 3 seconds with fade-out
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        navigation.replace(isLoggedIn ? "Main" : "Login");
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <Animated.View
      style={[
        styles.animatedWrap,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/*
        NOTE ON FILE PATHS: I'm guessing your mobile "assets" folder has the
        same two images as your web "public/images" folder, just copied over
        with the same names (Bantay-logo.png = the B icon, Long-logo.png =
        the wordmark). If your mobile project actually calls these something
        else (e.g. logo3.png), just change the two require() paths below —
        nothing else needs to change.
      */}

      {/* Background gradient — matches web .branding-side (linear-gradient(135deg, #fafafa 0%, #ffffff 100%)) */}
      <LinearGradient
        colors={["#FAFAFA", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Soft gradient glow behind the icon */}
        <LinearGradient
          colors={["rgba(59, 130, 246, 0.14)", "rgba(59, 130, 246, 0.02)"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.iconGlow}
        >
          <Image
            source={require("../assets/Bantay-logo.png")}
            style={styles.bIcon}
            resizeMode="contain"
          />
        </LinearGradient>

        {/* Wordmark card — matches web .bantay-logo-box
            (linear-gradient(135deg, rgba(59,130,246,0.05), rgba(220,38,38,0.05))) */}
        <LinearGradient
          colors={["rgba(59, 130, 246, 0.06)", "rgba(220, 38, 38, 0.04)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.wordmarkCard}
        >
          <Image
            source={require("../assets/Long-logo.png")}
            style={styles.wordmarkImage}
            resizeMode="contain"
          />
        </LinearGradient>

        {/* Full title — matches web .main-title (this IS the only title, no separate line) */}
        <Text style={styles.mainTitle}>
          Bacoor Anti-Criminality Network for Targeted Actions and Yields
        </Text>

        {/* Tagline — matches web .tagline */}
        <Text style={styles.tagline}>
          Empowering Law Enforcement Through Intelligence
        </Text>

        {/* Divider — matches web .bottom-line (fades out at both edges) */}
        <LinearGradient
          colors={["transparent", "#CBD5E1", "transparent"]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bottomDivider}
        />
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedWrap: {
    flex: 1,
  },

  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },

  // Soft circular gradient glow behind the icon
  iconGlow: {
    width: 156,
    height: 156,
    borderRadius: 78,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  // Bantay-logo.png is a perfect 360x360 square — no distortion at any size
  bIcon: {
    width: 108,
    height: 108,
  },

  // web .bantay-logo-box — real gradient now, plus a thin border. Kept the
  // shadow iOS-only (Android's `elevation` renders a flat gray halo instead
  // of a soft shadow, which was the "ugly" effect from before).
  wordmarkCard: {
    borderRadius: 24,
    paddingVertical: 22,
    paddingHorizontal: 28,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    width: 320,
    ...Platform.select({
      ios: {
        shadowColor: "#1e293b",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 0,
      },
    }),
  },

  // Long-logo.png is 838x285 (real ratio ≈ 2.94:1 — measured from your file).
  // Fixed width + height (not aspectRatio) — aspectRatio-only sizing is what
  // caused the "became bigger" bug earlier.
  wordmarkImage: {
    width: 288,
    height: 98,
  },

  // web .main-title
  mainTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.3,
    lineHeight: 27,
    marginBottom: 14,
    maxWidth: 320,
  },

  // web .tagline
  tagline: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 28,
    maxWidth: 300,
  },

  // web .bottom-line
  bottomDivider: {
    width: 160,
    height: 1,
  },
});
