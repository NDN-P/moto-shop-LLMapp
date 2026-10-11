import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import Suppliers from "./pages/Suppliers";
import StockMovements from "./pages/StockMovements";
import SalesTrends from "./pages/SalesTrends";
import LowStock from "./pages/LowStock";
import Storage from "./pages/Storage";
import Assistant from "./pages/Assistant";

function Router() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/stock" component={StockMovements} />
      <Route path="/trends" component={SalesTrends} />
      <Route path="/low-stock" component={LowStock} />
      <Route path="/storage" component={Storage} />
      <Route path="/assistant" component={Assistant} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
