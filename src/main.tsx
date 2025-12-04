import { createRoot } from "react-dom/client";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
