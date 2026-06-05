import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Badge, Loader, EmptyState } from '../components/ui';
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

const ROLE_LABEL = {
  worker: 'פועל',
  contractor: 'קבלן',
};

export default function ConversationsScreen({ navigation }) {
  const { token } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { conversations: data } = await apiExtra.conversations(token);
      setConversations(data);
    } catch (e) {
      // ignore — user sees stale data or empty state
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
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={conversations}
      keyExtractor={(c) => c.id}
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
        <EmptyState title="אין שיחות עדיין" subtitle="צור קשר עם קבלנים או פועלים כדי להתחיל" />
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('Chat', {
              conversationId: item.id,
              title: item.otherUser.name,
            })
          }
        >
          <Card style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.topRight}>
                <Text style={styles.name}>{item.otherUser.name}</Text>
                <Badge
                  label={ROLE_LABEL[item.otherUser.role] || item.otherUser.role}
                  tone="default"
                />
              </View>
              <View style={styles.topLeft}>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
                <Text style={styles.time}>
                  {relativeTime(item.lastMessageAt || item.lastMessage?.createdAt)}
                </Text>
              </View>
            </View>

            <Text
              style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]}
              numberOfLines={1}
            >
              {item.lastMessage ? item.lastMessage.body : 'אין הודעות עדיין'}
            </Text>
          </Card>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
  },
  topRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  topLeft: {
    alignItems: 'flex-end',
    gap: 4,
    marginRight: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  time: {
    color: colors.textMuted,
    fontSize: 12,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '700',
  },
  preview: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  previewUnread: {
    color: colors.text,
    fontWeight: '600',
  },
});
