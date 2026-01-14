import { writable, derived } from "svelte/store";
import type {
  Process,
  ProcessHistory,
  ProcessHistoryDataPoint,
} from "$lib/types";

interface ProcessHistoryStore {
  histories: Map<number, ProcessHistoryDataPoint[]>;
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
      const pid = process.pid;

      if (!histories.has(pid)) {
        histories.set(pid, []);
      }

      const dataPoints = histories.get(pid)!;
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
      const currentPids = new Set(processes.map((p) => p.pid));

      // Remove histories for processes that no longer exist
      for (const pid of histories.keys()) {
        if (!currentPids.has(pid)) {
          histories.delete(pid);
        }
      }

      // Add data points for all current processes
      processes.forEach((process) => {
        const pid = process.pid;

        if (!histories.has(pid)) {
          histories.set(pid, []);
        }

        const dataPoints = histories.get(pid)!;
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

  const getHistory = (pid: number): ProcessHistoryDataPoint[] => {
    let history: ProcessHistoryDataPoint[] = [];
    const unsubscribe = subscribe((state) => {
      history = state.histories.get(pid) || [];
    });
    unsubscribe();
    return history;
  };

  const clearHistory = (pid: number) => {
    update((state) => {
      const histories = new Map(state.histories);
      histories.delete(pid);
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
