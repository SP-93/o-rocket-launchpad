import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { Web3Provider } from "./providers/Web3Provider.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Web3Provider>
    <App />
  </Web3Provider>
);
