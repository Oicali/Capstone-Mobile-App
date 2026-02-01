import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    // Navigate to Login after 3 seconds
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Top Logos */}
      <View style={styles.topLogosContainer}>
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoText}>PNP Logo</Text>
        </View>
        
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoText}>Cavite Logo</Text>
        </View>
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.mainTitle}>PHILIPPINE NATIONAL POLICE</Text>
        <Text style={styles.subtitle}>Bacoor City Station</Text>
      </View>

      {/* Red Line */}
      <View style={styles.redLine} />

      {/* BANTAY Logo */}
      <View style={styles.bantayContainer}>
        <Text style={styles.bantayText}>BANTAY</Text>
      </View>

      {/* Tagline */}
      <Text style={styles.tagline}>
        Empowering Law Enforcement{'\n'}Through Intelligence
      </Text>

      {/* Bottom Line */}
      <View style={styles.bottomLine} />

      {/* Republic Text */}
      <Text style={styles.republicText}>REPUBLIC OF THE PHILIPPINES</Text>

      {/* Loading Dots */}
      <View style={styles.loadingContainer}>
        <View style={styles.loadingDot} />
        <View style={[styles.loadingDot, { opacity: 0.6 }]} />
        <View style={[styles.loadingDot, { opacity: 0.3 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  topLogosContainer: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#E5E7EB',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 15,
  },
  logoText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginTop: 5,
  },
  redLine: {
    width: 100,
    height: 4,
    backgroundColor: '#DC2626',
    marginBottom: 35,
  },
  bantayContainer: {
    borderWidth: 4,
    borderColor: '#1E3A8A',
    paddingHorizontal: 60,
    paddingVertical: 30,
    marginBottom: 30,
  },
  bantayText: {
    fontSize: 60,
    fontWeight: '900',
    color: '#1E3A8A',
  },
  tagline: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 18,
  },
  bottomLine: {
    width: 150,
    height: 1,
    backgroundColor: '#D1D5DB',
    marginBottom: 15,
  },
  republicText: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  loadingContainer: {
    flexDirection: 'row',
    marginTop: 40,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1E3A8A',
    margin: 4,
  },
});