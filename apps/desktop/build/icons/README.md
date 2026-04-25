# Desktop Icon Outputs

This directory is for desktop-only icon outputs derived from the shared source asset at `../../../assets/icons/nile-mark.svg`.

Expected files:

- `nileTemplate.png`: 16x16 macOS tray/menubar template image
- `nileTemplate@2x.png`: 32x32 Retina tray/menubar template image
- `icon.png`: runtime app/window icon used during local Electron development
- `icon.icns`: packaged macOS app icon

Notes:

- Keep the source SVG in `assets/icons` so README and app packaging reference the same design source.
- Do not use the tray template PNG as the app icon.
- Use `icon.png` for local Electron runtime and `icon.icns` for packaged macOS app output.
- macOS tray icons should remain simple monochrome template images.
