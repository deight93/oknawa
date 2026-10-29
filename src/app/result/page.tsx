import ResultBody from '@/views/result/ResultBody';

interface ResultPageProps {
  searchParams?: Promise<{
    mapId?: string | string[];
  }>;
}

const toSearchParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function ResultPage({ searchParams }: ResultPageProps) {
  const params = await searchParams;
  return <ResultBody queryMapId={toSearchParam(params?.mapId) ?? null} />;
}
