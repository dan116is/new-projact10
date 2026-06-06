import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Badge, Loader, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';
import { jobStatusLabel } from '../labels';

export default function JobDetailScreen({ route, navigation }) {
  const { jobId } = route.params;
  const { token, user } = useAuth();
  const [job, setJob] = useState(null);
  const [message, setMessage] = useState('');
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    try {
      const { job } = await api.getJob(jobId, token);
      setJob(job);
    } catch (e) {
      Alert.alert('שגיאה', e.message);
    }
  }, [jobId, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function apply() {
    if (!user?.isSubscribed) {
      navigation.navigate('Paywall');
      return;
    }
    setApplying(true);
    try {
      await api.applyToJob(jobId, { message: message.trim() }, token);
      Alert.alert('נשלח! ✅', 'המועמדות שלך נשלחה לקבלן.');
      setMessage('');
      load();
    } catch (e) {
      if (e.code === 'SUBSCRIPTION_REQUIRED') {
        navigation.navigate('Paywall');
      } else {
        Alert.alert('שגיאה', e.message);
      }
    } finally {
      setApplying(false);
    }
  }

  if (!job) return <Loader />;

  const isWorker = user?.role === 'worker';
  const canApply = isWorker && job.status === 'open';

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <Card>
        <View style={styles.row}>
          <Badge label={jobStatusLabel[job.status] || job.status} tone={job.status} />
          <Text style={styles.trade}>{job.trade}</Text>
        </View>
        <Text style={styles.title}>{job.title}</Text>
        {job.budget != null ? (
          <Text style={styles.budget}>תקציב: ₪{job.budget.toLocaleString()}</Text>
        ) : null}
        {job.location ? <Text style={styles.meta}>📍 {job.location}</Text> : null}
        {job.description ? <Text style={styles.desc}>{job.description}</Text> : null}

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>הקבלן</Text>
        <Text style={styles.company}>{job.contractor?.company || job.contractor?.name}</Text>
        {job.contractor?.phone ? (
          <Text style={styles.phone}>📞 {job.contractor.phone}</Text>
        ) : (
          <Text style={styles.meta}>פרטי הקשר ייחשפו לאחר אישור המועמדות</Text>
        )}
      </Card>

      {canApply && (
        <Card>
          <Text style={styles.sectionTitle}>הגשת מועמדות</Text>
          <Input
            placeholder="הוסיפו הודעה לקבלן (ניסיון, זמינות...)"
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            style={{ height: 100, textAlignVertical: 'top' }}
          />
          <Button
            title={user?.isSubscribed ? 'שליחת מועמדות' : 'הפעילו מנוי כדי להגיש'}
            onPress={apply}
            loading={applying}
          />
        </Card>
      )}

      {isWorker && job.status !== 'open' && (
        <Text style={styles.closed}>משרה זו אינה פתוחה להגשות חדשות.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  trade: { color: colors.primary, fontWeight: '700' },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: spacing.sm, textAlign: 'right' },
  budget: { color: colors.success, fontWeight: '700', marginTop: spacing.sm, textAlign: 'right' },
  meta: { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },
  desc: { color: colors.text, marginTop: spacing.md, lineHeight: 22, textAlign: 'right' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  sectionTitle: { color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: spacing.sm, textAlign: 'right' },
  company: { color: colors.text, fontSize: 16, textAlign: 'right' },
  phone: { color: colors.primary, marginTop: spacing.xs, textAlign: 'right' },
  closed: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
});
