import HotPlaceModalBase from '@/components/HotPlaceModal';
import { StationInfo } from '@/types/location';

interface HotPlaceModalProps {
  station: StationInfo;
}

export default function HotPlaceModal({ station }: HotPlaceModalProps) {
  return <HotPlaceModalBase x={station.end_x} y={station.end_y} />;
}
