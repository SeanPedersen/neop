<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { debounce } from "$lib/utils";
  import {
    StatsBar,
    ToolBar,
    TitleBar,
    ProcessTable,
    ProcessDetailsModal,
    KillProcessModal,
  } from "$lib/components/index";
  import { themeStore, settingsStore, processStore } from "$lib/stores/index";
  import { column_definitions } from "$lib/definitions/columns";
  import { filterProcesses, sortProcesses } from "$lib/utils";
  import type { Process } from "$lib/types";

  $: ({
    processes,
    systemStats,
    error,
    searchTerm,
    isLoading,
    currentPage,
    pinnedProcesses,
    selectedProcess,
    showInfoModal,
    showConfirmModal,
    processToKill,
    isKilling,
    isFrozen,
    sortConfig,
  } = $processStore);

  let intervalId: NodeJS.Timeout;
  let lastProcessCount = 0;
  let cachedFilteredProcesses: Process[] = [];
  let cachedSortedProcesses: Process[] = [];
  let paginatedProcesses: Process[] = [];

  // Initialize filters object for the new FilterToggle
  let filters = {
    cpu: { operator: ">", value: 50, enabled: false },
    ram: { operator: ">", value: 100, enabled: false },
    runtime: { operator: ">", value: 60, enabled: false },
    status: { values: [], enabled: false },
  };

  $: columns = column_definitions.map((col) => ({
    ...col,
    visible:
      col.required ||
      ($settingsStore.appearance.columnVisibility[col.id] ?? col.visible),
  }));
  $: itemsPerPage = $settingsStore.behavior.itemsPerPage;
  $: refreshRate = $settingsStore.behavior.refreshRate;

  // Throttled filtering to reduce CPU usage
  let lastFilterTerm = "";
  let lastFilterState = JSON.stringify(filters);

  const debouncedFilter = debounce(() => {
    const hasFilters = Object.values(filters).some((f) => f.enabled);
    if (hasFilters || searchTerm) {
      cachedFilteredProcesses = filterProcesses(processes, searchTerm, filters);
    } else {
      cachedFilteredProcesses = processes;
    }
  }, 100);

  // Only recalculate filtering when search term or filters actually change
  $: {
    const filterStateChanged =
      lastFilterTerm !== searchTerm ||
      lastFilterState !== JSON.stringify(filters);
    const countChanged = processes.length !== lastProcessCount;
    const hasFilters = Object.values(filters).some((f) => f.enabled);
    const hasSearchTerm = searchTerm.length > 0;

    if (filterStateChanged || countChanged) {
      lastProcessCount = processes.length;
      lastFilterTerm = searchTerm;
      lastFilterState = JSON.stringify(filters);

      // Skip debounce on initial load when there are no filters
      if (!hasFilters && !hasSearchTerm) {
        cachedFilteredProcesses = processes;
        console.log("[Filter] Immediate filter, processes:", processes.length);
      } else {
        debouncedFilter();
      }
    } else if (!hasSearchTerm && !hasFilters) {
      // No filters - reuse the same reference if already set to processes
      if (cachedFilteredProcesses !== processes) {
        cachedFilteredProcesses = processes;
      }
    }
  }

  // Cache sorted results - re-sort when cachedFilteredProcesses changes
  $: {
    // Always sort when we have processes and sortConfig
    // This will trigger whenever cachedFilteredProcesses changes (new reference)
    if (sortConfig && cachedFilteredProcesses.length > 0) {
      cachedSortedProcesses = sortProcesses(
        cachedFilteredProcesses,
        sortConfig,
        pinnedProcesses,
      );
      console.log(
        "[Sort] Sorted processes:",
        cachedSortedProcesses.length,
        "by",
        sortConfig.field,
        sortConfig.direction,
      );
    } else if (cachedFilteredProcesses.length === 0) {
      // Clear sorted list when there are no filtered processes
      cachedSortedProcesses = [];
    }
  }

  $: totalPages = Math.ceil(cachedFilteredProcesses.length / itemsPerPage);

  // Track pagination parameters
  let lastPage = currentPage;
  let lastItemsPerPage = itemsPerPage;
  let lastSortedLength = 0;

  $: {
    const pageChanged = lastPage !== currentPage;
    const itemsPerPageChanged = lastItemsPerPage !== itemsPerPage;
    const needsNewSlice = pageChanged || itemsPerPageChanged;

    if (needsNewSlice || paginatedProcesses.length === 0) {
      lastPage = currentPage;
      lastItemsPerPage = itemsPerPage;
      lastSortedLength = cachedSortedProcesses.length;

      paginatedProcesses = cachedSortedProcesses.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
      );

      console.log(
        "[Paginate] New slice, paginated:",
        paginatedProcesses.length,
        "from",
        cachedSortedProcesses.length,
        "currentPage:",
        currentPage,
        "itemsPerPage:",
        itemsPerPage,
      );
      if (paginatedProcesses.length > 0) {
        console.log(
          "[Paginate] First 3 processes CPU:",
          paginatedProcesses[0]?.cpu_usage,
          paginatedProcesses[1]?.cpu_usage,
          paginatedProcesses[2]?.cpu_usage,
        );
      }
    } else {
      // Update existing array in place - this preserves the reference
      const start = (currentPage - 1) * itemsPerPage;
      const end = start + itemsPerPage;
      const newSlice = cachedSortedProcesses.slice(start, end);

      console.log(
        "[Paginate] In-place update, from",
        paginatedProcesses.length,
        "to",
        newSlice.length,
      );
      if (newSlice.length > 0) {
        console.log(
          "[Paginate] In-place first 3 CPU:",
          newSlice[0]?.cpu_usage,
          newSlice[1]?.cpu_usage,
          newSlice[2]?.cpu_usage,
        );
      }

      // Adjust array length if needed
      paginatedProcesses.length = newSlice.length;

      // Update all items
      for (let i = 0; i < newSlice.length; i++) {
        paginatedProcesses[i] = newSlice[i];
      }

      lastSortedLength = cachedSortedProcesses.length;
    }
  }

  $: {
    if (searchTerm || itemsPerPage) {
      processStore.setCurrentPage(1);
    }
  }

  // Reset to page 1 if current page is beyond total pages
  $: if (currentPage > totalPages && totalPages > 0) {
    processStore.setCurrentPage(1);
  }

  $: {
    if (intervalId) clearInterval(intervalId);
    if (!isFrozen) {
      intervalId = setInterval(() => {
        processStore.getProcesses();
      }, refreshRate);
    }
  }

  onMount(async () => {
    // Initialize settings FIRST so itemsPerPage and other configs are ready
    settingsStore.init();
    themeStore.init();

    try {
      // First fetch - will have 0% CPU for all processes
      await processStore.getProcesses();
      console.log("[Mount] First fetch complete");

      // Wait 100ms then fetch again to get real CPU values
      await new Promise((resolve) => setTimeout(resolve, 100));
      await processStore.getProcesses();
      console.log("[Mount] Second fetch complete with real CPU data");
    } catch (error) {
      console.error("Failed to load processes:", error);
    } finally {
      processStore.setIsLoading(false);
      console.log("[Mount] isLoading = false, showing UI");
    }
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });
</script>

{#if isLoading}
  <div class="loading-container">
    <div class="loading-content">
      <img src="128x128.png" alt="NeoHtop Logo" class="logo" />
    </div>
  </div>
{:else}
  <div class="app-container">
    <TitleBar />
    <main>
      {#if systemStats}
        <StatsBar {systemStats} />
      {/if}

      <ToolBar
        bind:searchTerm={$processStore.searchTerm}
        bind:itemsPerPage
        bind:currentPage={$processStore.currentPage}
        bind:refreshRate
        bind:isFrozen={$processStore.isFrozen}
        bind:filters
        {totalPages}
        totalResults={cachedFilteredProcesses.length}
        bind:columns
      />

      {#if error}
        <div class="alert">{error}</div>
      {/if}

      <ProcessTable
        processes={paginatedProcesses}
        {columns}
        {systemStats}
        {sortConfig}
        {pinnedProcesses}
        onToggleSort={processStore.toggleSort}
        onTogglePin={processStore.togglePin}
        onShowDetails={processStore.showProcessDetails}
        onKillProcess={processStore.confirmKillProcess}
      />
    </main>
  </div>
{/if}

<ProcessDetailsModal
  show={showInfoModal}
  process={selectedProcess}
  {processes}
  cpuCoreCount={systemStats?.cpu_usage?.length || 1}
  onClose={processStore.closeProcessDetails}
  onShowDetails={processStore.showProcessDetails}
/>

<KillProcessModal
  show={showConfirmModal}
  process={processToKill}
  {isKilling}
  onClose={processStore.closeConfirmKill}
  onConfirm={processStore.handleConfirmKill}
/>

<style>
  :global(:root) {
    --base: #1e1e2e;
    --mantle: #181825;
    --crust: #11111b;
    --text: #cdd6f4;
    --subtext0: #a6adc8;
    --subtext1: #bac2de;
    --surface0: #313244;
    --surface1: #45475a;
    --surface2: #585b70;
    --overlay0: #6c7086;
    --overlay1: #7f849c;
    --blue: #89b4fa;
    --lavender: #b4befe;
    --sapphire: #74c7ec;
    --sky: #89dceb;
    --red: #f38ba8;
    --maroon: #eba0ac;
    --peach: #fab387;
    --yellow: #f9e2af;
    --green: #a6e3a1;
    --teal: #94e2d5;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
      sans-serif, "Apple Color Emoji", "Segoe UI Emoji";
    background-color: var(--base);
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
    user-select: none;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: min-content;
    overflow: hidden;
  }

  .app-container {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .alert {
    margin: 8px;
    padding: 8px 12px;
    background-color: var(--surface0);
    border: 1px solid var(--red);
    border-radius: 6px;
    color: var(--red);
    font-size: 13px;
  }

  .loading-container {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--base) 0%, var(--mantle) 100%);
    position: relative;
    overflow: hidden;
  }

  .loading-content {
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .logo {
    width: 128px;
    height: 128px;
    filter: drop-shadow(0 0 5px var(--text)) drop-shadow(0 0 10px var(--text))
      drop-shadow(0 0 20px var(--blue)) drop-shadow(0 0 40px var(--blue));
    animation: neonPulse 2s ease-in-out infinite;
  }

  @keyframes neonPulse {
    0%,
    100% {
      filter: drop-shadow(0 0 5px var(--text)) drop-shadow(0 0 10px var(--text))
        drop-shadow(0 0 20px var(--blue)) drop-shadow(0 0 40px var(--blue));
    }
    50% {
      filter: drop-shadow(0 0 10px var(--text))
        drop-shadow(0 0 20px var(--text)) drop-shadow(0 0 40px var(--blue))
        drop-shadow(0 0 80px var(--blue));
    }
  }
</style>
