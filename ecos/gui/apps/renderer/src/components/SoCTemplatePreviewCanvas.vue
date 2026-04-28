<script setup lang="ts">
import { computed } from 'vue'
import { buildSocPreviewRects } from '@/composables/socTemplatePreviewRenderer'
import type { SocTemplateDetail } from '@/composables/socTemplateMapper'

const props = defineProps<{
  template: SocTemplateDetail
  selectedCoreId: number | null
}>()

// select-core: [coreId: number]
const emit = defineEmits<{
  'select-core': [coreId: number]
}>()

const rects = computed(() => buildSocPreviewRects(props.template))
</script>

<template>
  <div class="soc-template-preview-canvas">
    <div class="soc-template-preview-canvas__die">
      <div class="soc-template-preview-canvas__core-area">
        <button
          v-for="rect in rects"
          :key="rect.coreId"
          type="button"
          class="soc-template-preview-canvas__core"
          :class="{ 'is-selected': rect.coreId === selectedCoreId }"
          :data-soc-core-id="rect.coreId"
          :style="{
            left: `${rect.leftPct}%`,
            top: `${rect.topPct}%`,
            width: `${rect.widthPct}%`,
            height: `${rect.heightPct}%`,
          }"
          @click="emit('select-core', rect.coreId)"
        >
          <span>{{ rect.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.soc-template-preview-canvas {
  width: 100%;
  height: 100%;
  min-height: 240px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.soc-template-preview-canvas__die {
  width: min(100%, 520px);
  aspect-ratio: 1;
  padding: 9%;
  border: 1px solid var(--border-color);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.01));
  box-sizing: border-box;
}

.soc-template-preview-canvas__core-area {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

.soc-template-preview-canvas__core {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(96, 165, 250, 0.16);
  color: var(--text-primary);
  cursor: pointer;
}

.soc-template-preview-canvas__core.is-selected {
  border-color: rgba(96, 165, 250, 0.9);
  background: rgba(96, 165, 250, 0.3);
}

.soc-template-preview-canvas__core span {
  font-size: 12px;
  line-height: 1.1;
  text-align: center;
  pointer-events: none;
}
</style>
