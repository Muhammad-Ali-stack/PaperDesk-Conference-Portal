import React from "react";
import Layout from "../../components/Layout";

const ReviewerDashboard = () => {
  return (
    <Layout title="PaperDesk - Reviewer Dashboard">
      <div className="flex-1 p-6 lg:p-10 overflow-auto">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900 via-teal-800 to-teal-700 shadow-2xl min-h-[360px] flex items-center">
            <img
              src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=2070&auto=format&fit=crop"
              alt="Reviewer reading and evaluating academic papers"
              className="absolute inset-0 w-full h-full object-cover opacity-20"
              loading="lazy"
            />
            <div className="relative z-10 p-8 lg:p-16 max-w-2xl">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-teal-500/50 text-white text-[10px] font-bold uppercase tracking-[0.2em] mb-5 border border-white/20">
                Expert Evaluator
              </span>
              <h1 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight mb-4">
                Reviewer <span className="text-teal-300">Space</span>
              </h1>
              <p className="text-base lg:text-lg text-white/70 font-medium leading-relaxed">
                Contribute to the advancement of science. Evaluate assigned manuscripts, provide expert feedback, and shape the future of your field.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ReviewerDashboard;