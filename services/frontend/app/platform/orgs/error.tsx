"use client";
import { Button } from "@heroui/react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <div className="text-2xl font-semibold text-danger">Something went wrong</div>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <Button variant="primary" onPress={reset}>
        Try again
      </Button>
    </div>
  );
}
