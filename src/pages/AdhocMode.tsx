import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Search, Package, Minus, Plus, Scan, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
interface TrayItem {
  id: number;
  tray_id: string;
  item_id: string | null;
  item_description: string | null;
  available_quantity: number;
  inbound_date: string | null;
  tray_status: string;
  tray_lockcount: number;
  tray_divider: number;
  tray_height: number;
  tray_weight: number;
  station_friendly_name?: string;
}
interface Order {
  id: number;
  tray_id: string;
  user_id: number;
  station_id: string;
  station_friendly_name: string;
  tray_status?: string;
  status?: string;
  auto_complete_time?: number;
}
const API_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2wiOiJhZG1pbiIsImV4cCI6MTkwMDY2MDExOX0.m9Rrmvbo22sJpWgTVynJLDIXFxOfym48F-kGy-wSKqQ";
const BASE_URL = "https://testhostsushil.leapmile.com";
const AdhocMode = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("tray");
  const [trayId, setTrayId] = useState("");
  const [itemId, setItemId] = useState("");
  const [stationItems, setStationItems] = useState<TrayItem[]>([]);
  const [storageItems, setStorageItems] = useState<TrayItem[]>([]);
  const [itemStationItems, setItemStationItems] = useState<TrayItem[]>([]);
  const [itemStorageItems, setItemStorageItems] = useState<TrayItem[]>([]);
  const [allTrays, setAllTrays] = useState<TrayItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrayItem | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [transactionItemId, setTransactionItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split("T")[0]);
  const [showPutawayDialog, setShowPutawayDialog] = useState(false);
  const [trayDividerFilter, setTrayDividerFilter] = useState<number | null>(null);
  const [showEmptyBins, setShowEmptyBins] = useState(false);
  const [offset, setOffset] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [storageOffset, setStorageOffset] = useState(0);
  const [storageTotalCount, setStorageTotalCount] = useState(0);
  const [retrievingTrayId, setRetrievingTrayId] = useState<string | null>(null);
  const [readyCount, setReadyCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [showReadyDialog, setShowReadyDialog] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [releasingOrderId, setReleasingOrderId] = useState<number | null>(null);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [transactionType, setTransactionType] = useState<'inbound' | 'pickup' | null>(null);
  const [trayItemsForPickup, setTrayItemsForPickup] = useState<TrayItem[]>([]);
  const [selectedProductForPickup, setSelectedProductForPickup] = useState<string | null>(null);

  // Auto-search for tray on input change with debounce
  useEffect(() => {
    if (activeTab !== "tray") return;
    if (!trayId.trim()) return;
    const timer = setTimeout(() => {
      setStationItems([]);
      setStorageItems([]);
      setStorageOffset(0);
      setLoading(true);
      Promise.all([fetchStationItems(), fetchStorageItems()]).finally(() => setLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [trayId, activeTab]);

  // Periodic API calls every 3 seconds for tray search
  useEffect(() => {
    if (!trayId.trim() || activeTab !== "tray") return;
    const interval = setInterval(() => {
      fetchStationItems();
      fetchStorageItems();
    }, 3000);
    return () => clearInterval(interval);
  }, [trayId, activeTab]);

  // Auto-search for item on input change with debounce
  useEffect(() => {
    if (activeTab !== "item") return;
    if (!itemId.trim()) return;
    const timer = setTimeout(() => {
      setItemStationItems([]);
      setItemStorageItems([]);
      setStorageOffset(0);
      setLoading(true);
      Promise.all([fetchItemStationItems(), fetchItemStorageItems()]).finally(() => setLoading(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [itemId, activeTab]);

  // Periodic API calls every 3 seconds for item search
  useEffect(() => {
    if (!itemId.trim() || activeTab !== "item") return;
    const interval = setInterval(() => {
      fetchItemStationItems();
      fetchItemStorageItems();
    }, 3000);
    return () => clearInterval(interval);
  }, [itemId, activeTab]);

  // Reset storage offset when tab changes
  useEffect(() => {
    setStorageOffset(0);
    setStorageTotalCount(0);
  }, [activeTab]);

  // Refetch storage items when storageOffset changes
  useEffect(() => {
    if (activeTab === "tray" && trayId.trim()) {
      fetchStorageItems();
    } else if (activeTab === "item" && itemId.trim()) {
      fetchItemStorageItems();
    }
  }, [storageOffset]);

  // Fetch all trays when search fields are empty
  useEffect(() => {
    if (activeTab === "tray" && !trayId.trim()) {
      fetchAllTrays();
    }
    if (activeTab === "item" && !itemId.trim()) {
      fetchAllTrays();
    }
  }, [activeTab, trayId, itemId, trayDividerFilter, showEmptyBins, offset]);

  // Fetch counts on mount and periodically (every 5 seconds)
  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  // Poll ready orders every 5 seconds when modal is open
  useEffect(() => {
    if (!showReadyDialog) return;
    fetchReadyOrders();
    const interval = setInterval(fetchReadyOrders, 5000);
    return () => clearInterval(interval);
  }, [showReadyDialog]);

  // Poll pending orders every 5 seconds when modal is open
  useEffect(() => {
    if (!showPendingDialog) return;
    fetchPendingOrders();
    const interval = setInterval(fetchPendingOrders, 5000);
    return () => clearInterval(interval);
  }, [showPendingDialog]);
  const fetchCounts = async () => {
    try {
      const [readyResponse, pendingResponse] = await Promise.all([fetch(`${BASE_URL}/nanostore/orders?tray_status=tray_ready_to_use&status=active&order_by_field=updated_at&order_by_type=DESC`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      }), fetch(`${BASE_URL}/nanostore/orders?tray_status=inprogress&status=active&order_by_field=updated_at&order_by_type=DESC`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      })]);
      if (readyResponse.ok) {
        const readyData = await readyResponse.json();
        setReadyCount(readyData.count || 0);
      } else {
        setReadyCount(0);
      }
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        setPendingCount(pendingData.count || 0);
      } else {
        setPendingCount(0);
      }
    } catch (error) {
      console.error("Failed to fetch counts:", error);
      setReadyCount(0);
      setPendingCount(0);
    }
  };
  const fetchReadyOrders = async () => {
    try {
      const response = await fetch(`${BASE_URL}/nanostore/orders?tray_status=tray_ready_to_use&status=active&order_by_field=updated_at&order_by_type=DESC`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setReadyOrders(data.records || []);
      } else {
        setReadyOrders([]);
      }
    } catch (error) {
      setReadyOrders([]);
    }
  };
  const fetchPendingOrders = async () => {
    try {
      const response = await fetch(`${BASE_URL}/nanostore/orders?tray_status=inprogress&status=active&order_by_field=updated_at&order_by_type=DESC`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPendingOrders(data.records || []);
      } else {
        setPendingOrders([]);
      }
    } catch (error) {
      setPendingOrders([]);
    }
  };
  const handleReleaseOrder = async (orderId: number) => {
    setReleasingOrderId(orderId);
    try {
      const response = await fetch(`${BASE_URL}/nanostore/orders/complete?record_id=${orderId}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (!response.ok) {
        throw new Error("Failed to release order");
      }
      toast({
        title: "Success",
        description: "Order released successfully"
      });
      await fetchReadyOrders();
      await fetchCounts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to release order",
        variant: "destructive"
      });
    } finally {
      setReleasingOrderId(null);
    }
  };
  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order);
    setTransactionType(null);
    setTransactionItemId("");
    setQuantity(1);
    setSelectedProductForPickup(null);
    setTrayItemsForPickup([]);
    setShowTransactionDialog(true);
  };
  const handleTransactionTypeSelect = async (type: 'inbound' | 'pickup') => {
    setTransactionType(type);
    if (type === 'pickup' && selectedOrder) {
      // Fetch items for the tray
      try {
        const response = await fetch(`${BASE_URL}/nanostore/trays_for_order?in_station=true&tray_id=${selectedOrder.tray_id}&order_flow=fifo`, {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${API_TOKEN}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.records && data.records.length > 0) {
            setTrayItemsForPickup(data.records);
          } else {
            setTrayItemsForPickup([]);
          }
        } else {
          setTrayItemsForPickup([]);
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch tray items",
          variant: "destructive"
        });
      }
    }
  };
  const handleSubmitInboundTransaction = async () => {
    if (!selectedOrder || !transactionItemId.trim()) {
      toast({
        title: "Error",
        description: "Please enter item ID",
        variant: "destructive"
      });
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/nanostore/transaction?order_id=${selectedOrder.id}&item_id=${transactionItemId}&transaction_item_quantity=${quantity}&transaction_type=inbound&transaction_date=${transactionDate}`, {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        },
        body: ""
      });
      if (!response.ok) {
        throw new Error("Failed to submit transaction");
      }
      toast({
        title: "Success",
        description: "Inbound transaction completed successfully"
      });
      setShowTransactionDialog(false);
      setSelectedOrder(null);
      setTransactionType(null);
      await fetchReadyOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit inbound transaction",
        variant: "destructive"
      });
    }
  };
  const handleSubmitPickupTransaction = async () => {
    if (!selectedOrder || !selectedProductForPickup) {
      toast({
        title: "Error",
        description: "Please select a product",
        variant: "destructive"
      });
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/nanostore/transaction?order_id=${selectedOrder.id}&item_id=${selectedProductForPickup}&transaction_item_quantity=-${quantity}&transaction_type=outbound&transaction_date=${transactionDate}`, {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        },
        body: ""
      });
      if (!response.ok) {
        throw new Error("Failed to submit transaction");
      }
      toast({
        title: "Success",
        description: "Pickup transaction completed successfully"
      });
      setShowTransactionDialog(false);
      setSelectedOrder(null);
      setTransactionType(null);
      await fetchReadyOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit pickup transaction",
        variant: "destructive"
      });
    }
  };

  const handleSelectStorageItem = async (item: TrayItem) => {
    const userId = localStorage.getItem("userId") || "1";
    
    try {
      // First, request the tray to create an order
      const response = await fetch(`${BASE_URL}/nanostore/orders?tray_id=${item.tray_id}&user_id=${userId}&auto_complete_time=2`, {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        },
        body: ""
      });
      
      if (!response.ok) {
        throw new Error("Failed to request tray");
      }
      
      const data = await response.json();
      
      // Create a mock order object from the response
      const order: Order = {
        id: data.id || data.record_id,
        tray_id: item.tray_id,
        user_id: parseInt(userId),
        station_id: data.station_id || "",
        station_friendly_name: data.station_friendly_name || "",
        tray_status: "tray_ready_to_use",
        status: "active"
      };
      
      setSelectedOrder(order);
      setTransactionType(null);
      setTransactionItemId("");
      setQuantity(1);
      setSelectedProductForPickup(null);
      setTrayItemsForPickup([]);
      setShowTransactionDialog(true);
      
      toast({
        title: "Success",
        description: `Tray ${item.tray_id} requested successfully`
      });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request tray",
        variant: "destructive"
      });
    }
  };
  const fetchAllTrays = async () => {
    setLoading(true);
    try {
      const hasItemParam = showEmptyBins ? "false" : "true";
      const dividerParam = trayDividerFilter !== null ? `&tray_divider=${trayDividerFilter}` : "";
      const response = await fetch(`${BASE_URL}/nanostore/trays_for_order?in_station=false${dividerParam}&has_item=${hasItemParam}&num_records=10&offset=${offset}&order_flow=fifo`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (!response.ok) {
        setAllTrays([]);
        return;
      }
      const data = await response.json();
      setAllTrays(data.records || []);
      setTotalCount(data.total_count || data.count || 0);
    } catch (error) {
      setAllTrays([]);
      toast({
        title: "Error",
        description: "Failed to fetch trays",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchStationInfo = async (trayId: string) => {
    try {
      const response = await fetch(`${BASE_URL}/nanostore/orders?tray_id=${trayId}&tray_status=tray_ready_to_use&status=active&order_by_field=updated_at&order_by_type=DESC&num_records=1&offset=0`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.records?.[0]?.station_friendly_name || null;
    } catch (error) {
      return null;
    }
  };
  const fetchStationItems = async () => {
    if (!trayId.trim()) return;
    try {
      const response = await fetch(`${BASE_URL}/nanostore/trays_for_order?in_station=true&tray_id=${trayId}&num_records=10&offset=0`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (!response.ok) {
        setStationItems([]);
        return;
      }
      const data = await response.json();
      const items = data.records || [];

      // Fetch station info for each tray
      const itemsWithStation = await Promise.all(items.map(async (item: TrayItem) => {
        const stationName = await fetchStationInfo(item.tray_id);
        return {
          ...item,
          station_friendly_name: stationName
        };
      }));
      setStationItems(itemsWithStation);
    } catch (error) {
      setStationItems([]);
    }
  };
  const fetchStorageItems = async () => {
    if (!trayId.trim()) return;
    try {
      const response = await fetch(`${BASE_URL}/nanostore/trays_for_order?in_station=false&tray_id=${trayId}&num_records=10&offset=${storageOffset}`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (!response.ok) {
        setStorageItems([]);
        setStorageTotalCount(0);
        return;
      }
      const data = await response.json();
      setStorageItems(data.records || []);
      setStorageTotalCount(0); // Storage API doesn't provide total_count
    } catch (error) {
      setStorageItems([]);
      setStorageTotalCount(0);
    }
  };
  const fetchItemStationItems = async () => {
    if (!itemId.trim()) return;
    try {
      const response = await fetch(`${BASE_URL}/nanostore/trays_for_order?in_station=true&item_id=${itemId}&num_records=10&offset=0&order_flow=fifo`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (!response.ok) {
        setItemStationItems([]);
        return;
      }
      const data = await response.json();
      const items = data.records || [];

      // Fetch station info for each tray
      const itemsWithStation = await Promise.all(items.map(async (item: TrayItem) => {
        const stationName = await fetchStationInfo(item.tray_id);
        return {
          ...item,
          station_friendly_name: stationName
        };
      }));
      setItemStationItems(itemsWithStation);
    } catch (error) {
      setItemStationItems([]);
    }
  };
  const fetchItemStorageItems = async () => {
    if (!itemId.trim()) return;
    try {
      const response = await fetch(`${BASE_URL}/nanostore/trays_for_order?in_station=false&item_id=${itemId}&num_records=10&offset=${storageOffset}&order_flow=fifo`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (!response.ok) {
        setItemStorageItems([]);
        setStorageTotalCount(0);
        return;
      }
      const data = await response.json();
      setItemStorageItems(data.records || []);
      setStorageTotalCount(0); // Storage API doesn't provide total_count
    } catch (error) {
      setItemStorageItems([]);
      setStorageTotalCount(0);
    }
  };
  const handleSearch = async () => {
    if (!trayId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a tray ID",
        variant: "destructive"
      });
      return;
    }

    // Clear old cached states before new search
    setStationItems([]);
    setStorageItems([]);
    setLoading(true);
    try {
      await Promise.all([fetchStationItems(), fetchStorageItems()]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch tray items",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleItemSearch = async () => {
    if (!itemId.trim()) {
      toast({
        title: "Error",
        description: "Please enter an item ID",
        variant: "destructive"
      });
      return;
    }

    // Clear old cached states before new search
    setItemStationItems([]);
    setItemStorageItems([]);
    setLoading(true);
    try {
      await Promise.all([fetchItemStationItems(), fetchItemStorageItems()]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch item trays",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleRequestTray = async (requestTrayId: string) => {
    if (!requestTrayId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a tray ID",
        variant: "destructive"
      });
      return;
    }
    const userId = localStorage.getItem("userId") || "1";
    setRetrievingTrayId(requestTrayId);
    try {
      const response = await fetch(`${BASE_URL}/nanostore/orders?tray_id=${requestTrayId}&user_id=${userId}&auto_complete_time=2`, {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        },
        body: ""
      });
      if (!response.ok) {
        throw new Error("Failed to request tray");
      }
      toast({
        title: "Success",
        description: `Tray ${requestTrayId} requested successfully`
      });

      // Fetch updated items based on active tab
      if (activeTab === "tray") {
        if (trayId.trim()) {
          await Promise.all([fetchStationItems(), fetchStorageItems()]);
        } else {
          await fetchAllTrays();
        }
      } else {
        await Promise.all([fetchItemStationItems(), fetchItemStorageItems()]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to request tray",
        variant: "destructive"
      });
    } finally {
      setRetrievingTrayId(null);
    }
  };
  const handleItemClick = async (item: TrayItem) => {
    const userId = localStorage.getItem("userId") || "1";
    try {
      const response = await fetch(`${BASE_URL}/nanostore/orders?tray_id=${item.tray_id}&tray_status=tray_ready_to_use&status=active&user_id=${userId}&order_by_field=updated_at&order_by_type=DESC`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
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
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check order status",
        variant: "destructive"
      });
    }
  };
  const handleReleaseTray = async (trayId: string) => {
    const userId = localStorage.getItem("userId") || "1";
    try {
      const response = await fetch(`${BASE_URL}/nanostore/orders?tray_id=${trayId}&tray_status=tray_ready_to_use&status=active&user_id=${userId}&order_by_field=updated_at&order_by_type=DESC`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        }
      });
      if (!response.ok) {
        throw new Error("No active order found");
      }
      const data = await response.json();
      if (data.records && data.records.length > 0) {
        const order: Order = data.records[0];
        const patchResponse = await fetch(`${BASE_URL}/nanostore/orders/complete?record_id=${order.id}`, {
          method: "PATCH",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${API_TOKEN}`
          }
        });
        if (!patchResponse.ok) {
          throw new Error("Failed to release tray");
        }
        toast({
          title: "Success",
          description: `Tray ${trayId} released successfully`
        });
        if (activeTab === "tray") {
          await Promise.all([fetchStationItems(), fetchStorageItems()]);
        } else {
          await Promise.all([fetchItemStationItems(), fetchItemStorageItems()]);
        }
      } else {
        toast({
          title: "No Active Order",
          description: "No active order found for this tray",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to release tray",
        variant: "destructive"
      });
    }
  };
  const handleSubmitTransaction = async () => {
    if (!orderId || !transactionItemId) {
      toast({
        title: "Error",
        description: "Missing required fields",
        variant: "destructive"
      });
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/nanostore/transaction?order_id=${orderId}&item_id=${transactionItemId}&transaction_item_quantity=${quantity}&transaction_type=inbound&transaction_date=${transactionDate}`, {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${API_TOKEN}`
        },
        body: ""
      });
      if (!response.ok) {
        throw new Error("Transaction failed");
      }
      toast({
        title: "Success",
        description: `Putaway completed: ${quantity} units of ${transactionItemId}`
      });
      setShowPutawayDialog(false);
      setSelectedItem(null);
      setOrderId(null);
      setTransactionItemId("");
      setQuantity(1);

      // Refresh the items based on active tab
      if (activeTab === "tray") {
        await Promise.all([fetchStationItems(), fetchStorageItems()]);
      } else {
        await Promise.all([fetchItemStationItems(), fetchItemStorageItems()]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to complete transaction",
        variant: "destructive"
      });
    }
  };
  const handleScanItemId = () => {
    const scannedId = prompt("Simulate Barcode Scan - Enter Item ID:");
    if (scannedId) {
      setTransactionItemId(scannedId);
    }
  };
  return <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b-2 border-border shadow-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button onClick={() => navigate("/home")} variant="ghost" size="icon" className="text-foreground hover:bg-accent/10">
                <ArrowLeft size={20} />
              </Button>
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Package className="text-primary-foreground" size={18} />
              </div>
              <h1 className="text-xl font-bold text-foreground">Adhoc Mode</h1>
            </div>
            
            {/* Count Boxes */}
            <div className="flex gap-3">
              <Card className="cursor-pointer hover:shadow-md transition-all border hover:border-primary/50" onClick={() => {
              fetchReadyOrders();
              setShowReadyDialog(true);
            }}>
                <CardContent className="p-2 px-3">
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground font-medium">Ready</p>
                      <p className="text-lg font-bold text-foreground">{readyCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-md transition-all border hover:border-primary/50" onClick={() => {
              fetchPendingOrders();
              setShowPendingDialog(true);
            }}>
                <CardContent className="p-2 px-3">
                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground font-medium">Pending</p>
                      <p className="text-lg font-bold text-foreground">{pendingCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-2 bg-gradient-to-b from-background to-accent/5">
        <div className="container max-w-6xl mx-auto px-2 space-y-6">
          {/* Search Section with Tabs */}
          <Card className="border-2 shadow-lg">
            <CardHeader className="border-b bg-card pb-4 px-4">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Package className="text-primary" size={28} />
                Search
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="tray">Tray Search</TabsTrigger>
                  <TabsTrigger value="item">Item Search</TabsTrigger>
                </TabsList>
                
                <TabsContent value="tray" className="space-y-3">
                  <Label className="text-base font-semibold">Tray ID</Label>
                  <Input value={trayId} onChange={e => {
                  setTrayId(e.target.value);
                  if (!e.target.value.trim()) {
                    setStationItems([]);
                    setStorageItems([]);
                    setStorageOffset(0);
                    setStorageTotalCount(0);
                  }
                }} className="h-14 text-lg px-5 border-2" placeholder="Enter Tray ID" />
                  
                  {!trayId.trim() && <div className="space-y-3 mt-4">
                      <Label className="text-base font-semibold">Filters</Label>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant={trayDividerFilter === null && !showEmptyBins ? "default" : "outline"} onClick={() => {
                      setTrayDividerFilter(null);
                      setShowEmptyBins(false);
                      setOffset(0);
                    }} size="sm">
                          All Trays
                        </Button>
                        <Button variant={trayDividerFilter === 0 ? "default" : "outline"} onClick={() => {
                      setTrayDividerFilter(0);
                      setOffset(0);
                    }} size="sm">
                          Divider: 0
                        </Button>
                        <Button variant={trayDividerFilter === 4 ? "default" : "outline"} onClick={() => {
                      setTrayDividerFilter(4);
                      setOffset(0);
                    }} size="sm">
                          Divider: 4
                        </Button>
                        <Button variant={trayDividerFilter === 6 ? "default" : "outline"} onClick={() => {
                      setTrayDividerFilter(6);
                      setOffset(0);
                    }} size="sm">
                          Divider: 6
                        </Button>
                        <Button variant={showEmptyBins ? "default" : "outline"} onClick={() => {
                      setShowEmptyBins(!showEmptyBins);
                      setOffset(0);
                    }} size="sm">
                          Empty Bins Only
                        </Button>
                      </div>
                    </div>}
                </TabsContent>
                
                <TabsContent value="item" className="space-y-3">
                  <Label className="text-base font-semibold">Item ID</Label>
                  <Input value={itemId} onChange={e => {
                  setItemId(e.target.value);
                  if (!e.target.value.trim()) {
                    setItemStationItems([]);
                    setItemStorageItems([]);
                    setStorageOffset(0);
                    setStorageTotalCount(0);
                  }
                }} className="h-14 text-lg px-5 border-2" placeholder="Enter Item ID" />
                  
                  {!itemId.trim() && <div className="space-y-3 mt-4">
                      <Label className="text-base font-semibold">Filters</Label>
                      <div className="flex gap-2 flex-wrap">
                        <Button variant={trayDividerFilter === null && !showEmptyBins ? "default" : "outline"} onClick={() => {
                      setTrayDividerFilter(null);
                      setShowEmptyBins(false);
                      setOffset(0);
                    }} size="sm">
                          All Trays
                        </Button>
                        <Button variant={trayDividerFilter === 0 ? "default" : "outline"} onClick={() => {
                      setTrayDividerFilter(0);
                      setOffset(0);
                    }} size="sm">
                          Divider: 0
                        </Button>
                        <Button variant={trayDividerFilter === 4 ? "default" : "outline"} onClick={() => {
                      setTrayDividerFilter(4);
                      setOffset(0);
                    }} size="sm">
                          Divider: 4
                        </Button>
                        <Button variant={trayDividerFilter === 6 ? "default" : "outline"} onClick={() => {
                      setTrayDividerFilter(6);
                      setOffset(0);
                    }} size="sm">
                          Divider: 6
                        </Button>
                        <Button variant={showEmptyBins ? "default" : "outline"} onClick={() => {
                      setShowEmptyBins(!showEmptyBins);
                      setOffset(0);
                    }} size="sm">
                          Empty Bins Only
                        </Button>
                      </div>
                    </div>}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Loading State */}
          {loading && <Card className="border-2 shadow-lg">
              <CardContent className="p-16 text-center">
                <div className="animate-pulse space-y-4">
                  <Package className="mx-auto text-primary" size={56} />
                  <p className="text-muted-foreground font-semibold text-lg">Loading items...</p>
                </div>
              </CardContent>
            </Card>}

          {/* All Trays List (when text field is empty) */}
          {!loading && (activeTab === "tray" && !trayId.trim() || activeTab === "item" && !itemId.trim()) && <Card className="border-2 shadow-lg">
              <CardHeader className="border-b bg-card pb-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg font-bold">
                    {showEmptyBins ? "Empty Bins" : "Trays in Storage"}
                  </CardTitle>
                  <Badge className="text-sm py-1 px-2.5">
                    {totalCount} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {allTrays.length === 0 ? <div className="text-center py-12">
                    <p className="text-muted-foreground text-lg font-medium">No trays found</p>
                  </div> : <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {allTrays.map(tray => <Card key={`all-tray-${tray.id}`} className="border-2 hover:shadow-lg transition-all hover:border-primary/50">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg font-bold">{tray.tray_id}</CardTitle>
                                {tray.item_description && <p className="text-sm text-muted-foreground mt-1">{tray.item_description}</p>}
                                {tray.item_id && <p className="text-xs text-muted-foreground mt-1">Item: {tray.item_id}</p>}
                              </div>
                              <Badge variant="secondary" className="ml-2 text-xs py-1 px-2">
                                {tray.tray_status}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 p-3 bg-accent/10 rounded-lg text-sm">
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold block">
                                  Qty
                                </span>
                                <p className="font-bold text-foreground">{tray.available_quantity}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold block">
                                  Divider
                                </span>
                                <p className="font-bold text-foreground">{tray.tray_divider}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold block">
                                  Height
                                </span>
                                <p className="font-bold text-foreground">{tray.tray_height}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold block">
                                  Weight
                                </span>
                                <p className="font-bold text-foreground">{tray.tray_weight}</p>
                              </div>
                            </div>
                            {tray.inbound_date && <div className="text-xs text-muted-foreground">
                                Inbound: {tray.inbound_date}
                              </div>}
                            <Button onClick={() => handleRequestTray(tray.tray_id)} disabled={retrievingTrayId === tray.tray_id} variant="default" className="w-full" size="sm">
                              {retrievingTrayId === tray.tray_id ? "Retrieving..." : "Retrieve to Station"}
                            </Button>
                          </CardContent>
                        </Card>)}
                    </div>
                    
                    {/* Pagination */}
                    {allTrays.length > 0 && <div className="flex items-center justify-center gap-2 mt-6 p-4 bg-muted/50 rounded-lg">
                        <Button onClick={() => setOffset(Math.max(0, offset - 10))} disabled={offset === 0} variant="outline" size="sm" className="gap-1">
                          <ChevronLeft size={16} />
                          Previous
                        </Button>
                        
                        <div className="flex items-center gap-2 px-4">
                          <span className="text-sm font-medium">
                            Showing {offset + 1}-{offset + allTrays.length}
                            {totalCount > 0 && ` of ${totalCount}`}
                          </span>
                        </div>

                        <Button onClick={() => setOffset(offset + 10)} disabled={allTrays.length < 10} variant="outline" size="sm" className="gap-1">
                          Next
                          <ChevronRight size={16} />
                        </Button>
                      </div>}
                  </>}
              </CardContent>
            </Card>}

          {/* In Station Section */}
          {!loading && (activeTab === "tray" && trayId || activeTab === "item" && itemId) && <Card className="border-2 shadow-lg">
              <CardHeader className="border-b bg-card pb-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg font-bold">In Station</CardTitle>
                  {(activeTab === "tray" ? stationItems : itemStationItems).length > 0 && <div className="flex items-center gap-2">
                      {activeTab === "tray" && <Badge variant="outline" className="text-sm py-1 px-2.5">
                          Tray: {stationItems[0].tray_id}
                        </Badge>}
                      {activeTab === "item" && <Badge variant="outline" className="text-sm py-1 px-2.5">
                          Item: {itemStationItems[0].item_id}
                        </Badge>}
                      <Badge className="text-sm py-1 px-2.5">
                        {(activeTab === "tray" ? stationItems : itemStationItems).length} item{(activeTab === "tray" ? stationItems : itemStationItems).length !== 1 ? "s" : ""}
                      </Badge>
                    </div>}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {(activeTab === "tray" ? stationItems : itemStationItems).length === 0 ? <div className="text-center py-12">
                    <p className="text-muted-foreground text-lg font-medium">No trays in station</p>
                  </div> : <div className="space-y-4">
                    {(activeTab === "tray" ? stationItems : itemStationItems).map(item => <Card key={`station-${item.id}-${item.item_id}-${item.tray_id}`} className="border-l-4 border-l-primary hover:shadow-lg transition-all hover:border-l-accent">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-xl font-bold">
                                {activeTab === "tray" ? item.item_id : item.tray_id}
                              </CardTitle>
                              <p className="text-base text-muted-foreground mt-1">{item.item_description}</p>
                              {activeTab === "item" && <p className="text-sm text-muted-foreground mt-1">Item: {item.item_id}</p>}
                              {item.station_friendly_name && <div className="mt-2">
                                  <Badge variant="secondary" className="text-sm py-1 px-3">
                                    📍 {item.station_friendly_name}
                                  </Badge>
                                </div>}
                            </div>
                            <Badge variant={item.tray_status === "active" ? "default" : "secondary"} className="ml-2 text-sm py-1 px-3">
                              {item.tray_status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 p-4 bg-accent/10 rounded-lg">
                            <div className="space-y-2">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold block">
                                Available Qty
                              </span>
                              <p className="font-bold text-lg text-primary">{item.available_quantity}</p>
                            </div>
                            <div className="space-y-2">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold block">
                                Inbound Date
                              </span>
                              <p className="font-bold text-sm">{item.inbound_date}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Button onClick={() => handleItemClick(item)} className="h-12 text-base font-semibold" disabled={item.tray_lockcount === 0}>
                              Inbound
                            </Button>
                            <Button onClick={() => handleReleaseTray(item.tray_id)} variant="outline" className="h-12 text-base font-semibold" disabled={item.tray_lockcount === 0}>
                              Release
                            </Button>
                          </div>
                        </CardContent>
                      </Card>)}
                  </div>}
              </CardContent>
            </Card>}

          {/* In Storage Section */}
          {!loading && (activeTab === "tray" && trayId || activeTab === "item" && itemId) && <Card className="border-2 shadow-lg">
              <CardHeader className="border-b bg-card pb-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg font-bold">In Storage</CardTitle>
                  {(activeTab === "tray" ? storageItems : itemStorageItems).length > 0 && <div className="flex items-center gap-2">
                      {activeTab === "tray" && <Badge variant="outline" className="text-sm py-1 px-2.5">
                          Tray: {storageItems[0].tray_id}
                        </Badge>}
                      {activeTab === "item" && <Badge variant="outline" className="text-sm py-1 px-2.5">
                          Item: {itemStorageItems[0].item_id}
                        </Badge>}
                      <Badge className="text-sm py-1 px-2.5">
                        {(activeTab === "tray" ? storageItems : itemStorageItems).length} on page
                      </Badge>
                    </div>}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {(activeTab === "tray" ? storageItems : itemStorageItems).length === 0 ? <div className="text-center py-12">
                    <p className="text-muted-foreground text-lg font-medium">No trays in storage</p>
                  </div> : <div className="space-y-4">
                    {(activeTab === "tray" ? storageItems : itemStorageItems).map(item => <Card key={`storage-${item.id}-${item.item_id}-${item.tray_id}`} className="border-l-4 border-l-secondary hover:shadow-lg transition-all hover:border-l-accent">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-xl font-bold">
                                {activeTab === "tray" ? item.item_id : item.tray_id}
                              </CardTitle>
                              <p className="text-base text-muted-foreground mt-1">{item.item_description}</p>
                              {activeTab === "item" && <p className="text-sm text-muted-foreground mt-1">Item: {item.item_id}</p>}
                            </div>
                            <Badge variant={item.tray_status === "active" ? "default" : "secondary"} className="ml-2 text-sm py-1 px-3">
                              {item.tray_status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 p-4 bg-accent/10 rounded-lg">
                            <div className="space-y-2">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold block">
                                Available Qty
                              </span>
                              <p className="font-bold text-lg text-foreground">{item.available_quantity}</p>
                            </div>
                            <div className="space-y-2">
                              <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold block">
                                Inbound Date
                              </span>
                              <p className="font-bold text-sm">{item.inbound_date}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <Button onClick={() => handleSelectStorageItem(item)} className="h-12 text-base font-semibold">
                              Select
                            </Button>
                            <Button onClick={() => handleRequestTray(item.tray_id)} variant="outline" className="h-12 text-base font-semibold">
                              Request
                            </Button>
                          </div>
                        </CardContent>
                      </Card>)}
                    
                    {/* Storage Pagination */}
                    {(activeTab === "tray" ? storageItems : itemStorageItems).length > 0 && <div className="flex items-center justify-center gap-2 mt-6 p-4 bg-muted/50 rounded-lg">
                        <Button onClick={() => {
                  setStorageOffset(Math.max(0, storageOffset - 10));
                }} disabled={storageOffset === 0} variant="outline" size="sm" className="gap-1">
                          <ChevronLeft size={16} />
                          Previous
                        </Button>
                        
                        <div className="flex items-center gap-2 px-4">
                          <span className="text-sm font-medium">
                            Showing {storageOffset + 1}-{storageOffset + (activeTab === "tray" ? storageItems : itemStorageItems).length}
                          </span>
                        </div>

                        <Button onClick={() => {
                  setStorageOffset(storageOffset + 10);
                }} disabled={(activeTab === "tray" ? storageItems : itemStorageItems).length < 10} variant="outline" size="sm" className="gap-1">
                          Next
                          <ChevronRight size={16} />
                        </Button>
                      </div>}
                  </div>}
              </CardContent>
            </Card>}
        </div>
      </div>

      {/* Ready Orders Dialog */}
      <Dialog open={showReadyDialog} onOpenChange={setShowReadyDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Ready Orders ({readyCount})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {readyOrders.length === 0 ? <div className="text-center py-12">
                <p className="text-muted-foreground">No ready orders</p>
              </div> : readyOrders.map(order => <Card key={order.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-lg">{order.tray_id}</p>
                        <p className="text-sm text-muted-foreground">{order.station_friendly_name}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            User: {order.user_id}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Station: {order.station_id}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleSelectOrder(order)} variant="default" size="sm">
                          Select
                        </Button>
                        <Button onClick={() => handleReleaseOrder(order.id)} disabled={releasingOrderId === order.id} variant="destructive" size="sm">
                          {releasingOrderId === order.id ? "Releasing..." : "Release"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending Orders Dialog */}
      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Pending Orders ({pendingCount})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {pendingOrders.length === 0 ? <div className="text-center py-12">
                <p className="text-muted-foreground">No pending orders</p>
              </div> : pendingOrders.map(order => <Card key={order.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-lg">{order.tray_id}</p>
                        <p className="text-sm text-muted-foreground">{order.station_friendly_name}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            User: {order.user_id}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Station: {order.station_id}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>)}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Selection Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {!transactionType ? "Select Transaction Type" : transactionType === 'inbound' ? "Inbound Transaction" : "Pickup Transaction"}
            </DialogTitle>
          </DialogHeader>

          {!transactionType ? <div className="space-y-4 py-4">
              {selectedOrder && <div className="p-4 bg-accent/10 rounded-lg space-y-2 mb-4">
                  <p className="text-sm font-medium">Tray: {selectedOrder.tray_id}</p>
                  <p className="text-sm text-muted-foreground">Station: {selectedOrder.station_friendly_name}</p>
                </div>}
              <Button onClick={() => handleTransactionTypeSelect('inbound')} variant="outline" className="w-full h-20 text-lg">
                Inbound
              </Button>
              <Button onClick={() => handleTransactionTypeSelect('pickup')} variant="outline" className="w-full h-20 text-lg">
                Pickup
              </Button>
            </div> : transactionType === 'inbound' ? <div className="space-y-4">
              {selectedOrder && <div className="p-4 bg-accent/10 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Tray: {selectedOrder.tray_id}</p>
                  <p className="text-sm text-muted-foreground">Station: {selectedOrder.station_friendly_name}</p>
                </div>}

              <div className="space-y-2">
                <Label htmlFor="inbound-item-id">Item ID</Label>
                <div className="flex gap-2">
                  <Input id="inbound-item-id" placeholder="Enter or scan item ID" value={transactionItemId} onChange={e => setTransactionItemId(e.target.value)} />
                  <Button variant="outline" size="icon" onClick={handleScanItemId}>
                    <Scan size={20} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center justify-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                    <Minus size={20} />
                  </Button>
                  <div className="text-3xl font-bold w-20 text-center">{quantity}</div>
                  <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>
                    <Plus size={20} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inbound-transaction-date">Transaction Date</Label>
                <Input id="inbound-transaction-date" type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setTransactionType(null)} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button onClick={handleSubmitInboundTransaction} className="flex-1">
                  Submit Inbound
                </Button>
              </div>
            </div> : <div className="space-y-4">
              {selectedOrder && <div className="p-4 bg-accent/10 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Tray: {selectedOrder.tray_id}</p>
                  <p className="text-sm text-muted-foreground">Station: {selectedOrder.station_friendly_name}</p>
                </div>}

              <div className="space-y-2">
                <Label>Select Product</Label>
                {trayItemsForPickup.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                    No items found in this tray
                  </div> : <div className="space-y-2">
                    {trayItemsForPickup.map(item => <Card key={item.id} className={`cursor-pointer border-2 transition-all ${selectedProductForPickup === item.item_id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`} onClick={() => setSelectedProductForPickup(item.item_id)}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold">{item.item_id}</p>
                              <p className="text-sm text-muted-foreground">{item.item_description}</p>
                            </div>
                            <Badge variant="secondary">
                              Qty: {item.available_quantity}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>)}
                  </div>}
              </div>

              {selectedProductForPickup && <>
                  <div className="space-y-2">
                    <Label>Quantity to Pick</Label>
                    <div className="flex items-center justify-center gap-4">
                      <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                        <Minus size={20} />
                      </Button>
                      <div className="text-3xl font-bold w-20 text-center">{quantity}</div>
                      <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>
                        <Plus size={20} />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickup-transaction-date">Transaction Date</Label>
                    <Input id="pickup-transaction-date" type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
                  </div>
                </>}

              <div className="flex gap-2">
                <Button onClick={() => setTransactionType(null)} variant="outline" className="flex-1">
                  Back
                </Button>
                <Button onClick={handleSubmitPickupTransaction} disabled={!selectedProductForPickup} className="flex-1">
                  Submit Pickup
                </Button>
              </div>
            </div>}
        </DialogContent>
      </Dialog>

      {/* Putaway Dialog */}
      <Dialog open={showPutawayDialog} onOpenChange={setShowPutawayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Putaway Transaction</DialogTitle>
          </DialogHeader>
          {selectedItem && <div className="space-y-4">
              <div className="p-4 bg-accent/10 rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Tray: {selectedItem.tray_id}</p>
                <p className="text-sm text-muted-foreground">Original Item: {selectedItem.item_id}</p>
                <p className="text-sm font-medium">Available: {selectedItem.available_quantity} units</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-id">Item ID</Label>
                <div className="flex gap-2">
                  <Input id="item-id" placeholder="Enter or scan item ID" value={transactionItemId} onChange={e => setTransactionItemId(e.target.value)} />
                  <Button variant="outline" size="icon" onClick={handleScanItemId}>
                    <Scan size={20} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center justify-center gap-4">
                  <Button variant="outline" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                    <Minus size={20} />
                  </Button>
                  <div className="text-3xl font-bold w-20 text-center">{quantity}</div>
                  <Button variant="outline" size="icon" onClick={() => setQuantity(quantity + 1)}>
                    <Plus size={20} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction-date">Transaction Date</Label>
                <Input id="transaction-date" type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} />
              </div>

              <Button onClick={handleSubmitTransaction} className="w-full">
                Submit Putaway
              </Button>
            </div>}
        </DialogContent>
      </Dialog>
    </div>;
};
export default AdhocMode;