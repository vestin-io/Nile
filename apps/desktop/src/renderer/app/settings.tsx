import ReactDOM from "react-dom/client";

import { SettingsApp } from "./SettingsApp";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Missing #root element for desktop settings renderer");
}

ReactDOM.createRoot(rootElement).render(<SettingsApp />);
