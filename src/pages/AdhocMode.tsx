import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Search, Package, Minus, Plus, Scan, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Html5QrcodeScanner } from "html5-qrcode";
import { updateOrderBeforeTransaction } from "@/lib/transactionUtils";
import Scaffold from "@/components/Scaffold";
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

const BASE_URL = "https://robotmanagerv1test.qikpod.com";
const AdhocMode = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("item");
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
  const [quantity, setQuantity] = useState<number | string>(0);
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
  const [transactionType, setTransactionType] = useState<"inbound" | "pickup" | null>(null);
  const [trayItemsForPickup, setTrayItemsForPickup] = useState<TrayItem[]>([]);
  const [selectedProductForPickup, setSelectedProductForPickup] = useState<string | null>(null);
  const [showTimeDialog, setShowTimeDialog] = useState(false);
  const [selectedTrayForRequest, setSelectedTrayForRequest] = useState<string | null>(null);
  const [autoCompleteTime, setAutoCompleteTime] = useState<number>(10);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const qrScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerDivRef = useRef<HTMLDivElement>(null);
  const [lastTransactionType, setLastTransactionType] = useState<"inbound" | "pickup">("inbound");
  const [showTrayDetailDialog, setShowTrayDetailDialog] = useState(false);
  const [selectedTrayForDetail, setSelectedTrayForDetail] = useState<TrayItem | null>(null);

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
      const [readyResponse, pendingResponse] = await Promise.all([
        fetch(
          `${BASE_URL}/nanostore/orders?tray_status=tray_ready_to_use&status=active&order_by_field=updated_at&order_by_type=DESC`,
          {
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          },
        ),
        fetch(
          `${BASE_URL}/nanostore/orders?tray_status=inprogress&status=active&order_by_field=updated_at&order_by_type=DESC`,
          {
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          },
        ),
      ]);
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
      const response = await fetch(
        `${BASE_URL}/nanostore/orders?tray_status=tray_ready_to_use&status=active&order_by_field=updated_at&order_by_type=DESC`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
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
      const response = await fetch(
        `${BASE_URL}/nanostore/orders?tray_status=inprogress&status=active&order_by_field=updated_at&order_by_type=DESC`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
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
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to release order");
      }
      toast({
        title: "Success",
        description: "Order released successfully",
      });
      await fetchReadyOrders();
      await fetchCounts();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to release order",
        variant: "destructive",
      });
    } finally {
      setReleasingOrderId(null);
    }
  };
  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order);
    setTransactionItemId("");
    setQuantity(0);
    setSelectedProductForPickup(null);
    setTrayItemsForPickup([]);

    // Always ask user to choose transaction type
    setTransactionType(null);
    setShowTransactionDialog(true);

    // Fetch items for the tray
    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/trays_for_order?in_station=true&tray_id=${order.tray_id}&order_flow=fifo`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
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
        variant: "destructive",
      });
    }
  };
  const handleTransactionTypeSelect = async (type: "inbound" | "pickup") => {
    setTransactionType(type);
    if (type === "pickup" && selectedOrder) {
      // Fetch items for the tray
      try {
        const response = await fetch(
          `${BASE_URL}/nanostore/trays_for_order?in_station=true&tray_id=${selectedOrder.tray_id}&order_flow=fifo`,
          {
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
          },
        );
        if (response.ok) {
          const data = await response.json();
          if (data.records && data.records.length > 0) {
            setTrayItemsForPickup(data.records);
          } else {
            setTrayItemsForPickup([]);
            toast({
              title: "No Items",
              description: "No items found in this tray",
              variant: "destructive",
            });
          }
        } else {
          setTrayItemsForPickup([]);
          toast({
            title: "Error",
            description: "Failed to fetch tray items",
            variant: "destructive",
          });
        }
      } catch (error) {
        setTrayItemsForPickup([]);
        toast({
          title: "Error",
          description: "Failed to fetch tray items",
          variant: "destructive",
        });
      }
    }
  };
  const handleSubmitInboundTransaction = async () => {
    if (!selectedOrder || !transactionItemId.trim()) {
      toast({
        title: "Error",
        description: "Please enter item ID",
        variant: "destructive",
      });
      return;
    }
    // Remember this transaction type for next time
    setLastTransactionType("inbound");
    try {
      const userId = localStorage.getItem("userId") || "1";
      let orderId = selectedOrder.id;

      // First, try to fetch existing order
      const fetchOrderResponse = await fetch(
        `${BASE_URL}/nanostore/orders?tray_id=${selectedOrder.tray_id}&tray_status=tray_ready_to_use&user_id=${userId}&order_by_field=updated_at&order_by_type=ASC&num_records=1`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );

      if (fetchOrderResponse.ok) {
        const orderData = await fetchOrderResponse.json();
        if (orderData.records && orderData.records.length > 0) {
          orderId = orderData.records[0].id;
        }
      }

      // If no order found, create one
      if (!orderId) {
        const createOrderResponse = await fetch(
          `${BASE_URL}/nanostore/orders?tray_id=${selectedOrder.tray_id}&user_id=${userId}&auto_complete_time=10`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
            body: "",
          },
        );

        if (!createOrderResponse.ok) {
          throw new Error("Failed to create order");
        }

        const newOrderData = await createOrderResponse.json();
        orderId = newOrderData.record_id || newOrderData.id;
      }

      // Update order with user_id
      const patchResponse = await fetch(`${BASE_URL}/nanostore/orders?record_id=${orderId}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: parseInt(userId) }),
      });

      if (!patchResponse.ok) {
        throw new Error("Failed to update order");
      }

      // Update order with user_id before transaction
      await updateOrderBeforeTransaction(orderId, userId, localStorage.getItem("authToken") || "");

      // Then proceed with transaction
      const response = await fetch(
        `${BASE_URL}/nanostore/transaction?order_id=${orderId}&item_id=${transactionItemId}&transaction_item_quantity=${quantity}&transaction_type=inbound&transaction_date=${transactionDate}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: "",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to submit transaction");
      }
      toast({
        title: "Success",
        description: "Inbound transaction completed successfully",
      });
      setShowTransactionDialog(false);
      setSelectedOrder(null);
      setTransactionType(null);
      await fetchReadyOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit inbound transaction",
        variant: "destructive",
      });
    }
  };
  const handleSubmitPickupTransaction = async () => {
    if (!selectedOrder || !selectedProductForPickup) {
      toast({
        title: "Error",
        description: "Please select a product",
        variant: "destructive",
      });
      return;
    }
    // Remember this transaction type for next time
    setLastTransactionType("pickup");
    try {
      const userId = localStorage.getItem("userId") || "1";
      let orderId = selectedOrder.id;

      // First, try to fetch existing order
      const fetchOrderResponse = await fetch(
        `${BASE_URL}/nanostore/orders?tray_id=${selectedOrder.tray_id}&tray_status=tray_ready_to_use&user_id=${userId}&order_by_field=updated_at&order_by_type=ASC&num_records=1`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );

      if (fetchOrderResponse.ok) {
        const orderData = await fetchOrderResponse.json();
        if (orderData.records && orderData.records.length > 0) {
          orderId = orderData.records[0].id;
        }
      }

      // If no order found, create one
      if (!orderId) {
        const createOrderResponse = await fetch(
          `${BASE_URL}/nanostore/orders?tray_id=${selectedOrder.tray_id}&user_id=${userId}&auto_complete_time=10`,
          {
            method: "POST",
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${localStorage.getItem("authToken")}`,
            },
            body: "",
          },
        );

        if (!createOrderResponse.ok) {
          throw new Error("Failed to create order");
        }

        const newOrderData = await createOrderResponse.json();
        orderId = newOrderData.record_id || newOrderData.id;
      }

      // Update order with user_id
      const patchResponse = await fetch(`${BASE_URL}/nanostore/orders?record_id=${orderId}`, {
        method: "PATCH",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: parseInt(userId) }),
      });

      if (!patchResponse.ok) {
        throw new Error("Failed to update order");
      }

      // Then proceed with transaction
      const response = await fetch(
        `${BASE_URL}/nanostore/transaction?order_id=${orderId}&item_id=${selectedProductForPickup}&transaction_item_quantity=-${quantity}&transaction_type=outbound&transaction_date=${transactionDate}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: "",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to submit transaction");
      }
      toast({
        title: "Success",
        description: "Pickup transaction completed successfully",
      });
      setShowTransactionDialog(false);
      setSelectedOrder(null);
      setTransactionType(null);
      await fetchReadyOrders();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit pickup transaction",
        variant: "destructive",
      });
    }
  };

  const handleRequestTrayWithTime = (trayId: string) => {
    setSelectedTrayForRequest(trayId);
    setAutoCompleteTime(10);
    setShowTimeDialog(true);
  };

  const handleConfirmRequestTray = async () => {
    if (!selectedTrayForRequest) return;

    const userId = localStorage.getItem("userId") || "1";
    setRetrievingTrayId(selectedTrayForRequest);
    setShowTimeDialog(false);

    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/orders?tray_id=${selectedTrayForRequest}&user_id=${userId}&auto_complete_time=${autoCompleteTime}`,
        {
          method: "POST",
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: "",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to request tray");
      }

      toast({
        title: "Success",
        description: `Tray ${selectedTrayForRequest} requested successfully (${autoCompleteTime} min)`,
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
        variant: "destructive",
      });
    } finally {
      setRetrievingTrayId(null);
      setSelectedTrayForRequest(null);
    }
  };
  const fetchAllTrays = async () => {
    setLoading(true);
    try {
      const hasItemParam = showEmptyBins ? "false" : "true";
      const dividerParam = trayDividerFilter !== null ? `&tray_divider=${trayDividerFilter}` : "";
      const response = await fetch(
        `${BASE_URL}/nanostore/trays_for_order?in_station=false${dividerParam}&has_item=${hasItemParam}&num_records=10&offset=${offset}&order_flow=fifo`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
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
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const fetchStationInfo = async (trayId: string) => {
    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/orders?tray_id=${trayId}&tray_status=tray_ready_to_use&status=active&order_by_field=updated_at&order_by_type=DESC&num_records=1&offset=0`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
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
      const response = await fetch(
        `${BASE_URL}/nanostore/trays_for_order?in_station=true&tray_id=${trayId}&num_records=10&offset=0`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
      if (!response.ok) {
        setStationItems([]);
        return;
      }
      const data = await response.json();
      const items = data.records || [];

      // Fetch station info for each tray
      const itemsWithStation = await Promise.all(
        items.map(async (item: TrayItem) => {
          const stationName = await fetchStationInfo(item.tray_id);
          return {
            ...item,
            station_friendly_name: stationName,
          };
        }),
      );
      setStationItems(itemsWithStation);
    } catch (error) {
      setStationItems([]);
    }
  };
  const fetchStorageItems = async () => {
    if (!trayId.trim()) return;
    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/trays_for_order?in_station=false&tray_id=${trayId}&num_records=10&offset=${storageOffset}`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
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
      const response = await fetch(
        `${BASE_URL}/nanostore/trays_for_order?in_station=true&item_id=${itemId}&num_records=10&offset=0&order_flow=fifo`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
      if (!response.ok) {
        setItemStationItems([]);
        return;
      }
      const data = await response.json();
      const items = data.records || [];

      // Fetch station info for each tray
      const itemsWithStation = await Promise.all(
        items.map(async (item: TrayItem) => {
          const stationName = await fetchStationInfo(item.tray_id);
          return {
            ...item,
            station_friendly_name: stationName,
          };
        }),
      );
      setItemStationItems(itemsWithStation);
    } catch (error) {
      setItemStationItems([]);
    }
  };
  const fetchItemStorageItems = async () => {
    if (!itemId.trim()) return;
    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/trays_for_order?in_station=false&item_id=${itemId}&num_records=10&offset=${storageOffset}&order_flow=fifo`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
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
        variant: "destructive",
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
        variant: "destructive",
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
        variant: "destructive",
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
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };
  const handleRequestTray = async (requestTrayId: string) => {
    handleRequestTrayWithTime(requestTrayId);
  };
  const handleSelectStationItem = async (item: TrayItem) => {
    // Store the item for later use in transaction
    setSelectedOrder({ tray_id: item.tray_id } as Order);
    // Always ask user to choose transaction type
    setTransactionType(null);
    setShowTransactionDialog(true);
  };
  const handleReleaseTray = async (trayId: string) => {
    const userId = localStorage.getItem("userId") || "1";
    try {
      const response = await fetch(
        `${BASE_URL}/nanostore/orders?tray_id=${trayId}&tray_status=tray_ready_to_use&status=active&user_id=${userId}&order_by_field=updated_at&order_by_type=DESC`,
        {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        },
      );
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
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        });
        if (!patchResponse.ok) {
          throw new Error("Failed to release tray");
        }
        toast({
          title: "Success",
          description: `Tray ${trayId} released successfully`,
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
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to release tray",
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
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
          body: "",
        },
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
      setQuantity(0);

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
        variant: "destructive",
      });
    }
  };
  const handleScanItemId = () => {
    setShowQrScanner(true);
    setIsScanning(true);
  };

  const stopScanning = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.clear().catch((err) => console.error("Failed to clear scanner:", err));
      qrScannerRef.current = null;
    }
    setIsScanning(false);
    setShowQrScanner(false);
  };

  const processBarcodeFromAPI = async (barcode: string) => {
    try {
      const response = await fetch(`${BASE_URL}/nanostore/barcode?barcode=${encodeURIComponent(barcode)}`, {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch barcode data");
      }

      const data = await response.json();

      if (data.status === "success" && data.records && data.records.length > 0) {
        const record = data.records[0];
        setTransactionItemId(record.product_id);
        setQuantity(record.product_quantity);

        toast({
          title: "Barcode Scanned",
          description: `Product: ${record.product_id}, Qty: ${record.product_quantity}`,
        });
      } else {
        throw new Error("No data found for barcode");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process barcode",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (showQrScanner && isScanning) {
      const timeoutId = setTimeout(() => {
        const readerElement = document.getElementById("qr-reader");

        if (readerElement) {
          try {
            const scanner = new Html5QrcodeScanner(
              "qr-reader",
              {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
                rememberLastUsedCamera: true,
                showTorchButtonIfSupported: true,
              },
              false,
            );

            scanner.render(
              async (decodedText) => {
                await processBarcodeFromAPI(decodedText);
                stopScanning();
              },
              (errorMessage) => {
                // Ignore routine scanning errors
              },
            );

            qrScannerRef.current = scanner;
          } catch (error) {
            console.error("QR Scanner Error:", error);
            toast({
              title: "Scanner Error",
              description: "Failed to initialize camera. Please check permissions.",
              variant: "destructive",
            });
          }
        }
      }, 300);

      return () => {
        clearTimeout(timeoutId);
        if (qrScannerRef.current) {
          qrScannerRef.current.clear().catch((err) => console.error("Cleanup error:", err));
          qrScannerRef.current = null;
        }
      };
    }
  }, [showQrScanner, isScanning]);
  return (
    <Scaffold
      title="Adhoc Mode"
      showBack
      icon={<Package className="text-primary-foreground" size={18} />}
      className="p-2 bg-gradient-to-b from-background to-accent/5"
      actions={
        <div className="flex gap-3">
          <Card
            className="cursor-pointer hover:shadow-md transition-all border hover:border-primary/50"
            onClick={() => {
              fetchReadyOrders();
              setShowReadyDialog(true);
            }}
          >
            <CardContent className="p-2 px-3">
              <div className="flex items-center gap-2">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-medium">Ready</p>
                  <p className="text-lg font-bold text-foreground">{readyCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-all border hover:border-primary/50"
            onClick={() => {
              fetchPendingOrders();
              setShowPendingDialog(true);
            }}
          >
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
      }
    >
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
                <TabsTrigger value="item">Item Search</TabsTrigger>
                <TabsTrigger value="tray">Tray Search</TabsTrigger>

              </TabsList>

              <TabsContent value="tray" className="space-y-3">
                <Label className="text-base font-semibold">Tray ID</Label>
                <Input
                  value={trayId}
                  onChange={(e) => {
                    setTrayId(e.target.value);
                    if (!e.target.value.trim()) {
                      setStationItems([]);
                      setStorageItems([]);
                      setStorageOffset(0);
                      setStorageTotalCount(0);
                    }
                  }}
                  className="h-14 text-lg px-5 border-2"
                  placeholder="Enter Tray ID"
                />

                {!trayId.trim() && (
                  <div className="space-y-3 mt-4">
                    <Label className="text-base font-semibold">Filters</Label>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        className={`h-9 rounded-md px-3 ${trayDividerFilter === null && !showEmptyBins ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setTrayDividerFilter(null);
                          setShowEmptyBins(false);
                          setOffset(0);
                        }}
                      >
                        All Trays
                      </Button>
                      <Button
                        className={`h-9 rounded-md px-3 ${trayDividerFilter === 0 ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setTrayDividerFilter(0);
                          setOffset(0);
                        }}
                      >
                        Divider: 0
                      </Button>
                      <Button
                        className={`h-9 rounded-md px-3 ${trayDividerFilter === 4 ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setTrayDividerFilter(4);
                          setOffset(0);
                        }}
                      >
                        Divider: 4
                      </Button>
                      <Button
                        className={`h-9 rounded-md px-3 ${trayDividerFilter === 6 ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setTrayDividerFilter(6);
                          setOffset(0);
                        }}
                      >
                        Divider: 6
                      </Button>
                      <Button
                        className={`h-9 rounded-md px-3 ${showEmptyBins ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setShowEmptyBins(!showEmptyBins);
                          setOffset(0);
                        }}
                      >
                        Empty Bins Only
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="item" className="space-y-3">
                <Label className="text-base font-semibold">Item ID</Label>
                <Input
                  value={itemId}
                  onChange={(e) => {
                    setItemId(e.target.value);
                    if (!e.target.value.trim()) {
                      setItemStationItems([]);
                      setItemStorageItems([]);
                      setStorageOffset(0);
                      setStorageTotalCount(0);
                    }
                  }}
                  className="h-14 text-lg px-5 border-2"
                  placeholder="Enter Item ID"
                />

                {!itemId.trim() && (
                  <div className="space-y-3 mt-4">
                    <Label className="text-base font-semibold">Filters</Label>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        className={`h-9 rounded-md px-3 ${trayDividerFilter === null && !showEmptyBins ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setTrayDividerFilter(null);
                          setShowEmptyBins(false);
                          setOffset(0);
                        }}
                      >
                        All Trays
                      </Button>
                      <Button
                        className={`h-9 rounded-md px-3 ${trayDividerFilter === 0 ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setTrayDividerFilter(0);
                          setOffset(0);
                        }}
                      >
                        Divider: 0
                      </Button>
                      <Button
                        className={`h-9 rounded-md px-3 ${trayDividerFilter === 4 ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setTrayDividerFilter(4);
                          setOffset(0);
                        }}
                      >
                        Divider: 4
                      </Button>
                      <Button
                        className={`h-9 rounded-md px-3 ${trayDividerFilter === 6 ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setTrayDividerFilter(6);
                          setOffset(0);
                        }}
                      >
                        Divider: 6
                      </Button>
                      <Button
                        className={`h-9 rounded-md px-3 ${showEmptyBins ? "bg-primary text-white hover:bg-primary/90" : "border border-input bg-background text-black hover:bg-accent hover:text-black"}`}
                        onClick={() => {
                          setShowEmptyBins(!showEmptyBins);
                          setOffset(0);
                        }}
                      >
                        Empty Bins Only
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <Card className="border-2 shadow-lg">
            <CardContent className="p-16 text-center">
              <div className="animate-pulse space-y-4">
                <Package className="mx-auto text-primary" size={56} />
                <p className="text-muted-foreground font-semibold text-lg">Loading items...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* All Trays List (when text field is empty) */}
        {!loading && ((activeTab === "tray" && !trayId.trim()) || (activeTab === "item" && !itemId.trim())) && (
          <Card className="border-2 shadow-lg">
            <CardHeader className="border-b bg-card pb-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg font-bold">
                  {showEmptyBins ? "Empty Bins" : "Trays in Storage"}
                </CardTitle>
                <Badge className="text-sm py-1 px-2.5">{totalCount} total</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {allTrays.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg font-medium">No trays found</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allTrays.map((tray) => (
                      <Card
                        key={`all-tray-${tray.id}`}
                        className="border-2 hover:shadow-lg transition-all hover:border-primary/50"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-lg font-bold">{tray.tray_id}</CardTitle>
                              {tray.item_description && (
                                <p className="text-sm text-muted-foreground mt-1">{tray.item_description}</p>
                              )}
                              {tray.item_id && (
                                <p className="text-xs text-muted-foreground mt-1">Item: {tray.item_id}</p>
                              )}
                            </div>
                            <Badge className="ml-2 text-xs py-1 px-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                              {tray.tray_status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Tray Image - Clickable */}
                          <div
                            className="relative w-full h-40 rounded-lg overflow-hidden border-2 border-border cursor-pointer hover:border-primary transition-all"
                            onClick={() => {
                              setSelectedTrayForDetail(tray);
                              setShowTrayDetailDialog(true);
                            }}
                          >
                            <img
                              src={`https://amsstores1.blr1.digitaloceanspaces.com/${tray.tray_id}.jpg`}
                              alt={`Tray ${tray.tray_id}`}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src =
                                  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%239ca3af">No Image Available</text></svg>';
                              }}
                            />
                            <div className="absolute inset-0 bg-black/20 hover:bg-black/10 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                              <p className="text-white font-semibold text-sm">Click to view details</p>
                            </div>
                          </div>

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
                          {tray.inbound_date && (
                            <div className="text-xs text-muted-foreground">Inbound: {tray.inbound_date}</div>
                          )}
                          <Button
                            onClick={() => handleRequestTray(tray.tray_id)}
                            disabled={retrievingTrayId === tray.tray_id}
                            className="w-full h-9 rounded-md px-3"
                          >
                            {retrievingTrayId === tray.tray_id ? "Retrieving..." : "Retrieve to Station"}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Pagination */}
                  {allTrays.length > 0 && (
                    <div className="flex items-center justify-center gap-2 mt-6 p-4 bg-muted/50 rounded-lg">
                      <Button
                        onClick={() => setOffset(Math.max(0, offset - 10))}
                        disabled={offset === 0}
                        className="gap-1 h-9 rounded-md px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </Button>

                      <div className="flex items-center gap-2 px-4">
                        <span className="text-sm font-medium">
                          Showing {offset + 1}-{offset + allTrays.length}
                          {totalCount > 0 && ` of ${totalCount}`}
                        </span>
                      </div>

                      <Button
                        onClick={() => setOffset(offset + 10)}
                        disabled={allTrays.length < 10}
                        className="gap-1 h-9 rounded-md px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      >
                        Next
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* In Station Section */}
        {!loading && ((activeTab === "tray" && trayId) || (activeTab === "item" && itemId)) && (
          <Card className="border-2 shadow-lg">
            <CardHeader className="border-b bg-card pb-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg font-bold">In Station</CardTitle>
                {(activeTab === "tray" ? stationItems : itemStationItems).length > 0 && (
                  <div className="flex items-center gap-2">
                    {activeTab === "tray" && (
                      <Badge className="text-sm py-1 px-2.5 text-foreground">
                        Tray: {stationItems[0].tray_id}
                      </Badge>
                    )}
                    {activeTab === "item" && (
                      <Badge className="text-sm py-1 px-2.5 text-foreground">
                        Item: {itemStationItems[0].item_id}
                      </Badge>
                    )}
                    <Badge className="text-sm py-1 px-2.5">
                      {(activeTab === "tray" ? stationItems : itemStationItems).length} item
                      {(activeTab === "tray" ? stationItems : itemStationItems).length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {(activeTab === "tray" ? stationItems : itemStationItems).length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg font-medium">No trays in station</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(activeTab === "tray" ? stationItems : itemStationItems).map((item) => (
                    <Card
                      key={`station-${item.id}-${item.item_id}-${item.tray_id}`}
                      className="border-l-4 border-l-primary hover:shadow-lg transition-all hover:border-l-accent"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl font-bold">
                              {activeTab === "tray" ? item.item_id : item.tray_id}
                            </CardTitle>
                            <p className="text-base text-muted-foreground mt-1">{item.item_description}</p>
                            {activeTab === "item" && (
                              <p className="text-sm text-muted-foreground mt-1">Item: {item.item_id}</p>
                            )}
                            {item.station_friendly_name && (
                              <div className="mt-2">
                                <Badge className="text-sm py-1 px-3 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                  📌 {item.station_friendly_name}
                                </Badge>
                              </div>
                            )}
                          </div>
                          <Badge
                            className={`ml-2 text-sm py-1 px-3 ${item.tray_status === "active" ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/80" : "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                          >
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
                          <Button
                            onClick={() => handleReleaseTray(item.tray_id)}
                            className="h-12 text-base font-semibold border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                            disabled={item.tray_lockcount === 0}
                          >
                            Release
                          </Button>
                          <Button
                            onClick={() => handleSelectStationItem(item)}
                            className="h-12 text-base font-semibold"
                            disabled={item.tray_lockcount === 0}
                          >
                            Select
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* In Storage Section */}
        {!loading && ((activeTab === "tray" && trayId) || (activeTab === "item" && itemId)) && (
          <Card className="border-2 shadow-lg">
            <CardHeader className="border-b bg-card pb-3 px-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg font-bold">In Storage</CardTitle>
                {(activeTab === "tray" ? storageItems : itemStorageItems).length > 0 && (
                  <div className="flex items-center gap-2">
                    {activeTab === "tray" && (
                      <Badge className="text-sm py-1 px-2.5  text-white">
                        Tray: {storageItems[0].tray_id}
                      </Badge>
                    )}
                    {activeTab === "item" && (
                      <Badge className="text-sm py-1 px-2.5 text-white">
                        Item: {itemStorageItems[0].item_id}
                      </Badge>
                    )}
                    <Badge className="text-sm py-1 px-2.5">
                      {(activeTab === "tray" ? storageItems : itemStorageItems).length} on page
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {(activeTab === "tray" ? storageItems : itemStorageItems).length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg font-medium">No trays in storage</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(activeTab === "tray" ? storageItems : itemStorageItems).map((item) => (
                    <Card
                      key={`storage-${item.id}-${item.item_id}-${item.tray_id}`}
                      className="border-l-4 border-l-secondary hover:shadow-lg transition-all hover:border-l-accent"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-xl font-bold">
                              {activeTab === "tray" ? item.item_id : item.tray_id}
                            </CardTitle>
                            <p className="text-base text-muted-foreground mt-1">{item.item_description}</p>
                            {activeTab === "item" && (
                              <p className="text-sm text-muted-foreground mt-1">Item: {item.item_id}</p>
                            )}
                          </div>
                          <Badge
                            className={`ml-2 text-sm py-1 px-3 ${item.tray_status === "active" ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/80" : "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                          >
                            {item.tray_status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Tray Image - Clickable */}
                        <div
                          className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-border cursor-pointer hover:border-primary transition-all"
                          onClick={() => {
                            setSelectedTrayForDetail(item);
                            setShowTrayDetailDialog(true);
                          }}
                        >
                          <img
                            src={`https://amsstores1.blr1.digitaloceanspaces.com/${item.tray_id}.jpg`}
                            alt={`Tray ${item.tray_id}`}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src =
                                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%239ca3af">No Image Available</text></svg>';
                            }}
                          />
                          <div className="absolute inset-0 bg-black/20 hover:bg-black/10 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                            <p className="text-white font-semibold text-lg">Click to view details</p>
                          </div>
                        </div>

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
                        <Button
                          onClick={() => handleRequestTray(item.tray_id)}
                          disabled={retrievingTrayId === item.tray_id}
                          className="w-full h-12 text-base font-semibold"
                        >
                          {retrievingTrayId === item.tray_id ? "Requesting..." : "Request Tray to Station"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Storage Pagination */}
                  {(activeTab === "tray" ? storageItems : itemStorageItems).length > 0 && (
                    <div className="flex items-center justify-center gap-2 mt-6 p-4 bg-muted/50 rounded-lg">
                      <Button
                        onClick={() => {
                          setStorageOffset(Math.max(0, storageOffset - 10));
                        }}
                        disabled={storageOffset === 0}
                        className="gap-1 h-9 rounded-md px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      >
                        <ChevronLeft size={16} />
                        Previous
                      </Button>

                      <div className="flex items-center gap-2 px-4">
                        <span className="text-sm font-medium">
                          Showing {storageOffset + 1}-
                          {storageOffset + (activeTab === "tray" ? storageItems : itemStorageItems).length}
                        </span>
                      </div>

                      <Button
                        onClick={() => {
                          setStorageOffset(storageOffset + 10);
                        }}
                        disabled={(activeTab === "tray" ? storageItems : itemStorageItems).length < 10}
                        className="gap-1 h-9 rounded-md px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                      >
                        Next
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>


      {/* Ready Orders Dialog */}
      <Dialog open={showReadyDialog} onOpenChange={setShowReadyDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Ready Orders ({readyCount})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {readyOrders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No ready orders</p>
              </div>
            ) : (
              readyOrders.map((order) => (
                <Card key={order.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-bold text-lg">{order.tray_id}</p>
                          <p className="text-sm text-muted-foreground">{order.station_friendly_name}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            onClick={() => handleReleaseOrder(order.id)}
                            disabled={releasingOrderId === order.id}
                            className="h-9 rounded-md px-3 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {releasingOrderId === order.id ? "Releasing..." : "Release"}
                          </Button>
                          <Button onClick={() => handleSelectOrder(order)} className="h-9 rounded-md px-3 bg-primary text-primary-foreground hover:bg-primary/90">
                            Select
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="text-xs border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                          User: {order.user_id}
                        </Badge>
                        <Badge className="text-xs text-foreground">
                          Station: {order.station_id}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
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
            {pendingOrders.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No pending orders</p>
              </div>
            ) : (
              pendingOrders.map((order) => (
                <Card key={order.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="font-bold text-lg">{order.tray_id}</p>
                        <p className="text-sm text-muted-foreground">{order.station_friendly_name}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="text-xs border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                          User: {order.user_id}
                        </Badge>
                        <Badge className="text-xs text-foreground">
                          Station: {order.station_id}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog - Inbound or Pickup Selection */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-black">
              {!transactionType
                ? "Select Transaction Type"
                : transactionType === "inbound"
                  ? "Inbound Transaction"
                  : "Pickup Transaction"}
            </DialogTitle>
          </DialogHeader>

          {!transactionType ? (
            <div className="space-y-4 py-4">
              {selectedOrder && (
                <div className="p-4 bg-accent/10 rounded-lg space-y-2 mb-4">
                  <p className="text-sm font-medium">Tray: {selectedOrder.tray_id}</p>
                  <p className="text-sm text-muted-foreground">Station: {selectedOrder.station_friendly_name}</p>
                </div>
              )}
              <Button
                onClick={() => handleTransactionTypeSelect("inbound")}
                className="w-full h-20 text-lg border border-input bg-background text-black hover:bg-accent hover:text-black"
              >
                Inbound
              </Button>
              <Button
                onClick={() => handleTransactionTypeSelect("pickup")}
                className="w-full h-20 text-lg border border-input bg-background text-black hover:bg-accent hover:text-black"
              >
                Pickup
              </Button>
            </div>
          ) : transactionType === "inbound" ? (
            <div className="space-y-4">
              {selectedOrder && (
                <div className="p-4 bg-accent/10 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Tray: {selectedOrder.tray_id}</p>
                  <p className="text-sm text-muted-foreground">Station: {selectedOrder.station_friendly_name}</p>
                </div>
              )}

              <div className="space-y-3">
                <Label htmlFor="inbound-item-id">Item ID</Label>
                <Input
                  id="inbound-item-id"
                  placeholder="Enter item ID manually"
                  value={transactionItemId}
                  onChange={(e) => setTransactionItemId(e.target.value)}
                />
                <Button className="w-full bg-[#378a84] text-white hover:bg-[#378a84]/90" onClick={handleScanItemId}>
                  <Scan className="mr-2" size={20} />
                  Scan Product
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    className="h-10 w-10 border border-input bg-background text-black hover:bg-accent hover:text-black"
                    onClick={() => {
                      const current = typeof quantity === "string" ? 0 : quantity;
                      setQuantity(Math.max(0, current - 1));
                    }}
                    disabled={typeof quantity === "number" && quantity <= 0}
                  >
                    <Minus size={20} />
                  </Button>
                  <Input
                    type="number"
                    className="w-24 text-center text-xl font-bold"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setQuantity("");
                      } else {
                        const numVal = parseInt(val);
                        if (!isNaN(numVal) && numVal >= 0) {
                          setQuantity(numVal);
                        }
                      }
                    }}
                  />
                  <Button
                    className="h-10 w-10 border border-input bg-background text-black hover:bg-accent hover:text-black"
                    onClick={() => {
                      const current = typeof quantity === "string" ? 0 : quantity;
                      setQuantity(current + 1);
                    }}
                  >
                    <Plus size={20} />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inbound-transaction-date">Transaction Date</Label>
                <Input
                  id="inbound-transaction-date"
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setTransactionType(null)} className="flex-1 border border-input bg-background text-black hover:bg-accent hover:text-black">
                  Back
                </Button>
                <Button onClick={handleSubmitInboundTransaction} className="flex-1">
                  Submit Inbound
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedOrder && (
                <div className="p-4 bg-accent/10 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Tray: {selectedOrder.tray_id}</p>
                  <p className="text-sm text-muted-foreground">Station: {selectedOrder.station_friendly_name}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Select Product</Label>
                <div className="space-y-2 mb-4">
                  <Label htmlFor="pickup-item-id">Or Enter Item ID Manually</Label>
                  <Input
                    id="pickup-item-id"
                    placeholder="Enter item ID"
                    value={selectedProductForPickup || ""}
                    onChange={(e) => setSelectedProductForPickup(e.target.value)}
                  />
                </div>
                {trayItemsForPickup.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No items found in this tray</div>
                ) : (
                  <div className="space-y-2">
                    {trayItemsForPickup.map((item) => (
                      <Card
                        key={item.id}
                        className={`cursor-pointer border-2 transition-all ${selectedProductForPickup === item.item_id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                        onClick={() => setSelectedProductForPickup(item.item_id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold">{item.item_id}</p>
                              <p className="text-sm text-muted-foreground">{item.item_description}</p>
                            </div>
                            <Badge className="border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">Qty: {item.available_quantity}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {selectedProductForPickup && (
                <>
                  <div className="space-y-2">
                    <Label>Quantity to Pick</Label>
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        className="h-10 w-10 border border-input bg-background text-black hover:bg-accent hover:text-black"
                        onClick={() => {
                          const current = typeof quantity === "string" ? 0 : quantity;
                          setQuantity(Math.max(0, current - 1));
                        }}
                        disabled={typeof quantity === "number" && quantity <= 0}
                      >
                        <Minus size={20} />
                      </Button>
                      <Input
                        type="number"
                        className="w-24 text-center text-xl font-bold"
                        value={quantity}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setQuantity("");
                          } else {
                            const numVal = parseInt(val);
                            if (!isNaN(numVal) && numVal >= 0) {
                              setQuantity(numVal);
                            }
                          }
                        }}
                      />
                      <Button
                        className="h-10 w-10 border border-input bg-background text-black hover:bg-accent hover:text-black"
                        onClick={() => {
                          const current = typeof quantity === "string" ? 0 : quantity;
                          setQuantity(current + 1);
                        }}
                      >
                        <Plus size={20} />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pickup-transaction-date">Transaction Date</Label>
                    <Input
                      id="pickup-transaction-date"
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button onClick={() => setTransactionType(null)} className="flex-1 border border-input bg-background text-black hover:bg-accent hover:text-black">
                  Back
                </Button>
                <Button onClick={handleSubmitPickupTransaction} disabled={!selectedProductForPickup} className="flex-1">
                  Submit Pickup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Time Input Dialog for Request Tray */}
      <Dialog open={showTimeDialog} onOpenChange={setShowTimeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Tray to Station</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-accent/10 rounded-lg">
              <p className="text-sm font-medium">Tray: {selectedTrayForRequest}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-complete-time">Time to Stay (minutes)</Label>
              <Input
                id="auto-complete-time"
                type="number"
                min="1"
                value={autoCompleteTime}
                onChange={(e) => setAutoCompleteTime(parseInt(e.target.value) || 2)}
                placeholder="Enter time in minutes"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={() => setShowTimeDialog(false)} className="flex-1 border border-input bg-background text-black hover:bg-accent hover:text-black">
                Cancel
              </Button>
              <Button onClick={handleConfirmRequestTray} className="flex-1">
                Confirm Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Putaway Dialog */}
      <Dialog open={showPutawayDialog} onOpenChange={setShowPutawayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Putaway Transaction</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className="p-4 bg-accent/10 rounded-lg space-y-2">
                <p className="text-sm text-muted-foreground">Tray: {selectedItem.tray_id}</p>
                <p className="text-sm text-muted-foreground">Original Item: {selectedItem.item_id}</p>
                <p className="text-sm font-medium">Available: {selectedItem.available_quantity} units</p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="item-id">Item ID</Label>
                <Input
                  id="item-id"
                  placeholder="Enter item ID manually"
                  value={transactionItemId}
                  onChange={(e) => setTransactionItemId(e.target.value)}
                />
                <Button className="w-full bg-[#378a84] text-white hover:bg-[#378a84]/90" onClick={handleScanItemId}>
                  <Scan className="mr-2 " size={20} />
                  Scan Product
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center justify-center gap-4">
                  <Button
                    className="h-10 w-10 border border-input bg-background text-black hover:bg-accent hover:text-black"
                    onClick={() => {
                      const current = typeof quantity === "string" ? 0 : quantity;
                      setQuantity(Math.max(0, current - 1));
                    }}
                    disabled={typeof quantity === "number" && quantity <= 0}
                  >
                    <Minus size={20} />
                  </Button>
                  <Input
                    type="number"
                    className="w-24 text-center text-xl font-bold"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setQuantity("");
                      } else {
                        const numVal = parseInt(val);
                        if (!isNaN(numVal) && numVal >= 0) {
                          setQuantity(numVal);
                        }
                      }
                    }}
                  />
                  <Button
                    className="h-10 w-10 border border-input bg-background text-black hover:bg-accent hover:text-black"
                    onClick={() => {
                      const current = typeof quantity === "string" ? 0 : quantity;
                      setQuantity(current + 1);
                    }}
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

      {/* QR Code Scanner Dialog */}
      <Dialog
        open={showQrScanner}
        onOpenChange={(open) => {
          if (!open) stopScanning();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Scan QR Code</DialogTitle>
              <Button className="h-10 w-10 hover:bg-accent hover:text-accent-foreground" onClick={stopScanning}>
                <X size={20} />
              </Button>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            <div id="qr-reader" ref={scannerDivRef} className="w-full"></div>
            <p className="text-sm text-muted-foreground text-center">Position the QR code within the camera frame</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tray Detail Dialog */}
      <Dialog open={showTrayDetailDialog} onOpenChange={setShowTrayDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Tray Details - {selectedTrayForDetail?.tray_id}</DialogTitle>
          </DialogHeader>

          {selectedTrayForDetail && (
            <div className="space-y-6">
              {/* Tray Image */}
              <div className="relative w-full h-96 rounded-lg overflow-hidden border-2 border-border">
                <img
                  src={`https://amsstores1.blr1.digitaloceanspaces.com/${selectedTrayForDetail.tray_id}.jpg`}
                  alt={`Tray ${selectedTrayForDetail.tray_id}`}
                  className="w-full h-full object-contain bg-muted"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src =
                      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%239ca3af">No Image Available</text></svg>';
                  }}
                />
              </div>

              {/* Tray Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Tray Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Tray ID</span>
                    <p className="font-bold text-lg">{selectedTrayForDetail.tray_id}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Status</span>
                    <Badge className={selectedTrayForDetail.tray_status === "active" ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/80" : "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80"}>
                      {selectedTrayForDetail.tray_status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">
                      Available Qty
                    </span>
                    <p className="font-bold text-lg text-primary">{selectedTrayForDetail.available_quantity}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Divider</span>
                    <p className="font-bold">{selectedTrayForDetail.tray_divider}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Height</span>
                    <p className="font-bold">{selectedTrayForDetail.tray_height}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Weight</span>
                    <p className="font-bold">{selectedTrayForDetail.tray_weight}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Lock Count</span>
                    <p className="font-bold">{selectedTrayForDetail.tray_lockcount}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">
                      Inbound Date
                    </span>
                    <p className="font-bold">{selectedTrayForDetail.inbound_date}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Item Details */}
              {selectedTrayForDetail.item_id && (
                <Card>
                  <CardHeader>
                    <CardTitle>Item Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">Item ID</span>
                      <p className="font-bold text-lg">{selectedTrayForDetail.item_id}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide font-bold">
                        Description
                      </span>
                      <p className="text-base">{selectedTrayForDetail.item_description}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    handleRequestTray(selectedTrayForDetail.tray_id);
                    setShowTrayDetailDialog(false);
                  }}
                  disabled={retrievingTrayId === selectedTrayForDetail.tray_id}
                  className="flex-1"
                >
                  {retrievingTrayId === selectedTrayForDetail.tray_id ? "Requesting..." : "Request Tray to Station"}
                </Button>
                <Button onClick={() => setShowTrayDetailDialog(false)} className="flex-1 border border-input bg-background text-black hover:bg-accent hover:text-black">
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Scaffold>
  );
};
export default AdhocMode;
