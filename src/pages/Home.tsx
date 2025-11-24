import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LogOut, Package, FileText, Upload, Boxes } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const Home = () => {
  const navigate = useNavigate();
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user is authenticated
  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      navigate("/");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userName');
    localStorage.removeItem('userId');
    navigate("/");
  };

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('https://testhostsushil.leapmile.com/nanostore/sap_orders/upload_file', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2wiOiJhZG1pbiIsImV4cCI6MTkwMDY2MDExOX0.m9Rrmvbo22sJpWgTVynJLDIXFxOfym48F-kGy-wSKqQ'
        },
        body: formData
      });
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "SAP file uploaded successfully"
      });
      setSelectedFile(null);
      setIsUploadDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload SAP file",
        variant: "destructive"
      });
    }
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
                <p className="text-muted-foreground">Tray & product search with putaway</p>
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
                    <h2 className="text-3xl font-bold text-foreground mb-2">Upload SAP</h2>
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
                    isDragging ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto mb-4 text-muted-foreground" size={48} />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop your file here, or
                  </p>
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

                <Button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="w-full"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default Home;
