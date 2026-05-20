<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { Copy, FileText, Send, Trash2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBackendStore } from "@/composables/useBackendStore";
import { getWsConnection } from "@/composables/useWsConnection";
import {
  maskToken,
  type RpcDebugRecord,
  useRpcDebugStore,
} from "../rpcDebugStore";
import {
  backendKey,
  methodCatalog,
  methodHints,
  rpcDebugCommandFilter,
} from "../helpers";
import { buildRpcMethodParams } from "../rpcMethodCatalog";
import type { ComposerDraft } from "../types";

interface ComposerSourceRecord {
  recordId: string;
  method: string;
}

const props = defineProps<{
  pendingRecord?: RpcDebugRecord | null;
}>();

const emit = defineEmits<{
  copied: [message?: string];
  consumedRecord: [];
  showSourceRecord: [recordId: string];
}>();

const debugStore = useRpcDebugStore();
const backendStore = useBackendStore();
const NO_BACKEND_VALUE = "__none__";
const methodFocused = ref(false);
const composerSource = ref<ComposerSourceRecord | null>(null);

const backendOptions = computed(() => backendStore.backends.value);
const currentBackendKey = computed(() =>
  backendStore.currentBackend.value
    ? backendKey(backendStore.currentBackend.value)
    : "",
);

const composer = reactive<ComposerDraft>({
  method: "nodeget-server_hello",
  requestId: "",
  backendKey: "",
  paramsText: "[]",
  sending: false,
  responseText: "尚未发送请求",
  responseMeta: "等待发送",
  responseMethod: "",
});

const selectedBackend = computed(() =>
  backendOptions.value.find((item) => backendKey(item) === composer.backendKey),
);

const sourceRecordIndex = computed(() => {
  if (!composerSource.value) return null;
  const index = debugStore.records.value.findIndex(
    (record) => record.recordId === composerSource.value?.recordId,
  );
  return index >= 0 ? index + 1 : null;
});

const sourceRecordLinkText = computed(() =>
  sourceRecordIndex.value ? `#${sourceRecordIndex.value}` : "#?",
);

const responseMethodTag = computed(
  () => composer.responseMethod || composer.method.trim() || "-",
);

watch(
  currentBackendKey,
  (key) => {
    if (!composer.backendKey) composer.backendKey = key;
  },
  { immediate: true },
);

watch(
  () => props.pendingRecord,
  (record) => {
    if (!record) return;
    const req =
      record.request && typeof record.request === "object"
        ? (record.request as { method?: unknown; params?: unknown })
        : null;
    composer.method =
      typeof req?.method === "string" ? req.method : record.method;
    composer.requestId = "";
    composer.paramsText = formatRawComposerPayload(req?.params ?? {});
    composer.responseText = "尚未发送请求";
    composer.responseMeta = "等待发送";
    composer.responseMethod = "";
    composerSource.value = {
      recordId: record.recordId,
      method: record.method,
    };
    emit("consumedRecord");
  },
  { immediate: true },
);

async function copyText(text: string, message?: string) {
  await navigator.clipboard.writeText(text);
  emit("copied", message);
}

function selectMethodSuggestion(method: string) {
  composer.method = method;
  methodFocused.value = false;
  fillDefaultParams();
}

function clearComposerDraft() {
  composer.method = "";
  composer.requestId = "";
  composer.backendKey = "";
  composer.paramsText = "";
  composer.responseText = "尚未发送请求";
  composer.responseMeta = "等待发送";
  composer.responseMethod = "";
  composerSource.value = null;
  methodFocused.value = false;
}

function showSourceRecord() {
  if (!composerSource.value) return;
  emit("showSourceRecord", composerSource.value.recordId);
}

function handleMethodFocusOut(event: FocusEvent) {
  const currentTarget = event.currentTarget;
  const relatedTarget = event.relatedTarget;

  if (!(currentTarget instanceof HTMLElement)) {
    return;
  }

  if (relatedTarget instanceof Node && currentTarget.contains(relatedTarget)) {
    return;
  }

  methodFocused.value = false;
}

function handleBackendSelectionChange(value: unknown) {
  composer.backendKey =
    typeof value === "string" && value !== NO_BACKEND_VALUE ? value : "";
  fillDefaultParams();
}

function formatRawComposerPayload(value: unknown) {
  if (typeof value === "string") return JSON.stringify(value);
  return (
    JSON.stringify(value, null, debugStore.settings.formatJson ? 2 : 0) ?? ""
  );
}

function fillDefaultParams() {
  const token = selectedBackend.value?.token ?? "";
  const method = composer.method.trim();
  const templateParams = buildRpcMethodParams(method, token);
  if (templateParams !== undefined) {
    composer.paramsText = formatRawComposerPayload(templateParams);
    return;
  }
  composer.paramsText = JSON.stringify({ token }, null, 2);
}

function parseComposerParams() {
  const text = composer.paramsText.trim();
  if (!text) return [];
  return JSON.parse(text) as unknown;
}

async function sendComposerRequest() {
  const backend = selectedBackend.value;
  if (!backend?.url) {
    toast.error("请选择后端凭据");
    return;
  }
  composer.sending = true;
  composer.responseMeta = "发送中";
  const method = composer.method.trim();
  composer.responseMethod = method;
  const startedAt = performance.now();
  try {
    const result = await getWsConnection(backend.url).call<unknown>(
      method,
      parseComposerParams(),
      10000,
      {
        idPrefix: "debug-",
        onRequestId: (id) => {
          composer.requestId = id;
        },
      },
    );
    const duration = Math.round(performance.now() - startedAt);
    composer.responseMeta = `成功 · ${duration}ms`;
    composer.responseText =
      typeof result === "string"
        ? result
        : JSON.stringify(
            result ?? null,
            null,
            debugStore.settings.formatJson ? 2 : 0,
          );
  } catch (error) {
    composer.responseMeta = "错误";
    composer.responseText =
      error instanceof Error ? error.message : String(error);
  } finally {
    composer.sending = false;
  }
}
</script>

<template>
  <div class="grid h-full gap-6 p-6 lg:grid-cols-[520px_minmax(0,1fr)]">
    <Card class="gap-0 py-0">
      <CardContent class="p-5">
        <Alert
          v-if="composerSource"
          class="mb-5 flex items-start justify-between gap-4 border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-100"
        >
          <AlertDescription
            class="min-w-0 leading-6 text-blue-950 dark:text-blue-100"
          >
            已从网络记录
            <Button
              variant="link"
              class="inline h-auto p-0 align-baseline text-sm font-semibold text-blue-700 underline-offset-4 dark:text-blue-300"
              type="button"
              @click="showSourceRecord"
            >
              {{ sourceRecordLinkText }}
            </Button>
            带入：<span class="font-mono text-xs">{{
              composerSource.method
            }}</span
            >。你可以修改参数后重新发送。
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            class="h-8 shrink-0 border-blue-200 bg-white px-2.5 text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
            type="button"
            :disabled="composer.sending"
            @click="clearComposerDraft"
          >
            <Trash2 class="size-3.5" />
            清除带入
          </Button>
        </Alert>
        <Alert v-else class="mb-5 bg-muted/35 text-muted-foreground">
          <AlertDescription class="text-muted-foreground">
            从网络详情点击“编辑并重新构造”会自动带入方法和参数。
          </AlertDescription>
        </Alert>
        <div class="space-y-5">
          <div class="relative grid gap-1.5">
            <Label class="text-xs text-muted-foreground">方法</Label>
            <Command
              :filter="rpcDebugCommandFilter"
              :highlight-on-hover="true"
              class="relative h-10 overflow-visible rounded-md border bg-background shadow-none [&_[data-slot=command-input-wrapper]]:h-10 [&_[data-slot=command-input-wrapper]]:border-b-0 [&_[data-slot=command-input]]:h-9 [&_[data-slot=command-input]]:py-1 [&_[data-slot=command-input]]:text-sm"
              @focusout="handleMethodFocusOut"
            >
              <CommandInput
                v-model="composer.method"
                :auto-focus="false"
                placeholder="nodeget-server_hello"
                @focus="methodFocused = true"
                @click="methodFocused = true"
                @keydown.esc.stop="methodFocused = false"
              />
              <CommandList
                v-if="methodFocused"
                class="absolute top-full left-0 z-10 mt-1 max-h-64 w-full rounded-md border bg-popover shadow-lg"
                @mousedown.prevent
              >
                <CommandEmpty class="py-3 text-xs"> 暂无匹配方法 </CommandEmpty>
                <CommandGroup heading="方法">
                  <CommandItem
                    v-for="method in methodCatalog"
                    :key="method"
                    :value="method"
                    class="justify-between gap-3 text-sm"
                    @select="selectMethodSuggestion(method)"
                  >
                    <span class="min-w-0 truncate font-mono text-xs">
                      {{ method }}
                    </span>
                    <span class="shrink-0 text-xs text-muted-foreground">
                      {{ methodHints[method] ?? "RPC" }}
                    </span>
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-1.5">
              <Label class="text-xs text-muted-foreground">请求 ID</Label>
              <Input
                v-model="composer.requestId"
                class="h-10"
                disabled
                placeholder="debug-<random_id>"
              />
            </div>
            <div class="grid gap-1.5">
              <Label class="text-xs text-muted-foreground">鉴权来源</Label>
              <Select
                :model-value="composer.backendKey || NO_BACKEND_VALUE"
                @update:model-value="handleBackendSelectionChange"
              >
                <SelectTrigger class="h-10 w-full">
                  <SelectValue placeholder="未选择" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="NO_BACKEND_VALUE">未选择</SelectItem>
                  <SelectItem
                    v-for="backend in backendOptions"
                    :key="backendKey(backend)"
                    :value="backendKey(backend)"
                  >
                    {{ backend.name }} / {{ maskToken(backend.token) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="grid gap-1.5">
            <Label class="text-xs text-muted-foreground">参数 JSON</Label>
            <Textarea
              v-model="composer.paramsText"
              class="min-h-[180px] font-mono text-sm"
            />
          </div>

          <div class="flex gap-2">
            <Button
              size="lg"
              type="button"
              :disabled="composer.sending"
              @click="sendComposerRequest"
            >
              <Send class="size-4" />
              {{ composer.sending ? "发送中" : "发送" }}
            </Button>
            <Button
              variant="outline"
              size="lg"
              type="button"
              @click="copyText(composer.paramsText, '参数 JSON 已复制')"
            >
              <Copy class="size-4" />
              复制 JSON
            </Button>
            <Button
              variant="outline"
              size="lg"
              type="button"
              :disabled="composer.sending"
              @click="fillDefaultParams"
            >
              <FileText class="size-4" />
              填入模板
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card class="min-h-0 gap-0 py-0">
      <CardContent class="flex h-full min-h-0 flex-col p-5">
        <div class="mb-5 flex flex-none items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold">响应结果</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ composer.responseMeta }}
            </p>
          </div>
          <Button
            variant="outline"
            size="lg"
            type="button"
            @click="copyText(composer.responseText, '响应结果已复制')"
          >
            <Copy class="size-4" />
            复制结果
          </Button>
        </div>
        <Badge
          variant="outline"
          class="mb-3 max-w-full flex-none border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-200"
        >
          <span class="font-medium">method:</span>
          <span class="truncate font-mono">{{ responseMethodTag }}</span>
        </Badge>
        <Textarea
          :model-value="composer.responseText"
          readonly
          class="h-full resize-none font-mono text-sm"
        />
      </CardContent>
    </Card>
  </div>
</template>
