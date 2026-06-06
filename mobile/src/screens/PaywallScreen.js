import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { Button, Card, Loader, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing, radius } from '../theme';

export default function PaywallScreen({ navigation }) {
  const { token, user, refreshUser } = useAuth();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [config, setConfig] = useState(null);
  const [selected, setSelected] = useState('pro'); // default to the recommended tier
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.subConfig(token);
        setConfig(cfg);
      } catch {
        // leave config null; subscribe() will surface a clear error
      }
    })();
  }, [token]);

  async function subscribe() {
    setLoading(true);
    try {
      const data = await api.paymentSheet(token, selected);
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

  if (!config) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader />
      </View>
    );
  }

  const plans = config.plans || [];
  const selectedPlan = plans.find((p) => p.id === selected) || plans[0];

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <Text style={styles.title}>בחרו את המסלול שלכם</Text>
      <Text style={styles.subtitle}>ביטול בכל עת. חיוב חודשי מתחדש.</Text>
      {config.trialDays > 0 ? (
        <Text style={styles.trial}>🎁 {config.trialDays} ימי ניסיון חינם</Text>
      ) : null}

      {plans.map((plan) => {
        const active = plan.id === selected;
        return (
          <TouchableOpacity
            key={plan.id}
            activeOpacity={0.9}
            onPress={() => setSelected(plan.id)}
          >
            <Card style={[styles.planCard, active && styles.planCardActive]}>
              <View style={styles.planHead}>
                <View style={styles.planHeadRight}>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.recommended ? <Badge label="מומלץ" tone="accepted" /> : null}
                </View>
                <Text style={styles.planPrice}>{plan.priceLabel}</Text>
              </View>
              {active
                ? plan.perks.map((p) => (
                    <View key={p} style={styles.perkRow}>
                      <Text style={styles.check}>✓</Text>
                      <Text style={styles.perkText}>{p}</Text>
                    </View>
                  ))
                : null}
            </Card>
          </TouchableOpacity>
        );
      })}

      <Button
        title={`הצטרפות — ${selectedPlan?.priceLabel || ''}`}
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
  subtitle: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  trial: { color: colors.primary, textAlign: 'center', marginTop: spacing.sm, fontWeight: '700' },
  planCard: { marginTop: spacing.lg, borderWidth: 2, borderColor: colors.border },
  planCardActive: { borderColor: colors.primary },
  planHead: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  planHeadRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm },
  planName: { color: colors.text, fontSize: 20, fontWeight: '800' },
  planPrice: { color: colors.primary, fontSize: 18, fontWeight: '800' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  perkRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: spacing.sm },
  check: { color: colors.success, fontSize: 18, fontWeight: '800', marginLeft: spacing.sm },
  perkText: { color: colors.text, fontSize: 15, flex: 1, textAlign: 'right' },
  secure: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg, fontSize: 13 },
});
