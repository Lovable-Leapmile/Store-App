import React, { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";

interface ScaffoldProps {
    title: ReactNode;
    children: ReactNode;
    showBack?: boolean;
    onBack?: () => void;
    showLogout?: boolean;
    onLogout?: () => void;
    actions?: ReactNode;
    className?: string;
    icon?: ReactNode;
}

const Scaffold = ({
    title,
    children,
    showBack = false,
    onBack,
    showLogout = false,
    onLogout,
    actions,
    className = "",
    icon,
}: ScaffoldProps) => {
    const navigate = useNavigate();

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            navigate(-1);
        }
    };

    const handleLogout = () => {
        if (onLogout) {
            onLogout();
        } else {
            localStorage.removeItem("authToken");
            localStorage.removeItem("userName");
            localStorage.removeItem("userId");
            navigate("/");
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="bg-card border-b-2 border-border shadow-sm sticky top-0 z-10">
                <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {showBack && (
                            <Button
                                onClick={handleBack}
                                className="h-10 w-10 hover:bg-accent hover:text-accent-foreground text-foreground"
                            >
                                <ArrowLeft size={24} />
                            </Button>
                        )}
                        {icon && (
                            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                                {icon}
                            </div>
                        )}
                        {typeof title === "string" ? (
                            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
                        ) : (
                            title
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {actions}
                        {showLogout && (
                            <Button
                                onClick={handleLogout}
                                className="h-10 w-10 hover:bg-accent hover:text-accent-foreground text-accent"
                            >
                                <LogOut size={24} />
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className={`flex-1 flex flex-col ${className}`}>
                {children}
            </div>
        </div>
    );
};

export default Scaffold;
