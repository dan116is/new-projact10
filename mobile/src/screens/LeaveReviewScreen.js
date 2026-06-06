// LeaveReviewScreen — lets a user leave a star rating + comment for another user.
// route.params: { jobId, revieweeId, name }
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Button, Input } from '../components/ui';
import StarRating from '../components/StarRating';
import { useAuth } from '../context/AuthContext';
import { apiExtra } from '../apiExtra';
import { colors, spacing } from '../theme';

export default function LeaveReviewScreen({ route, navigation }) {
  const { jobId, revieweeId, name } = route.params;
  const { token } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState('');

  async function handleSubmit() {
    if (rating === 0) {
      setRatingError('אנא בחר דירוג בין 1 ל-5 כוכבים');
      return;
    }
    setRatingError('');
    setSubmitting(true);
    try {
      await apiExtra.createReview({ jobId, revieweeId, rating, comment: comment.trim() }, token);
      Alert.alert('תודה!', 'הביקורת שלך נשמרה בהצלחה', [
        { text: 'אישור', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('שגיאה', e.message || 'אירעה שגיאה. נסה שוב.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>השאר ביקורת</Text>
        <Text style={styles.subheading}>
          כיצד תדרג את העבודה עם{' '}
          <Text style={styles.nameHighlight}>{name}</Text>?
        </Text>

        <View style={styles.starsBlock}>
          <StarRating rating={rating} size={40} onChange={setRating} />
          {ratingError ? (
            <Text style={styles.ratingError}>{ratingError}</Text>
          ) : null}
          <Text style={styles.ratingLabel}>
            {rating === 0
              ? 'גע בכוכב כדי לדרג'
              : rating === 1
              ? 'גרוע מאוד'
              : rating === 2
              ? 'לא מרוצה'
              : rating === 3
              ? 'סביר'
              : rating === 4
              ? 'טוב'
              : 'מצוין!'}
          </Text>
        </View>

        <Input
          label="הערות (אופציונלי)"
          value={comment}
          onChangeText={setComment}
          placeholder="ספר על חוויית העבודה..."
          multiline
          numberOfLines={4}
          style={styles.commentInput}
          textAlignVertical="top"
        />

        <Button
          title="שלח ביקורת"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submitBtn}
        />

        <Button
          title="ביטול"
          variant="ghost"
          onPress={() => navigation.goBack()}
          disabled={submitting}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  kav: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  subheading: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  nameHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
  starsBlock: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ratingError: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  ratingLabel: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  commentInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  submitBtn: {
    marginBottom: spacing.sm,
  },
});
