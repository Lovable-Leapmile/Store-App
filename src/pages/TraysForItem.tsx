import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package } from "lucide-react";

const TraysForItem = () => {
  const { orderId, itemId } = useParams();
  const navigate = useNavigate();

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
        </div>
      </header>

      <div className="flex-1 p-6">
        <div className="container max-w-2xl mx-auto">
          <p className="text-muted-foreground">Order ID: {orderId}</p>
          <p className="text-muted-foreground">Item ID: {itemId}</p>
          <p className="mt-4 text-sm text-muted-foreground">Tray details will be displayed here</p>
        </div>
      </div>
    </div>
  );
};

export default TraysForItem;
