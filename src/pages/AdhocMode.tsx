import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Search, Package, Minus, Plus, Scan } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";

interface TrayItem {
  id: number;
  tray_id: string;
  item_id: string;
  item_description: string;
  available_quantity: number;
  inbound_date: string;
  tray_status: string;
}

interface Order {
  id: number;
  tray_id: string;
  user_id: number;
  station_id: string;
  station_friendly_name: string;
}

const API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2wiOiJhZG1pbiIsImV4cCI6MTkwMDY2MDExOX0.m9Rrmvbo22sJpWgTVynJLDIXFxOfym48F-kGy-wSKqQ";
const BASE_URL = "https://robotmanagerv1test.qikpod.com";

const AdhocMode = () => {
  const navigate = useNavigate();
  const [trayId, setTrayId] = useState("");
  const [mode, setMode] = useState<"storage" | "station">("storage");
  const [trayItems, setTrayItems] = useState<TrayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrayItem | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [transactionItemId, setTransactionItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showPutawayDialog, setShowPutawayDialog] = useState(false);

  // Periodic API calls every 3 seconds
  useEffect(() => {
    if (!trayId.trim()) return;

    const interval = setInterval(() => {
      fetchTrayItems();
    }, 3000);

    return () => clearInterval(interval);
  }, [trayId, mode]);

  const fetchTrayItems = async () => {
    if (!trayId.trim()) return;

    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/trays_for_order?in_station=${mode === "station"}&tray_id=${trayId}&num_records=10&offset=0`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${API_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        // Clear old cached states on API failure
        setTrayItems([]);
        throw new Error("Failed to fetch tray items");
      }

      const data = await response.json();
      // Only show new API response
      setTrayItems(data.records || []);
    } catch (error) {
      // Clear cached data on error
      setTrayItems([]);
    }
  };

  const handleSearch = async () => {
    if (!trayId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a tray ID",
        variant: "destructive",
      });
      return;
    }

    // Clear old cached states before new search
    setTrayItems([]);
    setLoading(true);
    
    try {
      await fetchTrayItems();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tray items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestTray = async () => {
    if (!trayId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a tray ID",
        variant: "destructive",
      });
      return;
    }

    const userId = localStorage.getItem("userId") || "1";
    setLoading(true);

    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/orders?tray_id=${trayId}&user_id=${userId}&auto_complete_time=2`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${API_TOKEN}`,
          },
          body: "",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to request tray");
      }

      toast({
        title: "Success",
        description: `Tray ${trayId} requested successfully`,
      });

      // Fetch updated tray items
      await fetchTrayItems();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request tray",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: TrayItem) => {
    const userId = localStorage.getItem("userId") || "1";

    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/orders?tray_id=${item.tray_id}&tray_status=tray_ready_to_use&status=active&user_id=${userId}&order_by_field=updated_at&order_by_type=DESC`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${API_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("No active order found");
      }

      const data = await response.json();
      if (data.records && data.records.length > 0) {
        const order: Order = data.records[0];
        setOrderId(order.id);
        setSelectedItem(item);
        setTransactionItemId(item.item_id);
        setShowPutawayDialog(true);
      } else {
        toast({
          title: "No Active Order",
          description: "No active order found for this tray",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check order status",
        variant: "destructive",
      });
    }
  };

  const handleSubmitTransaction = async () => {
    if (!orderId || !transactionItemId) {
      toast({
        title: "Error",
        description: "Missing required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/transaction?order_id=${orderId}&item_id=${transactionItemId}&transaction_item_quantity=${quantity}&transaction_type=inbound&transaction_date=${transactionDate}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${API_TOKEN}`,
          },
          body: "",
        }
      );

      if (!response.ok) {
        throw new Error("Transaction failed");
      }

      toast({
        title: "Success",
        description: `Putaway completed: ${quantity} units of ${transactionItemId}`,
      });

      setShowPutawayDialog(false);
      setSelectedItem(null);
      setOrderId(null);
      setTransactionItemId("");
      setQuantity(1);
      
      // Refresh the items
      await fetchTrayItems();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete transaction",
        variant: "destructive",
      });
    }
  };

  const handleScanItemId = () => {
    const scannedId = prompt("Simulate Barcode Scan - Enter Item ID:");
    if (scannedId) {
      setTransactionItemId(scannedId);
    }
  };

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
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Package className="text-primary-foreground" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Adhoc Mode</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-4 bg-gradient-to-b from-background to-accent/5">
        <div className="container max-w-4xl mx-auto space-y-6">
          {/* Mode Selection Section */}
          <Card className="border-2 shadow-lg">
            <CardHeader className="border-b bg-card">
              <CardTitle className="flex items-center gap-2">
                <Package className="text-primary" size={24} />
                Tray Search
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Mode</Label>
                <Tabs value={mode} onValueChange={(v) => setMode(v as "storage" | "station")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="storage">In Storage</TabsTrigger>
                    <TabsTrigger value="station">In Station</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <Label className="text-sm font-medium mb-2 block">Tray ID</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter Tray ID (e.g., TRAY-2)"
                    value={trayId}
                    onChange={(e) => setTrayId(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} disabled={loading} size="lg">
                    <Search className="mr-2" size={20} />
                    Search
                  </Button>
                </div>
              </div>

              {mode === "storage" && trayItems.length > 0 && (
                <Button 
                  onClick={handleRequestTray} 
                  disabled={loading} 
                  className="w-full"
                  size="lg"
                >
                  Request Tray to Station
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          {loading && (
            <Card className="border-2 shadow-lg">
              <CardContent className="p-12 text-center">
                <div className="animate-pulse space-y-3">
                  <Package className="mx-auto text-primary" size={48} />
                  <p className="text-muted-foreground font-medium">Loading items...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && trayItems.length > 0 && (
            <Card className="border-2 shadow-lg">
              <CardHeader className="border-b bg-card">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    {mode === "storage" ? "Items in Storage" : "Items in Station"}
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-sm">
                      Tray: {trayItems[0].tray_id}
                    </Badge>
                    <Badge className="text-sm">
                      {trayItems.length} item{trayItems.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {trayItems.map((item) => (
                    <Card 
                      key={`${item.id}-${item.item_id}`} 
                      className="border-l-4 border-l-primary hover:shadow-md transition-all hover:border-l-accent"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg font-bold">{item.item_id}</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">{item.item_description}</p>
                          </div>
                          <Badge
                            variant={item.tray_status === "active" ? "default" : "secondary"}
                            className="ml-2"
                          >
                            {item.tray_status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4 p-4 bg-accent/5 rounded-lg">
                          <div>
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Available Qty</span>
                            <p className="font-bold text-xl text-primary mt-1">
                              {item.available_quantity}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Inbound Date</span>
                            <p className="font-medium mt-1">{item.inbound_date}</p>
                          </div>
                        </div>
                        {mode === "station" && (
                          <Button
                            onClick={() => handleItemClick(item)}
                            className="w-full"
                            size="lg"
                          >
                            Select for Putaway
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && trayItems.length === 0 && trayId && (
            <Card className="border-2 border-dashed shadow-lg">
              <CardContent className="p-12 text-center">
                <Package className="mx-auto text-muted-foreground mb-4" size={48} />
                <p className="text-muted-foreground font-medium">No items found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Try searching with a different tray ID or mode
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Putaway Dialog */}
      <Dialog open={showPutawayDialog} onOpenChange={setShowPutawayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Putaway Transaction</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-accent/10 rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">
                  Tray: {selectedItem.tray_id}
                </p>
                <p className="text-sm text-muted-foreground">
                  Original Item: {selectedItem.item_id}
                </p>
                <p className="text-sm font-medium">
                  Available: {selectedItem.available_quantity} units
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-id">Item ID</Label>
                <div className="flex gap-2">
                  <Input
                    id="item-id"
                    placeholder="Enter or scan item ID"
                    value={transactionItemId}
                    onChange={(e) => setTransactionItemId(e.target.value)}
                  />
                  <Button variant="outline" size="icon" onClick={handleScanItemId}>
                    <Scan size={20} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus size={20} />
                  </Button>
                  <div className="text-3xl font-bold w-20 text-center">
                    {quantity}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus size={20} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-date">Transaction Date</Label>
                <Input
                  id="transaction-date"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>

              <Button onClick={handleSubmitTransaction} className="w-full">
                Submit Putaway
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdhocMode;
