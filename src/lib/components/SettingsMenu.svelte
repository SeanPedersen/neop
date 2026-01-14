<script lang="ts">
  import { getVersion } from "@tauri-apps/api/app";
  import { onMount, onDestroy } from "svelte";
  import { themeStore, settingsStore } from "$lib/stores";
  import { overlayStore } from "$lib/stores/overlay";
  import { themes } from "$lib/definitions";
  import {
    ITEMS_PER_PAGE_OPTIONS,
    ASCII_ART,
    APP_INFO,
    THEME_GROUPS,
  } from "$lib/constants";
  import { platform } from "@tauri-apps/plugin-os";
  import Fa from "svelte-fa";
  import {
    faCog,
    faChevronLeft,
    faChevronRight,
  } from "@fortawesome/free-solid-svg-icons";
  import type { AppConfig } from "$lib/types";

  export let itemsPerPage: number;

  let version = "";
  let latestVersion = "";
  let hasUpdate = false;
  let containerElement: HTMLDivElement;
  let overlayElement: HTMLDivElement;
  let optionsContainer: HTMLDivElement;
  let canScrollLeft = false;
  let canScrollRight = false;

  $: showMenu = $overlayStore === "settings";

  const themeGroups = [
    ...THEME_GROUPS,
    ...(platform() === "windows" || platform() === "macos"
      ? [
          {
            label: "Glassy",
            themes: ["glassy"],
          },
        ]
      : []),
  ];

  async function checkLatestVersion() {
    try {
      const response = await fetch(
        "https://api.github.com/repos/abdenasser/neohtop/releases/latest",
      );
      const data = await response.json();

      const versionMatch = data.tag_name.match(/\d+\.\d+\.\d+/);
      if (!versionMatch) {
        console.warn(
          "Unexpected version format in latest release:",
          data.tag_name,
        );
        return;
      }

      latestVersion = versionMatch[0];

      const currentVersionMatch = version.match(/\d+\.\d+\.\d+/);
      if (!currentVersionMatch) {
        console.warn("Unexpected current version format:", version);
        return;
      }

      hasUpdate = currentVersionMatch[0] !== latestVersion;
    } catch (error) {
      console.error("Failed to check latest version:", error);
      latestVersion = "";
      hasUpdate = false;
    }
  }

  onMount(async () => {
    try {
      version = await getVersion();
      await checkLatestVersion();
    } catch (error) {
      console.error("Failed to initialize version info:", error);
      version = "";
    }
  });

  function updateOverlayPosition() {
    if (overlayElement && containerElement) {
      const toolbarContent = containerElement.closest(".toolbar-content");
      if (toolbarContent) {
        const toolbarRect = toolbarContent.getBoundingClientRect();
        const containerRect = containerElement.getBoundingClientRect();

        const leftOffset = containerRect.left - toolbarRect.left;
        const rightOffset = toolbarRect.right - containerRect.right;
        const topOffset = containerRect.top - toolbarRect.top;

        overlayElement.style.left = `-${leftOffset}px`;
        overlayElement.style.right = `-${rightOffset}px`;
        overlayElement.style.top = `-${topOffset}px`;
      }
    }
  }

  function updateScrollButtons() {
    if (optionsContainer) {
      canScrollLeft = optionsContainer.scrollLeft > 0;
      canScrollRight =
        optionsContainer.scrollLeft <
        optionsContainer.scrollWidth - optionsContainer.clientWidth;
    }
  }

  function scrollLeft() {
    if (optionsContainer) {
      optionsContainer.scrollBy({ left: -200, behavior: "smooth" });
      setTimeout(updateScrollButtons, 100);
    }
  }

  function scrollRight() {
    if (optionsContainer) {
      optionsContainer.scrollBy({ left: 200, behavior: "smooth" });
      setTimeout(updateScrollButtons, 100);
    }
  }

  function toggleSettingsMenu(event: Event) {
    event.stopPropagation();
    if (showMenu) {
      overlayStore.close();
    } else {
      overlayStore.open("settings");
      setTimeout(() => {
        updateOverlayPosition();
        updateScrollButtons();
      }, 0);
    }
  }

  function selectTheme(themeName: string) {
    themeStore.setTheme(themeName);
  }

  function updateBehaviorConfig(key: keyof AppConfig["behavior"], value: any) {
    settingsStore.updateConfig({
      behavior: {
        ...$settingsStore.behavior,
        [key]: value,
      },
    });
  }

  function selectItemsPerPage(value: number) {
    itemsPerPage = value;
    updateBehaviorConfig("itemsPerPage", itemsPerPage);
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      showMenu &&
      containerElement &&
      !containerElement.contains(event.target as Node)
    ) {
      overlayStore.close();
    }
  }

  function setupClickOutside() {
    if (typeof document !== "undefined") {
      document.addEventListener("click", handleClickOutside);
    }
  }

  function cleanupClickOutside() {
    if (typeof document !== "undefined") {
      document.removeEventListener("click", handleClickOutside);
    }
  }

  $: if (showMenu) {
    setTimeout(setupClickOutside, 0);
  } else {
    cleanupClickOutside();
  }

  onDestroy(() => {
    cleanupClickOutside();
  });
</script>

<div class="settings-menu" class:active={showMenu} bind:this={containerElement}>
  <button
    class="settings-button"
    class:active={showMenu}
    class:has-update={hasUpdate}
    on:click={toggleSettingsMenu}
    aria-label="Toggle settings menu"
  >
    <span class="icon" class:update-available={hasUpdate}>
      <Fa icon={faCog} />
    </span>
  </button>

  {#if showMenu}
    <div
      class="touchbar-full-overlay"
      bind:this={overlayElement}
      on:click={() => overlayStore.close()}
      on:keydown={(e) => e.key === "Escape" && overlayStore.close()}
      role="dialog"
      aria-label="Settings menu"
      tabindex="-1"
    >
      <div class="settings-content">
        <!-- Procs per page section -->
        <div class="settings-section">
          <span class="section-label">Procs per page:</span>
          <div class="section-options">
            {#each ITEMS_PER_PAGE_OPTIONS as option}
              <button
                class="touchbar-option"
                class:active={option === itemsPerPage}
                on:click|stopPropagation={() => selectItemsPerPage(option)}
              >
                {option}
              </button>
            {/each}
          </div>
        </div>

        <!-- Theme section -->
        <div class="settings-section theme-section">
          <span class="section-label">Theme:</span>

          {#if canScrollLeft}
            <button
              class="scroll-chevron scroll-left"
              on:click|stopPropagation={scrollLeft}
            >
              <Fa icon={faChevronLeft} />
            </button>
          {/if}

          <div
            class="section-options theme-options"
            bind:this={optionsContainer}
            on:scroll={updateScrollButtons}
          >
            {#each themeGroups as group}
              {#each group.themes as themeName}
                {@const theme = themes[themeName]}
                <button
                  class="touchbar-option"
                  class:active={$themeStore.name === theme.name}
                  on:click|stopPropagation={() => selectTheme(theme.name)}
                  title={theme.label}
                >
                  <div
                    class="theme-preview"
                    style:background={theme.colors.base}
                  >
                    <div
                      class="preview-color"
                      style:background={theme.colors.blue}
                    ></div>
                    <div
                      class="preview-color"
                      style:background={theme.colors.red}
                    ></div>
                    <div
                      class="preview-color"
                      style:background={theme.colors.green}
                    ></div>
                  </div>
                  <span class="theme-label">{theme.label}</span>
                </button>
              {/each}
            {/each}
          </div>

          {#if canScrollRight}
            <button
              class="scroll-chevron scroll-right"
              on:click|stopPropagation={scrollRight}
            >
              <Fa icon={faChevronRight} />
            </button>
          {/if}
        </div>

        <!-- App info section -->
        <div class="settings-section info-section">
          <div class="info-content">
            <pre class="ascii-art">{ASCII_ART}</pre>
            <div class="details">
              <div class="detail-row">
                <span>NeoHtop v{version}</span>
                {#if hasUpdate}
                  <a
                    href={`https://github.com/abdenasser/neohtop/releases/latest`}
                    class="update-button"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Update to v{latestVersion}
                  </a>
                {/if}
              </div>
              <div class="detail-row">
                <span class="label">app</span>
                <span class="separator">::</span>
                <span class="value">{APP_INFO.name}</span>
              </div>
              <div class="detail-row">
                <span class="label">source</span>
                <span class="separator">::</span>
                <a
                  href={APP_INFO.github}
                  class="value"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {APP_INFO.github}
                </a>
              </div>
              <div class="detail-row">
                <span class="label">stack</span>
                <span class="separator">::</span>
                <span class="value">{APP_INFO.stack.join(", ")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings-menu {
    position: relative;
  }

  .settings-button {
    height: 28px;
    width: 28px;
    padding: 0;
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
    background: var(--surface0);
    border: 1px solid var(--surface1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  .settings-button:hover {
    background: var(--surface1);
    border-color: var(--blue);
  }

  .settings-button.active {
    background: var(--surface1);
    border-color: var(--blue);
  }

  .settings-button.has-update {
    border-color: var(--red);
  }

  .settings-button.has-update:hover {
    background: color-mix(in srgb, var(--red) 10%, transparent);
  }

  .icon {
    display: inline-flex;
    align-items: center;
    font-size: 12px;
    color: var(--subtext0);
  }

  .icon.update-available {
    color: var(--red);
  }

  .touchbar-full-overlay {
    position: absolute;
    top: -0px;
    height: auto;
    min-height: 44px;
    background: var(--mantle);
    border: 1px solid var(--surface0);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    padding: 12px;
  }

  .settings-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 500px;
  }

  .settings-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .theme-section {
    position: relative;
  }

  .section-label {
    font-size: 12px;
    color: var(--subtext0);
    white-space: nowrap;
    min-width: 100px;
  }

  .section-options {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }

  .theme-options {
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .theme-options::-webkit-scrollbar {
    display: none;
  }

  .scroll-chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--surface0);
    border: 1px solid var(--surface1);
    border-radius: 4px;
    color: var(--text);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
    font-size: 10px;
  }

  .scroll-chevron:hover {
    background: var(--surface1);
    border-color: var(--blue);
  }

  .touchbar-option {
    padding: 0 12px;
    height: 28px;
    font-size: 12px;
    color: var(--text);
    background: var(--surface0);
    border: 1px solid var(--surface1);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-width: fit-content;
    box-sizing: border-box;
  }

  .touchbar-option:hover {
    background: var(--surface1);
    border-color: var(--blue);
  }

  .touchbar-option.active {
    background: var(--blue);
    color: var(--base);
    border-color: var(--blue);
  }

  .theme-preview {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: 3px;
    border: 1px solid var(--surface1);
  }

  .preview-color {
    width: 8px;
    height: 8px;
    border-radius: 1px;
  }

  .theme-label {
    font-size: 12px;
  }

  .info-section {
    padding-top: 8px;
    border-top: 1px solid var(--surface0);
  }

  .info-content {
    display: flex;
    gap: 24px;
    width: 100%;
  }

  .ascii-art {
    font-family: monospace;
    font-size: 8px;
    line-height: 1;
    color: var(--mauve);
    margin: 0;
    padding: 0;
    white-space: pre;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 0;
  }

  .detail-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: monospace;
    font-size: 13px;
  }

  .label {
    color: var(--green);
    min-width: 80px;
  }

  .separator {
    color: var(--subtext0);
  }

  .value {
    color: var(--text);
  }

  .detail-row span {
    color: var(--text);
    font-weight: 500;
  }

  .update-button {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--base);
    background: var(--red);
    border-radius: 4px;
    text-decoration: none;
    margin-left: 8px;
    transition: all 0.2s ease;
  }

  .update-button:hover {
    background: color-mix(in srgb, var(--red) 90%, white);
    transform: translateY(-1px);
  }
</style>
