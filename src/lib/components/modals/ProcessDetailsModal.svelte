<script lang="ts">
  import { Modal } from "$lib/components";
  import { formatBytes } from "$lib/utils";
  import type { Process, ProcessHistoryDataPoint } from "$lib/types";
  import type { ProcessResourceAccumulator } from "$lib/stores/systemHistory";
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
    faThumbtack,
    faXmark,
  } from "@fortawesome/free-solid-svg-icons";

  export let show = false;
  export let process: Process | null = null;
  export let onClose: () => void;
  export let processes: Process[] = [];
  export let processAccumulators: Map<string, ProcessResourceAccumulator> =
    new Map();
  export let onShowDetails: (process: Process) => void;
  export let cpuCoreCount: number = 1;
  export let onTogglePin: ((command: string) => void) | undefined = undefined;
  export let onKillProcess: ((process: Process) => void) | undefined =
    undefined;
  export let isPinned: boolean = false;

  $: isDead = process?.status === "Dead";
  $: childProcesses = process
    ? processes.filter((p) => p.ppid === process.pid)
    : [];

  // Build a comprehensive map of all processes (live and dead) by composite key
  $: allProcessesByKey = new Map<
    string,
    { name: string; pid: number; startTime: number; isLive: boolean }
  >([
    // Add live processes
    ...processes.map(
      (p) =>
        [
          `${p.pid}-${p.start_time}`,
          { name: p.name, pid: p.pid, startTime: p.start_time, isLive: true },
        ] as [
          string,
          { name: string; pid: number; startTime: number; isLive: boolean },
        ],
    ),
    // Add dead processes from accumulator
    ...Array.from(processAccumulators.entries())
      .filter(([_, acc]) => acc.status === "Dead")
      .map(
        ([key, acc]) =>
          [
            key,
            {
              name: acc.name,
              pid: acc.pid,
              startTime: acc.startTime,
              isLive: false,
            },
          ] as [
            string,
            { name: string; pid: number; startTime: number; isLive: boolean },
          ],
      ),
  ]);

  // Function to find parent process using composite key (PID + start_time)
  function findParentProcess(
    currentProcess: Process | null,
    allProcessesByKey: Map<
      string,
      { name: string; pid: number; startTime: number; isLive: boolean }
    >,
    processAccumulators: Map<string, ProcessResourceAccumulator>,
  ): { name: string; pid: number; startTime: number } | null {
    if (!currentProcess || currentProcess.ppid === 0) return null;

    // Get the parent's start_time from the current process's accumulator entry
    const currentKey = `${currentProcess.pid}-${currentProcess.start_time}`;
    const currentAccumulator = processAccumulators.get(currentKey);

    if (currentAccumulator) {
      // Special case: PID 1 (launchd/init) has start_time 0
      const parentKey =
        currentAccumulator.ppid === 1
          ? "1-0"
          : `${currentAccumulator.ppid}-${currentAccumulator.parentStartTime}`;

      const parentInfo = allProcessesByKey.get(parentKey);
      if (parentInfo) {
        return {
          name: parentInfo.name,
          pid: parentInfo.pid,
          startTime: parentInfo.startTime,
        };
      }
    }

    return null;
  }

  $: parentProcess =
    process && processAccumulators && allProcessesByKey
      ? findParentProcess(process, allProcessesByKey, processAccumulators)
      : null;

  function handleShowParentDetails() {
    if (!parentProcess) return;

    // Try to find the parent in live processes using composite key
    const liveParent = processes.find(
      (p) =>
        p.pid === parentProcess.pid && p.start_time === parentProcess.startTime,
    );
    if (liveParent) {
      onShowDetails(liveParent);
      return;
    }

    // If not live, reconstruct a dead Process object from the accumulator using composite key
    const parentKey = `${parentProcess.pid}-${parentProcess.startTime}`;
    const accumulator = processAccumulators.get(parentKey);
    if (accumulator) {
      const deadParent: Process = {
        pid: accumulator.pid,
        ppid: accumulator.ppid,
        name: accumulator.name,
        cpu_usage: 0,
        memory_usage: 0,
        status: "Dead",
        user: accumulator.user,
        command: accumulator.command,
        threads: 0,
        environ: [],
        root: "",
        virtual_memory: 0,
        start_time: accumulator.startTime,
        run_time: 0,
        disk_usage: [0, 0],
        session_id: 0,
      };
      onShowDetails(deadParent);
    }
  }

  // Create a derived store that gets the history for the current process
  $: historyStore = derived(processHistoryStore, ($store) => {
    return process
      ? $store.histories.get(`${process.pid}-${process.start_time}`) || []
      : [];
  });

  $: historyData = $historyStore;

  let selectedGraph: "cpu" | "memory" | "disk_read" | "disk_write" | null =
    null;
  let lastOpenedProcess: number | null = null;

  // Context menu state
  let contextMenu = {
    show: false,
    x: 0,
    y: 0,
    text: "",
  };

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

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    contextMenu.show = false;
  }

  function handleContextMenu(
    event: MouseEvent,
    text: string,
    type: "command" | "env" | "info",
  ) {
    event.preventDefault();
    contextMenu = {
      show: true,
      x: event.clientX,
      y: event.clientY,
      text: text,
    };
  }

  function closeContextMenu() {
    contextMenu.show = false;
  }

  // Close context menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (contextMenu.show) {
      closeContextMenu();
    }
  }
</script>

<Modal
  {show}
  title={`${process ? process.name : "Unknown Process"} - Process Details${isDead ? " (Dead)" : ""}`}
  maxWidth="1000px"
  {onClose}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div on:click={handleClickOutside}>
    {#if process}
      <div class="modal-content">
        <!-- Dead Process Warning Banner -->
        {#if isDead}
          <div class="dead-banner">
            <span class="dead-icon">⚠️</span>
            <div class="dead-text">
              <strong>This process is no longer running.</strong>
              <span
                >Showing historical information from when it was active.</span
              >
            </div>
          </div>
        {/if}

        <!-- Header Stats with Actions -->
        <div class="header-container">
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
                class:dead={isDead}
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

          {#if !isDead && onTogglePin && onKillProcess}
            <div class="header-actions">
              <button
                class="action-btn pin-btn"
                class:pinned={isPinned}
                on:click|stopPropagation={() =>
                  process && onTogglePin?.(process.command)}
                title={isPinned ? "Unpin" : "Pin"}
              >
                <Fa icon={faThumbtack} />
              </button>
              <button
                class="action-btn kill-btn"
                on:click|stopPropagation={() =>
                  process && onKillProcess?.(process)}
                title="Kill Process"
              >
                <Fa icon={faXmark} />
              </button>
            </div>
          {/if}
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
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="info-item copyable"
                    on:contextmenu={(e) =>
                      handleContextMenu(e, process.name, "info")}
                  >
                    <span class="info-label">Name</span>
                    <span class="info-value">{process.name}</span>
                  </div>
                  {#if process.user}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                      class="info-item copyable"
                      on:contextmenu={(e) =>
                        handleContextMenu(e, process.user, "info")}
                    >
                      <span class="info-label">User</span>
                      <span class="info-value">{process.user}</span>
                    </div>
                  {/if}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="info-item copyable"
                    on:contextmenu={(e) => {
                      const text = parentProcess
                        ? `${parentProcess.pid} - ${parentProcess.name}`
                        : process.ppid.toString();
                      handleContextMenu(e, text, "info");
                    }}
                  >
                    <span class="info-label">Parent Process</span>
                    {#if process.ppid === 0}
                      <span class="info-value">N/A</span>
                    {:else if parentProcess}
                      <!-- svelte-ignore a11y_click_events_have_key_events -->
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <span
                        class="info-value clickable parent-info"
                        on:click={handleShowParentDetails}
                      >
                        <span class="parent-pid">{parentProcess.pid}</span>
                        <span class="parent-separator">-</span>
                        <span class="parent-name">{parentProcess.name}</span>
                      </span>
                    {:else}
                      <span class="info-value">{process.ppid}</span>
                    {/if}
                  </div>
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    class="info-item copyable"
                    on:contextmenu={(e) =>
                      handleContextMenu(
                        e,
                        process.session_id?.toString() || "0",
                        "info",
                      )}
                  >
                    <span class="info-label">Session ID</span>
                    <span class="info-value">{process.session_id || "N/A"}</span
                    >
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
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="card-content copyable"
                on:contextmenu={(e) =>
                  handleContextMenu(
                    e,
                    `${process.command}\n${process.root}`,
                    "command",
                  )}
              >
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
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="env-item copyable"
                        on:contextmenu={(e) => handleContextMenu(e, env, "env")}
                      >
                        {env}
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Context Menu -->
  {#if contextMenu.show}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="context-menu"
      style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
      on:click|stopPropagation={() => copyToClipboard(contextMenu.text)}
    >
      <div class="context-menu-item">Copy</div>
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

  /* Dead Process Banner */
  .dead-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(243, 139, 168, 0.15);
    border: 1px solid var(--red);
    border-radius: 8px;
    color: var(--text);
  }

  .dead-icon {
    font-size: 20px;
    line-height: 1;
  }

  .dead-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 13px;
  }

  .dead-text strong {
    color: var(--red);
    font-weight: 600;
  }

  .dead-text span {
    color: var(--subtext0);
    font-size: 12px;
  }

  /* Header Container */
  .header-container {
    display: flex;
    gap: 16px;
    align-items: center;
  }

  /* Header Stats */
  .header-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 16px;
    padding: 16px;
    background: var(--surface0);
    border-radius: 8px;
    flex: 1;
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

  .stat-value.status.dead {
    color: var(--red);
  }

  /* Action Buttons next to Header */
  .header-actions {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .action-btn {
    background: transparent;
    border: 1px solid var(--surface1);
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
    background: var(--surface1);
    border-color: var(--surface2);
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

  .parent-info {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .parent-pid {
    font-weight: 600;
  }

  .parent-separator {
    color: var(--subtext0);
  }

  .parent-name {
    color: var(--text);
    font-size: 12px;
    word-break: break-all;
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

  /* Copyable items */
  .copyable {
    cursor: context-menu;
  }

  .copyable:hover {
    background: var(--surface1);
  }

  /* Context Menu */
  .context-menu {
    position: fixed;
    z-index: 10000;
    background: var(--surface0);
    border: 1px solid var(--surface2);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    min-width: 120px;
    overflow: hidden;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .context-menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    color: var(--text);
    font-size: 13px;
    transition: background 0.15s ease;
  }

  .context-menu-item:hover {
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
