import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
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
  isValidating: boolean;
  canEdit: boolean;
}

const AuthContext = createContext<AuthCtx | null>(null);

const STORAGE_KEY = "chorcha:auth";
const UNAUTH_EVENT = "chorcha:401";

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
  const [isValidating, setIsValidating] = useState(!!loadStored().token);
  const logoutRef = useRef<() => void>(() => undefined);

  const logout = useCallback(() => {
    setState({ token: null, user: null });
  }, []);

  logoutRef.current = logout;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const handler = () => logoutRef.current();
    window.addEventListener(UNAUTH_EVENT, handler);
    return () => window.removeEventListener(UNAUTH_EVENT, handler);
  }, []);

  useEffect(() => {
    const { token } = loadStored();
    if (!token) {
      setIsValidating(false);
      return;
    }
    let cancelled = false;
    setIsValidating(true);
    fetch(getApiUrl("api/auth/me"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          logout();
        } else if (res.ok) {
          const user = await res.json() as AuthUser;
          setState((prev) => prev.token === token ? { token, user } : prev);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsValidating(false); });
    return () => { cancelled = true; };
  }, [logout]);

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

  const canEdit = !!state.user;

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isLoading, isValidating, canEdit }}>
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
  return fetch(getApiUrl(`api${path}`), { ...options, headers }).then((res) => {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent(UNAUTH_EVENT));
    }
    return res;
  });
}
