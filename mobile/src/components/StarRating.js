// Reusable star-rating component.
// When `onChange` is provided it becomes an interactive selector; otherwise read-only.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function StarRating({ rating = 0, size = 18, onChange }) {
  const stars = [1, 2, 3, 4, 5];

  if (onChange) {
    return (
      <View style={styles.row}>
        {stars.map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => onChange(star)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text
              style={[
                styles.star,
                { fontSize: size, color: star <= rating ? colors.primary : colors.textMuted },
              ]}
            >
              ★
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      {stars.map((star) => (
        <Text
          key={star}
          style={[
            styles.star,
            { fontSize: size, color: star <= Math.round(rating) ? colors.primary : colors.textMuted },
          ]}
        >
          ★
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  star: {
    marginHorizontal: 1,
  },
});
