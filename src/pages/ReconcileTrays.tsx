import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, RefreshCw, Box } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface TrayRecord {
  tray_id: string;
  available_quantity: number;
  item_description: string;
  inbound_date: string;
  tray_status: string;
  tray_weight?: number;
  tray_height?: number;
}

interface ReconcileDetail {
  material: string;
  sap_quantity: number;
  item_quantity: number;
  quantity_difference: number;
  reconcile_status: string;
  item_description?: string;
}

const fetchReconcileDetail = async (material: string): Promise<ReconcileDetail> => {
  const authToken = localStorage.getItem('authToken');
  
  const response = await fetch(
    `https://testhostsushil.leapmile.com/nanostore/sap_reconcile/report?material=${material}&num_records=1&offset=0`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch reconcile details");
  }

  const data = await response.json();
  return data.records?.[0] || null;
};

const fetchTraysForMaterial = async (material: string): Promise<TrayRecord[]> => {
  const authToken = localStorage.getItem('authToken');
  
  const response = await fetch(
    `https://testhostsushil.leapmile.com/nanostore/trays_for_order?item_id=${material}&order_flow=fifo&num_records=100&offset=0`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    }
  );

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error("Failed to fetch trays");
  }

  const data = await response.json();
  return data.records || [];
};

const ReconcileTrays = () => {
  const { material } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      navigate("/");
    }
  }, [navigate]);

  const { data: reconcileDetail, isLoading: detailLoading } = useQuery({
    queryKey: ["reconcile-detail", material],
    queryFn: () => fetchReconcileDetail(material!),
    enabled: !!material,
  });

  const { data: trays, isLoading: traysLoading, refetch } = useQuery({
    queryKey: ["reconcile-trays", material],
    queryFn: () => fetchTraysForMaterial(material!),
    enabled: !!material,
  });

  const handleRefresh = async () => {
    toast({ title: "Refreshing data..." });
    await refetch();
    toast({ title: "Data refreshed" });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "sap_shortage":
        return "bg-red-500/20 text-red-700 dark:text-red-300";
      case "robot_shortage":
        return "bg-orange-500/20 text-orange-700 dark:text-orange-300";
      case "matched":
        return "bg-green-500/20 text-green-700 dark:text-green-300";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const totalTrayQuantity = trays?.reduce((sum, tray) => sum + tray.available_quantity, 0) || 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b-2 border-border shadow-sm sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate(-1)}
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-accent/10"
            >
              <ArrowLeft size={24} />
            </Button>
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Package className="text-primary-foreground" size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Reconcile Trays</h1>
              <p className="text-sm text-muted-foreground">Material: {material}</p>
            </div>
          </div>
          <Button onClick={handleRefresh} variant="ghost" size="icon" className="text-accent hover:bg-accent/10">
            <RefreshCw size={24} />
          </Button>
        </div>
      </header>

      <div className="flex-1 p-4 sm:p-6">
        <div className="container max-w-6xl mx-auto space-y-6">
          
          {/* Reconcile Summary Card */}
          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin text-primary" size={32} />
            </div>
          ) : reconcileDetail ? (
            <Card className="p-6 border-2 border-border">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h2 className="text-xl font-bold text-foreground">Reconciliation Summary</h2>
                  <Badge className={getStatusBadgeClass(reconcileDetail.reconcile_status)}>
                    {reconcileDetail.reconcile_status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                {reconcileDetail.item_description && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground font-medium">Description</p>
                    <p className="text-sm font-semibold text-foreground">{reconcileDetail.item_description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-xs text-muted-foreground font-medium">SAP Quantity</p>
                    <p className="text-2xl font-bold text-foreground">{reconcileDetail.sap_quantity}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-xs text-muted-foreground font-medium">System Quantity</p>
                    <p className="text-2xl font-bold text-foreground">{reconcileDetail.item_quantity}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-xs text-muted-foreground font-medium">Tray Total</p>
                    <p className="text-2xl font-bold text-foreground">{totalTrayQuantity}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                    <p className="text-xs text-muted-foreground font-medium">Difference</p>
                    <p className={`text-2xl font-bold ${reconcileDetail.quantity_difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {reconcileDetail.quantity_difference > 0 ? '+' : ''}{reconcileDetail.quantity_difference}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ) : null}

          {/* Trays List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Box size={20} className="text-accent" />
                Available Trays ({trays?.length || 0})
              </h2>
            </div>

            {traysLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="animate-spin text-primary" size={32} />
              </div>
            ) : !trays || trays.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No trays found for this material</p>
              </Card>
            ) : (
              <ScrollArea className="h-[calc(100vh-450px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trays.map((tray, index) => (
                    <Card key={index} className="p-4 border-2 border-border hover:shadow-lg transition-all duration-200">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border">
                          <h3 className="font-bold text-lg text-foreground">{tray.tray_id}</h3>
                          <Badge variant="outline" className="text-xs">
                            {tray.tray_status}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Available Qty</span>
                            <span className="text-xl font-bold text-primary">{tray.available_quantity}</span>
                          </div>

                          {tray.item_description && (
                            <div className="p-2 bg-muted/30 rounded text-xs">
                              <p className="text-muted-foreground truncate">{tray.item_description}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Inbound Date</p>
                              <p className="font-medium text-foreground">{tray.inbound_date}</p>
                            </div>
                            {tray.tray_weight && (
                              <div>
                                <p className="text-muted-foreground">Weight</p>
                                <p className="font-medium text-foreground">{tray.tray_weight}g</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReconcileTrays;
