// 所有节点的最新动态摘要
export { useDynamicSummaryMultiLast } from "@/composables/monitoring/dynamic/useDynamicSummaryMultiLast";
// 某个节点的动态摘要历史
export {
  fetchDynamicSummary,
  loading as dynamicSummaryLoading,
} from "@/composables/monitoring/dynamic/useDynamicSummarySingle";
// 某个节点的动态数据历史
export {
  fetchDynamic,
  loading as dynamicLoading,
} from "@/composables/monitoring/dynamic/useDynamicSingle";
