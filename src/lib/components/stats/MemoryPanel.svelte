<script lang="ts">
  import { faMemory } from "@fortawesome/free-solid-svg-icons";
  import { PanelHeader, ProgressBar, StatItem } from "$lib/components";
  import { formatMemorySize, formatPercentage } from "$lib/utils";

  export let memoryTotal: number;
  export let memoryUsed: number;
  export let memoryFree: number;
  export let onGraphClick: (() => void) | undefined = undefined;

  $: memoryPercentage = (memoryUsed / memoryTotal) * 100;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="stat-panel"
  class:clickable={!!onGraphClick}
  on:click={onGraphClick}
>
  <PanelHeader
    icon={faMemory}
    title="Memory"
    usageValue={formatPercentage(memoryPercentage)}
  />
  <div class="stats-content">
    <div class="stat-item with-progress">
      <ProgressBar
        label="Memory usage"
        value={memoryPercentage}
        labelWidth="5rem"
        valueWidth="2.5rem"
      />
    </div>
    <StatItem label="Total" value={formatMemorySize(memoryTotal)} />
    <StatItem label="Used" value={formatMemorySize(memoryUsed)} />
    <StatItem label="Free" value={formatMemorySize(memoryFree)} />
  </div>
</div>

<style>
  .stat-panel {
    flex: 2;
    min-width: 0;
    background-color: var(--mantle);
    border-radius: 6px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
  }

  .stat-panel.clickable {
    cursor: pointer;
  }

  .stats-content {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .stat-item.with-progress {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
</style>
