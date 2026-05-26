import { describe, expect, it } from "vitest";

import { SettingsConnectionMutationCoordinator } from "./ConnectionMutation";

describe("SettingsConnectionMutationCoordinator", () => {
  it("routes non-reused connections to the configured completion target", () => {
    const events: string[] = [];
    const coordinator = new SettingsConnectionMutationCoordinator({
      addConnectionReturnTarget: { kind: "connections-detail" },
      setCurrentPage: (page) => {
        events.push(`page:${page}`);
      },
      setReusedConnectionDialog: () => {
        events.push("dialog:set");
      },
      setSelectedConnectionId: (connectionId) => {
        events.push(`connection:${connectionId}`);
      },
    });

    coordinator.complete("connection-1", false);

    expect(events).toEqual([
      "connection:connection-1",
      "page:connections",
    ]);
  });

  it("stores reused connections in the dialog state", () => {
    const dialogs: Array<{ connectionId: string; target: { kind: "agents" } } | null> = [];
    const coordinator = new SettingsConnectionMutationCoordinator({
      addConnectionReturnTarget: { kind: "agents" },
      setCurrentPage: () => {
        throw new Error("should not navigate for reused connections");
      },
      setReusedConnectionDialog: (dialog) => {
        dialogs.push(dialog as { connectionId: string; target: { kind: "agents" } } | null);
      },
      setSelectedConnectionId: () => {
        throw new Error("should not select for reused connections");
      },
    });

    coordinator.complete("connection-2", true);

    expect(dialogs).toEqual([
      {
        connectionId: "connection-2",
        target: { kind: "agents" },
      },
    ]);
  });

  it("continues a reused connection dialog using its saved target", () => {
    const events: string[] = [];
    const coordinator = new SettingsConnectionMutationCoordinator({
      addConnectionReturnTarget: { kind: "agents" },
      setCurrentPage: (page) => {
        events.push(`page:${page}`);
      },
      setReusedConnectionDialog: (dialog) => {
        events.push(`dialog:${dialog ? "set" : "clear"}`);
      },
      setSelectedConnectionId: (connectionId) => {
        events.push(`connection:${connectionId}`);
      },
    });

    coordinator.continue({
      connectionId: "connection-3",
      target: { kind: "quick-setup" },
    });

    expect(events).toEqual([
      "dialog:clear",
      "connection:null",
      "page:quick-setup",
    ]);
  });

  it("ignores empty reused dialogs", () => {
    const events: string[] = [];
    const coordinator = new SettingsConnectionMutationCoordinator({
      addConnectionReturnTarget: { kind: "agents" },
      setCurrentPage: (page) => {
        events.push(`page:${page}`);
      },
      setReusedConnectionDialog: (dialog) => {
        events.push(`dialog:${dialog ? "set" : "clear"}`);
      },
      setSelectedConnectionId: (connectionId) => {
        events.push(`connection:${connectionId}`);
      },
    });

    coordinator.continue(null);

    expect(events).toEqual([]);
  });
});
