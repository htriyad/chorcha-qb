import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Home } from "@/pages/Home";
import { FolderView } from "@/pages/FolderView";
import { QuestionSetView } from "@/pages/QuestionSetView";
import { useEffect } from "react";
import { setBaseUrl } from "@workspace/api-client-react";

const _extApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "");
if (_extApiUrl) setBaseUrl(_extApiUrl);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ThemeWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/folders/:id" component={FolderView} />
      <Route path="/sets/:id" component={QuestionSetView} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeWrapper>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="min-h-[100dvh] bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
              <Router />
            </div>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeWrapper>
    </QueryClientProvider>
  );
}

export default App;
