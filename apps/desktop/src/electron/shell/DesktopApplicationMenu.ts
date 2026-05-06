import { app, Menu } from "electron";

type DesktopApplicationMenuOptions = {
  appIconPath: string;
  isPackaged: boolean;
  openSettings(): void;
  platform: NodeJS.Platform;
  version: string;
};

export class DesktopApplicationMenu {
  constructor(private readonly options: DesktopApplicationMenuOptions) {}

  configureAboutPanel(): void {
    if (this.options.platform !== "darwin") {
      return;
    }

    const version = this.options.version;
    const applicationVersion = this.options.isPackaged ? version : "Development build";
    app.setAboutPanelOptions({
      applicationName: "Nile",
      applicationVersion,
      version: this.options.isPackaged ? version : "",
      iconPath: this.options.appIconPath,
    });
  }

  install(): void {
    if (this.options.platform !== "darwin") {
      return;
    }

    const menu = Menu.buildFromTemplate([
      {
        label: "Nile",
        submenu: [
          { role: "about", label: "About Nile" },
          { type: "separator" },
          { role: "services" },
          { type: "separator" },
          { role: "hide", label: "Hide Nile" },
          { role: "hideOthers" },
          { role: "unhide" },
          { type: "separator" },
          { role: "quit", label: "Quit Nile" },
        ],
      },
      {
        label: "File",
        submenu: [{ label: "Open Main Window", click: () => this.options.openSettings() }],
      },
      {
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      {
        label: "View",
        submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }],
      },
      {
        role: "window",
        submenu: [{ role: "minimize" }, { role: "close" }],
      },
    ]);

    Menu.setApplicationMenu(menu);
  }
}
