import { writable } from "svelte/store";
import type { SystemStats } from "$lib/types";

export interface SystemHistoryDataPoint {
  timestamp: number;
  cpu_average: number;
  memory_used: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  disk_io_read_bytes: number;
  disk_io_write_bytes: number;
}

interface SystemHistoryStore {
  dataPoints: SystemHistoryDataPoint[];
}

const initialState: SystemHistoryStore = {
  dataPoints: [],
};

function createSystemHistoryStore() {
  const { subscribe, set, update } = writable<SystemHistoryStore>(initialState);

  const addDataPoint = (systemStats: SystemStats) => {
    update((state) => {
      const dataPoints = [...state.dataPoints];
      const cpuAverage =
        systemStats.cpu_usage.reduce((a, b) => a + b, 0) /
        systemStats.cpu_usage.length;

      const newDataPoint: SystemHistoryDataPoint = {
        timestamp: Date.now(),
        cpu_average: cpuAverage,
        memory_used: systemStats.memory_used,
        network_rx_bytes: systemStats.network_rx_bytes,
        network_tx_bytes: systemStats.network_tx_bytes,
        disk_io_read_bytes: systemStats.disk_io_read_bytes,
        disk_io_write_bytes: systemStats.disk_io_write_bytes,
      };

      dataPoints.push(newDataPoint);

      return { ...state, dataPoints };
    });
  };

  const clearHistory = () => {
    set(initialState);
  };

  return {
    subscribe,
    addDataPoint,
    clearHistory,
  };
}

export const systemHistoryStore = createSystemHistoryStore();
