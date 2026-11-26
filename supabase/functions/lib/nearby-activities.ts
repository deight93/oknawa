// Shared by the nearby picker and the Edge Function's keyword allowlist.
export const activityGroups = {
  sport: [
    { id: 'gym', label: '헬스장', keyword: '헬스장', industry: '헬스클럽' },
    {
      id: 'screen-golf',
      label: '스크린골프',
      keyword: '스크린골프',
      industry: '스크린골프',
    },
    {
      id: 'tennis',
      label: '테니스',
      keyword: '테니스장',
      industry: '테니스장',
    },
    {
      id: 'badminton',
      label: '배드민턴',
      keyword: '배드민턴장',
      industry: '배드민턴장',
    },
  ],
  play: [
    {
      id: 'board-game',
      label: '보드게임',
      keyword: '보드게임카페',
      industry: '보드카페',
    },
    {
      id: 'escape-room',
      label: '방탈출',
      keyword: '방탈출카페',
      industry: '방탈출카페',
    },
    { id: 'bowling', label: '볼링', keyword: '볼링장', industry: '볼링장' },
  ],
} as const;

export type ActivityGroup = keyof typeof activityGroups;
export type Activity = (typeof activityGroups)[ActivityGroup][number];
