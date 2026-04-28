<script setup lang="ts">
import { computed } from 'vue'
import { formatSocBoundingBox } from '@/composables/socTemplatePreviewRenderer'
import type { SocTemplateCore, SocTemplateDetail } from '@/composables/socTemplateMapper'

const props = defineProps<{
  template: SocTemplateDetail
  selectedCore: SocTemplateCore | null
}>()

const selectedInfo = computed(() => props.selectedCore?.info || 'No info provided')
</script>

<template>
  <aside class="soc-template-inspector">
    <section class="soc-template-inspector__section">
      <h3>Template</h3>
      <div>Design: {{ template.name }}</div>
      <div>Info: {{ template.info }}</div>
      <div>I/O Pins: {{ template.ioPinsCount }}</div>
      <div>Core Count: {{ template.coreCount }}</div>
    </section>

    <section class="soc-template-inspector__section">
      <h3>Selected Core</h3>
      <div v-if="selectedCore">
        <div>id: {{ selectedCore.id }}</div>
        <div>name: {{ selectedCore.name }}</div>
        <div>info: {{ selectedInfo }}</div>
        <div>align: {{ selectedCore.align }}</div>
        <div>orient: {{ selectedCore.orient }}</div>
        <div>bounding box: {{ formatSocBoundingBox(selectedCore.boundingBox) }}</div>
      </div>
      <div v-else>No core selected</div>
    </section>
  </aside>
</template>

<style scoped>
.soc-template-inspector {
  display: grid;
  gap: 16px;
  min-width: 260px;
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.soc-template-inspector__section {
  display: grid;
  gap: 8px;
}

.soc-template-inspector h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.2;
}
</style>
