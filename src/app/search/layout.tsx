import KakaoScripts from '@/components/KakaoScripts';

export default function SearchLayout({
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
