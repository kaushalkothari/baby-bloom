import type { Child } from '@/types';

export type ChildAvatarOption = {
  id: string;
  emoji: string;
};

/** Preset avatars for child profiles (stored as `avatarId` / DB `avatar_id`). Labels: i18n `children.avatars.<id>`. */
export const CHILD_AVATAR_OPTIONS: ChildAvatarOption[] = [
  { id: 'baby', emoji: '👶' },
  { id: 'bottle', emoji: '🍼' },
  { id: 'chick', emoji: '🐣' },
  { id: 'panda', emoji: '🐼' },
  { id: 'bear', emoji: '🧸' },
  { id: 'bunny', emoji: '🐰' },
  { id: 'koala', emoji: '🐨' },
  { id: 'duck', emoji: '🐤' },
  { id: 'penguin', emoji: '🐧' },
  { id: 'elephant', emoji: '🐘' },
  { id: 'kitten', emoji: '🐱' },
  { id: 'puppy', emoji: '🐶' },
  { id: 'butterfly', emoji: '🦋' },
  { id: 'ladybug', emoji: '🐞' },
  { id: 'flower', emoji: '🌸' },
  { id: 'sunflower', emoji: '🌻' },
  { id: 'balloon', emoji: '🎈' },
  { id: 'rainbow', emoji: '🌈' },
  { id: 'moon', emoji: '🌙' },
  { id: 'rocket', emoji: '🚀' },
  { id: 'star', emoji: '⭐' },
  { id: 'sun', emoji: '🌞' },
];

export function getChildAvatar(avatarId: string | undefined): ChildAvatarOption | undefined {
  if (!avatarId?.trim()) return undefined;
  return CHILD_AVATAR_OPTIONS.find((a) => a.id === avatarId);
}

/** Default avatar when adding a child; also used as a neutral suggestion before gender is chosen. */
export function suggestedAvatarIdForGender(gender: Child['gender'] | undefined): string {
  switch (gender) {
    case 'male':
      return 'rocket';
    case 'female':
      return 'butterfly';
    case 'other':
      return 'star';
    default:
      return 'panda';
  }
}
