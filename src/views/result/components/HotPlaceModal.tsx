import HotPlaceModalBase from '@/components/HotPlaceModal';
import { DistanceSummaryItem } from '@/types/location';

interface HotPlaceModalProps {
  station: DistanceSummaryItem;
}

export default function HotPlaceModal({ station }: HotPlaceModalProps) {
  return (
    <HotPlaceModalBase x={station.station.end_x} y={station.station.end_y} />
  );
}
