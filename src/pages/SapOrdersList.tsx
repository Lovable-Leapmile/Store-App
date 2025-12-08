import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Package, RefreshCw } from "lucide-react";
import SapOrderCard from "@/components/SapOrderCard";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";
import Scaffold from "@/components/Scaffold";

interface SapOrder {
  order_ref: string;
  total_items: number;
  pending_items: number;
  completed_items: number;
  order_status: string;
}

const fetchSapOrders = async (): Promise<SapOrder[]> => {
  const authToken = localStorage.getItem('authToken');

  const response = await fetch(
    "https://robotmanagerv1test.qikpod.com/nanostore/sap_orders/get_unique_sap_orders?order_status=active",
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch orders");
  }

  const data = await response.json();
  return data.records || [];
};

const SapOrdersList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Check if user is authenticated
  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      navigate("/");
    }
  }, [navigate]);

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ["sap-orders"],
    queryFn: fetchSapOrders,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Clear cache when error occurs
  useEffect(() => {
    if (error) {
      queryClient.clear();
    }
  }, [error, queryClient]);

  const handleRefresh = async () => {
    toast({
      title: "Refreshing orders...",
    });
    await refetch();
    toast({
      title: "Orders updated",
      description: "Latest data loaded successfully",
    });
  };

  return (
    <Scaffold
      title="SAP Orders"
      showBack
      onBack={() => navigate("/home")}
      icon={<Package className="text-primary-foreground" size={24} />}
      actions={
        <Button
          onClick={handleRefresh}
          className="h-10 w-10 text-accent hover:bg-accent/10 hover:text-accent-foreground"
        >
          <RefreshCw size={24} />
        </Button>
      }
    >
      <ScrollArea className="flex-1">
        <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-primary" size={32} />
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No SAP orders available</p>
            </div>
          )}

          {orders && orders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No active orders found</p>
            </div>
          )}

          {orders && orders.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground font-medium">
                  {orders.length} active orders
                </p>
              </div>

              {orders.map((order) => (
                <SapOrderCard key={order.order_ref} order={order} />
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </Scaffold>
  );
};

export default SapOrdersList;
