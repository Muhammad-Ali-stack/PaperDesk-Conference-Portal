import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/Auth";
import { useTheme } from "../context/Theme";
import { toast } from "react-hot-toast";
import { useNavigate, NavLink } from "react-router-dom";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { Sun, Moon, Menu, X, ChevronDown, User, LogOut, LayoutDashboard } from "lucide-react";

const Header = () => {
  const [auth, setAuth, rolesLoaded] = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isOrganizer = rolesLoaded && auth?.roles?.some((r) => r.role === "organizer");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest(".cf-user-area")) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const handleLogout = useCallback(() => {
    setAuth({ ...auth, user: null, token: "" });
    localStorage.removeItem("auth");
    toast.success("Logged out successfully");
    navigate("/login");
    setDropdownOpen(false);
    setMenuOpen(false);
  }, [auth, setAuth, navigate]);

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const linkBase = "relative text-sm font-semibold tracking-wide transition-colors duration-200 group";

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          "bg-teal-600/95 backdrop-blur-2xl",
          "border-b border-white/20",
          scrolled ? "shadow-lg shadow-black/10" : ""
        )}
      >
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">

          {/* Logo + Brand Name — visible on ALL screen sizes */}
          <NavLink to="/" className="flex items-center gap-3 flex-shrink-0 group">
            <img
              src="/logo.png"
              alt="PaperDesk"
              className="h-14 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
            <span className="font-extrabold text-lg text-white tracking-tight">
              Paper<span className="text-teal-200">Desk</span>
            </span>
          </NavLink>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-7">
            {[
              { to: "/", label: "Home", end: true },
              { to: "/learn-more", label: "About" },
              ...(auth?.user && !isOrganizer ? [{ to: "/all-conferences", label: "Conferences" }] : []),
              ...(isOrganizer ? [{ to: "/userdashboard/create-conference", label: "Create Conference" }] : []),
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(linkBase, isActive ? "text-white" : "text-white/80 hover:text-white")
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      className={cn(
                        "absolute -bottom-0.5 left-0 h-0.5 bg-teal-200 rounded-full transition-all duration-300",
                        isActive ? "w-full" : "w-0 group-hover:w-full"
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-white hover:bg-white/10 h-9 w-9"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {auth?.user ? (
              <div className="cf-user-area relative hidden md:block">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white text-sm font-semibold"
                >
                  <div className="w-6 h-6 rounded-full bg-teal-200 text-teal-800 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {auth?.user?.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <span className="max-w-[100px] truncate">{auth?.user?.name}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", dropdownOpen ? "rotate-180" : "")} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border bg-card shadow-xl overflow-hidden animate-fade-in">
                    <div className="px-4 py-3 border-b">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</p>
                      <p className="text-sm font-bold truncate mt-0.5">{auth?.user?.name}</p>
                    </div>
                    <div className="p-1.5">
                      <button
                        onClick={() => { navigate("/userdashboard/user-dashboard"); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-accent transition-colors text-left"
                      >
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                        Control Panel
                      </button>
                      <button
                        onClick={() => { navigate("/userdashboard/user-profile"); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-accent transition-colors text-left"
                      >
                        <User className="h-4 w-4 text-muted-foreground" />
                        Profile
                      </button>
                      <div className="h-px bg-border mx-2 my-1" />
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-left"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/login")}
                  className="text-white hover:bg-white/10 text-xs font-bold uppercase tracking-wider"
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/register")}
                  className="bg-white text-teal-700 hover:bg-teal-50 text-xs font-bold uppercase tracking-wider shadow-md"
                >
                  Get Started
                </Button>
              </div>
            )}

            {/* Mobile Hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 pt-16 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative bg-card border-b shadow-xl p-5 flex flex-col gap-1 animate-fade-in">
            {[
              { to: "/", label: "Home", end: true },
              { to: "/learn-more", label: "About" },
              ...(auth?.user && !isOrganizer ? [{ to: "/all-conferences", label: "Conferences" }] : []),
              ...(isOrganizer ? [{ to: "/userdashboard/create-conference", label: "Create Conference" }] : []),
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-4 py-3 rounded-lg text-sm font-semibold transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-accent"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="h-px bg-border my-2" />
            {auth?.user ? (
              <>
                <button
                  onClick={() => { navigate("/userdashboard/user-dashboard"); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold hover:bg-accent transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" /> Control Panel
                </button>
                <button
                  onClick={() => { navigate("/userdashboard/user-profile"); setMenuOpen(false); }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold hover:bg-accent transition-colors"
                >
                  <User className="h-4 w-4" /> Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" onClick={() => setMenuOpen(false)} className="flex items-center px-4 py-3 rounded-lg text-sm font-semibold hover:bg-accent transition-colors">
                  Sign In
                </NavLink>
                <NavLink to="/register" onClick={() => setMenuOpen(false)} className="flex items-center justify-center px-4 py-3 rounded-lg text-sm font-bold bg-primary text-primary-foreground">
                  Get Started
                </NavLink>
              </>
            )}
          </div>
        </div>
      )}

      <div className="h-16" />
    </>
  );
};

export default Header;