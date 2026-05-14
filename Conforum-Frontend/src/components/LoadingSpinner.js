import React from "react";
import { Skeleton } from "./ui/skeleton";
import { cn } from "../lib/utils";

const LoadingSpinner = ({ fullPage = false }) => {
  if (fullPage) {
    return (
      <div className="p-6 space-y-5 max-w-4xl mx-auto mt-4">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-2/3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
        <Skeleton className="h-4 w-full mt-4" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
};

export const TableSkeleton = ({ rows = 5, cols = 4 }) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className={cn("grid gap-4")} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} className="h-10 w-full" />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

export const PageSkeleton = () => (
  <div className="p-6 lg:p-10 space-y-6 max-w-5xl mx-auto">
    <div className="space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
    </div>
    <div className="space-y-4">
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  </div>
);

export default LoadingSpinner;
