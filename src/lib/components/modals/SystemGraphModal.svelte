<script lang="ts">
  import { Modal } from "$lib/components";
  import TimeSeriesGraph from "$lib/components/stats/TimeSeriesGraph.svelte";
  import { systemHistoryStore } from "$lib/stores/systemHistory";

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
</script>

<Modal {show} title={currentConfig?.title || "System Graph"} {onClose}>
  {#if currentConfig && historyData.length > 0}
    <div class="graph-modal-content">
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

  .dual-graphs {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .no-data {
    padding: 3rem;
    text-align: center;
    color: var(--subtext0);
  }
</style>
