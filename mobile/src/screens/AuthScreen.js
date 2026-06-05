import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Button, Input } from '../components/ui';
import { isValidIsraeliMobile } from '../data/israel';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

function RolePicker({ value, onChange }) {
  return (
    <View style={styles.roleRow}>
      {[
        { key: 'worker', label: 'פועל 👷' },
        { key: 'contractor', label: 'קבלן 🏗️' },
      ].map((r) => (
        <TouchableOpacity
          key={r.key}
          onPress={() => onChange(r.key)}
          style={[styles.roleBtn, value === r.key && styles.roleBtnActive]}
          activeOpacity={0.8}
        >
          <Text style={[styles.roleText, value === r.key && styles.roleTextActive]}>
            {r.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState('worker');
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError(null);
    if (mode === 'register') {
      if (form.password.length < 6) {
        setError('הסיסמה חייבת להכיל לפחות 6 תווים');
        return;
      }
      if (form.phone.trim() && !isValidIsraeliMobile(form.phone)) {
        setError('מספר טלפון לא תקין (פורמט: 05X-XXXXXXX)');
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password);
      } else {
        await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          role,
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🏗️ פועלים וקבלנים</Text>
        <Text style={styles.subtitle}>
          הפלטפורמה שמחברת בין פועלים מקצועיים לקבלנים — במנוי חודשי.
        </Text>

        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => setMode('login')} style={styles.tab}>
            <Text style={[styles.tabText, mode === 'login' && styles.tabActive]}>התחברות</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('register')} style={styles.tab}>
            <Text style={[styles.tabText, mode === 'register' && styles.tabActive]}>הרשמה</Text>
          </TouchableOpacity>
        </View>

        {mode === 'register' && (
          <>
            <Text style={styles.fieldLabel}>אני נרשם בתור:</Text>
            <RolePicker value={role} onChange={setRole} />
            <Input label="שם מלא" value={form.name} onChangeText={set('name')} placeholder="לדוגמה: יוסי כהן" />
            <Input
              label="טלפון"
              value={form.phone}
              onChangeText={set('phone')}
              placeholder="050-0000000"
              keyboardType="phone-pad"
            />
          </>
        )}

        <Input
          label="אימייל"
          value={form.email}
          onChangeText={set('email')}
          placeholder="you@example.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          label="סיסמה"
          value={form.password}
          onChangeText={set('password')}
          placeholder="••••••••"
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          title={mode === 'login' ? 'התחברות' : 'יצירת חשבון'}
          onPress={submit}
          loading={loading}
          style={{ marginTop: spacing.sm }}
        />

        {mode === 'login' && (
          <Text style={styles.hint}>
            התחברות לדמו: worker@demo.com / contractor@demo.com — סיסמה demo1234
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, paddingTop: spacing.xl * 2 },
  logo: { color: colors.text, fontSize: 30, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    fontSize: 15,
    lineHeight: 22,
  },
  tabs: { flexDirection: 'row', marginBottom: spacing.lg },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  tabText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  tabActive: {
    color: colors.primary,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: 6,
  },
  fieldLabel: { color: colors.textMuted, marginBottom: spacing.sm, textAlign: 'right' },
  roleRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  roleBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  roleBtnActive: { borderColor: colors.primary, backgroundColor: '#3B2A0A' },
  roleText: { color: colors.textMuted, fontSize: 16, fontWeight: '700' },
  roleTextActive: { color: colors.primary },
  error: { color: colors.danger, textAlign: 'center', marginTop: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: spacing.lg },
});
