import { onMounted, onUnmounted } from "vue";
import {
  useDynamicSummaryMultiLast,
  fetchDynamic,
  fetchDynamicSummary,
} from "@/composables/monitoring/useDynamicMonitoring";

const { refresh, servers, status, error } = useDynamicSummaryMultiLast();

const POLL_INTERVAL_MS = 1000;

export function useAgentStatus() {
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  onMounted(() => {
    if (pollTimer) {
      clearInterval(pollTimer);
    }
    pollTimer = setInterval(refresh, POLL_INTERVAL_MS);
  });

  onUnmounted(() => {
    if (pollTimer) {
      clearInterval(pollTimer);
    }
  });

  return {
    status,
    error,
    servers,
    fetchDynamicSummary,
    fetchDynamic,
  };
}
