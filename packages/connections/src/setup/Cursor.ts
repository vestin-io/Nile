import type { ConnectionEndpointModule } from "./Types";

const CURSOR_ROOT_URL = "https://api2.cursor.sh";

export function createCursorEndpointModule(): ConnectionEndpointModule {
  return {
    preset: "cursor",
    async build() {
      return {
        id: "cursor",
        label: "Cursor",
        rootUrl: CURSOR_ROOT_URL,
        profile: "cursor-backend",
        protocols: {
          cursor: {},
        },
      };
    },
  };
}
