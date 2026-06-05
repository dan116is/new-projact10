import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Badge, Loader, EmptyState, Button } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { colors, spacing } from '../theme';
import { applicationStatusLabel } from '../labels';

export default function MyApplicationsScreen() {
  const { token } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { applications } = await api.myApplications(token);
      setApps(applications);
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

  async function withdraw(id) {
    try {
      await api.withdrawApplication(id, token);
      load();
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
        <EmptyState title="עוד לא הגשת מועמדויות" subtitle="עברו ללשונית 'משרות' כדי להתחיל" />
      }
      renderItem={({ item }) => (
        <Card>
          <View style={styles.row}>
            <Badge
              label={applicationStatusLabel[item.status] || item.status}
              tone={item.status}
            />
            <Text style={styles.trade}>{item.job?.trade}</Text>
          </View>
          <Text style={styles.title}>{item.job?.title}</Text>
          <Text style={styles.company}>{item.contractor?.company || item.contractor?.name}</Text>
          {item.message ? <Text style={styles.message}>"{item.message}"</Text> : null}

          {item.status === 'accepted' && item.contractor && (
            <Text style={styles.accepted}>🎉 התקבלת! הקבלן יצור איתך קשר.</Text>
          )}
          {item.status === 'pending' && (
            <Button
              title="ביטול מועמדות"
              variant="ghost"
              onPress={() => withdraw(item.id)}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  trade: { color: colors.primary, fontWeight: '700' },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: spacing.sm, textAlign: 'right' },
  company: { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },
  message: { color: colors.text, fontStyle: 'italic', marginTop: spacing.sm, textAlign: 'right' },
  accepted: { color: colors.success, marginTop: spacing.sm, fontWeight: '700', textAlign: 'right' },
});
