import HotPlaceModalBase from '@/components/HotPlaceModal';
import { HotPlaceConfirmConfig } from '@/components/HotPlaceModal/types';
import { DistanceSummaryItem } from '@/types/location';

interface HotPlaceModalProps {
  station: DistanceSummaryItem;
  confirmConfig?: HotPlaceConfirmConfig;
}

export default function HotPlaceModal({
  station,
  confirmConfig,
}: HotPlaceModalProps) {
  return (
    <HotPlaceModalBase
      x={station.station.end_x}
      y={station.station.end_y}
      confirmConfig={confirmConfig}
    />
  );
}
