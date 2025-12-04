import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Scan, Keyboard, Minus, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { updateOrderBeforeTransaction } from "@/lib/transactionUtils";

interface SapOrder {
  id: number;
  order_ref: string;
  material: string;
  quantity: number;
  quantity_consumed: number;
  tray_id: string;
  item_description: string;
  inbound_date?: string;
  movement_type?: string;
}

interface OrderResponse {
  status: string;
  records: Array<{
    id: number;
    tray_id: string;
    user_id: number;
  }>;
}



const ScanTray = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showInput, setShowInput] = useState(false);
  const [trayId, setTrayId] = useState("");
  const [scannedTrayId, setScannedTrayId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<SapOrder | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [quantityToPick, setQuantityToPick] = useState(1);

  const { data: sapOrders, isLoading, error } = useQuery({
    queryKey: ["sapOrders", scannedTrayId],
    queryFn: async () => {
      if (!scannedTrayId) return null;

      const response = await fetch(
        `https://testhostsushil.leapmile.com/nanostore/sap_orders/get_orders_in_tray?tray_id=${scannedTrayId}`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("No SAP order for this tray");
      }

      const data = await response.json();
      return data.records || [];
    },
    enabled: !!scannedTrayId,
  });

  const handleScanTray = () => {
    const simulatedScan = prompt("Simulate Barcode Scan - Enter Tray ID:");
    if (simulatedScan) {
      setScannedTrayId(simulatedScan);
    }
  };

  const handleManualInput = () => {
    if (trayId.trim()) {
      setScannedTrayId(trayId);
      setShowInput(false);
      setTrayId("");
    }
  };

  const handleOrderClick = async (order: SapOrder) => {
    try {
      const checkResponse = await fetch(
        `https://testhostsushil.leapmile.com/nanostore/orders?tray_id=${order.tray_id}&status=active&user_id=1&order_by_field=updated_at&order_by_type=ASC`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }
      );

      const checkData: OrderResponse = await checkResponse.json();
      let currentOrderId: number;

      if (checkResponse.ok && checkData.records && checkData.records.length > 0) {
        currentOrderId = checkData.records[0].id;
      } else {
        const createResponse = await fetch(
          `https://testhostsushil.leapmile.com/nanostore/orders?tray_id=${order.tray_id}&user_id=1&auto_complete_time=10`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
            body: "",
          }
        );

        if (!createResponse.ok) {
          throw new Error("Failed to create order");
        }

        const createData: OrderResponse = await createResponse.json();
        currentOrderId = createData.records[0].id;
      }

      setOrderId(currentOrderId);
      setSelectedOrder(order);
      setQuantityToPick(1);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process order",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedOrder || !orderId) return;

    try {
      // Update order with user_id before transaction
      await updateOrderBeforeTransaction(orderId, 1, localStorage.getItem("authToken") || "");

      const transactionResponse = await fetch(
        `https://testhostsushil.leapmile.com/nanostore/transaction?order_id=${orderId}&item_id=${selectedOrder.material}&transaction_item_quantity=-${quantityToPick}&transaction_type=outbound&transaction_date=${selectedOrder.inbound_date || new Date().toISOString().split('T')[0]}&sap_order_reference=${selectedOrder.id}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: "",
        }
      );

      if (!transactionResponse.ok) {
        throw new Error("Transaction failed");
      }

      toast({
        title: "Success",
        description: `Picked ${quantityToPick} items from ${selectedOrder.tray_id}`,
      });

      setSelectedOrder(null);
      setOrderId(null);
      setQuantityToPick(1);
      queryClient.invalidateQueries({ queryKey: ["sapOrders", scannedTrayId] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit transaction",
        variant: "destructive",
      });
    }
  };

  const handleRelease = async () => {
    if (!orderId) return;

    try {
      const releaseResponse = await fetch(
        `https://testhostsushil.leapmile.com/nanostore/orders/complete?record_id=${orderId}`,
        {
          method: "PATCH",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: "",
        }
      );

      if (!releaseResponse.ok) {
        throw new Error("Failed to release order");
      }

      toast({
        title: "Order Released",
        description: "Order has been completed",
      });

      setSelectedOrder(null);
      setOrderId(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to release order",
        variant: "destructive",
      });
    }
  };

  const remainingQuantity = selectedOrder
    ? selectedOrder.quantity - selectedOrder.quantity_consumed
    : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b-2 border-border shadow-sm sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button
            onClick={() => navigate("/home")}
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-accent/10"
          >
            <ArrowLeft size={24} />
          </Button>
          <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
            <Scan className="text-accent-foreground" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Scan Tray in Station</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-4">
        {!scannedTrayId ? (
          <div className="max-w-md mx-auto mt-8 space-y-4">
            <Card className="p-6">
              <div className="space-y-4">
                <Button
                  onClick={handleScanTray}
                  className="w-full h-20 text-lg"
                  size="lg"
                >
                  <Scan className="mr-2" size={24} />
                  Scan Tray
                </Button>

                <Button
                  onClick={() => setShowInput(true)}
                  variant="outline"
                  className="w-full h-20 text-lg"
                  size="lg"
                >
                  <Keyboard className="mr-2" size={24} />
                  Enter Tray ID
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          <div className="container max-w-2xl mx-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Tray: {scannedTrayId}</h2>
                <p className="text-sm text-muted-foreground">SAP Orders</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["sapOrders"] });
                  setScannedTrayId(null);
                  setSelectedOrder(null);
                  setOrderId(null);
                }}
              >
                Clear
              </Button>
            </div>

            {isLoading && (
              <Card className="p-6 text-center">
                <p className="text-muted-foreground">Loading orders...</p>
              </Card>
            )}

            {error && (
              <Card className="p-6 text-center">
                <p className="text-destructive">No SAP order for this tray.</p>
              </Card>
            )}

            {sapOrders && sapOrders.length > 0 && (
              <div className="space-y-3">
                {sapOrders.map((order: SapOrder) => (
                  <Card key={order.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">Order #{order.order_ref}</CardTitle>
                        <Badge variant="secondary">ID: {order.id}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Item ID:</span>
                          <p className="font-medium">{order.material}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Description:</span>
                          <p className="font-medium">{order.item_description}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-muted-foreground">Quantity:</span>
                          <p className="font-medium">{order.quantity}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Picked:</span>
                          <p className="font-medium">{order.quantity_consumed}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Remaining:</span>
                          <p className="font-medium text-primary">
                            {order.quantity - order.quantity_consumed}
                          </p>
                        </div>
                      </div>
                      {order.inbound_date && (
                        <div>
                          <span className="text-muted-foreground">Inbound Date:</span>
                          <p className="font-medium">{order.inbound_date}</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => handleOrderClick(order)}
                          className="flex-1"
                        >
                          Pick Item
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Input Dialog */}
      <Dialog open={showInput} onOpenChange={setShowInput}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Tray ID</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter tray ID (e.g., TRAY-1)"
              value={trayId}
              onChange={(e) => setTrayId(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleManualInput()}
            />
            <div className="flex gap-2">
              <Button onClick={handleManualInput} className="flex-1">
                Submit
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowInput(false);
                  setTrayId("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quantity Selection Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Quantity to Pick</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-accent/10 rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Order: {selectedOrder.order_ref}</p>
                <p className="text-sm text-muted-foreground">Item: {selectedOrder.material}</p>
                <p className="text-sm font-medium">
                  Available: {remainingQuantity} items
                </p>
              </div>

              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantityToPick(Math.max(1, quantityToPick - 1))}
                  disabled={quantityToPick <= 1}
                >
                  <Minus size={20} />
                </Button>
                <div className="text-3xl font-bold w-20 text-center">
                  {quantityToPick}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setQuantityToPick(quantityToPick + 1)}
                >
                  <Plus size={20} />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSubmit} className="flex-1">
                  ✅ Submit
                </Button>
                <Button onClick={handleRelease} variant="outline" className="flex-1">
                  🔁 Release
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScanTray;
