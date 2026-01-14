<script lang="ts">
  export let currentPage: number;
  export let totalPages: number;
  export let totalResults: number;

  function changePage(page: number) {
    if (page >= 1 && page <= totalPages) {
      currentPage = page;
    }
  }
</script>

<div class="pagination-footer">
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

<style>
  .pagination-footer {
    padding: 8px;
    border-top: 1px solid var(--surface0);
    background-color: var(--mantle);
    display: flex;
    justify-content: center;
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
