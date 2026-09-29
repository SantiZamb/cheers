import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { GroupForm } from '@/components/group-form';
import { useStore } from '@/data/store';

/** "Edit group" sheet: name, photo and members. */
export default function EditGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useStore();
  const group = state.groups.find((g) => g.id === id);

  // The group went away (left elsewhere, or removed): nothing to edit.
  useEffect(() => {
    if (!group) router.back();
  }, [group]);

  return group ? <GroupForm group={group} /> : null;
}
