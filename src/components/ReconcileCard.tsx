import { Card } from "@/components/ui/card";

interface ReconcileCardProps {
  material: string;
  sapQuantity: number;
  itemQuantity: number;
  quantityDifference: number;
  reconcileStatus: string;
  onClick?: () => void;
}

const ReconcileCard = ({ 
  material, 
  sapQuantity, 
  itemQuantity, 
  quantityDifference, 
  reconcileStatus,
  onClick 
}: ReconcileCardProps) => {
  const getCardClassName = (status: string) => {
    const isClickable = (status === "sap_shortage" || status === "robot_shortage") && onClick;
    const baseClasses = isClickable ? "cursor-pointer" : "";
    
    switch (status) {
      case "sap_shortage":
        return `${baseClasses} border-red-500 bg-red-500/5 hover:bg-red-500/10`;
      case "robot_shortage":
        return `${baseClasses} border-orange-500 bg-orange-500/5 hover:bg-orange-500/10`;
      case "matched":
        return "border-green-500 bg-green-500/5 hover:bg-green-500/10";
      default:
        return "";
    }
  };

  const getStatusBadgeClassName = (status: string) => {
    switch (status) {
      case "sap_shortage":
        return "bg-red-500/20 text-red-700 dark:text-red-300";
      case "robot_shortage":
        return "bg-orange-500/20 text-orange-700 dark:text-orange-300";
      case "matched":
        return "bg-green-500/20 text-green-700 dark:text-green-300";
      default:
        return "";
    }
  };

  const handleClick = () => {
    if ((reconcileStatus === "sap_shortage" || reconcileStatus === "robot_shortage") && onClick) {
      onClick();
    }
  };

  return (
    <Card 
      className={`p-4 transition-all duration-200 border-2 ${getCardClassName(reconcileStatus)} animate-fade-in`}
      onClick={handleClick}
    >
      <div className="space-y-3">
        {/* Material - Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="font-bold text-lg text-foreground">{material}</h3>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusBadgeClassName(reconcileStatus)}`}>
            {reconcileStatus.replace('_', ' ')}
          </span>
        </div>

        {/* Quantities Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">SAP Quantity</p>
            <p className="text-2xl font-bold text-foreground">{sapQuantity}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Item Quantity</p>
            <p className="text-2xl font-bold text-foreground">{itemQuantity}</p>
          </div>
        </div>

        {/* Difference */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">Quantity Difference</p>
            <p className={`text-xl font-bold ${quantityDifference === 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {quantityDifference > 0 ? '+' : ''}{quantityDifference}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ReconcileCard;
