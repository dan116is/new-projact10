import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { Button, Card } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';
import { SUBSCRIPTION_PRICE } from '../labels';

const PERKS = {
  worker: [
    'גישה לכל המשרות הפתוחות',
    'הגשת מועמדות ללא הגבלה',
    'פרופיל מקצועי שקבלנים רואים',
    'קבלת פרטי קשר של הקבלן לאחר אישור',
  ],
  contractor: [
    'פרסום משרות ללא הגבלה',
    'צפייה בכל המועמדים',
    'אישור פועלים וקבלת פרטי הקשר שלהם',
    'ניהול מלא של תהליך הגיוס',
  ],
};

export default function PaywallScreen({ navigation }) {
  const { token, user, refreshUser } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const perks = PERKS[user?.role] || PERKS.worker;

  async function subscribe() {
    setLoading(true);
    try {
      const data = await api.paymentSheet(token);
      if (!data.paymentIntentClientSecret) {
        throw new Error('השרת לא הגדיר את Stripe. ראה README להגדרת מפתחות.');
      }

      const init = await initPaymentSheet({
        merchantDisplayName: 'פועלים וקבלנים',
        customerId: data.customerId,
        customerEphemeralKeySecret: data.ephemeralKey,
        paymentIntentClientSecret: data.paymentIntentClientSecret,
        allowsDelayedPaymentMethods: false,
        defaultBillingDetails: { name: user?.name },
      });
      if (init.error) throw new Error(init.error.message);

      const { error } = await presentPaymentSheet();
      if (error) {
        if (error.code !== 'Canceled') Alert.alert('התשלום נכשל', error.message);
        return;
      }

      // Payment succeeded — confirm with the server (webhook may lag a moment).
      await api.refreshSub(token);
      const updated = await refreshUser();
      if (updated?.isSubscribed) {
        Alert.alert('ברוך הבא! 🎉', 'המנוי שלך פעיל.');
        navigation.goBack();
      } else {
        Alert.alert('כמעט שם', 'התשלום התקבל. ייתכן עיכוב קצר עד הפעלת המנוי.');
      }
    } catch (e) {
      Alert.alert('שגיאה', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>שדרגו למנוי פרימיום</Text>
      <Text style={styles.price}>{SUBSCRIPTION_PRICE}</Text>
      <Text style={styles.subtitle}>ביטול בכל עת. חיוב חודשי מתחדש.</Text>

      <Card style={{ marginTop: spacing.lg }}>
        {perks.map((p) => (
          <View key={p} style={styles.perkRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.perkText}>{p}</Text>
          </View>
        ))}
      </Card>

      <Button
        title="הצטרפות עכשיו"
        onPress={subscribe}
        loading={loading}
        style={{ marginTop: spacing.lg }}
      />
      <Button
        title="אולי מאוחר יותר"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: spacing.sm }}
      />
      <Text style={styles.secure}>🔒 התשלום מאובטח ומעובד על ידי Stripe</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', textAlign: 'center' },
  price: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  subtitle: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  perkRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: spacing.md },
  check: { color: colors.success, fontSize: 18, fontWeight: '800', marginLeft: spacing.sm },
  perkText: { color: colors.text, fontSize: 16, flex: 1, textAlign: 'right' },
  secure: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, fontSize: 13 },
});
