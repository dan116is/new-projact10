// A tappable field that opens a bottom-sheet-style Modal for picking a string value.
// Styled to match the Input component from ui.js. Fully RTL.
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { colors, spacing, radius } from '../theme';

export default function PickerField({ label, value, options = [], onSelect, placeholder = 'בחר...' }) {
  const [visible, setVisible] = useState(false);

  function handleSelect(option) {
    onSelect(option);
    setVisible(false);
  }

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        style={styles.field}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={[styles.fieldText, !value && { color: colors.textMuted }]}>
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              {label ? <Text style={styles.sheetTitle}>{label}</Text> : null}
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.closeBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item, i) => `${item}-${i}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.option, item === value && styles.optionSelected]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, item === value && { color: colors.primary }]}>
                    {item}
                  </Text>
                  {item === value ? <Text style={styles.checkmark}>✓</Text> : null}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontSize: 13,
    textAlign: 'right',
  },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldText: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'right',
    flex: 1,
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 16,
    marginLeft: spacing.sm,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '60%',
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'android' ? spacing.lg : 0,
  },
  sheetHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  closeBtn: {
    color: colors.textMuted,
    fontSize: 18,
  },
  option: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  optionSelected: {
    backgroundColor: `${colors.primary}18`,
  },
  optionText: {
    color: colors.text,
    fontSize: 16,
    textAlign: 'right',
    flex: 1,
  },
  checkmark: {
    color: colors.primary,
    fontSize: 16,
    marginLeft: spacing.sm,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
});
