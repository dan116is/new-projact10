import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Loader, EmptyState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { apiExtra } from '../apiExtra';
import { colors, spacing, radius } from '../theme';

function shortTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

export default function ChatScreen({ route }) {
  const { conversationId } = route.params;
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { messages: data } = await apiExtra.conversationMessages(conversationId, token);
      // Reverse so newest is at bottom in inverted FlatList
      setMessages(data);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [conversationId, token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const { message } = await apiExtra.sendMessage(conversationId, { body: trimmed }, token);
      setText('');
      // Append optimistically and then reload for consistency
      setMessages((prev) => [...prev, message]);
      // Scroll to bottom after appending
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (e) {
      // silently ignore; user still sees their text in the input
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loader />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        style={styles.messageList}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[
          styles.messageContent,
          messages.length === 0 && { flex: 1 },
        ]}
        onContentSizeChange={() => {
          if (listRef.current && messages.length > 0) {
            listRef.current.scrollToEnd({ animated: false });
          }
        }}
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
          <EmptyState title="אין הודעות עדיין" subtitle="שלח הודעה ראשונה!" />
        }
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.mine ? styles.bubbleRowMine : styles.bubbleRowOther]}>
            <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleOther]}>
              <Text style={[styles.bubbleText, item.mine && styles.bubbleTextMine]}>
                {item.body}
              </Text>
              <Text style={[styles.bubbleTime, item.mine && styles.bubbleTimeMine]}>
                {shortTime(item.createdAt)}
              </Text>
            </View>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#1E293B" />
          ) : (
            <Text style={styles.sendIcon}>▶</Text>
          )}
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="כתוב הודעה..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={1000}
          textAlign="right"
          returnKeyType="default"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  bubbleRow: {
    marginBottom: spacing.sm,
    flexDirection: 'row',
  },
  bubbleRowMine: {
    justifyContent: 'flex-start', // RTL: "start" is the right side
    flexDirection: 'row-reverse',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  bubbleOther: {
    backgroundColor: colors.surfaceAlt,
    borderBottomLeftRadius: radius.sm,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 15,
    textAlign: 'right',
    lineHeight: 22,
  },
  bubbleTextMine: {
    color: '#1E293B',
  },
  bubbleTime: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'left',
  },
  bubbleTimeMine: {
    color: '#78350F',
  },
  inputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: colors.text,
    fontSize: 15,
    maxHeight: 100,
    textAlign: 'right',
  },
  sendBtn: {
    backgroundColor: colors.primary,
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '700',
    // Flip the arrow so it points left (RTL send direction)
    transform: [{ scaleX: -1 }],
  },
});
