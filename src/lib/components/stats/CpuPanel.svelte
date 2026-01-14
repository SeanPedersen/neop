<script lang="ts">
  import { faMicrochip } from "@fortawesome/free-solid-svg-icons";
  import { PanelHeader, ProgressBar } from "$lib/components";
  import { formatPercentage } from "$lib/utils";

  export let cpuUsage: number[];
  export let onGraphClick: (() => void) | undefined = undefined;

  $: averageUsage = formatPercentage(
    cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length,
  );
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="stat-panel"
  class:clickable={!!onGraphClick}
  on:click={onGraphClick}
>
  <PanelHeader icon={faMicrochip} title="CPU Usage" usageValue={averageUsage} />
  <div class="stats-content cpu-grid">
    {#each cpuUsage as usage, i}
      <div class="stat-item with-progress">
        <ProgressBar
          label={`Core ${i}`}
          value={usage}
          labelWidth="2.5rem"
          valueWidth="2.5rem"
        />
      </div>
    {/each}
  </div>
</div>

<style>
  .stat-panel {
    flex: 2.5;
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

  .cpu-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.4rem 2rem;
    height: auto;
    overflow: visible;
  }

  .stat-item.with-progress {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
</style>
