import { writable, derived } from "svelte/store";
import type {
  Process,
  ProcessHistory,
  ProcessHistoryDataPoint,
} from "$lib/types";

interface ProcessHistoryStore {
  histories: Map<string, ProcessHistoryDataPoint[]>; // Key is now "pid-startTime"
}

const initialState: ProcessHistoryStore = {
  histories: new Map(),
};

function createProcessHistoryStore() {
  const { subscribe, set, update } =
    writable<ProcessHistoryStore>(initialState);

  const addDataPoint = (process: Process) => {
    update((state) => {
      const histories = new Map(state.histories);
      const key = `${process.pid}-${process.start_time}`;

      if (!histories.has(key)) {
        histories.set(key, []);
      }

      const dataPoints = histories.get(key)!;
      const newDataPoint: ProcessHistoryDataPoint = {
        timestamp: Date.now(),
        cpu_usage: process.cpu_usage,
        memory_usage: process.memory_usage,
        disk_read: process.disk_usage[0],
        disk_write: process.disk_usage[1],
      };

      dataPoints.push(newDataPoint);

      return { ...state, histories };
    });
  };

  const addDataPoints = (processes: Process[]) => {
    update((state) => {
      const histories = new Map(state.histories);
      const currentKeys = new Set(
        processes.map((p) => `${p.pid}-${p.start_time}`),
      );

      // Don't remove histories for dead processes anymore - keep them for historical view
      // Only remove very old histories (optional: could add cleanup after X hours)

      // Add data points for all current processes
      processes.forEach((process) => {
        const key = `${process.pid}-${process.start_time}`;

        if (!histories.has(key)) {
          histories.set(key, []);
        }

        const dataPoints = histories.get(key)!;
        const newDataPoint: ProcessHistoryDataPoint = {
          timestamp: Date.now(),
          cpu_usage: process.cpu_usage,
          memory_usage: process.memory_usage,
          disk_read: process.disk_usage[0],
          disk_write: process.disk_usage[1],
        };

        dataPoints.push(newDataPoint);
      });

      return { ...state, histories };
    });
  };

  const getHistory = (
    pid: number,
    startTime: number,
  ): ProcessHistoryDataPoint[] => {
    let history: ProcessHistoryDataPoint[] = [];
    const key = `${pid}-${startTime}`;
    const unsubscribe = subscribe((state) => {
      history = state.histories.get(key) || [];
    });
    unsubscribe();
    return history;
  };

  const clearHistory = (pid: number, startTime: number) => {
    update((state) => {
      const histories = new Map(state.histories);
      const key = `${pid}-${startTime}`;
      histories.delete(key);
      return { ...state, histories };
    });
  };

  const clearAllHistories = () => {
    set(initialState);
  };

  return {
    subscribe,
    addDataPoint,
    addDataPoints,
    getHistory,
    clearHistory,
    clearAllHistories,
  };
}

export const processHistoryStore = createProcessHistoryStore();
