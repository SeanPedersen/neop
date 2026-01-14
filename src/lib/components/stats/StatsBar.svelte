<script lang="ts">
  import type { SystemStats } from "$lib/types";
  import {
    CpuPanel,
    MemoryPanel,
    StoragePanel,
    SystemPanel,
    NetworkPanel,
    DiskIOPanel,
  } from "$lib/components";

  export let systemStats: SystemStats | null = null;
</script>

<div class="dashboard-stats">
  {#if systemStats}
    <div class="stats-layout">
      <CpuPanel cpuUsage={systemStats.cpu_usage} />

      <MemoryPanel
        memoryTotal={systemStats.memory_total}
        memoryUsed={systemStats.memory_used}
        memoryFree={systemStats.memory_free}
      />

      <NetworkPanel
        networkRxBytes={systemStats.network_rx_bytes}
        networkTxBytes={systemStats.network_tx_bytes}
      />

      <DiskIOPanel
        diskIoReadBytes={systemStats.disk_io_read_bytes}
        diskIoWriteBytes={systemStats.disk_io_write_bytes}
      />

      <StoragePanel
        diskTotalBytes={systemStats.disk_total_bytes}
        diskUsedBytes={systemStats.disk_used_bytes}
        diskFreeBytes={systemStats.disk_free_bytes}
      />

      <SystemPanel uptime={systemStats.uptime} loadAvg={systemStats.load_avg} />
    </div>
  {/if}
</div>

<style>
  .dashboard-stats {
    padding: 0.5rem;
    overflow-x: auto;
  }

  .stats-layout {
    display: flex;
    gap: 0.75rem;
    width: 100%;
  }
</style>
