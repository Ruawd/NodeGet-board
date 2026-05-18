<template>
  <div v-html="qrcodeEl"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import QRCode from "qrcode";

// props: text, size, type(svg/canvas)
const props = defineProps({
  text: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    default: 200,
  },
});

const qrcodeEl = ref("");

// 渲染二维码
const renderQRCode = async () => {
  // 清空上次内容
  qrcodeEl.value = "";

  try {
    const svgString = await QRCode.toString(props.text, {
      type: "svg",
      width: props.size,
      margin: 2,
    });
    // 插入 SVG
    qrcodeEl.value = svgString;
  } catch (err) {
    console.error(err);
  }
};

// 首次挂载渲染
onMounted(renderQRCode);

// 当 text 或 size 改变时重新渲染
watch(() => [props.text, props.size], renderQRCode);
</script>
