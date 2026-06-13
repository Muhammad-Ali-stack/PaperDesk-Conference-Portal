import React from "react";
import Layout from "../../components/Layout";
import { useAuth } from "../../context/Auth";

const UserDashboard = () => {
  const [auth] = useAuth();

  return (
    <Layout title="PaperDesk - Dashboard">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 shadow-2xl min-h-[360px] flex items-center">
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop"
              alt="Personal workspace dashboard"
              className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
              loading="lazy"
            />
            <div className="relative z-10 p-8 lg:p-16 max-w-2xl">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-5 backdrop-blur-sm border border-white/20">
                Welcome Back
              </span>
              <h1 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight mb-4">
                Personal <span className="text-teal-300">Workspace</span>
              </h1>
              <p className="text-base lg:text-lg text-white/70 font-medium leading-relaxed">
                {auth?.user?.name ? `Hello, ${auth.user.name}! ` : ""}
                Manage your submissions, assignments, and collaborate with the global research community.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserDashboard;