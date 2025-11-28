import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import SapOrdersList from "./pages/SapOrdersList";
import SapReconcile from "./pages/SapReconcile";
import ScanTray from "./pages/ScanTray";
import OrderDetails from "./pages/OrderDetails";
import TraysForItem from "./pages/TraysForItem";
import ReconcileTrays from "./pages/ReconcileTrays";
import AdhocMode from "./pages/AdhocMode";
import StationPicking from "./pages/StationPicking";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<Home />} />
          <Route path="/sap-orders" element={<SapOrdersList />} />
          <Route path="/sap-reconcile" element={<SapReconcile />} />
          <Route path="/scan-tray" element={<ScanTray />} />
          <Route path="/adhoc-mode" element={<AdhocMode />} />
          <Route path="/station-picking" element={<StationPicking />} />
          <Route path="/order/:orderId" element={<OrderDetails />} />
          <Route path="/trays/:orderId/:itemId" element={<TraysForItem />} />
          <Route path="/trays-for-item/reconcile/:material" element={<ReconcileTrays />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
