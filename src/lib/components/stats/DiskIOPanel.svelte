<script lang="ts">
  import { faHardDrive } from "@fortawesome/free-solid-svg-icons";
  import { PanelHeader, StatItem } from "$lib/components";
  import { formatBytes } from "$lib/utils";

  export let diskIoReadBytes: number;
  export let diskIoWriteBytes: number;
</script>

<div class="stat-panel">
  <PanelHeader icon={faHardDrive} title="Disk I/O" />
  <div class="diskio-stats">
    <StatItem label="↓ Reading" value={`${formatBytes(diskIoReadBytes)}/s`} />
    <StatItem label="↑ Writing" value={`${formatBytes(diskIoWriteBytes)}/s`} />
  </div>
</div>

<style>
  .stat-panel {
    flex: 0.8;
    min-width: 125px;
    background-color: var(--mantle);
    border-radius: 6px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
  }

  .diskio-stats {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
</style>
