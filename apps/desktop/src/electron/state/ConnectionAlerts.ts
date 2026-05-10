import type { CreateConnectionAlertInput, UpdateConnectionAlertInput } from "../alerts/Store";
import { ConnectionAlertStore } from "../alerts/Store";

export class ConnectionAlerts {
  constructor(private readonly store: ConnectionAlertStore | null) {}

  create(input: CreateConnectionAlertInput) {
    if (!this.store) {
      throw new Error("Connection alert store is unavailable");
    }
    return this.store.create(input);
  }

  update(input: UpdateConnectionAlertInput) {
    if (!this.store) {
      throw new Error("Connection alert store is unavailable");
    }
    return this.store.update(input);
  }

  delete(connectionId: string, alertId: string): void {
    if (!this.store) {
      throw new Error("Connection alert store is unavailable");
    }
    this.store.delete(connectionId, alertId);
  }
}
