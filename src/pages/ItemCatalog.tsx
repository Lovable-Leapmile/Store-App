import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Scaffold from "@/components/Scaffold";
import { Database, Upload, FileText, CheckCircle2, XCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
//a
interface ItemUploadLog {
    item_id: string;
    item_description: string;
    status: "success" | "failed";
    message?: string;
}

const ItemCatalog = () => {
    const navigate = useNavigate();
    // File Upload State
    const [itemCatalogFile, setItemCatalogFile] = useState<File | null>(null);
    const [isItemCatalogDragging, setIsItemCatalogDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadLogs, setUploadLogs] = useState<ItemUploadLog[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [remainingItems, setRemainingItems] = useState(0);
    const itemCatalogInputRef = useRef<HTMLInputElement>(null);

    // Manual Add State
    const [manualItemId, setManualItemId] = useState("");
    const [manualDescription, setManualDescription] = useState("");
    const [isSubmittingManual, setIsSubmittingManual] = useState(false);

    // File Upload Handlers
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
                        `https://staging.leapmile.com/nanostore/item?item_id=${encodeURIComponent(item.item_id)}&item_description=${encodeURIComponent(item.item_description)}`,
                        {
                            method: "POST",
                            headers: {
                                accept: "application/json",
                                Authorization:
                                    `Bearer ${localStorage.getItem("authToken")}`,
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

    // Validate if item exists in robot catalog
    const validateItemInCatalog = async (itemId: string): Promise<boolean> => {
        try {
            const authToken = localStorage.getItem("authToken");
            const response = await fetch(
                `https://amsstores1.leapmile.com/nanostore/items?item_id=${itemId}`,
                {
                    method: "GET",
                    headers: {
                        accept: "application/json",
                        Authorization: `Bearer ${authToken}`,
                    },
                },
            );

            if (!response.ok) {
                return false;
            }

            const data = await response.json();
            return data && data.records && data.records.length > 0;
        } catch (error) {
            console.error("Failed to validate item in catalog", error);
            return false;
        }
    };

    // Manual Add Handlers
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualItemId || !manualDescription) {
            toast({
                title: "Error",
                description: "Please fill in all fields",
                variant: "destructive",
            });
            return;
        }

        setIsSubmittingManual(true);
        try {
            // Check if item already exists in robot catalog
            const itemExists = await validateItemInCatalog(manualItemId);
            
            if (itemExists) {
                toast({
                    title: "⚠️ Item Already Exists",
                    description: "This item is already in the robot catalog.",
                    variant: "destructive",
                });
                setIsSubmittingManual(false);
                return;
            }

            const response = await fetch(
                `https://staging.leapmile.com/nanostore/item?item_id=${encodeURIComponent(manualItemId)}&item_description=${encodeURIComponent(manualDescription)}`,
                {
                    method: "POST",
                    headers: {
                        accept: "application/json",
                        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
                    },
                    body: "",
                }
            );
            const result = await response.json();

            if (response.ok && result.status === "success") {
                toast({
                    title: "Success",
                    description: `Item ${manualItemId} added successfully`,
                });
                setManualItemId("");
                setManualDescription("");
            } else {
                throw new Error(result.message || "Failed to add item");
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to add item",
                variant: "destructive",
            });
        } finally {
            setIsSubmittingManual(false);
        }
    };

    return (
        <Scaffold
            title="Item Catalog"
            showBack
            onBack={() => navigate("/home")}
            icon={<Database className="text-primary-foreground" size={24} />}
        >
            <div className="container max-w-4xl mx-auto p-6">
                <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-8">
                        <TabsTrigger value="upload" className="text-lg py-3">
                            <Upload className="mr-2 h-5 w-5" />
                            Batch Upload
                        </TabsTrigger>
                        <TabsTrigger value="manual" className="text-lg py-3">
                            <FileText className="mr-2 h-5 w-5" />
                            Manual Entry
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload">
                        <Card>
                            <CardHeader>
                                <CardTitle>Upload Item Catalog</CardTitle>
                                <CardDescription>Upload an Excel file containing item details (Material, Material Description)</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {!isUploading && uploadLogs.length === 0 && (
                                    <>
                                        <div
                                            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${isItemCatalogDragging ? "border-primary bg-primary/10" : "border-border"}`}
                                            onDragOver={handleItemCatalogDragOver}
                                            onDragLeave={handleItemCatalogDragLeave}
                                            onDrop={handleItemCatalogDrop}
                                        >
                                            <Database className="mx-auto mb-4 text-muted-foreground" size={64} />
                                            <p className="text-lg text-muted-foreground mb-2">Drag and drop a Excel file here</p>
                                            <p className="text-sm text-muted-foreground mb-6">or</p>
                                            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => itemCatalogInputRef.current?.click()}>
                                                Browse Files
                                            </Button>
                                            <input
                                                ref={itemCatalogInputRef}
                                                type="file"
                                                className="hidden"
                                                accept=".xlsx,.xls"
                                                onChange={handleItemCatalogFileSelect}
                                            />
                                            <p className="text-xs text-muted-foreground mt-6">
                                                Excel file with columns: Material, Material Description
                                            </p>
                                        </div>

                                        {itemCatalogFile && (
                                            <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-medium">Selected file:</p>
                                                    <p className="text-sm text-muted-foreground">{itemCatalogFile.name}</p>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={() => setItemCatalogFile(null)}>
                                                    Remove
                                                </Button>
                                            </div>
                                        )}

                                        <Button onClick={handleItemCatalogUpload} disabled={!itemCatalogFile} className="w-full" size="lg">
                                            Upload & Process
                                        </Button>
                                    </>
                                )}

                                {(isUploading || uploadLogs.length > 0) && (
                                    <div className="space-y-6">
                                        {/* Remaining Items Counter */}
                                        <div className="p-6 bg-primary/10 rounded-lg border border-primary/20">
                                            <div className="text-center">
                                                <div className="text-4xl font-bold text-primary mb-2">{remainingItems}</div>
                                                <div className="text-sm text-muted-foreground">Remaining out of {totalItems} total items</div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">Progress</span>
                                                <span className="text-muted-foreground">{Math.round(uploadProgress)}%</span>
                                            </div>
                                            <Progress value={uploadProgress} className="h-3" />
                                        </div>

                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div className="p-4 bg-muted rounded-lg text-center">
                                                <div className="text-3xl font-bold text-foreground">{uploadLogs.length}</div>
                                                <div className="text-xs text-muted-foreground mt-1">Total Processed</div>
                                            </div>
                                            <div className="p-4 bg-green-500/10 rounded-lg text-center">
                                                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                                                    {uploadLogs.filter((l) => l.status === "success").length}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">Success</div>
                                            </div>
                                            <div className="p-4 bg-red-500/10 rounded-lg text-center">
                                                <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                                                    {uploadLogs.filter((l) => l.status === "failed").length}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-1">Failed</div>
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-border overflow-hidden">
                                            <ScrollArea className="h-[400px]">
                                                <div className="p-4 space-y-2">
                                                    {uploadLogs.map((log, index) => (
                                                        <div
                                                            key={index}
                                                            className={`p-3 rounded-lg border ${log.status === "success" ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}
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
                                                className="w-full"
                                                variant="outline"
                                                size="lg"
                                            >
                                                Upload Another File
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="manual">
                        <Card>
                            <CardHeader>
                                <CardTitle>Add New Item</CardTitle>
                                <CardDescription>Manually add a single item to the catalog</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleManualSubmit} className="space-y-6 max-w-md mx-auto py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="itemId">Item ID</Label>
                                        <Input
                                            id="itemId"
                                            placeholder="e.g. 10001"
                                            value={manualItemId}
                                            onChange={(e) => setManualItemId(e.target.value)}
                                            disabled={isSubmittingManual}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="itemDescription">Item Description</Label>
                                        <Input
                                            id="itemDescription"
                                            placeholder="e.g. Wireless Mouse"
                                            value={manualDescription}
                                            onChange={(e) => setManualDescription(e.target.value)}
                                            disabled={isSubmittingManual}
                                        />
                                    </div>

                                    <Button type="submit" className="w-full" size="lg" disabled={isSubmittingManual}>
                                        {isSubmittingManual ? "Adding Item..." : "Add Item"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </Scaffold>
    );
};

export default ItemCatalog;
