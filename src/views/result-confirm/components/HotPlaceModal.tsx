import HotPlaceModalBase from '@/components/HotPlaceModal';
import {
  HotPlaceConfirmConfig,
  HotPlaceVoteConfig,
} from '@/components/HotPlaceModal/types';
import { StationInfo } from '@/types/location';

interface HotPlaceModalProps {
  station: StationInfo;
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
      x={station.end_x}
      y={station.end_y}
      confirmConfig={confirmConfig}
      voteConfig={voteConfig}
    />
  );
}
