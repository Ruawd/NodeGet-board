import { reactive, type Ref } from "vue";
import { fetchDynamic } from "@/composables/monitoring/useDynamicMonitoring";
import type { DynamicDetailData } from "@/types/monitoring";
import type { DetailTab } from "@/components/node/status/constants";

const TAB_FIELDS: Record<DetailTab, string[]> = {
  disk: ["disk"],
  network: ["network"],
};

const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_REFRESH_MS = 1_000;
const CPU_DETAIL_INTERVAL_MS = 1_000;

export interface DetailSlice {
  windowMs: number;
  refreshInterval: number;
  data: DynamicDetailData[];
  loading: boolean;
  fetchData(showLoading?: boolean): Promise<void>;
  startTimer(intervalMs: number): void;
  stopTimer(): void;
  clear(): void;
}

function createDetailSlice(uuid: Ref<string>, tab: DetailTab): DetailSlice {
  const state = reactive({
    windowMs: DEFAULT_WINDOW_MS,
    refreshInterval: DEFAULT_REFRESH_MS,
    data: [] as DynamicDetailData[],
    loading: false,
  });
  let timer: ReturnType<typeof setInterval> | null = null;
  let fetchSeq = 0;

  async function pull(from: number, to: number): Promise<DynamicDetailData[]> {
    return fetchDynamic(uuid.value, TAB_FIELDS[tab], {
      timestamp_from: from,
      timestamp_to: to,
    });
  }

  // Full replace — used for tab/window/uuid switches.
  async function fetchData(showLoading = true) {
    if (!uuid.value) return;
    const seq = ++fetchSeq;
    if (showLoading) state.loading = true;
    const now = Date.now();
    try {
      const result = await pull(now - state.windowMs, now);
      if (seq !== fetchSeq) return;
      state.data = result;
    } catch (e) {
      if (seq !== fetchSeq) return;
      console.error(`[Status] ${tab} detail fetch failed:`, e);
    } finally {
      if (showLoading && seq === fetchSeq) state.loading = false;
    }
  }

  // Incremental: pull only [lastTs+1, now], dedupe by timestamp, trim entries outside window
  async function tick() {
    if (!uuid.value) return;
    const seq = ++fetchSeq;
    const now = Date.now();

    if (state.data.length === 0) {
      try {
        const result = await pull(now - state.windowMs, now);
        if (seq !== fetchSeq) return;
        state.data = result;
      } catch (e) {
        if (seq !== fetchSeq) return;
        console.error(`[Status] ${tab} detail tick (full) failed:`, e);
      }
      return;
    }

    const lastTs = state.data[state.data.length - 1]!.timestamp;
    try {
      const incoming = await pull(lastTs + 1, now);
      if (seq !== fetchSeq) return;
      const seen = new Set(state.data.map((r) => r.timestamp));
      const fresh = incoming.filter((r) => !seen.has(r.timestamp));
      const cutoff = now - state.windowMs;
      state.data = [...state.data, ...fresh]
        .filter((r) => r.timestamp >= cutoff)
        .sort((a, b) => a.timestamp - b.timestamp);
    } catch (e) {
      if (seq !== fetchSeq) return;
      console.error(`[Status] ${tab} detail tick (incremental) failed:`, e);
    }
  }

  function startTimer(intervalMs: number) {
    stopTimer();
    timer = setInterval(() => tick(), intervalMs);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function clear() {
    state.data = [];
  }

  return Object.assign(state, {
    fetchData,
    startTimer,
    stopTimer,
    clear,
  }) as DetailSlice;
}

export interface CpuDetailSlice {
  data: DynamicDetailData | null;
  fetchData(): Promise<void>;
  startTimer(): void;
  stopTimer(): void;
  clear(): void;
}

function createCpuDetailSlice(uuid: Ref<string>): CpuDetailSlice {
  const state = reactive({
    data: null as DynamicDetailData | null,
  });
  let timer: ReturnType<typeof setInterval> | null = null;
  let fetchSeq = 0;

  async function fetchData() {
    if (!uuid.value) return;
    const seq = ++fetchSeq;
    try {
      const result = await fetchDynamic(uuid.value, ["cpu"]);
      if (seq !== fetchSeq) return;
      state.data = result.length > 0 ? (result[0] ?? null) : null;
    } catch (e) {
      if (seq !== fetchSeq) return;
      console.error("[Status] Failed to fetch cpu detail:", e);
    }
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => fetchData(), CPU_DETAIL_INTERVAL_MS);
  }

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function clear() {
    state.data = null;
  }

  return Object.assign(state, {
    fetchData,
    startTimer,
    stopTimer,
    clear,
  }) as CpuDetailSlice;
}

export function useTabDetails(uuid: Ref<string>) {
  const disk = createDetailSlice(uuid, "disk");
  const network = createDetailSlice(uuid, "network");
  const cpu = createCpuDetailSlice(uuid);

  function stopAll() {
    disk.stopTimer();
    network.stopTimer();
    cpu.stopTimer();
  }

  function clearAll() {
    disk.clear();
    network.clear();
    cpu.clear();
  }

  function clampDetail(mapper: (windowMs: number) => number) {
    disk.windowMs = mapper(disk.windowMs);
    network.windowMs = mapper(network.windowMs);
  }

  return { disk, network, cpu, stopAll, clearAll, clampDetail };
}
