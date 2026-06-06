import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert } from 'react-native';
import { Button, Card, Input, Badge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { apiExtra } from '../apiExtra';
import { colors, spacing } from '../theme';

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

  // Mock SMS OTP — the server accepts the demo code "1234".
  function verifyPhone() {
    Alert.alert('אימות טלפון', 'נשלח אליך קוד ב-SMS. לצורך הדגמה הקוד הוא 1234.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'אמת',
        onPress: async () => {
          try {
            await apiExtra.verifyPhone('1234', token);
            await refreshUser();
            Alert.alert('אומת ✓', 'המספר אומת והפרופיל שלך מסומן כמאומת.');
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
          <View style={styles.badges}>
            {user?.verified ? <Badge label="✓ מאומת" tone="accepted" /> : null}
            <Badge
              label={
                user?.isSubscribed
                  ? user?.tier === 'pro'
                    ? 'מנוי פרו ⭐'
                    : 'מנוי בסיסי'
                  : 'ללא מנוי'
              }
              tone={user?.isSubscribed ? (user?.tier === 'pro' ? 'pending' : 'accepted') : 'withdrawn'}
            />
          </View>
        </View>
        <Text style={styles.email}>{user?.email}</Text>
        <View style={styles.quickRow}>
          <Button
            title="🔔 התראות"
            variant="secondary"
            onPress={() => navigation.navigate('Notifications')}
            style={{ flex: 1 }}
          />
          <Button
            title="⭐ הביקורות שלי"
            variant="secondary"
            onPress={() => navigation.navigate('Reviews', { userId: user.id, name: user.name })}
            style={{ flex: 1 }}
          />
        </View>
        {!user?.verified && (
          <Button
            title="📱 אמת מספר טלפון"
            variant="ghost"
            onPress={verifyPhone}
            style={{ marginTop: spacing.sm }}
          />
        )}
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
            <Text style={styles.subInfo}>
              {user?.tier === 'pro' ? 'מנוי פרו פעיל ⭐' : 'מנוי בסיסי פעיל'}.
            </Text>
            {user?.tier !== 'pro' ? (
              <Button title="⭐ שדרגו לפרו" onPress={() => navigation.navigate('Paywall')} />
            ) : null}
            <Button
              title="ביטול מנוי"
              variant="ghost"
              onPress={cancelSubscription}
              style={{ marginTop: spacing.sm }}
            />
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
  badges: { flexDirection: 'row-reverse', gap: spacing.sm, alignItems: 'center' },
  quickRow: { flexDirection: 'row-reverse', gap: spacing.md, marginTop: spacing.md },
  role: { color: colors.text, fontSize: 20, fontWeight: '800' },
  email: { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },
  section: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: spacing.md, textAlign: 'right' },
  subInfo: { color: colors.textMuted, marginBottom: spacing.md, textAlign: 'right' },
});
