import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Package, RefreshCw, Tag, Layers, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import Scaffold from "@/components/Scaffold";

interface OrderItem {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
  order_ref: string;
  material: string;
  quantity: number;
  quantity_consumed: number;
  activity: string;
  movement_type: string;
}

const fetchOrderItems = async (orderRef: string): Promise<OrderItem[]> => {
  const response = await fetch(
    `https://staging.leapmile.com/nanostore/sap_orders/?order_ref=${orderRef}&order_by_field=updated_at&order_by_type=DESC`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch order items");
  }

  const data = await response.json();
  return data.records || [];
};

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const OrderDetails = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const { data: items, isLoading, error, refetch } = useQuery({
    queryKey: ["order-items", orderId],
    queryFn: () => fetchOrderItems(orderId || ""),
    enabled: !!orderId,
    refetchInterval: 30000,
  });

  const handleRefresh = async () => {
    toast({
      title: "Refreshing items...",
    });
    await refetch();
    toast({
      title: "Items updated",
      description: "Latest data loaded successfully",
    });
  };

  return (
    <Scaffold
      title={`Order ${orderId}`}
      showBack
      onBack={() => navigate("/sap-orders")}
      icon={<Package className="text-primary-foreground" size={24} />}
      actions={
        <Button
          onClick={handleRefresh}
          className="h-10 w-10 bg-transparent text-accent hover:bg-accent/10 hover:text-accent-foreground"
        >
          <RefreshCw size={24} />
        </Button>
      }
    >
      <ScrollArea className="flex-1">
        <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
          {/* Order Summary Card */}
          {items && items.length > 0 && (
            <Card className="p-5 bg-card border-2 border-border shadow-sm animate-fade-in mb-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Order ID */}
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="text-primary" size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Order ID</p>
                      <p className="text-lg font-bold text-foreground">{orderId}</p>
                    </div>
                  </div>

                  {/* Order Details */}
                  <div className="space-y-3 pl-12">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <Layers className="text-muted-foreground" size={16} />
                        <div>
                          <p className="text-xs text-muted-foreground">Total Items</p>
                          <p className="text-base font-bold text-primary">{items.length}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="text-muted-foreground" size={16} />
                        <div>
                          <p className="text-xs text-muted-foreground">Last Updated</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatTime(items[0].updated_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status Summary */}
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1 px-3 py-1 rounded-md bg-success/10 border border-success/20">
                        <CheckCircle2 size={14} className="text-success" />
                        <span className="text-sm font-semibold text-success">
                          {items.reduce((sum, item) => sum + item.quantity_consumed, 0)} Picked
                        </span>
                      </div>
                      <div className="flex items-center gap-1 px-3 py-1 rounded-md bg-accent/10 border border-accent/20">
                        <Package size={14} className="text-accent" />
                        <span className="text-sm font-semibold text-accent">
                          {items.reduce((sum, item) => sum + (item.quantity - item.quantity_consumed), 0)} Remaining
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-primary" size={32} />
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-destructive font-semibold">Failed to load items</p>
              <Button onClick={handleRefresh} className="mt-4 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                Try Again
              </Button>
            </div>
          )}

          {items && items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No items found for this order</p>
            </div>
          )}

          {items && items.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground font-medium">
                  {items.length} items in order
                </p>
              </div>

              {items.map((item) => {
                const remainingQuantity = item.quantity - item.quantity_consumed;
                return (
                  <Card
                    key={item.id}
                    className="p-5 bg-card hover:shadow-lg transition-all duration-300 border-2 border-border animate-fade-in cursor-pointer active:scale-[0.98]"
                    onClick={() => navigate(`/trays/${orderId}/${item.material}`)}
                  >
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Tag className="text-primary" size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground font-medium">Item ID</p>
                          </div>
                          <p className="text-xl font-bold text-foreground">{item.material}</p>
                        </div>
                      </div>

                      {/* Movement Type and Time */}
                      <div className="grid grid-cols-2 gap-4 pl-15">
                        <div className="flex items-center gap-2">
                          <Package className="text-muted-foreground" size={16} />
                          <div>
                            <p className="text-xs text-muted-foreground">Movement Type</p>
                            <p className="text-sm font-semibold text-foreground">{item.movement_type}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Clock className="text-muted-foreground" size={16} />
                          <div>
                            <p className="text-xs text-muted-foreground">Updated</p>
                            <p className="text-sm font-semibold text-foreground">
                              {formatTime(item.updated_at)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Quantities */}
                      <div className="grid grid-cols-3 gap-3 pl-15">
                        <div className="flex items-center gap-2">
                          <Layers className="text-primary" size={16} />
                          <div>
                            <p className="text-xs text-muted-foreground">Total Qty</p>
                            <p className="text-base font-bold text-primary">{item.quantity}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="text-success" size={16} />
                          <div>
                            <p className="text-xs text-muted-foreground">Picked</p>
                            <p className="text-base font-bold text-success">{item.quantity_consumed}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Package className="text-accent" size={16} />
                          <div>
                            <p className="text-xs text-muted-foreground">Remaining</p>
                            <p className="text-base font-bold text-accent">{remainingQuantity}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </Scaffold>
  );
};

export default OrderDetails;
