import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Badge, Loader, EmptyState, Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { apiExtra } from '../apiExtra';
import { colors, spacing } from '../theme';
import { applicationStatusLabel } from '../labels';

export default function JobApplicantsScreen({ route, navigation }) {
  const { jobId } = route.params;
  const { token } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { applications } = await api.jobApplications(jobId, token);
      setApps(applications);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function decide(id, status) {
    try {
      await api.decideApplication(id, status, token);
      load();
    } catch (e) {
      Alert.alert('שגיאה', e.message);
    }
  }

  async function openChat(worker) {
    try {
      const { conversation } = await apiExtra.openConversation(
        { otherUserId: worker.id, jobId },
        token
      );
      navigation.navigate('Chat', { conversationId: conversation.id, title: worker.name });
    } catch (e) {
      Alert.alert('שגיאה', e.message);
    }
  }

  if (loading) return <Loader />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={apps}
      keyExtractor={(a) => a.id}
      contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
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
        <EmptyState title="אין מועמדים עדיין" subtitle="פועלים שיגישו מועמדות יופיעו כאן" />
      }
      renderItem={({ item }) => (
        <Card>
          <View style={styles.row}>
            <Badge
              label={applicationStatusLabel[item.status] || item.status}
              tone={item.status}
            />
            <Text style={styles.name}>{item.worker?.name}</Text>
          </View>
          <View style={styles.tagsRow}>
            {(item.worker?.trades || []).map((t) => (
              <Text key={t} style={styles.tag}>
                {t}
              </Text>
            ))}
          </View>
          <View style={styles.metaRow}>
            {item.worker?.experienceYears != null ? (
              <Text style={styles.meta}>📅 {item.worker.experienceYears} שנות ניסיון</Text>
            ) : null}
            {item.worker?.hourlyRate != null ? (
              <Text style={styles.meta}>💰 ₪{item.worker.hourlyRate}/שעה</Text>
            ) : null}
          </View>
          {item.message ? <Text style={styles.message}>"{item.message}"</Text> : null}

          {item.status === 'accepted' && item.worker?.phone ? (
            <Text style={styles.phone}>📞 {item.worker.phone}</Text>
          ) : null}

          {item.status === 'accepted' && (
            <View style={styles.actions}>
              <Button title="💬 שלח הודעה" onPress={() => openChat(item.worker)} style={{ flex: 1 }} />
              <Button
                title="⭐ השאר ביקורת"
                variant="secondary"
                onPress={() =>
                  navigation.navigate('LeaveReview', {
                    jobId,
                    revieweeId: item.worker.id,
                    name: item.worker.name,
                  })
                }
                style={{ flex: 1 }}
              />
            </View>
          )}

          {item.status === 'pending' && (
            <View style={styles.actions}>
              <Button
                title="אישור"
                onPress={() => decide(item.id, 'accepted')}
                style={{ flex: 1 }}
              />
              <Button
                title="דחייה"
                variant="secondary"
                onPress={() => decide(item.id, 'rejected')}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '700' },
  tagsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    color: colors.primary,
    backgroundColor: '#3B2A0A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 13,
    overflow: 'hidden',
  },
  metaRow: { flexDirection: 'row-reverse', gap: spacing.md, marginTop: spacing.sm },
  meta: { color: colors.textMuted, fontSize: 13 },
  message: { color: colors.text, fontStyle: 'italic', marginTop: spacing.sm, textAlign: 'right' },
  phone: { color: colors.primary, marginTop: spacing.sm, fontWeight: '700', textAlign: 'right' },
  actions: { flexDirection: 'row-reverse', gap: spacing.md, marginTop: spacing.md },
});
