<script lang="ts">
  import type { Process, Column } from "$lib/types";
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import Fa from "svelte-fa";
  import { faThumbtack, faXmark } from "@fortawesome/free-solid-svg-icons";

  export let processes: Process[];
  export let columns: Column[];
  export let systemStats: { memory_total: number } | null;
  export let sortConfig: { field: keyof Process; direction: "asc" | "desc" };
  export let pinnedProcesses: Set<string>;

  export let onToggleSort: (field: keyof Process) => void;
  export let onTogglePin: (command: string) => void;
  export let onShowDetails: (process: Process) => void;
  export let onKillProcess: (process: Process) => void;

  import { onMount } from "svelte";

  let scrollElement: HTMLDivElement;
  let virtualizerInstance: any = null;
  let lastProcessesRef = processes;

  // Recreate virtualizer only when array reference changes (page size change), not on length change
  $: if (scrollElement) {
    const refChanged = lastProcessesRef !== processes;

    if (!virtualizerInstance || refChanged) {
      lastProcessesRef = processes;
      virtualizerInstance = createVirtualizer({
        count: processes.length,
        getScrollElement: () => scrollElement,
        estimateSize: () => 36,
        overscan: 5,
      });
    }
  }

  $: items = virtualizerInstance ? $virtualizerInstance.getVirtualItems() : [];
  $: totalSize = virtualizerInstance ? $virtualizerInstance.getTotalSize() : 0;

  $: visibleColumns = columns.filter((col) => col.visible);

  // Dynamically generate grid template based on visible columns
  $: gridTemplate =
    visibleColumns
      .map((col) => {
        // Assign relative widths based on column type
        switch (col.id) {
          case "name":
            return "2fr";
          case "pid":
            return "0.7fr";
          case "status":
            return "0.8fr";
          case "user":
            return "0.9fr";
          case "cpu_usage":
            return "0.7fr";
          case "memory_usage":
            return "0.9fr";
          case "virtual_memory":
            return "0.9fr";
          case "disk_usage":
            return "1.5fr";
          case "run_time":
            return "1.3fr";
          default:
            return "1fr";
        }
      })
      .join(" ") + " 100px"; // Add actions column at the end

  function getSortIndicator(field: keyof Process) {
    if (sortConfig.field !== field) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  }

  function formatValue(process: Process, column: Column) {
    if (column.format) {
      return column.format(process[column.id]);
    }
    return process[column.id];
  }
</script>

<div class="grid-container" bind:this={scrollElement}>
  <div class="grid-inner" style="height: {totalSize}px;">
    <!-- Header Row -->
    <div class="grid-header" style="grid-template-columns: {gridTemplate};">
      {#each visibleColumns as column}
        <div
          class="grid-cell header-cell sortable"
          on:click={() => onToggleSort(column.id)}
          on:keydown={(e) => e.key === "Enter" && onToggleSort(column.id)}
          role="button"
          tabindex="0"
        >
          <div class="th-content">
            {column.label}
            <span
              class="sort-indicator"
              class:active={sortConfig.field === column.id}
            >
              {getSortIndicator(column.id)}
            </span>
          </div>
        </div>
      {/each}
      <div class="grid-cell header-cell">Actions</div>
    </div>

    <!-- Virtual Rows -->
    <div class="grid-rows">
      {#each items as virtualRow (virtualRow.index)}
        {@const process = processes[virtualRow.index]}
        {@const isPinned = pinnedProcesses.has(process.command)}
        {@const isHighUsage =
          process.cpu_usage > 50 ||
          process.memory_usage / (systemStats?.memory_total || 0) > 0.1}
        <div
          class="grid-row"
          class:high-usage={isHighUsage}
          class:pinned={isPinned}
          style="position: absolute; top: {virtualRow.start}px; left: 0; width: 100%; grid-template-columns: {gridTemplate};"
          on:click={() => onShowDetails(process)}
          on:keydown={(e) => e.key === "Enter" && onShowDetails(process)}
          role="button"
          tabindex="0"
        >
          {#each visibleColumns as column}
            <div class="grid-cell">
              {#if column.id === "name"}
                <div class="name-cell">
                  <span class="process-name">{process.name}</span>
                </div>
              {:else}
                {@html formatValue(process, column)}
              {/if}
            </div>
          {/each}
          <div class="grid-cell actions-cell">
            <button
              class="action-btn pin-btn"
              class:pinned={isPinned}
              on:click|stopPropagation={() => onTogglePin(process.command)}
              title={isPinned ? "Unpin" : "Pin"}
            >
              <Fa icon={faThumbtack} />
            </button>
            <button
              class="action-btn kill-btn"
              on:click|stopPropagation={() => onKillProcess(process)}
              title="Kill Process"
            >
              <Fa icon={faXmark} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .grid-container {
    flex: 1;
    overflow-x: auto;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--surface2) var(--mantle);
  }

  .grid-container::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .grid-container::-webkit-scrollbar-track {
    background: var(--mantle);
    border-radius: 4px;
  }

  .grid-container::-webkit-scrollbar-thumb {
    background: var(--surface2);
    border-radius: 4px;
    transition: background 0.2s ease;
  }

  .grid-container::-webkit-scrollbar-thumb:hover {
    background: var(--surface1);
  }

  .grid-container::-webkit-scrollbar-corner {
    background: var(--mantle);
  }

  .grid-inner {
    position: relative;
    width: 100%;
  }

  .grid-header,
  .grid-row {
    display: grid;
    font-size: 13px;
    width: 100%;
    gap: 0;
  }

  .grid-header {
    position: sticky;
    top: 0;
    z-index: 10;
    background: var(--mantle);
  }

  .grid-rows {
    position: relative;
    width: 100%;
  }

  .grid-cell {
    padding: 6px 12px;
    border-bottom: 1px solid var(--surface0);
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: flex;
    align-items: center;
    min-width: 0;
  }

  .header-cell {
    padding: 8px 12px;
    font-weight: 500;
    color: var(--subtext0);
    border-bottom: 1px solid var(--surface0);
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }

  .th-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sort-indicator {
    color: var(--overlay0);
    font-size: 12px;
    opacity: 0.5;
    transition: all 0.2s ease;
  }

  .sort-indicator.active {
    color: var(--blue);
    opacity: 1;
  }

  .sortable:hover .sort-indicator {
    opacity: 1;
  }

  .grid-row {
    cursor: pointer;
    transition: background-color 0.1s ease;
  }

  .grid-row:hover {
    background-color: var(--surface0);
  }

  .grid-row.high-usage {
    background-color: color-mix(in srgb, var(--red) 10%, transparent);
  }

  .grid-row.high-usage:hover {
    background-color: color-mix(in srgb, var(--red) 15%, transparent);
  }

  .grid-row.pinned {
    background-color: color-mix(in srgb, var(--blue) 10%, transparent);
  }

  .grid-row.pinned:hover {
    background-color: color-mix(in srgb, var(--blue) 15%, transparent);
  }

  .name-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .actions-cell {
    display: flex;
    gap: 4px;
    justify-content: flex-end;
  }

  .action-btn {
    background: transparent;
    border: 1px solid var(--surface0);
    color: var(--text);
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn :global(svg) {
    display: block;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: var(--surface0);
    border-color: var(--surface1);
  }

  /* Pin button styles */
  .pin-btn.pinned :global(svg) {
    transform: rotate(45deg);
  }

  /* Kill button styles */
  .kill-btn:hover {
    color: var(--red);
    background: var(--red);
    border-color: var(--red);
  }

  .kill-btn:hover :global(svg) {
    color: var(--crust);
  }
</style>
