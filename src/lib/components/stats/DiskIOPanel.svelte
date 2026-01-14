<script lang="ts">
  import { faHardDrive } from "@fortawesome/free-solid-svg-icons";
  import { PanelHeader, StatItem } from "$lib/components";
  import { formatBytes } from "$lib/utils";

  export let diskIoReadBytes: number;
  export let diskIoWriteBytes: number;
  export let onGraphClick: (() => void) | undefined = undefined;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="stat-panel"
  class:clickable={!!onGraphClick}
  on:click={onGraphClick}
>
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

  .stat-panel.clickable {
    cursor: pointer;
  }

  .diskio-stats {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
</style>
