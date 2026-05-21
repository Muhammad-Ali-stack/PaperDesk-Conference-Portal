import React from "react";
import Layout from "../../components/Layout";

const OrganizerDashboard = () => {
  return (
    <Layout title="PaperDesk - Editor Dashboard">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 shadow-2xl min-h-[360px] flex items-center">
            <img
              src="https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=2069&auto=format&fit=crop"
              alt="Conference Editor planning conference"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
              loading="lazy"
            />
            <div className="relative z-10 p-8 lg:p-16 max-w-2xl">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/50 text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-5 border border-white/20">
               Conference Manager
              </span>
              <h1 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight mb-4">
                Editor <span className="text-teal-300">Portal</span>
              </h1>
              <p className="text-base lg:text-lg text-white/70 font-medium leading-relaxed">
                Orchestrate world-class academic events. Manage registrations, review assignments, and published proceedings with ease.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default OrganizerDashboard;