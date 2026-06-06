import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, Badge, Loader, EmptyState, Button, Input } from '../components/ui';
import PickerField from '../components/PickerField';
import StarRating from '../components/StarRating';
import { useAuth } from '../context/AuthContext';
import { apiExtra } from '../apiExtra';
import { colors, spacing } from '../theme';
import { TRADES, CITIES } from '../data/israel';

// Prepend a "show all" entry so the user can clear a filter
const TRADE_OPTIONS = ['הכל', ...TRADES];
const CITY_OPTIONS = ['הכל', ...CITIES];

export default function WorkersScreen({ navigation }) {
  const { token } = useAuth();

  const [q, setQ] = useState('');
  const [trade, setTrade] = useState('');
  const [city, setCity] = useState('');
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);

  // Map display value → API value ('הכל' → '')
  function resolveFilter(val) {
    return val === 'הכל' ? '' : val;
  }

  const load = useCallback(
    async (overrides = {}) => {
      try {
        const filters = {
          trade: resolveFilter(overrides.trade !== undefined ? overrides.trade : trade),
          city: resolveFilter(overrides.city !== undefined ? overrides.city : city),
          q: overrides.q !== undefined ? overrides.q : q,
        };
        const { workers: list } = await apiExtra.searchWorkers(filters, token);
        setWorkers(list);
      } catch (e) {
        Alert.alert('שגיאה', e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setSearching(false);
      }
    },
    [token, trade, city, q]
  );

  // Load all workers on first focus (no filters)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load({ trade: '', city: '', q: '' });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])
  );

  function handleSearch() {
    setSearching(true);
    load();
  }

  function handleRefresh() {
    setRefreshing(true);
    load();
  }

  async function openChat(worker) {
    try {
      const { conversation } = await apiExtra.openConversation(
        { otherUserId: worker.id },
        token
      );
      navigation.navigate('Chat', { conversationId: conversation.id, title: worker.name });
    } catch (e) {
      Alert.alert('שגיאה', e.message);
    }
  }

  function openReviews(worker) {
    try {
      navigation.navigate('Reviews', { userId: worker.id, name: worker.name });
    } catch (e) {
      Alert.alert('שגיאה', e.message);
    }
  }

  function renderWorker({ item }) {
    const profile = item.profile || {};
    const ratingData = item.rating || {};
    const avg = ratingData.average ?? null;
    const count = ratingData.count ?? 0;
    const hasRating = count > 0;

    return (
      <Card style={item.promoted && { borderColor: colors.primary }}>
        {/* Name + verified/promoted badges */}
        <View style={styles.row}>
          <View style={{ flexDirection: 'row-reverse', gap: spacing.sm, alignItems: 'center' }}>
            {item.promoted ? <Badge label="⭐ פרו" tone="pending" /> : null}
            {item.verified ? <Badge label="✓ מאומת" tone="accepted" /> : null}
          </View>
          <Text style={styles.name}>{item.name}</Text>
        </View>

        {/* Trade tags */}
        {(profile.trades || []).length > 0 ? (
          <View style={styles.tagsRow}>
            {profile.trades.map((t) => (
              <Text key={t} style={styles.tag}>
                {t}
              </Text>
            ))}
          </View>
        ) : null}

        {/* Meta: city, rate, experience */}
        <View style={styles.metaRow}>
          {profile.city ? (
            <Text style={styles.meta}>📍 {profile.city}</Text>
          ) : null}
          {profile.hourlyRate != null ? (
            <Text style={styles.meta}>💰 ₪{profile.hourlyRate}/שעה</Text>
          ) : null}
          {profile.experienceYears != null ? (
            <Text style={styles.meta}>📅 {profile.experienceYears} שנות ניסיון</Text>
          ) : null}
        </View>

        {/* Rating */}
        <View style={styles.ratingRow}>
          {hasRating ? (
            <>
              <Text style={styles.ratingCount}>({count})</Text>
              <StarRating rating={avg} size={16} />
            </>
          ) : (
            <Text style={styles.noRating}>אין דירוגים עדיין</Text>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Button
            title="💬 פנייה"
            variant="ghost"
            onPress={() => openChat(item)}
            style={styles.actionBtn}
          />
          <Button
            title="⭐ ביקורות"
            variant="secondary"
            onPress={() => openReviews(item)}
            style={styles.actionBtn}
          />
        </View>
      </Card>
    );
  }

  if (loading) return <Loader />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={workers}
      keyExtractor={(w) => String(w.id)}
      contentContainerStyle={{ flexGrow: 1 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.filterArea}>
          <Input
            placeholder="חיפוש לפי שם / מקצוע / עיר"
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            style={{ marginBottom: 0 }}
          />
          <PickerField
            label="מקצוע"
            value={trade || 'הכל'}
            options={TRADE_OPTIONS}
            onSelect={(v) => setTrade(v === 'הכל' ? '' : v)}
            placeholder="הכל"
          />
          <PickerField
            label="עיר"
            value={city || 'הכל'}
            options={CITY_OPTIONS}
            onSelect={(v) => setCity(v === 'הכל' ? '' : v)}
            placeholder="הכל"
          />
          <Button
            title="חיפוש"
            onPress={handleSearch}
            loading={searching}
          />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="לא נמצאו פועלים"
          subtitle="נסו לשנות את הסינון"
        />
      }
      renderItem={renderWorker}
    />
  );
}

const styles = StyleSheet.create({
  filterArea: {
    padding: spacing.md,
    backgroundColor: colors.bg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tag: {
    color: colors.primary,
    backgroundColor: '#3B2A0A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 13,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
  },
  ratingRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  ratingCount: {
    color: colors.textMuted,
    fontSize: 13,
    marginRight: spacing.xs,
  },
  noRating: {
    color: colors.textMuted,
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
});
