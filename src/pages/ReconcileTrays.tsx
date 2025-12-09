import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Package, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Scaffold from "@/components/Scaffold";

interface ItemDetails {
  id: number;
  material: string;
  sap_quantity: number;
  sap_date: string;
  item_quantity: number;
  item_description: string;
  item_weight: number | null;
  quantity_difference: number;
  reconcile_status: string;
  created_at: string;
  updated_at: string;
}

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

const fetchItemDetails = async (material: string): Promise<ItemDetails | null> => {
  const authToken = localStorage.getItem('authToken');

  const response = await fetch(
    `https://amsstores1.leapmile.com/nanostore/sap_reconcile/report?material=${material}&num_records=100&offset=0`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${authToken}`
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.records && data.records.length > 0 ? data.records[0] : null;
};

const fetchTrays = async (itemId: string, inStation: boolean): Promise<Tray[]> => {
  const authToken = localStorage.getItem('authToken');

  const response = await fetch(
    `https://amsstores1.leapmile.com/nanostore/trays_for_order?in_station=${inStation}&item_id=${itemId}&like=false&num_records=10&offset=0&order_flow=fifo`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${authToken}`
      }
    }
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.records || [];
};

const fetchTrayOrder = async (trayId: string): Promise<TrayOrder | null> => {
  const authToken = localStorage.getItem('authToken');

  const response = await fetch(
    `https://amsstores1.leapmile.com/nanostore/orders?tray_id=${trayId}&tray_status=tray_ready_to_use&user_id=1&order_by_field=updated_at&order_by_type=ASC`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${authToken}`
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.records && data.records.length > 0 ? data.records[0] : null;
};

const ReconcileTrays = () => {
  const { material } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedTray, setSelectedTray] = useState<Tray | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [quantityToPick, setQuantityToPick] = useState(0);
  const [isPickingDialogOpen, setIsPickingDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'pick' | 'inbound'>('pick');
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [releasingTrayId, setReleasingTrayId] = useState<string | null>(null);
  const [retrievingTrayId, setRetrievingTrayId] = useState<string | null>(null);

  // Fetch item details
  const { data: itemDetails, refetch: refetchItemDetails } = useQuery({
    queryKey: ["item-details", material],
    queryFn: () => fetchItemDetails(material || ""),
    enabled: !!material,
    retry: false,
    refetchInterval: 5000
  });

  // Fetch in-storage trays
  const { data: storageTrays, refetch: refetchStorage } = useQuery({
    queryKey: ["storage-trays-reconcile", material],
    queryFn: () => fetchTrays(material || "", false),
    enabled: !!material,
    retry: false,
    refetchInterval: 5000
  });

  // Fetch in-station trays with their orders
  const { data: stationTraysData, refetch: refetchStation } = useQuery({
    queryKey: ["station-trays-reconcile", material],
    queryFn: async () => {
      const trays = await fetchTrays(material || "", true);
      const orderPromises = trays.map(tray => fetchTrayOrder(tray.tray_id));
      const orders = await Promise.all(orderPromises);

      const ordersMap = new Map<string, TrayOrder>();
      orders.forEach((order, index) => {
        if (order) {
          ordersMap.set(trays[index].tray_id, order);
        }
      });

      return { trays, ordersMap };
    },
    enabled: !!material,
    retry: false,
    refetchInterval: 5000
  });

  const stationTrays = stationTraysData?.trays;
  const trayOrders = stationTraysData?.ordersMap || new Map<string, TrayOrder>();

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      navigate("/");
    }
  }, [navigate]);

  const handleRefresh = async () => {
    toast({ title: "Refreshing data..." });
    await Promise.all([refetchItemDetails(), refetchStorage(), refetchStation()]);
    toast({ title: "Data updated", description: "Latest data loaded successfully" });
  };

  const handleRetrieveTray = async (tray: Tray) => {
    setRetrievingTrayId(tray.tray_id);
    const authToken = localStorage.getItem('authToken');

    try {
      const checkResponse = await fetch(
        `https://amsstores1.leapmile.com/nanostore/orders?tray_id=${tray.tray_id}&tray_status=tray_ready_to_use&order_by_field=updated_at&order_by_type=ASC`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      const checkData = await checkResponse.json();

      if (checkResponse.ok && checkData.records && checkData.records.length > 0) {
        toast({
          title: "Tray Already in Station",
          description: `Tray ${tray.tray_id} is ready`
        });
      } else {
        const createResponse = await fetch(
          `https://amsstores1.leapmile.com/nanostore/orders?tray_id=${tray.tray_id}&user_id=1&auto_complete_time=10`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${authToken}`
            },
            body: ""
          }
        );

        if (!createResponse.ok) {
          throw new Error("Failed to create order");
        }

        toast({
          title: "Tray Requested",
          description: `Waiting for tray ${tray.tray_id} to arrive at station...`
        });
      }

      queryClient.invalidateQueries({ queryKey: ["storage-trays-reconcile"] });
      queryClient.invalidateQueries({ queryKey: ["station-trays-reconcile"] });
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
    setSelectedTray(tray);
    setQuantityToPick(0);
    setShowActionDialog(true);
  };

  const handleActionSelect = async (selectedAction: 'pick' | 'inbound') => {
    setActionType(selectedAction);
    setShowActionDialog(false);

    // Both pick and inbound need to ensure tray is in station and has an order
    if (!selectedTray) return;

    const existingOrder = trayOrders.get(selectedTray.tray_id);
    if (existingOrder) {
      setOrderId(existingOrder.id);
      setIsPickingDialogOpen(true);
      return;
    }

    // No existing order, need to check/create one
    const authToken = localStorage.getItem('authToken');
    try {
      const checkResponse = await fetch(
        `https://amsstores1.leapmile.com/nanostore/orders?tray_id=${selectedTray.tray_id}&tray_status=tray_ready_to_use&status=active&order_by_field=updated_at&order_by_type=DESC`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      const checkData = await checkResponse.json();

      if (!checkResponse.ok || !checkData.records || checkData.records.length === 0) {
        toast({
          title: "Tray Not In Station",
          description: `Tray ${selectedTray.tray_id} is not available`,
          variant: "destructive"
        });
        return;
      }

      const createResponse = await fetch(
        `https://amsstores1.leapmile.com/nanostore/orders?tray_id=${selectedTray.tray_id}&user_id=1&auto_complete_time=10`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: ""
        }
      );

      if (!createResponse.ok) {
        throw new Error("Failed to create order");
      }

      const createData = await createResponse.json();
      const order_id = createData.records[0].id;

      toast({
        title: "Order Created",
        description: `Order ID: ${order_id}`
      });

      setOrderId(order_id);
      setIsPickingDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create order",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async () => {
    if (!selectedTray || !material || !orderId) return;

    // Validate quantity
    if (quantityToPick <= 0) {
      toast({
        title: "Invalid Quantity",
        description: "Please enter a quantity greater than 0",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    const authToken = localStorage.getItem('authToken');

    try {
      if (actionType === 'inbound') {
        const currentDate = new Date().toISOString().split('T')[0];
        const response = await fetch(
          `https://amsstores1.leapmile.com/nanostore/transaction?order_id=${orderId}&item_id=${material}&transaction_item_quantity=${quantityToPick}&transaction_type=admin&transaction_date=${currentDate}&comment=SAP%20Reconcile%20Inbound`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${authToken}`
            },
            body: ""
          }
        );

        if (!response.ok) {
          throw new Error("Failed to submit inbound transaction");
        }

        toast({
          title: "Success",
          description: `Added ${quantityToPick} items via inbound transaction`
        });
      } else {
        const response = await fetch(
          `https://amsstores1.leapmile.com/nanostore/transaction?order_id=${orderId}&item_id=${material}&transaction_item_quantity=-${quantityToPick}&transaction_type=admin&transaction_date=${selectedTray.inbound_date}&comment=SAP%20Reconcile%20Pickup`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${authToken}`
            },
            body: ""
          }
        );

        if (!response.ok) {
          throw new Error("Failed to submit pick transaction");
        }

        toast({
          title: "Success",
          description: `Picked ${quantityToPick} items from tray ${selectedTray.tray_id}`
        });
      }

      setIsPickingDialogOpen(false);
      setSelectedTray(null);
      setOrderId(null);
      setQuantityToPick(0);

      await refetchItemDetails();
      queryClient.invalidateQueries({ queryKey: ["storage-trays-reconcile"] });
      queryClient.invalidateQueries({ queryKey: ["station-trays-reconcile"] });
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to submit ${actionType} transaction`,
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
    const authToken = localStorage.getItem('authToken');

    try {
      const response = await fetch(
        `https://amsstores1.leapmile.com/nanostore/orders/complete?record_id=${existingOrder.id}`,
        {
          method: "PATCH",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: ""
        }
      );

      if (!response.ok) {
        throw new Error("Failed to release tray");
      }

      toast({
        title: "Tray Released Successfully",
        description: `Tray ${tray.tray_id} has been released`
      });

      queryClient.invalidateQueries({ queryKey: ["storage-trays-reconcile"] });
      queryClient.invalidateQueries({ queryKey: ["station-trays-reconcile"] });
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
    if (!orderId) return;

    setIsSubmitting(true);
    const authToken = localStorage.getItem('authToken');

    try {
      const response = await fetch(
        `https://amsstores1.leapmile.com/nanostore/orders/complete?record_id=${orderId}`,
        {
          method: "PATCH",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: ""
        }
      );

      if (!response.ok) {
        throw new Error("Failed to release tray");
      }

      toast({
        title: "Tray Released Successfully",
        description: `Tray ${selectedTray?.tray_id} has been released`
      });

      setIsPickingDialogOpen(false);
      setSelectedTray(null);
      setOrderId(null);
      setQuantityToPick(0);

      queryClient.invalidateQueries({ queryKey: ["storage-trays-reconcile"] });
      queryClient.invalidateQueries({ queryKey: ["station-trays-reconcile"] });
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

  return (
    <Scaffold
      title={
        <div>
          <h1 className="text-2xl font-bold text-foreground">{material}</h1>
          <p className="text-sm text-muted-foreground">{itemDetails?.item_description || ""}</p>
        </div>
      }
      showBack
      onBack={() => navigate("/sap-reconcile")}
      icon={<Package className="text-primary-foreground" size={24} />}
      actions={
        <Button
          onClick={handleRefresh}
          className="h-10 w-10 bg-transparent text-accent hover:bg-accent/10"
        >
          <RefreshCw size={24} />
        </Button>
      }
    >
      {/* Item Details Card */}
      {itemDetails && (
        <div className="container max-w-6xl mx-auto px-4 py-4">
          <Card className="p-6 bg-muted/30 border border-border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">SAP Quantity</p>
                <p className="text-3xl font-bold text-foreground">{itemDetails.sap_quantity}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Item Quantity</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{itemDetails.item_quantity}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Difference</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{itemDetails.quantity_difference}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <p className={`text-lg font-bold capitalize ${itemDetails.reconcile_status === 'sap_shortage' ? 'text-orange-600 dark:text-orange-400' :
                  itemDetails.reconcile_status === 'robot_shortage' ? 'text-amber-600 dark:text-amber-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                  {itemDetails.reconcile_status.replace('_', ' ')}
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Trays Content */}
      <div className="container max-w-7xl mx-auto px-2 sm:px-4 pb-6 flex-1">
        <div className="space-y-6">
          {/* In Station Trays */}
          <div>
            <div className="flex items-center gap-2 mb-4 px-2">
              <h2 className="text-xl font-bold text-foreground">🏭 In Station Trays</h2>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                {stationTrays?.length || 0}
              </span>
            </div>
            {!stationTrays || stationTrays.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No trays in station</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
                  {stationTrays.map((tray) => {
                    const order = trayOrders.get(tray.tray_id);
                    const isReleasing = releasingTrayId === tray.tray_id;

                    return (
                      <Card
                        key={tray.id}
                        className="p-4 bg-card border-2 border-primary/20 hover:border-primary/40 transition-all"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package className="text-primary" size={20} />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Tray ID</p>
                                <p className="font-bold text-foreground">{tray.tray_id}</p>
                              </div>
                            </div>
                            {order && (
                              <div className="px-2 py-1 rounded-md bg-success/20 text-success text-xs font-semibold">
                                {order.station_friendly_name}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Quantity</p>
                              <p className="font-bold text-foreground">{tray.available_quantity}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Status</p>
                              <p className="font-semibold text-success">In Station</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleRelease(tray)}
                              disabled={isReleasing || isSubmitting}
                              className="flex-1 h-9 rounded-md px-3 border border-input text-black bg-background hover:bg-accent hover:text-accent-foreground"
                            >
                              {isReleasing ? <RefreshCw className="animate-spin" size={16} /> : "Release"}
                            </Button>
                            <Button
                              onClick={() => handlePickItem(tray)}
                              disabled={isSubmitting}
                              className="flex-1 h-9 rounded-md px-3"
                            >
                              Reconcile
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* In Storage Trays */}
          <div>
            <div className="flex items-center gap-2 mb-4 px-2">
              <h2 className="text-xl font-bold text-foreground">🏗 In Storage Trays</h2>
              <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-semibold">
                {storageTrays?.length || 0}
              </span>
            </div>
            {!storageTrays || storageTrays.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No trays in storage</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-2">
                  {storageTrays.map((tray) => {
                    const isRetrieving = retrievingTrayId === tray.tray_id;

                    return (
                      <Card
                        key={tray.id}
                        className="p-5 bg-card border border-border hover:shadow-md transition-all"
                      >
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Tray ID</p>
                            <p className="text-xl font-bold text-foreground">{tray.tray_id}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                              <p className="text-2xl font-bold text-foreground">{tray.available_quantity}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Status</p>
                              <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">In Storage</p>
                            </div>
                          </div>

                          <Button
                            onClick={() => handleRetrieveTray(tray)}
                            disabled={isRetrieving || isSubmitting}
                            className="w-full bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-700"
                          >
                            {isRetrieving ? <RefreshCw className="animate-spin mr-2" size={16} /> : null}
                            {isRetrieving ? "Retrieving..." : "Retrieve Tray"}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>

      {/* Action Type Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Action</DialogTitle>
            <DialogDescription>
              Choose an action for this item
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              onClick={() => handleActionSelect('pick')}
              className="w-full py-6 text-lg"
            >
              Pick
            </Button>
            <Button
              onClick={() => handleActionSelect('inbound')}
              className="w-full py-6 text-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Inbound
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Picking Dialog */}
      <Dialog open={isPickingDialogOpen} onOpenChange={setIsPickingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'inbound' ? 'Inbound Items' : 'Pick Items from Tray'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'inbound'
                ? `Adding items to ${material}`
                : `Tray ID: ${selectedTray?.tray_id} | Available: ${selectedTray?.available_quantity}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {actionType === 'inbound' ? 'Quantity to Add' : 'Quantity to Pick'}
              </label>
              <Input
                type="number"
                value={quantityToPick}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value)) {
                    setQuantityToPick(value);
                  } else if (e.target.value === '') {
                    setQuantityToPick(0);
                  }
                }}
                min="0"
                className="text-center text-2xl font-bold"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Submitting..." : `Confirm ${actionType === 'inbound' ? 'Inbound' : 'Pick'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Scaffold>
  );
};

export default ReconcileTrays;
