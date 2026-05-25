type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ReadTrayPopupPositionInput = {
  popupHeight: number;
  popupWidth: number;
  trayBounds: Rect;
  workArea: Rect;
};

export class TrayPopupPlacement {
  private static readonly gutter = 12;

  static readPosition(input: ReadTrayPopupPositionInput): { x: number; y: number } {
    const preferred = this.readPreferredPosition(input);
    return {
      x: this.clamp(
        preferred.x,
        input.workArea.x + TrayPopupPlacement.gutter,
        input.workArea.x + input.workArea.width - input.popupWidth - TrayPopupPlacement.gutter,
      ),
      y: this.clamp(
        preferred.y,
        input.workArea.y + TrayPopupPlacement.gutter,
        input.workArea.y + input.workArea.height - input.popupHeight - TrayPopupPlacement.gutter,
      ),
    };
  }

  private static readPreferredPosition(input: ReadTrayPopupPositionInput): { x: number; y: number } {
    const trayCenterX = input.trayBounds.x + Math.round(input.trayBounds.width / 2);
    const trayCenterY = input.trayBounds.y + Math.round(input.trayBounds.height / 2);

    if (input.trayBounds.y + input.trayBounds.height >= input.workArea.y + input.workArea.height) {
      return {
        x: trayCenterX - Math.round(input.popupWidth / 2),
        y: input.trayBounds.y - input.popupHeight - TrayPopupPlacement.gutter,
      };
    }

    if (input.trayBounds.y <= input.workArea.y) {
      return {
        x: trayCenterX - Math.round(input.popupWidth / 2),
        y: input.trayBounds.y + input.trayBounds.height + TrayPopupPlacement.gutter,
      };
    }

    if (input.trayBounds.x <= input.workArea.x) {
      return {
        x: input.trayBounds.x + input.trayBounds.width + TrayPopupPlacement.gutter,
        y: trayCenterY - Math.round(input.popupHeight / 2),
      };
    }

    return {
      x: input.trayBounds.x - input.popupWidth - TrayPopupPlacement.gutter,
      y: trayCenterY - Math.round(input.popupHeight / 2),
    };
  }

  private static clamp(value: number, min: number, max: number): number {
    if (max < min) {
      return min;
    }
    return Math.min(Math.max(value, min), max);
  }
}
