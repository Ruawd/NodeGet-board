import { useBackendStore } from "@/composables/useBackendStore";
import { WsConnection, getWsConnection } from "@/composables/useWsConnection";
import type { SummaryField } from "@/types/monitoring";
import { useInFlightDedupe } from "@/composables/useInFlightDedupe";

const { currentBackend } = useBackendStore();

const dedicatedWs = true;
const summaryConn: WsConnection = dedicatedWs
  ? new WsConnection(currentBackend.value?.url as string)
  : getWsConnection(currentBackend.value?.url as string);

const _fetchDynamicSummary = async (
  serverUuid: string,
  options?: {
    timestamp_from?: number;
    timestamp_to?: number;
    limit?: number;
  },
  fields?: SummaryField[],
  timeout: number = 10_000,
) => {
  if (!currentBackend.value) throw new Error("No backend selected");

  const queryFields = fields ?? [
    "cpu_usage",
    "used_memory",
    "total_memory",
    "read_speed",
    "write_speed",
    "transmit_speed",
    "receive_speed",
  ];

  const condition: Record<string, unknown>[] = [{ uuid: serverUuid }];
  if (options?.timestamp_from != null && options?.timestamp_to != null) {
    condition.push({
      timestamp_from_to: [options.timestamp_from, options.timestamp_to],
    });
  }
  if (options?.limit != null) condition.push({ limit: options.limit });

  return summaryConn.call(
    "agent_query_dynamic_summary",
    [currentBackend.value.token, { fields: queryFields, condition }],
    timeout,
  );
};

export const { execute: fetchDynamicSummary, isLoading: loading } =
  useInFlightDedupe(_fetchDynamicSummary);
