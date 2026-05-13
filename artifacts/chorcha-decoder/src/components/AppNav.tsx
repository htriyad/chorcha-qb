import { Link, useLocation } from "wouter";
import { FileLock2, Library, LogOut, User, Moon, Sun, ShieldCheck, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";

export function AppNav() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [loc, navigate] = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const navLink = (href: string, icon: React.ReactNode, label: string) => {
    const active = href === "/" ? loc === "/" : loc.startsWith(href);
    return (
      <Link href={href}>
        <button
          type="button"
          className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
            active
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
        >
          {icon}
          {label}
          {active && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />
          )}
        </button>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur-xl shadow-sm">
      <div className="max-w-screen-xl mx-auto px-4 h-13 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <Link href="/">
            <div className="flex items-center gap-2 mr-3 select-none cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm tracking-tight hidden sm:block">
                Chorcha<span className="text-primary">·X</span>
              </span>
            </div>
          </Link>

          {navLink("/", <FileLock2 className="w-3.5 h-3.5" />, "Decoder")}
          {navLink("/library", <Library className="w-3.5 h-3.5" />, "Library")}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark"
              ? <Sun className="w-4 h-4 text-amber-400" />
              : <Moon className="w-4 h-4" />}
          </button>

          {user ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/50">
                {user.role === "admin" ? (
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-xs font-medium">{user.username}</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${
                  user.role === "admin"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {user.role}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link href="/login">
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                Sign in
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
