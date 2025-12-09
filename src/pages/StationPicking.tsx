import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Lock, Unlock, Package } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { updateOrderBeforeTransaction } from "@/lib/transactionUtils";
import Scaffold from "@/components/Scaffold";

interface Station {
  slot_id: string;
  slot_name: string;
  slot_status: string;
  tags: string;
  tray_id: string;
  comment: string;
}

interface TrayItem {
  item_id: string;
  item_description: string;
  tray_weight: number;
  available_quantity: number;
  tray_id: string;
}

interface Order {
  id: number;
  tray_id: string;
  user_id: number;
  status: string;
  tray_status: string;
  updated_at: string;
}

const StationPicking = () => {
  const navigate = useNavigate();
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [trayItems, setTrayItems] = useState<TrayItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<TrayItem | null>(null);
  const [quantity, setQuantity] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"stations" | "items" | "quantity" | "order-actions">("stations");
  const [showQuantityDialog, setShowQuantityDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);

  const userId = 1; // You can get this from app state if needed

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    setLoading(true);
    try {
      const authToken = localStorage.getItem("authToken");
      const response = await fetch(
        "https://robotmanagerv1test.qikpod.com/robotmanager/slots?tags=station&slot_status=inactive&order_by_field=updated_at&order_by_type=DESC",
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      const data = await response.json();
      setStations(data.records || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch stations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStationSelect = async (station: Station) => {
    setSelectedStation(station);
    setLoading(true);

    try {
      const authToken = localStorage.getItem("authToken");
      // Create order
      const trayId = station.tray_id;
      const orderResponse = await fetch(
        `https://robotmanagerv1test.qikpod.com/nanostore/orders?tray_id=${trayId}&user_id=${userId}&auto_complete_time=2000`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      const orderData = await orderResponse.json();
      const order = orderData.records[0];
      setCurrentOrder(order);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Unblock slot after creating order
      await fetch(`https://robotmanagerv1test.qikpod.com/robotmanager/unblock?slot_id=${station.slot_id}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await fetchTrayItems(trayId);
      setStep("items");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create order or lock station",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTrayItems = async (trayId: string) => {
    try {
      const authToken = localStorage.getItem("authToken");
      const response = await fetch(
        `https://robotmanagerv1test.qikpod.com/nanostore/trays_for_order?tray_id=${trayId}&in_station=true`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      const data = await response.json();
      setTrayItems(data.records || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tray items",
        variant: "destructive",
      });
    }
  };

  const handleItemSelect = (item: TrayItem) => {
    setSelectedItem(item);
    setQuantity("");
    setShowQuantityDialog(true);
  };

  const handleCreateTransaction = async () => {
    if (!selectedItem || !currentOrder || !quantity || !selectedStation) return;

    setLoading(true);
    setShowQuantityDialog(false);

    try {
      const authToken = localStorage.getItem("authToken");

      // Update order with user_id before transaction
      if (authToken) {
        await updateOrderBeforeTransaction(currentOrder.id, userId, authToken);
      }

      const today = new Date().toISOString().split("T")[0];
      const transactionResponse = await fetch(
        `https://robotmanagerv1test.qikpod.com/nanostore/transaction?order_id=${currentOrder.id}&item_id=${selectedItem.item_id}&transaction_item_quantity=-${quantity}&transaction_type=outbound&transaction_date=${today}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      if (transactionResponse.ok) {
        toast({
          title: "✔ Done!",
          description: "Your pick has been recorded successfully.",
        });
      } else {
        toast({
          title: "Failed",
          description: "Transaction failed",
          variant: "destructive",
        });
      }

      // Refresh tray items
      if (currentOrder) {
        await fetchTrayItems(currentOrder.tray_id);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create transaction",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!currentOrder || !selectedStation) return;

    setLoading(true);

    try {
      const authToken = localStorage.getItem("authToken");

      // Unblock slot before releasing
      await fetch(`https://robotmanagerv1test.qikpod.com/robotmanager/unblock?slot_id=${selectedStation.slot_id}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      // Complete order
      await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/orders/complete?record_id=${currentOrder.id}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      toast({
        title: "Success!",
        description: "Order completed and station released.",
      });

      // Reset state
      setSelectedStation(null);
      setCurrentOrder(null);
      setTrayItems([]);
      setStep("stations");
      fetchStations();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to release order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Scaffold
      title="Station Picking"
      showBack
      icon={<Package className="text-primary-foreground" size={24} />}
    >
      <div className="max-w-4xl mx-auto p-4">
        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {step === "stations" && !loading && (
          <>
            {stations.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">No available trays found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {stations.map((station) => (
                  <Card
                    key={station.slot_id}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleStationSelect(station)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{station.slot_name}</CardTitle>
                      <CardDescription>Slot ID : {station.slot_id}</CardDescription>
                      <CardDescription>Tray ID : {station.tray_id}</CardDescription>
                      <CardDescription>Comment : {station.comment || "No comment"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge className={station.slot_status === "inactive" ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : ""}>
                        {station.slot_status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {step === "items" && !loading && (
          <>
            {currentOrder && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-destructive" />
                      Order #{currentOrder.id}
                    </div>
                    <Button onClick={handleRelease} className="h-9 rounded-md px-3 bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      <Unlock className="h-4 w-4 mr-2" />
                      Release
                    </Button>
                  </CardTitle>
                  <CardDescription>Tray: {currentOrder.tray_id}</CardDescription>
                </CardHeader>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {trayItems.map((item) => (
                <Card
                  key={item.item_id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleItemSelect(item)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{item.item_id}</CardTitle>
                    <CardDescription>{item.item_description}</CardDescription>
                    <CardDescription>Tray Weight : {item.tray_weight}</CardDescription>
                    <CardDescription>Item Quantity : {item.available_quantity}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge className="border-transparent bg-primary text-primary-foreground hover:bg-primary/80">Available: {item.available_quantity}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enter Quantity</DialogTitle>
              <DialogDescription>
                How many units of {selectedItem?.item_description} do you want to pick?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  max={selectedItem?.available_quantity}
                />
                <p className="text-sm text-muted-foreground">Available: {selectedItem?.available_quantity}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateTransaction}
                  disabled={!quantity || parseInt(quantity) <= 0}
                  className="flex-1"
                >
                  Confirm Pick
                </Button>
                <Button onClick={() => setShowQuantityDialog(false)} className="flex-1 border border-input bg-background hover:bg-accent hover:text-accent-foreground">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Scaffold>
  );
};

export default StationPicking;
