import { toast } from "vue-sonner";

const checkInterval = 30 * 1000; // 30s

let lastHash = "";
export async function detectDashboardUpdate() {
  if (import.meta.env.DEV) {
    return;
  }

  try {
    const version: { hash: string; timestamp: number } = await fetch(
      "/.vite/version.json?ts=" + Date.now(),
    ).then((r) => r.json());
    if (version.hash) {
      if (!lastHash) {
        lastHash = version.hash;
      }
      if (lastHash !== version.hash) {
        toast.info("控制面板有新版本可用，可以刷新网页立即体验🚀", {
          duration: Infinity,
        });
        lastHash = version.hash;
      }
    }
  } catch (error) {
    console.error(error);
  }

  setTimeout(detectDashboardUpdate, checkInterval);
}

setTimeout(detectDashboardUpdate, checkInterval);
