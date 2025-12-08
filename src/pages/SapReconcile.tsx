import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, FileText, Upload, RefreshCw, Download } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ReconcileCard from "@/components/ReconcileCard";
import * as XLSX from "xlsx";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import Scaffold from "@/components/Scaffold";

interface ReconcileRecord {
  material: string;
  sap_quantity: number;
  item_quantity: number;
  quantity_difference: number;
  reconcile_status: string;
}

const fetchReconcileData = async (status: string): Promise<ReconcileRecord[]> => {
  const authToken = localStorage.getItem("authToken");

  const response = await fetch(
    `https://robotmanagerv1test.qikpod.com/nanostore/sap_reconcile/report?reconcile_status=${status}&num_records=100&offset=0`,
    {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    },
  );

  // Handle 404 as valid "no records" response
  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error("Failed to fetch reconcile data");
  }

  const data = await response.json();
  return data.records || [];
};

const SapReconcile = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("sap_shortage");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user is authenticated
  useEffect(() => {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      navigate("/");
    }
  }, [navigate]);

  const {
    data: sapShortageData,
    isLoading: sapShortageLoading,
    refetch: refetchSapShortage,
  } = useQuery({
    queryKey: ["reconcile-sap-shortage"],
    queryFn: () => fetchReconcileData("sap_shortage"),
    enabled: activeTab === "sap_shortage",
    retry: false,
  });

  const {
    data: robotShortageData,
    isLoading: robotShortageLoading,
    refetch: refetchRobotShortage,
  } = useQuery({
    queryKey: ["reconcile-robot-shortage"],
    queryFn: () => fetchReconcileData("robot_shortage"),
    enabled: activeTab === "robot_shortage",
    retry: false,
  });

  const {
    data: matchedData,
    isLoading: matchedLoading,
    refetch: refetchMatched,
  } = useQuery({
    queryKey: ["reconcile-matched"],
    queryFn: () => fetchReconcileData("matched"),
    enabled: activeTab === "matched",
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const authToken = localStorage.getItem("authToken");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("https://robotmanagerv1test.qikpod.com/nanostore/sap_reconcile/upload_file", {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "File uploaded and data refreshed successfully",
      });
      setSelectedFile(null);
      setIsUploadDialogOpen(false);

      // Invalidate all queries to trigger a single refetch
      queryClient.invalidateQueries({ queryKey: ["reconcile-sap-shortage"] });
      queryClient.invalidateQueries({ queryKey: ["reconcile-robot-shortage"] });
      queryClient.invalidateQueries({ queryKey: ["reconcile-matched"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload SAP Reconcile file",
        variant: "destructive",
      });
    },
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleRefresh = async () => {
    toast({
      title: "Refreshing data...",
    });

    if (activeTab === "sap_shortage") {
      await refetchSapShortage();
    } else if (activeTab === "robot_shortage") {
      await refetchRobotShortage();
    } else {
      await refetchMatched();
    }

    toast({
      title: "Data updated",
      description: "Latest data loaded successfully",
    });
  };

  const handleCardClick = (material: string) => {
    navigate(`/trays-for-item/reconcile/${material}`);
  };

  const handleExport = () => {
    let data: ReconcileRecord[] | undefined;
    let fileName: string;

    switch (activeTab) {
      case "sap_shortage":
        data = sapShortageData;
        fileName = "SAP_Shortage_Export";
        break;
      case "robot_shortage":
        data = robotShortageData;
        fileName = "Robot_Shortage_Export";
        break;
      case "matched":
        data = matchedData;
        fileName = "Matched_Export";
        break;
      default:
        data = [];
        fileName = "Export";
    }

    if (!data || data.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no records available for export",
        variant: "destructive",
      });
      return;
    }

    // Prepare data for Excel
    const exportData = data.map((record) => ({
      Material: record.material,
      "SAP Quantity": record.sap_quantity,
      "Item Quantity": record.item_quantity,
      "Quantity Difference": record.quantity_difference,
      "Reconcile Status": record.reconcile_status,
    }));

    // Create worksheet and workbook
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");

    // Generate and download file
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Export successful",
      description: `${data.length} records exported to Excel`,
    });
  };

  // AG Grid Column Definitions
  const colDefs: ColDef<ReconcileRecord>[] = useMemo(() => [
    { field: "material", headerName: "Material", flex: 1, filter: true },
    { field: "sap_quantity", headerName: "SAP Quantity", width: 150, filter: true },
    { field: "item_quantity", headerName: "Item Quantity", width: 150, filter: true },
    {
      field: "quantity_difference",
      headerName: "Difference",
      width: 150,
      filter: true,
      cellStyle: params => {
        if (params.value > 0) return { color: 'var(--success)' };
        if (params.value < 0) return { color: 'var(--destructive)' };
        return null;
      }
    },
    { field: "reconcile_status", headerName: "Status", flex: 1, filter: true },
    {
      headerName: "Action",
      width: 120,
      cellRenderer: (params: ICellRendererParams) => {
        const record = params.data;
        if (record.reconcile_status === "sap_shortage" || record.reconcile_status === "robot_shortage") {
          return (
            <Button
              onClick={() => handleCardClick(record.material)}
              className="h-8 w-full text-primary hover:text-primary-hover hover:bg-primary/10"
            >
              View
            </Button>
          );
        }
        return null;
      }
    }
  ], []);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
  }), []);

  const renderContent = (data: ReconcileRecord[] | undefined, isLoading: boolean, status: string) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      );
    }

    if (!data || data.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No records found</p>
        </div>
      );
    }

    return (
      <>
        {/* Mobile View - Cards */}
        <div className="block md:hidden grid grid-cols-1 gap-4 p-4">
          {data.map((record, index) => (
            <ReconcileCard
              key={index}
              material={record.material}
              sapQuantity={record.sap_quantity}
              itemQuantity={record.item_quantity}
              quantityDifference={record.quantity_difference}
              reconcileStatus={record.reconcile_status}
              onClick={
                record.reconcile_status === "sap_shortage" || record.reconcile_status === "robot_shortage"
                  ? () => handleCardClick(record.material)
                  : undefined
              }
            />
          ))}
        </div>

        {/* Desktop View - AG Grid */}
        <div className="hidden md:block h-[calc(100vh-300px)] w-full p-4">
          <div className="ag-theme-alpine w-full h-full">
            <AgGridReact
              rowData={data}
              columnDefs={colDefs}
              defaultColDef={defaultColDef}
              pagination={true}
              paginationPageSize={20}
              rowSelection="single"
            />
          </div>
        </div>
      </>
    );
  };

  return (
    <Scaffold
      title="SAP Reconcile"
      showBack
      icon={<FileText className="text-primary-foreground" size={24} />}
      actions={
        <div className="flex gap-2">
          <Button onClick={handleRefresh} className="h-10 w-10 text-accent hover:bg-accent/10">
            <RefreshCw size={24} />
          </Button>
        </div>
      }
    >
      {/* Upload and Export Buttons */}
      <div className="container max-w-6xl mx-auto px-4 py-4">
        <div className="flex flex-wrap gap-3">
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-initial">
                <Upload className="mr-2" size={20} />
                Upload SAP Reconcile File
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload SAP Reconcile File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? "border-primary bg-primary/10" : "border-border"
                    }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto mb-4 text-muted-foreground" size={48} />
                  <p className="text-sm text-muted-foreground mb-2">Drag and drop a Excel file here</p>
                  <p className="text-sm text-muted-foreground mb-2">or</p>
                  <Button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground" onClick={() => fileInputRef.current?.click()}>
                    Browse Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                  />
                </div>

                {selectedFile && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">Selected file:</p>
                    <p className="text-sm text-muted-foreground">{selectedFile.name}</p>
                  </div>
                )}

                <Button onClick={handleUpload} disabled={!selectedFile || uploadMutation.isPending} className="w-full">
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={handleExport} className="gap-2 flex-1 sm:flex-initial bg-primary text-primary-foreground hover:bg-primary/90">
            <Download size={20} />
            Export{" "}
            {activeTab === "sap_shortage"
              ? "SAP Shortage"
              : activeTab === "robot_shortage"
                ? "Robot Shortage"
                : "Matched"}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="container max-w-7xl mx-auto px-2 sm:px-4 pb-6 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="sap_shortage" className="text-xs sm:text-sm">
              SAP Shortage
            </TabsTrigger>
            <TabsTrigger value="robot_shortage" className="text-xs sm:text-sm">
              Robot Shortage
            </TabsTrigger>
            <TabsTrigger value="matched" className="text-xs sm:text-sm">
              Matched
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sap_shortage">
            {renderContent(sapShortageData, sapShortageLoading, "sap_shortage")}
          </TabsContent>

          <TabsContent value="robot_shortage">
            {renderContent(robotShortageData, robotShortageLoading, "robot_shortage")}
          </TabsContent>

          <TabsContent value="matched">
            {renderContent(matchedData, matchedLoading, "matched")}
          </TabsContent>
        </Tabs>
      </div>
    </Scaffold>
  );
};

export default SapReconcile;
