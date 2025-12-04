import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Package, RefreshCw, Minus, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
interface Tray {
  id: number;
  tray_id: string;
  tray_status: string;
  available_quantity: number;
  inbound_date: string;
  item_id: string;
  item_description: string;
  tray_height: number;
  tray_weight: number;
}
interface TrayOrder {
  id: number;
  station_friendly_name: string;
  tray_id: string;
}
interface SapOrderItem {
  id: number;
  order_ref: string;
  material: string;
  movement_type: string;
  quantity: number;
  quantity_consumed: number;
  plant: string;
  storage_location: string;
}
interface Transaction {
  id: number;
  user_name: string;
  tray_id: string;
  transaction_item_quantity: number;
  station_friendly_name: string;
  transaction_date: string;
  created_at: string;
}
const fetchTrays = async (itemId: string, inStation: boolean): Promise<Tray[]> => {
  const response = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/trays_for_order?in_station=${inStation}&item_id=${itemId}&like=false&num_records=10&offset=0&order_flow=fifo`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${localStorage.getItem("authToken")}`
    }
  });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return data.records || [];
};
const fetchTrayOrder = async (trayId: string): Promise<TrayOrder | null> => {
  const userId = localStorage.getItem("userId") || "1";
  const response = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/orders?tray_id=${trayId}&tray_status=tray_ready_to_use&user_id=${userId}&order_by_field=updated_at&order_by_type=ASC`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${localStorage.getItem("authToken")}`
    }
  });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.records && data.records.length > 0 ? data.records[0] : null;
};
const fetchSapOrderItem = async (orderRef: string, material: string): Promise<SapOrderItem | null> => {
  const response = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/sap_orders/?order_ref=${orderRef}&material=${material}&order_by_field=updated_at&order_by_type=DESC`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${localStorage.getItem("authToken")}`
    }
  });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.records && data.records.length > 0 ? data.records[0] : null;
};
const fetchTransactions = async (orderRef: string, itemId: string): Promise<Transaction[]> => {
  const response = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/transactions?order_ref=${orderRef}&item_id=${itemId}&order_by_field=updated_at&order_by_type=DESC`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${localStorage.getItem("authToken")}`
    }
  });
  if (!response.ok) {
    return [];
  }
  const data = await response.json();
  return data.records || [];
};
const TraysForItem = () => {
  const {
    orderId,
    itemId
  } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTray, setSelectedTray] = useState<Tray | null>(null);
  const [orderId_internal, setOrderIdInternal] = useState<number | null>(null);
  const [quantityToPick, setQuantityToPick] = useState(0);
  const [isPickingDialogOpen, setIsPickingDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [releasingTrayId, setReleasingTrayId] = useState<string | null>(null);
  const [retrievingTrayId, setRetrievingTrayId] = useState<string | null>(null);

  // Fetch current SAP order item details
  const {
    data: currentItem,
    refetch: refetchItem
  } = useQuery({
    queryKey: ["sap-order-item", orderId, itemId],
    queryFn: () => fetchSapOrderItem(orderId || "", itemId || ""),
    enabled: !!orderId && !!itemId,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    placeholderData: previousData => previousData
  });

  // Fetch in-storage trays
  const {
    data: storageTrays,
    error: storageError,
    refetch: refetchStorage
  } = useQuery({
    queryKey: ["storage-trays", itemId],
    queryFn: () => fetchTrays(itemId || "", false),
    enabled: !!itemId,
    retry: false,
    refetchInterval: 5000,
    placeholderData: previousData => previousData
  });

  // Fetch in-station trays with their orders
  const {
    data: stationTraysData,
    error: stationError,
    refetch: refetchStation
  } = useQuery({
    queryKey: ["station-trays", itemId],
    queryFn: async () => {
      const trays = await fetchTrays(itemId || "", true);
      const orderPromises = trays.map(tray => fetchTrayOrder(tray.tray_id));
      const orders = await Promise.all(orderPromises);
      const ordersMap = new Map<string, TrayOrder>();
      orders.forEach((order, index) => {
        if (order) {
          ordersMap.set(trays[index].tray_id, order);
        }
      });
      return {
        trays,
        ordersMap
      };
    },
    enabled: !!itemId,
    retry: false,
    refetchInterval: 5000,
    placeholderData: previousData => previousData
  });
  const stationTrays = stationTraysData?.trays;
  const trayOrders = stationTraysData?.ordersMap || new Map<string, TrayOrder>();

  // Fetch transactions history
  const {
    data: transactions,
    error: transactionsError
  } = useQuery({
    queryKey: ["transactions", orderId, itemId],
    queryFn: () => fetchTransactions(orderId || "", itemId || ""),
    enabled: !!orderId && !!itemId,
    retry: false,
    refetchInterval: 5000,
    placeholderData: previousData => previousData
  });
  useEffect(() => {
    if (transactionsError) {
      queryClient.removeQueries({
        queryKey: ["transactions", orderId, itemId]
      });
    }
  }, [transactionsError, queryClient, orderId, itemId]);
  const handleRefresh = async () => {
    toast({
      title: "Refreshing trays..."
    });
    await Promise.all([refetchStorage(), refetchStation()]);
    toast({
      title: "Trays updated",
      description: "Latest data loaded successfully"
    });
  };
  const handleRetrieveTray = async (tray: Tray) => {
    setRetrievingTrayId(tray.tray_id);
    try {
      const checkResponse = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/orders?tray_id=${tray.tray_id}&tray_status=tray_ready_to_use&order_by_field=updated_at&order_by_type=ASC`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`
        }
      });
      const checkData = await checkResponse.json();
      if (checkResponse.ok && checkData.records && checkData.records.length > 0) {
        toast({
          title: "Tray Already in Station",
          description: `Tray ${tray.tray_id} is ready`
        });
      } else {
        const createResponse = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/orders?tray_id=${tray.tray_id}&user_id=1&auto_complete_time=10`, {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`
          },
          body: ""
        });
        if (!createResponse.ok) {
          throw new Error("Failed to create order");
        }
        toast({
          title: "Tray Requested",
          description: `Waiting for tray ${tray.tray_id} to arrive at station...`
        });
      }
      queryClient.invalidateQueries({
        queryKey: ["storage-trays"]
      });
      queryClient.invalidateQueries({
        queryKey: ["station-trays"]
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to retrieve tray",
        variant: "destructive"
      });
    } finally {
      setRetrievingTrayId(null);
    }
  };
  const handlePickItem = async (tray: Tray) => {
    const existingOrder = trayOrders.get(tray.tray_id);
    if (existingOrder) {
      setSelectedTray(tray);
      setOrderIdInternal(existingOrder.id);
      setQuantityToPick(0);
      setIsPickingDialogOpen(true);
    } else {
      try {
        const checkResponse = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/orders?tray_id=${tray.tray_id}&tray_status=tray_ready_to_use&status=active&order_by_field=updated_at&order_by_type=DESC`, {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`
          }
        });
        const checkData = await checkResponse.json();
        if (!checkResponse.ok || !checkData.records || checkData.records.length === 0) {
          toast({
            title: "Tray Not In Station",
            description: `Tray ${tray.tray_id} is not available for picking`,
            variant: "destructive"
          });
          return;
        }
        const user_Id = localStorage.getItem("userId") || "1";
        const createResponse = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/orders?tray_id=${tray.tray_id}&user_id=${user_Id}&auto_complete_time=10`, {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`
          },
          body: ""
        });
        if (!createResponse.ok) {
          throw new Error("Failed to create order");
        }
        const createData = await createResponse.json();
        const order_id = createData.records[0].id;
        toast({
          title: "Order Created",
          description: `Order ID: ${order_id}`
        });
        setSelectedTray(tray);
        setOrderIdInternal(order_id);
        setQuantityToPick(0);
        setIsPickingDialogOpen(true);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to create order",
          variant: "destructive"
        });
      }
    }
  };
  const handleSubmit = async () => {
    if (!selectedTray || !orderId_internal || !currentItem || !itemId) return;
    if (quantityToPick <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a quantity greater than 0",
        variant: "destructive"
      });
      return;
    }
    if (quantityToPick > selectedTray.available_quantity) {
      toast({
        title: "Quantity Exceeds Available",
        description: `Only ${selectedTray.available_quantity} items available`,
        variant: "destructive"
      });
      return;
    }
    const remainingQty = currentItem.quantity - currentItem.quantity_consumed;
    if (quantityToPick > remainingQty) {
      toast({
        title: "Quantity Exceeds Order Requirement",
        description: `Only ${remainingQty} items needed for this order`,
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/transaction?order_id=${orderId_internal}&item_id=${itemId}&transaction_item_quantity=-${quantityToPick}&transaction_type=outbound&transaction_date=${selectedTray.inbound_date}&sap_order_reference=${currentItem.id}`, {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`
        },
        body: ""
      });
      if (!response.ok) {
        throw new Error("Failed to submit transaction");
      }
      toast({
        title: "Success",
        description: `Picked ${quantityToPick} items from tray ${selectedTray.tray_id}`
      });
      setIsPickingDialogOpen(false);
      setSelectedTray(null);
      setOrderIdInternal(null);
      setQuantityToPick(0);
      await refetchItem();
      queryClient.invalidateQueries({
        queryKey: ["storage-trays"]
      });
      queryClient.invalidateQueries({
        queryKey: ["station-trays"]
      });
      queryClient.invalidateQueries({
        queryKey: ["transactions"]
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit picking transaction",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleRelease = async (tray: Tray) => {
    const existingOrder = trayOrders.get(tray.tray_id);
    if (!existingOrder) {
      toast({
        title: "Error",
        description: "No order found for this tray",
        variant: "destructive"
      });
      return;
    }
    setIsSubmitting(true);
    setReleasingTrayId(tray.tray_id);
    try {
      const response = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/orders/complete?record_id=${existingOrder.id}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`
        },
        body: ""
      });
      if (!response.ok) {
        throw new Error("Failed to release tray");
      }
      toast({
        title: "Tray Released Successfully",
        description: `Tray ${tray.tray_id} has been released`
      });
      queryClient.invalidateQueries({
        queryKey: ["storage-trays"]
      });
      queryClient.invalidateQueries({
        queryKey: ["station-trays"]
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to release tray",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setReleasingTrayId(null);
    }
  };
  const handleReleaseFromDialog = async () => {
    if (!orderId_internal) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`https://robotmanagerv1test.qikpod.com/nanostore/orders/complete?record_id=${orderId_internal}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`
        },
        body: ""
      });
      if (!response.ok) {
        throw new Error("Failed to release tray");
      }
      toast({
        title: "Tray Released Successfully",
        description: `Tray ${selectedTray?.tray_id} has been released`
      });
      setIsPickingDialogOpen(false);
      setSelectedTray(null);
      setOrderIdInternal(null);
      setQuantityToPick(0);
      queryClient.invalidateQueries({
        queryKey: ["storage-trays"]
      });
      queryClient.invalidateQueries({
        queryKey: ["station-trays"]
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to release tray",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  return <div className="min-h-screen bg-background flex flex-col">
    <header className="bg-card border-b-2 border-border shadow-sm sticky top-0 z-10">
      <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate(`/order/${orderId}`)} variant="ghost" size="icon" className="text-foreground hover:bg-accent/10">
            <ArrowLeft size={24} />
          </Button>
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Package className="text-primary-foreground" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Trays</h1>
            <p className="text-xs text-muted-foreground">Item: {itemId}</p>
          </div>
        </div>
        <Button onClick={handleRefresh} variant="ghost" size="icon" className="text-accent hover:bg-accent/10">
          <RefreshCw size={24} />
        </Button>
      </div>
    </header>

    <ScrollArea className="flex-1">
      <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Order Summary Card */}
        {currentItem && <Card className="p-5 bg-card border-2 border-primary shadow-lg animate-fade-in">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Order ID</p>
                <p className="text-lg font-bold text-foreground">{currentItem.order_ref}</p>
              </div>
            </div>
          </div>
        </Card>}

        {/* Current Item Card */}
        {currentItem && <Card className="p-5 bg-card border-2 border-border hover:shadow-lg transition-all duration-300 animate-fade-in">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Item Details</h2>
              <span className="text-xs font-semibold px-3 py-1 rounded bg-primary text-primary-foreground">
                {currentItem.movement_type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Material ID</p>
                <p className="text-lg font-bold text-foreground">{currentItem.material}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Order Ref</p>
                <p className="text-lg font-bold text-foreground">{currentItem.order_ref}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Qty</p>
                <p className="text-base font-bold text-foreground">{currentItem.quantity}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Picked</p>
                <p className="text-base font-bold text-success">{currentItem.quantity_consumed}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="text-base font-bold text-warning">
                  {currentItem.quantity - currentItem.quantity_consumed}
                </p>
              </div>
            </div>
          </div>
        </Card>}

        <div>
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            🏭 In Station Trays
            <span className="text-sm text-muted-foreground font-normal">({stationTrays?.length || 0})</span>
          </h2>
          <div className="space-y-3">
            {stationError && !stationTrays && <Card className="p-6 border-2 border-destructive/50 bg-destructive/5">
              <p className="text-center text-destructive font-medium">Failed to load station trays</p>
            </Card>}
            {!stationError && stationTrays && stationTrays.length === 0 && <Card className="p-6 border-2 border-border bg-muted/30">
              <p className="text-center text-muted-foreground font-medium">No trays in station for this item</p>
            </Card>}
            {stationTrays?.map(tray => {
              const trayOrder = trayOrders.get(tray.tray_id);
              return <Card key={tray.tray_id} className="p-5 border-2 border-primary/50 bg-primary/5 hover:shadow-lg transition-all duration-300 animate-fade-in">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Tray ID</p>
                        <p className="text-lg font-bold text-foreground">{tray.tray_id}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {trayOrder && <span className="text-xs font-semibold px-2 py-1 rounded text-accent-foreground bg-primary">
                        {trayOrder.station_friendly_name}
                      </span>}
                      <span className="text-xs font-semibold px-2 py-1 rounded bg-success text-success-foreground">
                        In Station
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Available</p>
                      <p className="text-base font-bold text-foreground">{tray.available_quantity}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Inbound Date</p>
                      <p className="text-sm font-medium text-foreground">{tray.inbound_date}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="text-sm font-medium text-foreground">{tray.item_description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Button onClick={() => handleRelease(tray)} disabled={isSubmitting || !trayOrder || releasingTrayId === tray.tray_id} variant="outline" className="w-full">
                      🔁 Release
                    </Button>
                    <Button onClick={() => handlePickItem(tray)} disabled={isSubmitting || releasingTrayId === tray.tray_id || currentItem && currentItem.quantity_consumed >= currentItem.quantity} className="w-full">
                      📦 Pick Item
                    </Button>
                  </div>
                </div>
              </Card>;
            })}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            🏗 In Storage Trays
            <span className="text-sm text-muted-foreground font-normal">({storageTrays?.length || 0})</span>
          </h2>
          <div className="space-y-3">
            {storageError && !storageTrays && <Card className="p-6 border-2 border-destructive/50 bg-destructive/5">
              <p className="text-center text-destructive font-medium">Failed to load storage trays</p>
            </Card>}
            {!storageError && storageTrays && storageTrays.length === 0 && <Card className="p-6 border-2 border-border bg-muted/30">
              <p className="text-center text-muted-foreground font-medium">No trays in storage for this item</p>
            </Card>}
            {storageTrays?.map(tray => <Card key={tray.tray_id} className="p-5 border-2 border-border hover:shadow-lg transition-all duration-300 animate-fade-in">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Package className="text-primary" size={20} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Tray ID</p>
                      <p className="text-lg font-bold text-foreground">{tray.tray_id}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-1 rounded bg-accent/20 text-accent-foreground">
                    {tray.tray_status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Available</p>
                    <p className="text-base font-bold text-foreground">{tray.available_quantity}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Inbound Date</p>
                    <p className="text-sm font-medium text-foreground">{tray.inbound_date}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm font-medium text-foreground">{tray.item_description}</p>
                </div>

                <Button onClick={() => handleRetrieveTray(tray)} disabled={retrievingTrayId === tray.tray_id} className="w-full">
                  Retrieve Tray
                </Button>
              </div>
            </Card>)}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-foreground mb-3 flex items-center gap-2">
            📋 Picked Items
            <span className="text-sm text-muted-foreground font-normal">({transactions?.length || 0})</span>
          </h2>
          <div className="space-y-3">
            {transactions && transactions.length === 0 && <p className="text-center py-6 text-muted-foreground">No transaction history</p>}
            {transactions?.map(transaction => <Card key={`${transaction.id}-${transaction.created_at}`} className="p-4 border-2 border-border bg-card">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Tray: {transaction.tray_id}</span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${transaction.transaction_item_quantity < 0 ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"}`}>
                    Qty: {transaction.transaction_item_quantity}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">User: </span>
                    <span className="font-medium text-foreground">{transaction.user_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Station: </span>
                    <span className="font-medium text-foreground">{transaction.station_friendly_name}</span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  {new Date(transaction.created_at).toLocaleString()}
                </div>
              </div>
            </Card>)}
          </div>
        </div>
      </div>
    </ScrollArea>

    <Dialog open={isPickingDialogOpen} onOpenChange={setIsPickingDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pick Items from Tray</DialogTitle>
          <DialogDescription>
            Tray: {selectedTray?.tray_id} | Available: {selectedTray?.available_quantity}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center gap-4 py-6">
          <Button variant="outline" size="icon" onClick={() => setQuantityToPick(Math.max(1, quantityToPick - 1))} disabled={quantityToPick <= 1}>
            <Minus size={20} />
          </Button>
          <div className="text-4xl font-bold text-primary w-20 text-center">{quantityToPick}</div>
          <Button variant="outline" size="icon" onClick={() => {
            const remainingQty = currentItem ? currentItem.quantity - currentItem.quantity_consumed : 0;
            const maxQty = Math.min(selectedTray?.available_quantity || 1, remainingQty);
            setQuantityToPick(Math.min(maxQty, quantityToPick + 1));
          }} disabled={quantityToPick >= Math.min(selectedTray?.available_quantity || 1, currentItem ? currentItem.quantity - currentItem.quantity_consumed : 1)}>
            <Plus size={20} />
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Submitting..." : "✅ Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
};
export default TraysForItem;