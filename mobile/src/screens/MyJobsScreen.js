import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Badge, Loader, EmptyState, Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';
import { jobStatusLabel } from '../labels';
import SubscriptionBanner from '../components/SubscriptionBanner';

export default function MyJobsScreen({ navigation }) {
  const { token, user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { jobs } = await api.myJobs(token);
      setJobs(jobs);
    } catch (e) {
      // ignore
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
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 90, flexGrow: 1 }}
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
          <EmptyState
            title="עוד לא פרסמת משרות"
            subtitle="לחצו על + כדי לפרסם את המשרה הראשונה"
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('JobApplicants', { jobId: item.id, title: item.title })}
          >
            <Card>
              <View style={styles.row}>
                <Badge label={jobStatusLabel[item.status] || item.status} tone={item.status} />
                <Text style={styles.trade}>{item.trade}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>👥 {item.applicationsCount} מועמדים · הקש לצפייה</Text>
            </Card>
          </TouchableOpacity>
        )}
      />
      <View style={styles.fabWrap}>
        <Button
          title="+ פרסום משרה חדשה"
          onPress={() =>
            user?.isSubscribed ? navigation.navigate('PostJob') : navigation.navigate('Paywall')
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  trade: { color: colors.primary, fontWeight: '700' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.sm, textAlign: 'right' },
  meta: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'right' },
  fabWrap: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md },
});
