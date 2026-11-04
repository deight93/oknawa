import { atomWithStorage } from 'jotai/utils';
import type { MeetingDestination } from '@/types/meetingDestination';
import { createSafeJSONStorage } from '@/utils/browserStorage';

// Only the dedicated direct-entry routes read this draft. Shared rooms always
// read their destination from the room RPC, including when following an invite.
export const meetingDestinationState =
  atomWithStorage<MeetingDestination | null>(
    'meetingDestination',
    null,
    createSafeJSONStorage<MeetingDestination | null>(
      () => window.sessionStorage,
    ),
  );
