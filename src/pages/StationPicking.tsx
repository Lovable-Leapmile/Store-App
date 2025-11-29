import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Station {
  slot_id: string;
  slot_name: string;
  slot_status: string;
  tags: string;
  tray_id: string;
}

interface TrayItem {
  item_id: string;
  item_description: string;
  available_quantity: number;
  tray_id: string;
}

interface Order {
  record_id: string;
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
      toast({
        title: "👋 Hey there!",
        description:
          "I checked your system and found all available stations. Pick a station to see the trays ready for action!",
      });
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

    toast({
      title: "😊 Awesome!",
      description: "I'm preparing your order now… Just a sec while I lock this tray for you.",
    });

    try {
      const authToken = localStorage.getItem("authToken");
      // Create order
      const trayId = station.tray_id;
      const orderResponse = await fetch(
        `https://robotmanagerv1test.qikpod.com/nanostore/orders?tray_id=${trayId}&user_id=${userId}&auto_complete_time=2`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      const orderData = await orderResponse.json();
      setCurrentOrder(orderData);

      toast({
        title: "🔐 Station Locked!",
        description: `Everything is secured and your order (#${orderData.record_id}) is active. Let me load all items available in this tray.`,
      });

      // Fetch tray items
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
      toast({
        title: "✨ Here are all the items",
        description: "Tap on any item you want to pick!",
      });
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
    toast({
      title: "😄 Great choice!",
      description: "How many units do you want to pick from this item? Enter your quantity below.",
    });
  };

  const handleCreateTransaction = async () => {
    if (!selectedItem || !currentOrder || !quantity) return;

    setLoading(true);
    setShowQuantityDialog(false);

    try {
      const authToken = localStorage.getItem("authToken");
      const today = new Date().toISOString().split("T")[0];
      await fetch(
        `https://robotmanagerv1test.qikpod.com/nanostore/transaction?order_id=${currentOrder.record_id}&item_id=${selectedItem.item_id}&transaction_item_quantity=-${quantity}&transaction_type=outbound&transaction_date=${today}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      toast({
        title: "✔ Done!",
        description: "Your pick has been recorded successfully.",
      });

      // Fetch order status
      await fetchOrderStatus();
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

  const fetchOrderStatus = async () => {
    if (!currentOrder) return;

    toast({
      title: "✔ Your pick has been updated!",
      description: "Now let's check the current order status for this tray…",
    });

    try {
      const authToken = localStorage.getItem("authToken");
      const response = await fetch(
        `https://robotmanagerv1test.qikpod.com/nanostore/orders?tray_id=${currentOrder.tray_id}&tray_status=tray_ready_to_use&order_by_field=updated_at&order_by_type=DESC`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );
      const data = await response.json();
      if (data && data.length > 0) {
        setCurrentOrder(data[0]);
      }
      setShowOrderDialog(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch order status",
        variant: "destructive",
      });
    }
  };

  const handleSelectMore = () => {
    setShowOrderDialog(false);
    toast({
      title: "🙌 Great!",
      description: "You can continue picking items from this tray. Just choose another item from the list.",
    });
  };

  const handleRelease = async () => {
    if (!currentOrder || !selectedStation) return;

    setLoading(true);
    setShowOrderDialog(false);

    toast({
      title: "Releasing your order… 🔄",
      description: "Please wait…",
    });

    try {
      const authToken = localStorage.getItem("authToken");
      // Complete order
      await fetch(
        `https://robotmanagerv1test.qikpod.com/nanostore/orders/complete?record_id=${currentOrder.record_id}`,
        {
          method: "PATCH",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      // Unblock slot
      await fetch(`https://robotmanagerv1test.qikpod.com/robotmanager/unblock?slot_id=${selectedStation.slot_id}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      toast({
        title: "🎉 Success!",
        description:
          "Your order is completed and the tray has been released. Station unlocked! Everything is back to normal. 😊",
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
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/home")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Station Picking</h1>
            <p className="text-muted-foreground">Manage your picking workflow</p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {step === "stations" && !loading && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stations.map((station) => (
              <Card
                key={station.slot_id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleStationSelect(station)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{station.slot_name}</CardTitle>
                  <CardDescription>Slot ID: {station.slot_id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant={station.slot_status === "inactive" ? "secondary" : "default"}>
                    {station.slot_status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {step === "items" && !loading && (
          <>
            {currentOrder && (
              <Card className="mb-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5 text-destructive" />
                    Order #{currentOrder.record_id}
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
                  </CardHeader>
                  <CardContent>
                    <Badge>Available: {item.available_quantity}</Badge>
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
                <Button variant="outline" onClick={() => setShowQuantityDialog(false)} className="flex-1">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>📦 Here is your current order</DialogTitle>
              <DialogDescription>What would you like to do next?</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {currentOrder && (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="font-medium">Order ID:</span>
                    <span>{currentOrder.record_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Tray ID:</span>
                    <span>{currentOrder.tray_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Status:</span>
                    <Badge>{currentOrder.status}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Updated:</span>
                    <span className="text-sm">{new Date(currentOrder.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleSelectMore} className="w-full" variant="default">
                  🟦 SELECT
                </Button>
                <Button onClick={handleRelease} className="w-full" variant="destructive">
                  🟥 RELEASE
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default StationPicking;
