<script lang="ts">
  import { Modal } from "$lib/components";
  import { formatBytes } from "$lib/utils";
  import type { Process, ProcessHistoryDataPoint } from "$lib/types";
  import { processHistoryStore } from "$lib/stores/processHistory";
  import TimeSeriesGraph from "$lib/components/stats/TimeSeriesGraph.svelte";
  import Fa from "svelte-fa";
  import { derived } from "svelte/store";
  import {
    faMemory,
    faMicrochip,
    faCodeFork,
    faTerminal,
    faList,
  } from "@fortawesome/free-solid-svg-icons";

  export let show = false;
  export let process: Process | null = null;
  export let onClose: () => void;
  export let processes: Process[] = [];
  export let onShowDetails: (process: Process) => void;
  export let cpuCoreCount: number = 1;

  $: childProcesses = process
    ? processes.filter((p) => p.ppid === process.pid)
    : [];

  // Create a derived store that gets the history for the current process
  $: historyStore = derived(processHistoryStore, ($store) => {
    return process ? $store.histories.get(process.pid) || [] : [];
  });

  $: historyData = $historyStore;

  let selectedGraph: "cpu" | "memory" | "disk_read" | "disk_write" | null =
    null;
  let lastOpenedProcess: number | null = null;

  // Select CPU Usage by default only when modal opens with a new process
  $: if (show && process && process.pid !== lastOpenedProcess) {
    selectedGraph = "cpu";
    lastOpenedProcess = process.pid;
  } else if (!show) {
    lastOpenedProcess = null;
  }

  function toggleGraph(graph: "cpu" | "memory" | "disk_read" | "disk_write") {
    if (selectedGraph === graph) {
      selectedGraph = null;
    } else {
      selectedGraph = graph;
    }
  }
</script>

<Modal
  {show}
  title={`${process ? process.name : "Unknown Process"} - Process Details`}
  maxWidth="1000px"
  {onClose}
>
  {#if process}
    <div class="modal-content">
      <!-- Header Stats -->
      <div class="header-stats">
        <div class="stat-item">
          <div class="stat-label">PID</div>
          <div class="stat-value">{process.pid}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Status</div>
          <div
            class="stat-value status"
            class:running={process.status === "Running"}
          >
            {process.status}
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-label">CPU</div>
          <div class="stat-value">{process.cpu_usage.toFixed(1)}%</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Memory</div>
          <div class="stat-value">{formatBytes(process.memory_usage)}</div>
        </div>
      </div>

      <!-- Resource Usage - Full Width at Top -->
      <div class="card resource-card">
        <div class="card-header">
          <Fa icon={faMemory} />
          <span>Resource Usage</span>
        </div>
        <div class="card-content">
          <div class="resource-layout">
            <div class="resource-metrics">
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="resource-item clickable"
                class:active={selectedGraph === "cpu"}
                on:click={() => toggleGraph("cpu")}
              >
                <div class="resource-header">
                  <span>CPU Usage</span>
                  <span class="resource-value"
                    >{process.cpu_usage.toFixed(1)}%</span
                  >
                </div>
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    style="width: {Math.min(
                      (process.cpu_usage / (cpuCoreCount * 100)) * 100,
                      100,
                    )}%"
                    class:high={process.cpu_usage > cpuCoreCount * 50}
                    class:critical={process.cpu_usage > cpuCoreCount * 80}
                  ></div>
                </div>
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="resource-item clickable"
                class:active={selectedGraph === "memory"}
                on:click={() => toggleGraph("memory")}
              >
                <div class="resource-header">
                  <span>Memory Usage</span>
                </div>
                <div class="memory-stats">
                  <div>Physical: {formatBytes(process.memory_usage)}</div>
                  <div>Virtual: {formatBytes(process.virtual_memory)}</div>
                </div>
              </div>
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="resource-item clickable"
                class:active={selectedGraph === "disk_read" ||
                  selectedGraph === "disk_write"}
                on:click={() => toggleGraph("disk_read")}
              >
                <div class="resource-header">
                  <span>Disk I/O</span>
                </div>
                <div class="disk-stats">
                  <div>Read: {formatBytes(process.disk_usage[0])}</div>
                  <div>Written: {formatBytes(process.disk_usage[1])}</div>
                </div>
              </div>
            </div>

            <!-- Graph Display on the Right -->
            {#if selectedGraph && historyData.length > 0}
              <div class="graph-section">
                {#if selectedGraph === "cpu"}
                  <TimeSeriesGraph
                    data={historyData}
                    metric="cpu_usage"
                    label="CPU Usage"
                    color="var(--blue)"
                    height={150}
                    maxValue={cpuCoreCount * 100}
                  />
                {:else if selectedGraph === "memory"}
                  <TimeSeriesGraph
                    data={historyData}
                    metric="memory_usage"
                    label="Memory Usage"
                    color="var(--green)"
                    height={150}
                  />
                {:else if selectedGraph === "disk_read"}
                  <div class="disk-graphs">
                    <TimeSeriesGraph
                      data={historyData}
                      metric="disk_read"
                      label="Disk Read"
                      color="var(--lavender)"
                      height={120}
                    />
                    <TimeSeriesGraph
                      data={historyData}
                      metric="disk_write"
                      label="Disk Write"
                      color="var(--peach)"
                      height={120}
                    />
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="content-grid">
        <!-- Left Column -->
        <div class="content-column">
          <!-- Process Info -->
          <div class="card">
            <div class="card-header">
              <Fa icon={faMicrochip} />
              <span>Process Information</span>
            </div>
            <div class="card-content">
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Name</span>
                  <span class="info-value">{process.name}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">User</span>
                  <span class="info-value">{process.user}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Parent PID</span>
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <span
                    class="info-value clickable"
                    on:click={() => {
                      const parent = processes.find(
                        (p) => p.pid === process.ppid,
                      );
                      if (parent) onShowDetails(parent);
                    }}
                  >
                    {process.ppid}
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Session ID</span>
                  <span class="info-value">{process.session_id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column -->
        <div class="content-column">
          <!-- Command -->
          <div class="card">
            <div class="card-header">
              <Fa icon={faTerminal} />
              <span>Command</span>
            </div>
            <div class="card-content">
              <div class="command-text">{process.command}</div>
              <div class="path-text">{process.root}</div>
            </div>
          </div>

          <!-- Child Processes -->
          {#if childProcesses.length > 0}
            <div class="card">
              <div class="card-header">
                <Fa icon={faCodeFork} />
                <span>Child Processes ({childProcesses.length})</span>
              </div>
              <div class="card-content">
                <table class="process-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>PID</th>
                      <th>CPU</th>
                      <th>Memory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each childProcesses as child}
                      <tr
                        class="clickable"
                        on:click={() => onShowDetails(child)}
                      >
                        <td>{child.name}</td>
                        <td>{child.pid}</td>
                        <td>{child.cpu_usage.toFixed(1)}%</td>
                        <td>{formatBytes(child.memory_usage)}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}

          <!-- Environment Variables -->
          {#if process.environ.length > 0}
            <div class="card">
              <div class="card-header">
                <Fa icon={faList} />
                <span>Environment Variables</span>
              </div>
              <div class="card-content">
                <div class="env-list">
                  {#each process.environ as env}
                    <div class="env-item">{env}</div>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</Modal>

<style>
  /* Base Modal Content */
  .modal-content {
    display: flex;
    flex-direction: column;
    gap: 24px;
    font-size: 13px;
    color: var(--text);
  }

  /* Header Stats */
  .header-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
    padding: 16px;
    background: var(--surface0);
    border-radius: 8px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-label {
    font-size: 12px;
    color: var(--subtext0);
    font-weight: 500;
  }

  .stat-value {
    font-size: 16px;
    font-weight: 600;
  }

  .stat-value.status {
    color: var(--subtext0);
  }

  .stat-value.status.running {
    color: var(--green);
  }

  /* Main Content Grid */
  .content-grid {
    display: grid;
    grid-template-columns: minmax(300px, 0.4fr) minmax(400px, 0.6fr);
    gap: 24px;
  }

  .content-column {
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-width: 0; /* Prevent overflow issues */
  }

  /* Cards */
  .card {
    background: var(--surface0);
    border-radius: 8px;
    overflow: hidden;
    min-width: 0; /* Prevent overflow issues */
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: var(--surface1);
    color: var(--subtext0);
    font-weight: 500;
  }

  .card-header :global(svg) {
    width: 14px;
    height: 14px;
    color: var(--blue);
  }

  .card-content {
    padding: 16px;
    overflow: auto;
  }

  /* Info Grid */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .info-label {
    color: var(--subtext0);
    font-size: 12px;
  }

  .info-value {
    color: var(--text);
  }

  .info-value.clickable {
    cursor: pointer;
    color: var(--blue);
  }

  .info-value.clickable:hover {
    text-decoration: underline;
  }

  /* Resource Usage */
  .resource-card {
    width: 100%;
  }

  .resource-layout {
    display: grid;
    grid-template-columns: minmax(250px, 0.3fr) minmax(400px, 0.7fr);
    gap: 24px;
    align-items: start;
  }

  .resource-metrics {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .resource-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .resource-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: 6px;
    transition: background 0.2s ease;
  }

  .resource-item.clickable {
    cursor: pointer;
  }

  .resource-item.clickable:hover {
    background: var(--surface1);
  }

  .resource-item.clickable.active {
    background: var(--surface1);
    border: 1px solid var(--blue);
  }

  .resource-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--subtext0);
    font-size: 12px;
  }

  .resource-value {
    color: var(--text);
  }

  /* Progress Bar */
  .progress-bar {
    height: 6px;
    background: var(--surface1);
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--blue);
    transition: width 0.2s ease;
  }

  .progress-fill.high {
    background: var(--yellow);
  }

  .progress-fill.critical {
    background: var(--red);
  }

  /* Memory and Disk Stats */
  .memory-stats,
  .disk-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    color: var(--text);
  }

  /* Graph Section */
  .graph-section {
    flex: 1;
    min-width: 0;
  }

  .disk-graphs {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .graph-with-title {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .graph-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    padding-left: 4px;
  }

  /* Command and Path */
  .command-text,
  .path-text {
    word-break: break-all;
    white-space: pre-wrap;
  }

  .path-text {
    margin-top: 8px;
    font-size: 12px;
    color: var(--subtext0);
  }

  /* Process Table */
  .process-table {
    width: 100%;
    border-collapse: collapse;
  }

  .process-table th {
    text-align: left;
    padding: 8px;
    color: var(--subtext0);
    font-weight: 500;
    border-bottom: 1px solid var(--surface1);
  }

  .process-table td {
    padding: 8px;
    border-bottom: 1px solid var(--surface1);
  }

  .process-table tr:last-child td {
    border-bottom: none;
  }

  .process-table tr.clickable {
    cursor: pointer;
  }

  .process-table tr.clickable:hover {
    background: var(--surface1);
  }

  /* Environment Variables */
  .env-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
    margin: -16px;
    padding: 16px;
  }

  .env-item {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--subtext1);
    font-size: 12px;
  }

  .env-item:hover {
    background: var(--surface1);
  }

  /* Update scrollbar styles to match the container edges */
  .env-list::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .env-list::-webkit-scrollbar-track {
    background: var(--surface0);
    border-radius: 0;
  }

  .env-list::-webkit-scrollbar-thumb {
    background: var(--surface2);
    border-radius: 4px;
    border: 2px solid var(--surface0);
  }

  .env-list::-webkit-scrollbar-thumb:hover {
    background: var(--surface1);
  }

  /* Scrollbar Styles */
  :global(.modal-content *::-webkit-scrollbar) {
    width: 8px;
    height: 8px;
  }

  :global(.modal-content *::-webkit-scrollbar-track) {
    background: var(--mantle);
    border-radius: 4px;
  }

  :global(.modal-content *::-webkit-scrollbar-thumb) {
    background: var(--surface2);
    border-radius: 4px;
  }

  :global(.modal-content *::-webkit-scrollbar-thumb:hover) {
    background: var(--surface1);
  }

  /* Responsive Design */
  @media (max-width: 900px) {
    .content-grid {
      grid-template-columns: 1fr;
    }

    .header-stats {
      grid-template-columns: repeat(2, 1fr);
    }

    .resource-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
