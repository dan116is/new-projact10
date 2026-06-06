import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Badge, Loader, EmptyState, Button, Input } from '../components/ui';
import PickerField from '../components/PickerField';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';
import { jobStatusLabel } from '../labels';
import { TRADES, CITIES } from '../data/israel';
import SubscriptionBanner from '../components/SubscriptionBanner';

const ALL = 'הכל';

export default function JobsListScreen({ navigation }) {
  const { token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 'recommended' = personalised feed; 'all' = filtered search.
  const [mode, setMode] = useState('recommended');
  const [q, setQ] = useState('');
  const [trade, setTrade] = useState('');
  const [city, setCity] = useState('');

  const load = useCallback(async () => {
    try {
      let result;
      if (mode === 'recommended') {
        result = await api.recommendedJobs(token);
      } else {
        const params = [];
        if (q.trim()) params.push(`q=${encodeURIComponent(q.trim())}`);
        if (trade) params.push(`trade=${encodeURIComponent(trade)}`);
        if (city) params.push(`location=${encodeURIComponent(city)}`);
        const query = params.length ? `?${params.join('&')}` : '';
        result = await api.listJobs(token, query);
      }
      setJobs(result.jobs);
    } catch (e) {
      // keep previous list on transient errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, mode, q, trade, city]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function applyMode(next) {
    setMode(next);
    setLoading(true);
  }

  function clearFilters() {
    setQ('');
    setTrade('');
    setCity('');
    setMode('recommended');
    setLoading(true);
  }

  const header = (
    <View>
      <SubscriptionBanner />
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggle, mode === 'recommended' && styles.toggleActive]}
          onPress={() => applyMode('recommended')}
        >
          <Text style={[styles.toggleText, mode === 'recommended' && styles.toggleTextActive]}>
            ⭐ מומלצות עבורך
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggle, mode === 'all' && styles.toggleActive]}
          onPress={() => applyMode('all')}
        >
          <Text style={[styles.toggleText, mode === 'all' && styles.toggleTextActive]}>
            🔎 חיפוש
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'all' && (
        <Card>
          <Input
            placeholder="חיפוש חופשי (כותרת, מקצוע, עיר)"
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            onSubmitEditing={() => applyMode('all')}
          />
          <PickerField
            label="מקצוע"
            value={trade || ALL}
            options={[ALL, ...TRADES]}
            onSelect={(v) => setTrade(v === ALL ? '' : v)}
            placeholder="כל המקצועות"
          />
          <PickerField
            label="עיר"
            value={city || ALL}
            options={[ALL, ...CITIES]}
            onSelect={(v) => setCity(v === ALL ? '' : v)}
            placeholder="כל הערים"
          />
          <View style={styles.filterActions}>
            <Button title="חיפוש" onPress={() => applyMode('all')} style={{ flex: 1 }} />
            <Button title="ניקוי" variant="secondary" onPress={clearFilters} style={{ flex: 1 }} />
          </View>
        </Card>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.md }}>{header}</View>
        <Loader />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="לא נמצאו משרות"
            subtitle={mode === 'all' ? 'נסו לשנות את הסינון' : 'משכו למטה כדי לרענן'}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('JobDetail', { jobId: item.id })}
          >
            <Card>
              <View style={styles.row}>
                <Badge label={jobStatusLabel[item.status] || item.status} tone={item.status} />
                <Text style={styles.trade}>{item.trade}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.desc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}
              <View style={styles.metaRow}>
                <Text style={styles.meta}>👥 {item.applicationsCount} מועמדים</Text>
                {item.location ? <Text style={styles.meta}>📍 {item.location}</Text> : null}
                {item.budget != null ? (
                  <Text style={styles.budget}>₪{item.budget.toLocaleString()}</Text>
                ) : null}
              </View>
              <Text style={styles.company}>
                {item.contractor?.company || item.contractor?.name || 'קבלן'}
              </Text>
            </Card>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row-reverse', gap: spacing.sm, marginBottom: spacing.md },
  toggle: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  toggleActive: { borderColor: colors.primary, backgroundColor: '#3B2A0A' },
  toggleText: { color: colors.textMuted, fontWeight: '700' },
  toggleTextActive: { color: colors.primary },
  filterActions: { flexDirection: 'row-reverse', gap: spacing.md, marginTop: spacing.sm },
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  trade: { color: colors.primary, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.sm, textAlign: 'right' },
  desc: { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  meta: { color: colors.textMuted, fontSize: 13 },
  budget: { color: colors.success, fontWeight: '700', marginRight: 'auto' },
  company: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, textAlign: 'right' },
});
