import { useState } from "react";
import { useLocation } from "wouter";
import { getApiUrl } from "@/lib/apiUrl";
import { Zap, AlertCircle, Loader2, Lock, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppNav } from "@/components/AppNav";

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const [, setLoc] = useLocation();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (tab === "register") {
        const res = await fetch(getApiUrl("api/auth/register"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const body = await res.json() as { token?: string; user?: { id: number; username: string; role: string }; error?: string };
        if (!res.ok) throw new Error(body.error || "Registration failed");
        // Re-use the token from register response directly via login
        await login(username, password);
      } else {
        await login(username, password);
      }
      setLoc("/library");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <AppNav />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">

          <div className="text-center mb-8">
            <div className="inline-flex w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl items-center justify-center shadow-lg mb-4">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Sign in to access your library and decoder</p>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card shadow-xl overflow-hidden">
            <div className="flex border-b border-border/60 bg-muted/20">
              {(["login", "register"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setError(null); }}
                  className={`flex-1 py-3 text-sm font-semibold transition-all ${
                    tab === t
                      ? "text-primary border-b-2 border-primary bg-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="username"
                    type="text"
                    placeholder="your_username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                    autoComplete="username"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border/60 bg-muted/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border/60 bg-muted/20 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <button
                type="submit"
                disabled={isLoading || !username || !password}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2 mt-2"
              >
                {isLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  : tab === "login" ? "Sign in" : "Create account"}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Chorcha Decoder · For educational use only
          </p>
        </div>
      </div>
    </div>
  );
}
