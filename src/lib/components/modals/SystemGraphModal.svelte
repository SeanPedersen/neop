<script lang="ts">
  import { Modal } from "$lib/components";
  import TimeSeriesGraph from "$lib/components/stats/TimeSeriesGraph.svelte";
  import { systemHistoryStore } from "$lib/stores/systemHistory";
  import type { ProcessResourceAccumulator } from "$lib/stores/systemHistory";

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

  const graphConfigs = {
    cpu: {
      title: "System CPU Usage",
      metric: "cpu_average" as const,
      label: "CPU Usage",
      color: "var(--blue)",
      maxValue: 100,
      showSingle: true,
    },
    memory: {
      title: "System Memory Usage",
      metric: "memory_used" as const,
      label: "Memory Usage",
      color: "var(--green)",
      maxValue: memoryTotal || null,
      showSingle: true,
    },
    network_rx: {
      title: "Network Received",
      metric: "network_rx_bytes" as const,
      label: "Network RX",
      color: "var(--lavender)",
      maxValue: null,
      showSingle: true,
    },
    network_tx: {
      title: "Network Transmitted",
      metric: "network_tx_bytes" as const,
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
</script>

<Modal {show} title={currentConfig?.title || "System Graph"} {onClose}>
  {#if currentConfig && historyData.length > 0}
    <div class="graph-modal-content">
      <div class="content-layout">
        <div class="graph-area">
          {#if currentConfig.showSingle}
            <TimeSeriesGraph
              data={historyData}
              metric={currentConfig.metric}
              label={currentConfig.label}
              color={currentConfig.color}
              height={300}
              maxValue={currentConfig.maxValue}
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
                <div class="process-item">
                  <div class="process-rank">#{index + 1}</div>
                  <div class="process-info">
                    <div class="process-name">{proc.name}</div>
                    <div class="process-stats">
                      <span class="process-pid">PID: {proc.pid}</span>
                      <span class="process-value"
                        >{formatResourceValue(proc, graphType)}</span
                      >
                    </div>
                  </div>
                </div>
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
  }

  .process-item:hover {
    background: var(--surface1);
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
