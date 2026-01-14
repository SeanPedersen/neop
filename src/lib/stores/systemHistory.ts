import { writable } from "svelte/store";
import type { SystemStats, Process } from "$lib/types";

export interface SystemHistoryDataPoint {
  timestamp: number;
  cpu_average: number;
  memory_used: number;
  network_rx_bytes: number;
  network_tx_bytes: number;
  disk_io_read_bytes: number;
  disk_io_write_bytes: number;
}

export interface ProcessResourceAccumulator {
  pid: number;
  name: string;
  command: string;
  user: string;
  startTime: number;
  totalCpuUsage: number;
  maxMemoryUsage: number;
  totalDiskRead: number;
  totalDiskWrite: number;
  sampleCount: number;
  lastSeen: number;
  status: string;
}

interface SystemHistoryStore {
  dataPoints: SystemHistoryDataPoint[];
  processAccumulators: Map<string, ProcessResourceAccumulator>; // Key is now "pid-startTime"
}

const initialState: SystemHistoryStore = {
  dataPoints: [],
  processAccumulators: new Map(),
};

function createSystemHistoryStore() {
  const { subscribe, set, update } = writable<SystemHistoryStore>(initialState);

  const addDataPoint = (systemStats: SystemStats, processes: Process[]) => {
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

      // Update process accumulators
      const processAccumulators = new Map(state.processAccumulators);
      const now = Date.now();
      const currentProcessKeys = new Set<string>();

      processes.forEach((process) => {
        const key = `${process.pid}-${process.start_time}`;
        currentProcessKeys.add(key);

        const existing = processAccumulators.get(key);
        if (existing) {
          existing.totalCpuUsage += process.cpu_usage;
          existing.maxMemoryUsage = Math.max(
            existing.maxMemoryUsage,
            process.memory_usage,
          );
          existing.totalDiskRead += process.disk_usage[0];
          existing.totalDiskWrite += process.disk_usage[1];
          existing.sampleCount += 1;
          existing.lastSeen = now;
          existing.status = process.status;
        } else {
          processAccumulators.set(key, {
            pid: process.pid,
            name: process.name,
            command: process.command,
            user: process.user,
            startTime: process.start_time,
            totalCpuUsage: process.cpu_usage,
            maxMemoryUsage: process.memory_usage,
            totalDiskRead: process.disk_usage[0],
            totalDiskWrite: process.disk_usage[1],
            sampleCount: 1,
            lastSeen: now,
            status: process.status,
          });
        }
      });

      // Mark processes that are no longer in the current process list as "Dead"
      processAccumulators.forEach((accumulator, key) => {
        if (!currentProcessKeys.has(key)) {
          accumulator.status = "Dead";
        }
      });

      return { ...state, dataPoints, processAccumulators };
    });
  };

  const getTopProcessesByCpu = (
    limit: number = 10,
  ): ProcessResourceAccumulator[] => {
    let result: ProcessResourceAccumulator[] = [];
    const unsubscribe = subscribe((state) => {
      result = Array.from(state.processAccumulators.values())
        .sort((a, b) => b.totalCpuUsage - a.totalCpuUsage)
        .slice(0, limit);
    });
    unsubscribe();
    return result;
  };

  const getTopProcessesByMemory = (
    limit: number = 10,
  ): ProcessResourceAccumulator[] => {
    let result: ProcessResourceAccumulator[] = [];
    const unsubscribe = subscribe((state) => {
      result = Array.from(state.processAccumulators.values())
        .sort((a, b) => b.maxMemoryUsage - a.maxMemoryUsage)
        .slice(0, limit);
    });
    unsubscribe();
    return result;
  };

  const getTopProcessesByDiskRead = (
    limit: number = 10,
  ): ProcessResourceAccumulator[] => {
    let result: ProcessResourceAccumulator[] = [];
    const unsubscribe = subscribe((state) => {
      result = Array.from(state.processAccumulators.values())
        .sort((a, b) => b.totalDiskRead - a.totalDiskRead)
        .slice(0, limit);
    });
    unsubscribe();
    return result;
  };

  const getTopProcessesByDiskWrite = (
    limit: number = 10,
  ): ProcessResourceAccumulator[] => {
    let result: ProcessResourceAccumulator[] = [];
    const unsubscribe = subscribe((state) => {
      result = Array.from(state.processAccumulators.values())
        .sort((a, b) => b.totalDiskWrite - a.totalDiskWrite)
        .slice(0, limit);
    });
    unsubscribe();
    return result;
  };

  const clearHistory = () => {
    set(initialState);
  };

  return {
    subscribe,
    addDataPoint,
    getTopProcessesByCpu,
    getTopProcessesByMemory,
    getTopProcessesByDiskRead,
    getTopProcessesByDiskWrite,
    clearHistory,
  };
}

export const systemHistoryStore = createSystemHistoryStore();
