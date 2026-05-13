import HotPlaceModalBase from '@/components/HotPlaceModal';
import { HotPlaceConfirmConfig } from '@/components/HotPlaceModal/types';
import { StationInfo } from '@/types/location';

interface HotPlaceModalProps {
  station: StationInfo;
  confirmConfig?: HotPlaceConfirmConfig;
}

export default function HotPlaceModal({
  station,
  confirmConfig,
}: HotPlaceModalProps) {
  return (
    <HotPlaceModalBase
      x={station.end_x}
      y={station.end_y}
      confirmConfig={confirmConfig}
    />
  );
}
