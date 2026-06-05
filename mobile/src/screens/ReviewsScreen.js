// ReviewsScreen — shows all reviews for a given user, with average and count header.
// route.params: { userId, name }
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
import StarRating from '../components/StarRating';
import { useAuth } from '../context/AuthContext';
import { apiExtra } from '../apiExtra';
import { colors, spacing } from '../theme';

function shortDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  });
}

export default function ReviewsScreen({ route }) {
  const { userId, name } = route.params;
  const { token } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiExtra.userReviews(userId, token);
      setReviews(data.reviews || []);
      setAverage(data.average || 0);
      setCount(data.count || 0);
    } catch (e) {
      // ignore — show empty state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) return <Loader />;

  const ListHeader = (
    <View style={styles.header}>
      <Text style={styles.headerName}>{name}</Text>
      <View style={styles.ratingRow}>
        <Text style={styles.averageText}>
          {average > 0 ? average.toFixed(1) : '—'}
        </Text>
        <StarRating rating={average} size={24} />
      </View>
      <Text style={styles.countText}>{count} ביקורות</Text>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      data={reviews}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: spacing.md, flexGrow: 1 }}
      ListHeaderComponent={ListHeader}
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
          title="אין ביקורות עדיין"
          subtitle="ביקורות יופיעו כאן לאחר השלמת עבודות"
        />
      }
      renderItem={({ item }) => (
        <Card>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewerName}>{item.reviewer?.name}</Text>
            <StarRating rating={item.rating} size={16} />
          </View>
          {item.comment ? (
            <Text style={styles.comment}>"{item.comment}"</Text>
          ) : null}
          <Text style={styles.date}>{shortDate(item.createdAt)}</Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  averageText: {
    color: colors.primary,
    fontSize: 36,
    fontWeight: '700',
  },
  countText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.xs,
  },
  reviewHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  reviewerName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  comment: {
    color: colors.text,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'right',
    lineHeight: 20,
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
    textAlign: 'right',
  },
});
