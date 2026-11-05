import KakaoScripts from '@/components/KakaoScripts';

export default function MeetingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <KakaoScripts />
      {children}
    </>
  );
}
