import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getApiUrl } from "@/lib/apiUrl";

export interface AuthUser {
  userId: number;
  username: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

interface AuthCtx extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  canEdit: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

const STORAGE_KEY = "chorcha:auth";

function loadStored(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    return JSON.parse(raw) as AuthState;
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadStored);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(getApiUrl("api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Login failed");
      }
      const data = await res.json() as { token: string; user: AuthUser };
      setState({ token: data.token, user: data.user });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setState({ token: null, user: null });
  }, []);

  const canEdit = !!state.user;

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isLoading, canEdit }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function authFetch(token: string | null, path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers as Record<string, string> | undefined);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(getApiUrl(`api${path}`), { ...options, headers });
}
