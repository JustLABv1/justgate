export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded-md bg-default-200" />
      <div className="h-4 w-80 animate-pulse rounded-md bg-default-100" />
      <div className="h-64 w-full animate-pulse rounded-lg bg-default-100" />
    </div>
  );
}
