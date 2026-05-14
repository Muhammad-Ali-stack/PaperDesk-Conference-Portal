import React from "react";
import { Link } from "react-router-dom";

const Footer = () => {
  const year = new Date().getFullYear();

  const navLinks = [
    { label: "Home", to: "/" },
    { label: "About", to: "/learn-more" },
    { label: "All Conferences", to: "/all-conferences" },
  ];

  return (
    <footer className="bg-teal-900 dark:bg-teal-950 text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />
      <div className="absolute inset-0 opacity-5 pointer-events-none"
           style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />

      <div className="relative max-w-screen-xl mx-auto px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 group">
              <span className="font-extrabold text-2xl tracking-tight">
                Con<span className="text-teal-300">Forum</span>
              </span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed mt-4 max-w-md">
              The premier platform for academic conference management. Connecting researchers, reviewers, and organizers worldwide.
            </p>
          </div>

          <div className="md:justify-self-end">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-teal-300/80 block mb-4">
              Navigation
            </span>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm text-white/50 hover:text-white transition-all duration-200 hover:translate-x-0.5 inline-block"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/10 text-center">
          <p className="text-xs text-white/30">
            &copy; {year} ConForum &mdash; A Product of the Department of Computer Science &amp; Information Technology, NED University
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
