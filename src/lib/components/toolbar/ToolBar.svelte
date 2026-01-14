<script lang="ts">
  import {
    SearchBox,
    RefreshControls,
    ColumnToggle,
    FilterToggle,
    SettingsMenu,
  } from "$lib/components";
  import { overlayStore } from "$lib/stores/overlay";

  export let searchTerm: string;
  export let itemsPerPage: number;
  export let currentPage: number;
  export let totalPages: number;
  export let totalResults: number;
  export let columns: Array<{
    id: string;
    label: string;
    visible: boolean;
    required?: boolean;
  }>;
  export let refreshRate: number;
  export let isFrozen: boolean;
  export let filters: {
    cpu: { operator: string; value: number; enabled: boolean };
    ram: { operator: string; value: number; enabled: boolean };
    runtime: { operator: string; value: number; enabled: boolean };
    status: { values: string[]; enabled: boolean };
  } = {
    cpu: { operator: ">", value: 50, enabled: false },
    ram: { operator: ">", value: 100, enabled: false },
    runtime: { operator: ">", value: 60, enabled: false },
    status: { values: [], enabled: false },
  };

  function changePage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }

  $: isAnyOverlayOpen = $overlayStore !== null;
  $: activeOverlayType = $overlayStore;
  $: showPagination = totalPages > 1;
</script>

<div class="toolbar">
  <div class="toolbar-content" class:overlay-mode={isAnyOverlayOpen}>
    <div class:hidden={isAnyOverlayOpen && activeOverlayType !== "searchHelp"}>
      <SearchBox bind:searchTerm />
    </div>

    <div class:hidden={isAnyOverlayOpen && activeOverlayType !== "filters"}>
      <FilterToggle bind:filters />
    </div>

    <div class="toolbar-spacer" class:hidden={isAnyOverlayOpen}></div>

    {#if showPagination}
      <div
        class:hidden={isAnyOverlayOpen && activeOverlayType !== "pagination"}
      >
        <div class="pagination">
          <button
            class="btn-page"
            disabled={currentPage === 1}
            on:click={() => changePage(1)}
          >
            ««
          </button>
          <button
            class="btn-page"
            disabled={currentPage === 1}
            on:click={() => changePage(currentPage - 1)}
          >
            «
          </button>
          <div class="page-info">
            <span>Page {currentPage} of {totalPages}</span>
            <span class="results-info">({totalResults} processes)</span>
          </div>
          <button
            class="btn-page"
            disabled={currentPage === totalPages}
            on:click={() => changePage(currentPage + 1)}
          >
            »
          </button>
          <button
            class="btn-page"
            disabled={currentPage === totalPages}
            on:click={() => changePage(totalPages)}
          >
            »»
          </button>
        </div>
      </div>
      <div class="toolbar-spacer" class:hidden={isAnyOverlayOpen}></div>
    {/if}

    <div class:hidden={isAnyOverlayOpen && activeOverlayType !== "columns"}>
      <ColumnToggle {columns} />
    </div>

    <div class:hidden={isAnyOverlayOpen && activeOverlayType !== "refresh"}>
      <RefreshControls bind:refreshRate bind:isFrozen />
    </div>

    <div class:hidden={isAnyOverlayOpen && activeOverlayType !== "settings"}>
      <SettingsMenu bind:itemsPerPage />
    </div>
  </div>
</div>

<style>
  .toolbar {
    border-bottom: 1px solid var(--surface0);
    background-color: var(--mantle);
  }

  .toolbar-content {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 12px;
    min-width: max-content;
    height: 44px;
    position: relative;
  }

  .toolbar-content > div {
    display: flex;
    align-items: center;
  }

  .toolbar-content :global(.hidden) {
    opacity: 0;
    pointer-events: none;
  }

  .toolbar-spacer {
    flex: 1;
  }

  .pagination {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-page {
    padding: 6px 10px;
    font-size: 12px;
    color: var(--text);
    background: var(--surface0);
    border: 1px solid var(--surface1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-page:hover:not(:disabled) {
    background: var(--surface1);
  }

  .btn-page:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-info {
    font-size: 12px;
    color: var(--subtext0);
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
  }

  .page-info span {
    display: block;
  }

  .results-info {
    color: var(--overlay0);
  }
</style>
