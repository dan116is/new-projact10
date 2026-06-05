import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { Button, Card, Input, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';
import { SUBSCRIPTION_PRICE } from '../labels';

export default function ProfileScreen({ navigation }) {
  const { user, token, logout, updateProfile, refreshUser } = useAuth();
  const isWorker = user?.role === 'worker';

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [company, setCompany] = useState(user?.profile?.company || '');
  const [trades, setTrades] = useState((user?.profile?.trades || []).join(', '));
  const [hourlyRate, setHourlyRate] = useState(
    user?.profile?.hourlyRate != null ? String(user.profile.hourlyRate) : ''
  );
  const [experienceYears, setExperienceYears] = useState(
    user?.profile?.experienceYears != null ? String(user.profile.experienceYears) : ''
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const profile = isWorker
        ? {
            trades: trades
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean),
            hourlyRate: hourlyRate ? Number(hourlyRate) : null,
            experienceYears: experienceYears ? Number(experienceYears) : null,
          }
        : { company: company.trim() };
      await updateProfile({ name: name.trim(), phone: phone.trim(), profile });
      Alert.alert('נשמר ✅', 'הפרופיל עודכן.');
    } catch (e) {
      Alert.alert('שגיאה', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function cancelSubscription() {
    Alert.alert('ביטול מנוי', 'המנוי יישאר פעיל עד סוף תקופת החיוב. להמשיך?', [
      { text: 'לא', style: 'cancel' },
      {
        text: 'כן, בטל',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.cancelSub(token);
            await refreshUser();
            Alert.alert('בוצע', 'המנוי יבוטל בסוף התקופה.');
          } catch (e) {
            Alert.alert('שגיאה', e.message);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <Card>
        <View style={styles.headerRow}>
          <Text style={styles.role}>{isWorker ? 'פועל 👷' : 'קבלן 🏗️'}</Text>
          <Badge
            label={user?.isSubscribed ? 'מנוי פעיל' : 'ללא מנוי'}
            tone={user?.isSubscribed ? 'accepted' : 'withdrawn'}
          />
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </Card>

      <Card>
        <Text style={styles.section}>פרטים אישיים</Text>
        <Input label="שם" value={name} onChangeText={setName} />
        <Input label="טלפון" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        {isWorker ? (
          <>
            <Input
              label="מקצועות (מופרדים בפסיק)"
              value={trades}
              onChangeText={setTrades}
              placeholder="חשמלאי, גבס"
            />
            <Input
              label="תעריף לשעה (₪)"
              value={hourlyRate}
              onChangeText={setHourlyRate}
              keyboardType="numeric"
            />
            <Input
              label="שנות ניסיון"
              value={experienceYears}
              onChangeText={setExperienceYears}
              keyboardType="numeric"
            />
          </>
        ) : (
          <Input label="שם החברה" value={company} onChangeText={setCompany} />
        )}
        <Button title="שמירה" onPress={save} loading={saving} />
      </Card>

      <Card>
        <Text style={styles.section}>מנוי</Text>
        {user?.isSubscribed ? (
          <>
            <Text style={styles.subInfo}>המנוי שלך פעיל ({SUBSCRIPTION_PRICE}).</Text>
            <Button title="ביטול מנוי" variant="ghost" onPress={cancelSubscription} />
          </>
        ) : (
          <>
            <Text style={styles.subInfo}>הפעילו מנוי כדי לפתוח את כל הפיצ'רים.</Text>
            <Button title="הפעלת מנוי" onPress={() => navigation.navigate('Paywall')} />
          </>
        )}
      </Card>

      <Button title="התנתקות" variant="danger" onPress={logout} style={{ marginTop: spacing.md }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  role: { color: colors.text, fontSize: 20, fontWeight: '800' },
  email: { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.md, textAlign: 'right' },
  subInfo: { color: colors.textMuted, marginBottom: spacing.md, textAlign: 'right' },
});
