<script lang="ts">
  import { Modal } from "$lib/components";
  import TimeSeriesGraph from "$lib/components/stats/TimeSeriesGraph.svelte";
  import { systemHistoryStore } from "$lib/stores/systemHistory";
  import type { ProcessResourceAccumulator } from "$lib/stores/systemHistory";
  import type { Process } from "$lib/types";

  export let show = false;
  export let onClose: () => void;
  export let graphType:
    | "cpu"
    | "memory"
    | "network_rx"
    | "network_tx"
    | "disk_io"
    | null = null;
  export let memoryTotal: number | undefined = undefined;
  export let currentProcesses: Process[] = [];
  export let onProcessClick: ((process: Process) => void) | undefined =
    undefined;

  $: historyData = $systemHistoryStore.dataPoints;

  let topProcesses: ProcessResourceAccumulator[] = [];

  $: if (show && graphType) {
    // Get top processes based on graph type
    switch (graphType) {
      case "cpu":
        topProcesses = systemHistoryStore.getTopProcessesByCpu(10);
        break;
      case "memory":
        topProcesses = systemHistoryStore.getTopProcessesByMemory(10);
        break;
      case "disk_io":
        // For disk I/O, we'll show top by total I/O (read + write)
        const byRead = systemHistoryStore.getTopProcessesByDiskRead(10);
        const byWrite = systemHistoryStore.getTopProcessesByDiskWrite(10);
        // Combine and deduplicate
        const combined = [...byRead, ...byWrite];
        const uniqueMap = new Map<number, ProcessResourceAccumulator>();
        combined.forEach((proc) => {
          if (!uniqueMap.has(proc.pid)) {
            uniqueMap.set(proc.pid, proc);
          }
        });
        topProcesses = Array.from(uniqueMap.values())
          .sort(
            (a, b) =>
              b.totalDiskRead +
              b.totalDiskWrite -
              (a.totalDiskRead + a.totalDiskWrite),
          )
          .slice(0, 10);
        break;
      default:
        topProcesses = [];
    }
  }

  const graphConfigs: {
    [key: string]: {
      title: string;
      showSingle: boolean;
      metric?:
        | "cpu_average"
        | "memory_used"
        | "disk_io_read_bytes"
        | "disk_io_write_bytes"
        | "network_rx_bytes"
        | "network_tx_bytes";
      label?: string;
      color?: string;
      maxValue?: number | null;
    };
  } = {
    cpu: {
      title: "System CPU Usage",
      metric: "cpu_average",
      label: "CPU Usage",
      color: "var(--blue)",
      maxValue: 100,
      showSingle: true,
    },
    memory: {
      title: "System Memory Usage",
      metric: "memory_used",
      label: "Memory Usage",
      color: "var(--green)",
      maxValue: memoryTotal || null,
      showSingle: true,
    },
    network_rx: {
      title: "Network Received",
      metric: "network_rx_bytes",
      label: "Network RX",
      color: "var(--lavender)",
      maxValue: null,
      showSingle: true,
    },
    network_tx: {
      title: "Network Transmitted",
      metric: "network_tx_bytes",
      label: "Network TX",
      color: "var(--peach)",
      maxValue: null,
      showSingle: true,
    },
    disk_io: {
      title: "System Disk I/O",
      showSingle: false,
    },
  };

  $: currentConfig = graphType ? graphConfigs[graphType] : null;

  // Update memory maxValue when memoryTotal changes
  $: if (graphType === "memory" && memoryTotal) {
    graphConfigs.memory.maxValue = memoryTotal;
  }

  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeIndex = Math.max(0, Math.min(i, sizes.length - 1));
    return (bytes / Math.pow(k, sizeIndex)).toFixed(1) + " " + sizes[sizeIndex];
  }

  function formatResourceValue(
    proc: ProcessResourceAccumulator,
    type: "cpu" | "memory" | "disk_io",
  ): string {
    switch (type) {
      case "cpu":
        // Mean value
        return (proc.totalCpuUsage / proc.sampleCount).toFixed(1) + "% avg";
      case "memory":
        // Max value
        return formatBytes(proc.maxMemoryUsage) + " max";
      case "disk_io":
        // Sum (total) with read/write breakdown
        const total = proc.totalDiskRead + proc.totalDiskWrite;
        const read = formatBytes(proc.totalDiskRead);
        const write = formatBytes(proc.totalDiskWrite);
        return `${formatBytes(total)} (R: ${read}, W: ${write})`;
      default:
        return "";
    }
  }

  function isProcessAlive(proc: ProcessResourceAccumulator): boolean {
    return proc.status !== "Dead";
  }

  function handleProcessClick(proc: ProcessResourceAccumulator) {
    if (!onProcessClick) return;

    // Try to find the process in the current process list
    const liveProcess = currentProcesses.find(
      (p) => p.pid === proc.pid && p.start_time === proc.startTime,
    );

    if (liveProcess) {
      onProcessClick(liveProcess);
    } else {
      // Create a dead process object for display with saved information
      const deadProcess: Process = {
        pid: proc.pid,
        ppid: 0,
        name: proc.name,
        cpu_usage: 0,
        memory_usage: 0,
        status: "Dead",
        user: proc.user,
        command: proc.command,
        threads: 0,
        environ: [],
        root: "",
        virtual_memory: 0,
        start_time: proc.startTime,
        run_time: 0,
        disk_usage: [0, 0],
        session_id: 0,
      };
      onProcessClick(deadProcess);
    }
  }
</script>

<Modal {show} title={currentConfig?.title || "System Graph"} {onClose}>
  {#if currentConfig && historyData.length > 0}
    <div class="graph-modal-content">
      <div class="content-layout">
        <div class="graph-area">
          {#if currentConfig.showSingle && currentConfig.metric && currentConfig.label && currentConfig.color !== undefined}
            <TimeSeriesGraph
              data={historyData}
              metric={currentConfig.metric}
              label={currentConfig.label}
              color={currentConfig.color}
              height={300}
              maxValue={currentConfig.maxValue ?? null}
            />
          {:else if graphType === "disk_io"}
            <div class="dual-graphs">
              <TimeSeriesGraph
                data={historyData}
                metric="disk_io_read_bytes"
                label="Disk Read"
                color="var(--sapphire)"
                height={250}
              />
              <TimeSeriesGraph
                data={historyData}
                metric="disk_io_write_bytes"
                label="Disk Write"
                color="var(--maroon)"
                height={250}
              />
            </div>
          {/if}
        </div>

        {#if topProcesses.length > 0 && (graphType === "cpu" || graphType === "memory" || graphType === "disk_io")}
          <div class="top-processes">
            <h3>Top 10 Resource Hogs</h3>
            <div class="process-list">
              {#each topProcesses as proc, index}
                <button
                  class="process-item"
                  class:clickable={onProcessClick !== undefined}
                  class:dead={!isProcessAlive(proc)}
                  on:click={() => handleProcessClick(proc)}
                  type="button"
                >
                  <div class="process-rank">#{index + 1}</div>
                  <div class="process-info">
                    <div class="process-name">
                      {proc.name}
                      {#if !isProcessAlive(proc)}
                        <span class="dead-badge">Dead</span>
                      {/if}
                    </div>
                    <div class="process-stats">
                      <span class="process-pid">PID: {proc.pid}</span>
                      <span class="process-value"
                        >{formatResourceValue(proc, graphType)}</span
                      >
                    </div>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="no-data">
      <p>No data available yet. Wait for data to be collected...</p>
    </div>
  {/if}
</Modal>

<style>
  .graph-modal-content {
    padding: 1rem;
    min-height: 350px;
  }

  .content-layout {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .graph-area {
    width: 100%;
  }

  .dual-graphs {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .top-processes {
    background: var(--mantle);
    border-radius: 8px;
    padding: 1rem;
    width: 100%;
  }

  .top-processes h3 {
    margin: 0 0 1rem 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    border-bottom: 1px solid var(--surface1);
    padding-bottom: 0.5rem;
  }

  .process-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.5rem;
  }

  .process-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem;
    background: var(--surface0);
    border-radius: 6px;
    align-items: center;
    transition: background 0.2s ease;
    border: none;
    width: 100%;
    text-align: left;
  }

  .process-item.clickable {
    cursor: pointer;
  }

  .process-item.clickable:hover {
    background: var(--surface1);
  }

  .process-item.dead {
    opacity: 0.7;
  }

  .process-item.dead .process-name {
    color: var(--subtext0);
  }

  .process-rank {
    font-size: 12px;
    font-weight: 600;
    color: var(--blue);
    min-width: 28px;
  }

  .process-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .process-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dead-badge {
    display: inline-block;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 600;
    color: var(--red);
    background: rgba(243, 139, 168, 0.2);
    border-radius: 4px;
    text-transform: uppercase;
  }

  .process-stats {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--subtext0);
  }

  .process-pid {
    color: var(--subtext1);
  }

  .process-value {
    color: var(--blue);
    font-weight: 500;
  }

  .no-data {
    padding: 3rem;
    text-align: center;
    color: var(--subtext0);
  }
</style>
