import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { RatingPill } from '@/components/rating';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { KIND_LABELS } from '@/data/seed';
import { timeAgo, useStore } from '@/data/store';
import { REACTIONS, type Post, type Reaction } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';

const COLLAPSED_COMMENTS = 2;

/** A post in any feed or list. Reacting and commenting happen inline; there's no detail screen. */
export function PostCard({ post }: { post: Post }) {
  const { userById } = useStore();
  const author = userById(post.userId);
  const kind = KIND_LABELS[post.kind];
  const where = [post.venue, post.city].filter(Boolean).join(', ');

  return (
    <Card>
      <View style={styles.header}>
        <Avatar user={author} size={40} />
        <View style={styles.flex}>
          <ThemedText type="smallBold">{author.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {kind.emoji} {kind.label} · {post.pending ? 'Sending…' : timeAgo(post.createdAt)}
          </ThemedText>
        </View>
        {post.rating ? <RatingPill value={post.rating} /> : null}
      </View>

      {post.photo ? (
        <Image
          // Signed URLs change on every refresh; the storage path keeps the disk cache stable.
          source={{ uri: post.photo, cacheKey: post.photoKey }}
          style={styles.photo}
          contentFit="cover"
          cachePolicy="disk"
          transition={150}
        />
      ) : null}

      <View style={styles.body}>
        {post.kind === 'beer' && (
          <>
            <ThemedText type="defaultSemiBold" style={styles.headline}>
              {post.beer}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[post.brewery, post.style].filter((v) => v && v !== 'Unknown brewery' && v !== 'Beer').join(' · ')}
            </ThemedText>
          </>
        )}
        {post.kind === 'night' && (
          <>
            <ThemedText type="defaultSemiBold" style={styles.headline}>
              {post.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              🍺 × {post.beersCount ?? 0} over the night
            </ThemedText>
          </>
        )}
        {post.note ? (
          <ThemedText style={post.kind === 'checkin' ? styles.checkinNote : styles.note}>{post.note}</ThemedText>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          📍 {where}
        </ThemedText>
      </View>

      <ReactionBar post={post} />
      <Comments post={post} />
    </Card>
  );
}

function ReactionBar({ post }: { post: Post }) {
  return (
    <View style={styles.reactions}>
      {REACTIONS.map((r) => (
        <ReactionPill key={r} post={post} reaction={r} />
      ))}
    </View>
  );
}

function ReactionPill({ post, reaction }: { post: Post; reaction: Reaction }) {
  const theme = useTheme();
  const { toggleReaction, myId } = useStore();
  const users = post.reactions[reaction] ?? [];
  const mine = users.includes(myId);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Pressable
      onPress={() => {
        scale.set(withSequence(withTiming(1.25, { duration: 70 }), withSpring(1, { damping: 10, stiffness: 300 })));
        toggleReaction(post.id, reaction);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: mine }}
      accessibilityLabel={`React ${reaction}, ${users.length}`}>
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: mine ? theme.accentSoft : 'transparent',
            borderColor: mine ? theme.accent : theme.border,
          },
          style,
        ]}>
        <Text style={styles.pillEmoji}>{reaction}</Text>
        {users.length > 0 ? (
          <ThemedText type="smallBold" style={mine ? { color: theme.accentEnd } : undefined}>
            {users.length}
          </ThemedText>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function Comments({ post }: { post: Post }) {
  const theme = useTheme();
  const { addComment, userById } = useStore();
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');

  const hidden = expanded ? 0 : Math.max(0, post.comments.length - COLLAPSED_COMMENTS);
  const shown = post.comments.slice(hidden);

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addComment(post.id, trimmed);
    setText('');
    setReplying(false);
  };

  if (!shown.length && !replying) {
    return (
      <Pressable onPress={() => setReplying(true)} hitSlop={6} style={styles.replyLink}>
        <ThemedText type="small" themeColor="textSecondary">
          Add a comment…
        </ThemedText>
      </Pressable>
    );
  }

  return (
    <View style={[styles.comments, { borderTopColor: theme.border }]}>
      {hidden > 0 && (
        <Pressable onPress={() => setExpanded(true)} hitSlop={6}>
          <ThemedText type="small" themeColor="textSecondary">
            View all {post.comments.length} comments
          </ThemedText>
        </Pressable>
      )}
      {shown.map((c) => (
        <Animated.View key={c.id} entering={FadeIn.duration(150)} style={styles.comment}>
          <Avatar user={userById(c.userId)} size={22} />
          <ThemedText type="small" style={styles.flex}>
            <ThemedText type="smallBold">{userById(c.userId).name} </ThemedText>
            {c.text}
          </ThemedText>
        </Animated.View>
      ))}

      {replying ? (
        <View style={[styles.replyRow, { backgroundColor: theme.backgroundSelected }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Say something nice…"
            placeholderTextColor={theme.textSecondary}
            autoFocus
            returnKeyType="send"
            onSubmitEditing={send}
            // Tapping away without typing closes the box again.
            onBlur={() => {
              if (!text.trim()) setReplying(false);
            }}
            style={[styles.replyInput, { color: theme.text }]}
          />
          <Pressable onPress={send} hitSlop={8} accessibilityRole="button" accessibilityLabel="Send comment">
            <ThemedText type="smallBold" style={{ color: theme.accentEnd }}>
              Post
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setReplying(true)} hitSlop={6}>
          <ThemedText type="small" themeColor="textSecondary">
            Reply…
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    gap: Spacing.three - Spacing.one,
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: Radius.md,
  },
  body: {
    gap: Spacing.one,
  },
  headline: {
    fontSize: 20,
    lineHeight: 25,
  },
  note: {
    marginTop: Spacing.one,
  },
  checkinNote: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: '600',
  },
  reactions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  pillEmoji: {
    fontSize: 15,
  },
  replyLink: {
    marginTop: -Spacing.one,
  },
  comments: {
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three - Spacing.one,
  },
  comment: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  replyRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
  },
  replyInput: {
    flex: 1,
    paddingVertical: Spacing.two + Spacing.one,
    fontSize: 15,
  },
});
