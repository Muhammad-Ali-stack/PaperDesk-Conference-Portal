import React, { Suspense, useRef, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import UserSidebar from "./UserSidebar";

const DashboardLayout = () => {
  const { pathname } = useLocation();
  const mainRef = useRef(null);

  // Scroll the content container (not window) back to top on every
  // route change. Resetting window.scrollTo was causing the sticky
  // sidebar to visually snap because window scroll != content scroll.
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [pathname]);

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <UserSidebar />
      <div ref={mainRef} className="flex-1 min-w-0 overflow-auto">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
};

export default DashboardLayout;