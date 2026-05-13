export type MeetingPurpose =
  | 'meal'
  | 'cafe'
  | 'drink'
  | 'study'
  | 'date'
  | 'meeting';

export const MEETING_PURPOSE_OPTIONS: {
  label: string;
  value: MeetingPurpose;
}[] = [
  { label: '밥', value: 'meal' },
  { label: '카페', value: 'cafe' },
  { label: '술', value: 'drink' },
  { label: '공부', value: 'study' },
  { label: '데이트', value: 'date' },
  { label: '회의', value: 'meeting' },
];
