import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Badge, Loader, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';
import { jobStatusLabel } from '../labels';
import SubscriptionBanner from '../components/SubscriptionBanner';

export default function JobsListScreen({ navigation }) {
  const { token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { jobs } = await api.listJobs(token);
      setJobs(jobs);
    } catch (e) {
      // keep previous list on transient errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <Loader />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}
        ListHeaderComponent={<SubscriptionBanner />}
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
          <EmptyState title="אין משרות פתוחות כרגע" subtitle="משוך למטה כדי לרענן" />
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
