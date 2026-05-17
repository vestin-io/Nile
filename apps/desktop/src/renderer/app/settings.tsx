import ReactDOM from "react-dom/client";
import { registerBuiltinAgentDeclarations } from "@nile/builtins/agents";

import { SettingsApp } from "./settings/App";

const rootElement = document.getElementById("root");

registerBuiltinAgentDeclarations();

if (!rootElement) {
  throw new Error("Missing #root element for desktop settings renderer");
}

ReactDOM.createRoot(rootElement).render(<SettingsApp />);
