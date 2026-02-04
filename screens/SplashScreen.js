import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';

export default function SplashScreen({ navigation }) {
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
        navigation.replace('Login');
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      {/* Top Logos - Side by Side with overlap like web */}
      <View style={styles.topLogosContainer}>
        <Image 
          source={require('../assets/logo2.png')} 
          style={styles.logoPNP}
          resizeMode="contain"
        />
        <Image 
          source={require('../assets/logo1.png')} 
          style={styles.logoCavite}
          resizeMode="contain"
        />
      </View>

      {/* Title Section */}
      <View style={styles.titleContainer}>
        <Text style={styles.mainTitle}>PHILIPPINE NATIONAL POLICE</Text>
        <Text style={styles.subtitle}>Bacoor City Station</Text>
      </View>

      {/* BANTAY Logo Container - Matching Web Design */}
      <View style={styles.bantayOuterContainer}>
        <Image 
          source={require('../assets/logo3.png')} 
          style={styles.bantayLogoImage}
          resizeMode="contain"
        />
      </View>

      {/* Tagline */}
      <Text style={styles.tagline}>
        Empowering Law Enforcement Through Intelligence
      </Text>

      {/* Bottom Divider */}
      <View style={styles.bottomDivider} />

      {/* Republic Text */}
      <Text style={styles.republicText}>REPUBLIC OF THE PHILIPPINES</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  
  // Top Logos - Side by Side with Overlap
  topLogosContainer: {
    flexDirection: 'row',
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // PNP Logo (Left) - 140x160px with right overlap
  logoPNP: {
    width: 100,
    height: 160,
    marginRight: -10,
  },
  
  // Cavite Logo (Right) - 140x160px
  logoCavite: {
    width: 100,
    height: 160,
  },
  
  // Title Section
  titleContainer: {
    alignItems: 'center',
    marginTop: -29,
    marginBottom: 32,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 30,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  
  // BANTAY Logo Container
  bantayOuterContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 20,
    padding: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 5,
  },
  
  // BANTAY Logo Image
  bantayLogoImage: {
    width: 350,
    height: 150,
  },
  
  // Tagline
  tagline: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 30,
    marginTop: 10,
    lineHeight: 20,
    fontWeight: '500',
    maxWidth: 320,
  },
  
  // Bottom Divider
  bottomDivider: {
    width: 240,
    height: 1,
    backgroundColor: '#CBD5E1',
    marginBottom: 22,
    opacity: 0.5,
  },
  
  // Republic Text
  republicText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 2,
    textAlign: 'center',
  },
});