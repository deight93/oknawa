import ResultConfirmBody from '@/views/result-confirm/ResultConfirmBody';

interface ResultConfirmPageProps {
  searchParams?: Promise<{
    sharekey?: string | string[];
  }>;
}

const toSearchParam = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

export default async function ResultConfirmPage({
  searchParams,
}: ResultConfirmPageProps) {
  const params = await searchParams;
  return (
    <ResultConfirmBody
      queryShareKey={toSearchParam(params?.sharekey) ?? null}
    />
  );
}
