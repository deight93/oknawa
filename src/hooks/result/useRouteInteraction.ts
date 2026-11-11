'use client';

import { useState } from 'react';
import type { ItineraryItem, Participant } from '@/types/location';
import { getRouteTransfers, isRoutePoint } from '@/utils/routeSteps';

export interface TransferSelection {
  stepIndex: number;
  source: 'map' | 'details';
}

type RouteFocus =
  | { kind: 'overview' }
  | { kind: 'participant'; participantIndex: number }
  | { kind: 'transfer'; participantIndex: number; transfer: TransferSelection };

export default function useRouteInteraction({
  resultKey,
  participants,
  itinerary,
}: {
  resultKey: string;
  participants: Participant[];
  itinerary: (ItineraryItem | null)[];
}) {
  // Compare route identity by value: vote updates/refetches may recreate arrays.
  // Coordinates stay in the current itinerary, never in selection state.
  const scope = JSON.stringify([
    resultKey,
    participants,
    itinerary.map(route => route?.itinerary.steps),
  ]);
  const [state, setState] = useState<{ scope: string; focus: RouteFocus }>({
    scope,
    focus: { kind: 'overview' },
  });
  const focus: RouteFocus =
    state.scope === scope ? state.focus : { kind: 'overview' };
  if (state.scope !== scope) setState({ scope, focus });

  const selectedParticipantIndex =
    focus.kind === 'overview' ? 0 : focus.participantIndex;

  const selectParticipant = (participantIndex: number) => {
    if (!participants[participantIndex]) return;
    setState({ scope, focus: { kind: 'participant', participantIndex } });
  };
  const selectTransfer = (
    stepIndex: number,
    source: TransferSelection['source'] = 'details',
  ) => {
    const transfer = getRouteTransfers(
      itinerary[selectedParticipantIndex]?.itinerary.steps,
    ).find(item => item.stepIndex === stepIndex);
    if (!isRoutePoint(transfer?.transit?.departureStop?.location)) return;
    setState({
      scope,
      focus: {
        kind: 'transfer',
        participantIndex: selectedParticipantIndex,
        transfer: { stepIndex, source },
      },
    });
  };

  return {
    selectedParticipantIndex,
    isRouteFocused: focus.kind !== 'overview',
    selectedTransfer: focus.kind === 'transfer' ? focus.transfer : null,
    selectParticipant,
    selectTransfer,
    showOverview: () => setState({ scope, focus: { kind: 'overview' } }),
  };
}
