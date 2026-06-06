import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Loader, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { apiExtra } from '../apiExtra';
import { colors, spacing } from '../theme';

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'אתמול';
  if (days < 7) return `לפני ${days} ימים`;
  return new Date(dateStr).toLocaleDateString('he-IL');
}

const TYPE_ICON = {
  message: '💬',
  review: '⭐',
};

function typeIcon(type) {
  return TYPE_ICON[type] || '📋';
}

export default function NotificationsScreen() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { notifications: data } = await apiExtra.notifications(token);
      setNotifications(data);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const markAndLoad = useCallback(async () => {
    // Mark all as read on every focus, then reload list
    try {
      await apiExtra.markAllNotificationsRead(token);
    } catch (e) {
      // ignore — read-marking is best-effort
    }
    await load();
  }, [token, load]);

  useFocusEffect(
    useCallback(() => {
      markAndLoad();
    }, [markAndLoad])
  );

  if (loading) return <Loader />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={notifications}
      keyExtractor={(n) => n.id}
      contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            markAndLoad();
          }}
          tintColor={colors.primary}
        />
      }
      ListEmptyComponent={
        <EmptyState title="אין התראות" subtitle="נעדכן אותך כאן כשמשהו חדש יקרה" />
      }
      renderItem={({ item }) => (
        <Card style={[styles.card, !item.read && styles.cardUnread]}>
          <View style={styles.row}>
            <View style={styles.rowRight}>
              <Text style={styles.icon}>{typeIcon(item.type)}</Text>
              <View style={styles.textBlock}>
                <Text style={[styles.title, !item.read && styles.titleUnread]}>
                  {item.title}
                </Text>
                {item.body ? (
                  <Text style={styles.body} numberOfLines={2}>
                    {item.body}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.rowLeft}>
              <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
              {!item.read && <View style={styles.dot} />}
            </View>
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  cardUnread: {
    borderColor: colors.primary,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowRight: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    flex: 1,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 22,
    marginTop: 1,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  titleUnread: {
    fontWeight: '700',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 3,
    textAlign: 'right',
    lineHeight: 18,
  },
  rowLeft: {
    alignItems: 'flex-end',
    gap: 4,
    marginRight: spacing.sm,
    minWidth: 50,
  },
  time: {
    color: colors.textMuted,
    fontSize: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
