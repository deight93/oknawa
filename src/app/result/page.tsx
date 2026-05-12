import ResultBody from '@/views/result/ResultBody';

interface ResultPageProps {
  searchParams?: {
    mapId?: string | string[];
  };
}

const toSearchParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default function ResultPage({ searchParams }: ResultPageProps) {
  return <ResultBody queryMapId={toSearchParam(searchParams?.mapId) ?? null} />;
}
