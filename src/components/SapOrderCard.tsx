import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Package, Layers, CheckCircle2, Clock } from "lucide-react";

interface SapOrder {
  order_ref: string;
  total_items: number;
  pending_items: number;
  completed_items: number;
  order_status: string;
}

interface SapOrderCardProps {
  order: SapOrder;
}

const SapOrderCard = ({ order }: SapOrderCardProps) => {
  const navigate = useNavigate();

  return (
    <Card
      className="p-5 bg-card hover:shadow-lg transition-all duration-300 border-2 border-border animate-fade-in cursor-pointer active:scale-[0.98]"
      onClick={() => navigate(`/order/${order.order_ref}`)}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Package className="text-primary" size={24} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground font-medium">Order Ref</p>
            </div>
            <p className="text-xl font-bold text-foreground">{order.order_ref}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 pl-15">
          <div className="flex items-center gap-2">
            <Layers className="text-primary" size={16} />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-base font-bold text-primary">{order.total_items}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="text-warning" size={16} />
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-base font-bold text-warning">{order.pending_items}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-success" size={16} />
            <div>
              <p className="text-xs text-muted-foreground">Complete</p>
              <p className="text-base font-bold text-success">{order.completed_items}</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default SapOrderCard;
