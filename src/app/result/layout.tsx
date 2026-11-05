import KakaoScripts from '@/components/KakaoScripts';

export default function ResultLayout({
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
