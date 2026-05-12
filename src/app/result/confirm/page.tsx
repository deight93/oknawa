import ResultConfirmBody from '@/views/result-confirm/ResultConfirmBody';

interface ResultConfirmPageProps {
  searchParams?: {
    sharekey?: string | string[];
  };
}

const toSearchParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default function ResultConfirmPage({
  searchParams,
}: ResultConfirmPageProps) {
  return (
    <ResultConfirmBody
      queryShareKey={toSearchParam(searchParams?.sharekey) ?? null}
    />
  );
}
