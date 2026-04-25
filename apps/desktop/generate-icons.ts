import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const desktopRoot = dirname(fileURLToPath(import.meta.url));
const sourceIcon = join(desktopRoot, "..", "..", "assets", "icons", "nile-mark.svg");
const outputDir = join(desktopRoot, "build", "icons");

class DesktopIconsGenerator {
  async run(): Promise<void> {
    this.ensureCommand("iconutil");

    mkdirSync(outputDir, { recursive: true });

    const workspace = mkdtempSync(join(tmpdir(), "nile-desktop-icons-"));
    try {
      await this.renderSourcePng(workspace);
      const appSourcePng = await this.renderAppSourcePng(workspace);
      const traySourcePng = await this.renderTraySourcePng(workspace);
      await this.renderTrayPng(traySourcePng, 16, join(outputDir, "nileTemplate.png"));
      await this.renderTrayPng(traySourcePng, 32, join(outputDir, "nileTemplate@2x.png"));
      await this.renderAppPng(appSourcePng, join(outputDir, "icon.png"));
      await this.renderIcns(appSourcePng, workspace, join(outputDir, "icon.icns"));
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }

  private ensureCommand(name: string): void {
    try {
      execFileSync("which", [name], { stdio: "ignore" });
    } catch {
      throw new Error(`Missing required macOS tool: ${name}`);
    }
  }

  private async renderSourcePng(workspace: string): Promise<string> {
    const pngPath = join(workspace, "source-1024.png");
    const svg = readFileSync(sourceIcon);
    await sharp(svg, { density: 1024 })
      .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(pngPath);

    if (!existsSync(pngPath)) {
      throw new Error(`Failed to render source icon from ${sourceIcon}`);
    }
    return pngPath;
  }

  private async renderTraySourcePng(workspace: string): Promise<string> {
    const pngPath = join(workspace, "source-1024-tray.png");
    const base = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect x="110" y="110" width="804" height="804" rx="178" fill="#000000"/></svg>`,
          ),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    const cutoutWaves = await sharp(readFileSync(sourceIcon), { density: 1024 })
      .resize(915, 915, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    await sharp(base)
      .composite([
        {
          input: cutoutWaves,
          left: 55,
          top: 55,
          blend: "dest-out",
        },
      ])
      .png()
      .toFile(pngPath);

    if (!existsSync(pngPath)) {
      throw new Error(`Failed to render tray icon source from ${sourceIcon}`);
    }
    return pngPath;
  }

  private async renderAppSourcePng(workspace: string): Promise<string> {
    const pngPath = join(workspace, "source-1024-app.png");
    await sharp(Buffer.from(this.buildAppIconSvg()), { density: 1024 })
      .png()
      .toFile(pngPath);

    if (!existsSync(pngPath)) {
      throw new Error(`Failed to render app icon source from ${sourceIcon}`);
    }
    return pngPath;
  }

  private buildAppIconSvg(): string {
    const foreground = this.buildEmbeddedMark("#F8FBFF", 106, 112, 1);
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
        <defs>
          <linearGradient id="appGradient" x1="512" y1="88" x2="512" y2="936" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#69C0FF"/>
            <stop offset="52%" stop-color="#3E93EB"/>
            <stop offset="100%" stop-color="#245FCE"/>
          </linearGradient>
          <linearGradient id="topSheen" x1="512" y1="88" x2="512" y2="344" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.10"/>
            <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bottomShade" x1="512" y1="664" x2="512" y2="936" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#174EB6" stop-opacity="0"/>
            <stop offset="100%" stop-color="#174EB6" stop-opacity="0.16"/>
          </linearGradient>
          <linearGradient id="rim" x1="512" y1="104" x2="512" y2="918" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect x="88" y="88" width="848" height="848" rx="188" fill="url(#appGradient)"/>
        <rect x="88" y="88" width="848" height="848" rx="188" fill="url(#topSheen)"/>
        <rect x="88" y="88" width="848" height="848" rx="188" fill="url(#bottomShade)"/>
        <rect x="105" y="104" width="814" height="814" rx="170" fill="none" stroke="url(#rim)" stroke-width="4"/>
        ${foreground}
      </svg>
    `.trim();
  }

  private buildEmbeddedMark(stroke: string, x: number, y: number, opacity: number): string {
    return readFileSync(sourceIcon, "utf8")
      .replace(/stroke="#000"/g, `stroke="${stroke}"`)
      .replace(/stroke="currentColor"/g, `stroke="${stroke}"`)
      .replace(
        /<svg[^>]*viewBox="0 0 512 512">/,
        `<svg x="${x}" y="${y}" width="812" height="812" viewBox="0 0 512 512" opacity="${opacity}" style="color:${stroke}">`,
      );
  }
  private async renderTrayPng(sourcePng: string, size: number, outputPath: string): Promise<void> {
    await sharp(sourcePng)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
  }

  private async renderAppPng(sourcePng: string, outputPath: string): Promise<void> {
    await sharp(sourcePng)
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(outputPath);
  }

  private async renderIcns(sourcePng: string, workspace: string, outputPath: string): Promise<void> {
    const iconsetDir = join(workspace, "nile.iconset");
    mkdirSync(iconsetDir, { recursive: true });

    const sizes = [
      ["16", "icon_16x16.png"],
      ["32", "icon_16x16@2x.png"],
      ["32", "icon_32x32.png"],
      ["64", "icon_32x32@2x.png"],
      ["128", "icon_128x128.png"],
      ["256", "icon_128x128@2x.png"],
      ["256", "icon_256x256.png"],
      ["512", "icon_256x256@2x.png"],
      ["512", "icon_512x512.png"],
      ["1024", "icon_512x512@2x.png"],
    ] as const;

    for (const [size, name] of sizes) {
      await sharp(sourcePng)
        .resize(Number(size), Number(size), {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(join(iconsetDir, name));
    }

    try {
      execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", outputPath], { stdio: "ignore" });
    } catch {
      if (!existsSync(outputPath)) {
        throw new Error("Failed to generate icon.icns and no previous icon.icns is available");
      }
      console.warn("[desktop] iconutil failed; keeping existing icon.icns");
    }
  }
}

void new DesktopIconsGenerator().run();
