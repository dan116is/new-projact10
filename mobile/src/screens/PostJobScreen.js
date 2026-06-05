import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, Text } from 'react-native';
import { Button, Input, Card } from '../components/ui';
import PickerField from '../components/PickerField';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';
import { TRADES, CITIES } from '../data/israel';

export default function PostJobScreen({ navigation }) {
  const { token } = useAuth();
  const [form, setForm] = useState({
    title: '',
    trade: '',
    description: '',
    location: '',
    budget: '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.title.trim() || !form.trade.trim()) {
      Alert.alert('חסר מידע', 'יש למלא לפחות כותרת ומקצוע.');
      return;
    }
    setLoading(true);
    try {
      await api.createJob(
        {
          title: form.title.trim(),
          trade: form.trade.trim(),
          description: form.description.trim(),
          location: form.location.trim(),
          budget: form.budget ? Number(form.budget) : null,
        },
        token
      );
      Alert.alert('פורסם! ✅', 'המשרה פורסמה ופועלים יכולים להגיש מועמדות.');
      navigation.goBack();
    } catch (e) {
      if (e.code === 'SUBSCRIPTION_REQUIRED') {
        navigation.replace('Paywall');
      } else {
        Alert.alert('שגיאה', e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.md }}>
      <Card>
        <Text style={styles.heading}>פרטי המשרה</Text>
        <Input label="כותרת" value={form.title} onChangeText={set('title')} placeholder="חשמלאי לפרויקט דירות" />
        <PickerField
          label="מקצוע"
          value={form.trade}
          options={TRADES}
          onSelect={set('trade')}
          placeholder="בחרו מקצוע"
        />
        <Input
          label="תיאור"
          value={form.description}
          onChangeText={set('description')}
          placeholder="פרטו על העבודה, היקף, משך..."
          multiline
          numberOfLines={4}
          style={{ height: 100, textAlignVertical: 'top' }}
        />
        <PickerField
          label="עיר"
          value={form.location}
          options={CITIES}
          onSelect={set('location')}
          placeholder="בחרו עיר"
        />
        <Input
          label="תקציב (₪)"
          value={form.budget}
          onChangeText={set('budget')}
          placeholder="15000"
          keyboardType="numeric"
        />
        <Button title="פרסום המשרה" onPress={submit} loading={loading} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.md, textAlign: 'right' },
});
