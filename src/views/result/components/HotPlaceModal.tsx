import HotPlaceModalBase from '@/components/HotPlaceModal';
import {
  HotPlaceConfirmConfig,
  HotPlaceVoteConfig,
} from '@/components/HotPlaceModal/types';
import { DistanceSummaryItem } from '@/types/location';

interface HotPlaceModalProps {
  station: DistanceSummaryItem;
  confirmConfig?: HotPlaceConfirmConfig;
  voteConfig?: HotPlaceVoteConfig;
}

export default function HotPlaceModal({
  station,
  confirmConfig,
  voteConfig,
}: HotPlaceModalProps) {
  return (
    <HotPlaceModalBase
      x={station.station.end_x}
      y={station.station.end_y}
      confirmConfig={confirmConfig}
      voteConfig={voteConfig}
    />
  );
}
