// Persistent nudge shown to non-subscribers. Tapping opens the paywall.
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../theme';

export default function SubscriptionBanner() {
  const { user } = useAuth();
  const navigation = useNavigation();
  if (user?.isSubscribed) return null;
  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.85}
      onPress={() => navigation.navigate('Paywall')}
    >
      <Text style={styles.text}>🔓 הפעילו מנוי כדי להגיש מועמדות ולפרסם משרות</Text>
      <Text style={styles.cta}>שדרגו ›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#3B2A0A',
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: { color: colors.text, flex: 1, textAlign: 'right', fontWeight: '600' },
  cta: { color: colors.primary, fontWeight: '800', marginRight: spacing.sm },
});
