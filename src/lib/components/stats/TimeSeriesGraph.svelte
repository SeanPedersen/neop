<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { ProcessHistoryDataPoint } from "$lib/types";

  export let data: ProcessHistoryDataPoint[] = [];
  export let metric: "cpu_usage" | "memory_usage" | "disk_read" | "disk_write";
  export let label: string = "";
  export let color: string = "#89b4fa"; // Default blue
  export let height: number = 150;
  export let maxValue: number | null = null; // Auto-scale if null

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  let animationFrameId: number | null = null;
  let resizeObserver: ResizeObserver | null = null;

  // Debounced draw function to prevent excessive redraws
  function scheduleDraw() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(() => {
      draw();
      animationFrameId = null;
    });
  }

  $: if (ctx && data) {
    scheduleDraw();
  }

  function draw() {
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 10, bottom: 30, left: 60 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Get computed colors from CSS variables
    const styles = getComputedStyle(canvas);
    const subtextColor =
      styles.getPropertyValue("--subtext0").trim() || "#6c7086";
    const textColor = styles.getPropertyValue("--text").trim() || "#cdd6f4";
    const surface1Color =
      styles.getPropertyValue("--surface1").trim() || "#313244";

    // Resolve the color prop if it's a CSS variable
    let resolvedColor = color;
    if (color.startsWith("var(")) {
      const varName = color.match(/var\((--[\w-]+)\)/)?.[1];
      if (varName) {
        resolvedColor = styles.getPropertyValue(varName).trim() || color;
      }
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (data.length === 0) {
      // Draw "No data" message
      ctx.fillStyle = subtextColor;
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No data available", width / 2, height / 2);
      return;
    }

    // Extract values
    const values = data.map((d) => d[metric]);
    const timestamps = data.map((d) => d.timestamp);

    // Calculate scales
    const maxVal = maxValue !== null ? maxValue : Math.max(...values, 1);
    const minVal = 0;
    const timeSpan =
      timestamps.length > 1
        ? timestamps[timestamps.length - 1] - timestamps[0]
        : 1000;

    // Draw grid lines
    ctx.strokeStyle = surface1Color;
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (graphHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + graphWidth, y);
      ctx.stroke();

      // Draw Y-axis labels
      const value = maxVal - (maxVal / gridLines) * i;
      ctx.fillStyle = subtextColor;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(formatValue(value), padding.left - 5, y + 4);
    }

    // Draw line
    ctx.strokeStyle = resolvedColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const value = values[i];
      const timestamp = timestamps[i];

      const x = padding.left + (graphWidth * i) / Math.max(data.length - 1, 1);
      const y =
        padding.top +
        graphHeight -
        ((value - minVal) / (maxVal - minVal)) * graphHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw filled area under the line
    ctx.lineTo(padding.left + graphWidth, padding.top + graphHeight);
    ctx.lineTo(padding.left, padding.top + graphHeight);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(
      0,
      padding.top,
      0,
      padding.top + graphHeight,
    );
    gradient.addColorStop(0, resolvedColor + "40");
    gradient.addColorStop(1, resolvedColor + "08");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw axes
    ctx.strokeStyle = subtextColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + graphHeight);
    ctx.lineTo(padding.left + graphWidth, padding.top + graphHeight);
    ctx.stroke();

    // Draw X-axis time labels
    ctx.fillStyle = subtextColor;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";

    if (timestamps.length > 1) {
      const timeLabels = 5;
      const currentTime = timestamps[timestamps.length - 1];

      for (let i = 0; i <= timeLabels; i++) {
        const index = Math.floor((data.length - 1) * (i / timeLabels));
        const timestamp = timestamps[index];
        const timeDelta = (currentTime - timestamp) / 1000; // seconds

        const x = padding.left + (graphWidth * i) / timeLabels;
        const y = height - 10; // Position near bottom of canvas

        const label = formatTimeDelta(timeDelta);
        ctx.fillText(label, x, y);
      }
    }

    // Draw label
    ctx.fillStyle = textColor;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(label, padding.left, padding.top - 5);

    // Draw current value
    if (values.length > 0) {
      const currentValue = values[values.length - 1];
      ctx.textAlign = "right";
      ctx.fillText(
        formatValue(currentValue),
        padding.left + graphWidth,
        padding.top - 5,
      );
    }
  }

  function formatTimeDelta(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.round(seconds % 60);
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  function formatValue(value: number): string {
    if (metric === "cpu_usage") {
      return value.toFixed(1) + "%";
    } else if (metric === "memory_usage") {
      return formatBytes(value);
    } else {
      return formatBytes(value);
    }
  }

  function formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    if (!isFinite(bytes)) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Ensure i is within valid range
    const sizeIndex = Math.max(0, Math.min(i, sizes.length - 1));
    const value = bytes / Math.pow(k, sizeIndex);

    return value.toFixed(1) + " " + sizes[sizeIndex];
  }

  function handleResize() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    scheduleDraw();
  }

  onMount(() => {
    handleResize();

    // Use ResizeObserver instead of window resize event for better performance
    if (canvas && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      resizeObserver.observe(canvas);
    } else {
      window.addEventListener("resize", handleResize);
    }
  });

  onDestroy(() => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    } else {
      window.removeEventListener("resize", handleResize);
    }
  });
</script>

<div class="graph-wrapper" style="height: {height}px;">
  <div class="graph-container">
    <canvas bind:this={canvas}></canvas>
  </div>
</div>

<style>
  .graph-wrapper {
    width: 100%;
    position: relative;
  }

  .graph-container {
    width: 100%;
    height: 100%;
    position: relative;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
