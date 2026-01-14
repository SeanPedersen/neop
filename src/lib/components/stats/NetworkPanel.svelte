<script lang="ts">
  import { faNetworkWired } from "@fortawesome/free-solid-svg-icons";
  import { PanelHeader, StatItem } from "$lib/components";
  import { formatBytes } from "$lib/utils";

  export let networkRxBytes: number;
  export let networkTxBytes: number;
  export let onGraphClick: (() => void) | undefined = undefined;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="stat-panel"
  class:clickable={!!onGraphClick}
  on:click={onGraphClick}
>
  <PanelHeader icon={faNetworkWired} title="Network I/O" />
  <div class="network-stats">
    <StatItem label="↓ Receiving" value={formatBytes(networkRxBytes)} />
    <StatItem label="↑ Sending" value={formatBytes(networkTxBytes)} />
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

  .network-stats {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
</style>
