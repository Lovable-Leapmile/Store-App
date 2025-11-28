import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LogOut, Package, FileText, Upload, Boxes, CheckCircle2, XCircle, Database } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as XLSX from "xlsx";

interface ItemUploadLog {
  item_id: string;
  item_description: string;
  status: "success" | "failed";
  message?: string;
}

const Home = () => {
  const navigate = useNavigate();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isItemCatalogDialogOpen, setIsItemCatalogDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [itemCatalogFile, setItemCatalogFile] = useState<File | null>(null);
  const [isItemCatalogDragging, setIsItemCatalogDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLogs, setUploadLogs] = useState<ItemUploadLog[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [remainingItems, setRemainingItems] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemCatalogInputRef = useRef<HTMLInputElement>(null);

  // Check if user is authenticated
  useEffect(() => {
    const authToken = localStorage.getItem("authToken");
    if (!authToken) {
      navigate("/");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userName");
    localStorage.removeItem("userId");
    navigate("/");
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("https://robotmanagerv1test.qikpod.com/nanostore/sap_orders/upload_file", {
        method: "POST",
        headers: {
          accept: "application/json",
          Authorization:
            "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2wiOiJhZG1pbiIsImV4cCI6MTkwMDY2MDExOX0.m9Rrmvbo22sJpWgTVynJLDIXFxOfym48F-kGy-wSKqQ",
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
        description: "SAP file uploaded successfully",
      });
      setSelectedFile(null);
      setIsUploadDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload SAP file",
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

  const handleItemCatalogDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsItemCatalogDragging(true);
  };

  const handleItemCatalogDragLeave = () => {
    setIsItemCatalogDragging(false);
  };

  const handleItemCatalogDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsItemCatalogDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setItemCatalogFile(file);
    }
  };

  const handleItemCatalogFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setItemCatalogFile(file);
    }
  };

  const handleItemCatalogUpload = async () => {
    if (!itemCatalogFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadLogs([]);

    try {
      const data = await itemCatalogFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<{
        Material: string;
        "Material Description": string;
      }>;

      // Map Excel columns to internal property names
      const mappedData = jsonData.map((row) => ({
        item_id: row.Material?.trim() || "",
        item_description: row["Material Description"]?.trim() || "",
      }));

      const totalItemsCount = mappedData.length;
      setTotalItems(totalItemsCount);
      setRemainingItems(totalItemsCount);
      let processedItems = 0;

      for (const item of mappedData) {
        try {
          const response = await fetch(
            `https://robotmanagerv1test.qikpod.com/nanostore/item?item_id=${encodeURIComponent(item.item_id)}&item_description=${encodeURIComponent(item.item_description)}`,
            {
              method: "POST",
              headers: {
                accept: "application/json",
                Authorization:
                  "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2wiOiJhZG1pbiIsImV4cCI6MTkwMDY2MDExOX0.m9Rrmvbo22sJpWgTVynJLDIXFxOfym48F-kGy-wSKqQ",
              },
              body: "",
            },
          );

          const result = await response.json();

          if (response.ok && result.status === "success") {
            setUploadLogs((prev) => [
              ...prev,
              {
                item_id: item.item_id,
                item_description: item.item_description,
                status: "success",
              },
            ]);
          } else {
            setUploadLogs((prev) => [
              ...prev,
              {
                item_id: item.item_id,
                item_description: item.item_description,
                status: "failed",
                message: result.message || "Unknown error",
              },
            ]);
          }
        } catch (error) {
          setUploadLogs((prev) => [
            ...prev,
            {
              item_id: item.item_id,
              item_description: item.item_description,
              status: "failed",
              message: "Network error",
            },
          ]);
        }

        processedItems++;
        setUploadProgress((processedItems / totalItemsCount) * 100);
        setRemainingItems(totalItemsCount - processedItems);

        // Wait 30ms before next request
        if (processedItems < totalItemsCount) {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      }

      toast({
        title: "Upload Complete",
        description: `Processed ${totalItemsCount} items`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b-2 border-border shadow-sm sticky top-0 z-10">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Package className="text-primary-foreground" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Home</h1>
          </div>
          <Button onClick={handleLogout} variant="ghost" size="icon" className="text-accent hover:bg-accent/10">
            <LogOut size={24} />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="container max-w-2xl mx-auto space-y-6">
          {/* SAP Orders Button */}
          <Card
            className="p-8 bg-card hover:shadow-xl transition-all duration-300 border-2 border-border hover:border-primary/50 cursor-pointer animate-fade-in"
            onClick={() => navigate("/sap-orders")}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Package className="text-primary" size={48} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-2">SAP Orders</h2>
                <p className="text-muted-foreground">View and manage active orders</p>
              </div>
            </div>
          </Card>

          {/* SAP Reconcile Button */}
          <Card
            className="p-8 bg-card hover:shadow-xl transition-all duration-300 border-2 border-border hover:border-primary/50 cursor-pointer animate-fade-in"
            onClick={() => navigate("/sap-reconcile")}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileText className="text-primary" size={48} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-2">SAP Reconcile</h2>
                <p className="text-muted-foreground">Reconcile SAP data and view reports</p>
              </div>
            </div>
          </Card>

          {/* Adhoc Mode Button */}
          <Card
            className="p-8 bg-card hover:shadow-xl transition-all duration-300 border-2 border-border hover:border-primary/50 cursor-pointer animate-fade-in"
            onClick={() => navigate("/adhoc-mode")}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Boxes className="text-primary" size={48} />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-2">Adhoc Mode</h2>
                <p className="text-muted-foreground">Tray & product search with Inbound or Pickup</p>
              </div>
            </div>
          </Card>

          {/* Upload SAP Button */}
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Card className="p-8 bg-card hover:shadow-xl transition-all duration-300 border-2 border-border hover:border-primary/50 cursor-pointer animate-fade-in">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload className="text-primary" size={48} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-foreground mb-2">Upload SAP Order</h2>
                    <p className="text-muted-foreground">Upload SAP order files</p>
                  </div>
                </div>
              </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload SAP File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging ? "border-primary bg-primary/10" : "border-border"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto mb-4 text-muted-foreground" size={48} />
                  <p className="text-sm text-muted-foreground mb-2">Drag and drop your file here, or</p>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                    Browse Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
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

          {/* Upload Item Catalog Button */}
          <Dialog
            open={isItemCatalogDialogOpen}
            onOpenChange={(open) => {
              setIsItemCatalogDialogOpen(open);
              if (!open) {
                // Reset state when dialog is closed
                setItemCatalogFile(null);
                setUploadLogs([]);
                setUploadProgress(0);
                setTotalItems(0);
                setRemainingItems(0);
              }
            }}
          >
            <DialogTrigger asChild>
              <Card className="p-8 bg-card hover:shadow-xl transition-all duration-300 border-2 border-border hover:border-primary/50 cursor-pointer animate-fade-in">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Database className="text-primary" size={48} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-foreground mb-2">Upload Item Catalog</h2>
                    <p className="text-muted-foreground">Upload item catalog file</p>
                  </div>
                </div>
              </Card>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Upload Item Catalog</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                {!isUploading && uploadLogs.length === 0 && (
                  <>
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        isItemCatalogDragging ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      onDragOver={handleItemCatalogDragOver}
                      onDragLeave={handleItemCatalogDragLeave}
                      onDrop={handleItemCatalogDrop}
                    >
                      <Database className="mx-auto mb-4 text-muted-foreground" size={48} />
                      <p className="text-sm text-muted-foreground mb-2">Drag and drop a Excel file here</p>
                      <p className="text-sm text-muted-foreground mb-2"> or</p>
                      <Button variant="outline" onClick={() => itemCatalogInputRef.current?.click()}>
                        Browse Files
                      </Button>
                      <input
                        ref={itemCatalogInputRef}
                        type="file"
                        className="hidden"
                        accept=".xlsx,.xls"
                        onChange={handleItemCatalogFileSelect}
                      />
                      <p className="text-xs text-muted-foreground mt-4">
                        Excel file with columns: Material, Material Description
                      </p>
                    </div>

                    {itemCatalogFile && (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium">Selected file:</p>
                        <p className="text-sm text-muted-foreground">{itemCatalogFile.name}</p>
                      </div>
                    )}

                    <Button onClick={handleItemCatalogUpload} disabled={!itemCatalogFile} className="w-full">
                      Upload & Process
                    </Button>
                  </>
                )}

                {(isUploading || uploadLogs.length > 0) && (
                  <div className="space-y-4">
                    {/* Remaining Items Counter */}
                    <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-primary mb-1">{remainingItems}</div>
                        <div className="text-sm text-muted-foreground">Remaining out of {totalItems} total items</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Progress</span>
                        <span className="text-muted-foreground">{Math.round(uploadProgress)}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="p-3 bg-muted rounded-lg text-center">
                        <div className="text-2xl font-bold text-foreground">{uploadLogs.length}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="p-3 bg-green-500/10 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {uploadLogs.filter((l) => l.status === "success").length}
                        </div>
                        <div className="text-xs text-muted-foreground">Success</div>
                      </div>
                      <div className="p-3 bg-red-500/10 rounded-lg text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {uploadLogs.filter((l) => l.status === "failed").length}
                        </div>
                        <div className="text-xs text-muted-foreground">Failed</div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border overflow-hidden">
                      <ScrollArea className="h-[400px]">
                        <div className="p-4 space-y-2">
                          {uploadLogs.map((log, index) => (
                            <div
                              key={index}
                              className={`p-3 rounded-lg border ${
                                log.status === "success"
                                  ? "bg-green-500/5 border-green-500/20"
                                  : "bg-red-500/5 border-red-500/20"
                              } animate-fade-in`}
                            >
                              <div className="flex items-start gap-3">
                                {log.status === "success" ? (
                                  <CheckCircle2
                                    className="text-green-600 dark:text-green-400 shrink-0 mt-0.5"
                                    size={18}
                                  />
                                ) : (
                                  <XCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={18} />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">{log.item_id}</span>
                                    <span className="text-xs text-muted-foreground">•</span>
                                    <span className="text-xs text-muted-foreground truncate">
                                      {log.item_description}
                                    </span>
                                  </div>
                                  {log.message && <p className="text-xs text-muted-foreground mt-1">{log.message}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    {!isUploading && (
                      <Button
                        onClick={() => {
                          setUploadLogs([]);
                          setUploadProgress(0);
                          setItemCatalogFile(null);
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        Upload Another File
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Home;
