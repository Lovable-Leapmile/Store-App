import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TrayItem {
  id: number;
  tray_id: string;
  item_id: string;
  item_description: string;
  available_quantity: number;
  inbound_date: string;
  tray_status: string;
  tray_height: number;
  tray_lockcount: number;
}

interface ApiResponse {
  status: string;
  records: TrayItem[];
  count: number;
  message?: string;
}

const fetchTrayItems = async (orderId: string, itemId: string): Promise<TrayItem[]> => {
  const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2wiOiJhZG1pbiIsImV4cCI6MTkwMDY2MDExOX0.m9Rrmvbo22sJpWgTVynJLDIXFxOfym48F-kGy-wSKqQ";
  
  // Try both in_station true and false to get all trays
  const responses = await Promise.all([
    fetch(`https://robotmanagerv1test.qikpod.com/nanostore/trays_for_material?material=${itemId}&in_station=true&num_records=50&offset=0`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    }),
    fetch(`https://robotmanagerv1test.qikpod.com/nanostore/trays_for_material?material=${itemId}&in_station=false&num_records=50&offset=0`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    })
  ]);

  const allTrays: TrayItem[] = [];
  
  for (const response of responses) {
    if (response.ok) {
      const data: ApiResponse = await response.json();
      if (data.status === "success" && data.records) {
        allTrays.push(...data.records);
      }
    }
  }

  return allTrays;
};

const TraysForItem = () => {
  const { orderId, itemId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: trayItems = [], isLoading, error, refetch } = useQuery({
    queryKey: ["trayItems", orderId, itemId],
    queryFn: () => fetchTrayItems(orderId!, itemId!),
    refetchInterval: 3000,
    enabled: !!orderId && !!itemId,
  });

  if (error) {
    toast({
      title: "Error",
      description: "Failed to fetch tray items",
      variant: "destructive",
    });
  }

  const totalQuantity = trayItems.reduce((sum, item) => sum + item.available_quantity, 0);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b-2 border-border shadow-sm sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
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
          <h1 className="text-2xl font-bold text-foreground">Trays for Item</h1>
          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="icon"
            className="ml-auto text-foreground hover:bg-accent/10"
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} size={20} />
          </Button>
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="container max-w-2xl mx-auto space-y-4">
          {/* Summary Card */}
          <Card className="border-2 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Item Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID:</span>
                <span className="font-semibold">{orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item ID:</span>
                <span className="font-semibold">{itemId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Trays:</span>
                <span className="font-semibold">{trayItems.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Quantity:</span>
                <span className="font-semibold">{totalQuantity}</span>
              </div>
            </CardContent>
          </Card>

          {/* Loading State */}
          {isLoading && trayItems.length === 0 && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          )}

          {/* Empty State */}
          {!isLoading && trayItems.length === 0 && (
            <Card className="border-2">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No trays found for this item</p>
              </CardContent>
            </Card>
          )}

          {/* Tray Items */}
          {trayItems.map((item) => (
            <Card key={item.id} className="border-2 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{item.tray_id}</CardTitle>
                  <Badge variant={item.tray_status === "active" ? "default" : "secondary"}>
                    {item.tray_status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description:</span>
                  <span className="font-medium text-right">{item.item_description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available Quantity:</span>
                  <span className="font-semibold text-primary">{item.available_quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inbound Date:</span>
                  <span className="font-medium">{item.inbound_date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Height:</span>
                  <span className="font-medium">{item.tray_height}mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lock Count:</span>
                  <span className="font-medium">{item.tray_lockcount}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TraysForItem;
