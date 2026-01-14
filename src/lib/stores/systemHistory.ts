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
  ppid: number;
  parentStartTime: number; // Parent's start_time for composite key lookup
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

        // Find parent process to get its start_time
        // First try current processes
        let parentStartTime = 0;
        const parentProcess = processes.find((p) => p.pid === process.ppid);

        if (parentProcess) {
          parentStartTime = parentProcess.start_time;
        } else if (process.ppid !== 0 && process.ppid !== 1) {
          // Parent not in current processes, check if we have it in the accumulator
          // Skip PID 1 (launchd/init) as it's special and has start_time 0
          // Find the most recent accumulator entry with matching ppid
          const existingParents = Array.from(processAccumulators.values())
            .filter((acc) => acc.pid === process.ppid)
            .sort((a, b) => b.lastSeen - a.lastSeen);

          if (existingParents.length > 0) {
            parentStartTime = existingParents[0].startTime;
          }
        }
        // For ppid === 1 (launchd), parentStartTime stays 0 which is correct

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
          // Update parent info in case it changed (though unlikely)
          existing.ppid = process.ppid;
          existing.parentStartTime = parentStartTime;
        } else {
          processAccumulators.set(key, {
            pid: process.pid,
            ppid: process.ppid,
            parentStartTime: parentStartTime,
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
