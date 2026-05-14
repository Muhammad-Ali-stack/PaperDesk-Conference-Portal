import React, { Suspense } from "react";
import { Outlet } from "react-router-dom";
import UserSidebar from "./UserSidebar";
import { Skeleton } from "./ui/skeleton";

const ContentLoader = () => (
  <div className="flex-1 p-6 space-y-5 max-w-4xl mt-4">
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

const DashboardLayout = () => (
  <div className="flex min-h-[calc(100vh-4rem)]">
    <UserSidebar />
    <div className="flex-1 min-w-0 overflow-auto">
      <Suspense fallback={<ContentLoader />}>
        <Outlet />
      </Suspense>
    </div>
  </div>
);

export default DashboardLayout;
