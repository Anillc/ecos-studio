<script setup lang="ts">
import { computed } from 'vue'
import DrawingAreaShell from '@/components/DrawingAreaShell.vue'
import SoCTemplateInspector from '@/components/SoCTemplateInspector.vue'
import SoCTemplatePreviewCanvas from '@/components/SoCTemplatePreviewCanvas.vue'
import { getSelectedSocCore } from '@/composables/socTemplatePreviewSelection'
import type { SocTemplateDetail as SocTemplateDetailModel } from '@/composables/socTemplateMapper'

const props = defineProps<{
  template: SocTemplateDetailModel
  selectedCoreId: number | null
}>()

defineEmits<{
  back: []
  'select-core': [coreId: number]
}>()

const selectedCore = computed(() => getSelectedSocCore(props.template, props.selectedCoreId))
</script>

<template>
  <section class="soc-template-detail">
    <header class="soc-template-detail__header">
      <button type="button" class="soc-template-detail__back" @click="$emit('back')">Back</button>
      <div>
        <h1>{{ template.name }}</h1>
        <p>{{ template.ioPinsCount }} IO Pins - {{ template.info }}</p>
      </div>
    </header>

    <div class="soc-template-detail__main">
      <DrawingAreaShell>
        <SoCTemplatePreviewCanvas
          :template="template"
          :selected-core-id="selectedCoreId"
          @select-core="$emit('select-core', $event)"
        />
      </DrawingAreaShell>

      <SoCTemplateInspector :template="template" :selected-core="selectedCore" />
    </div>

    <div class="soc-template-detail__chips">
      <button
        v-for="core in template.cores"
        :key="core.id"
        type="button"
        class="soc-template-detail__chip"
        :data-soc-core-chip="core.id"
        @click="$emit('select-core', core.id)"
      >
        {{ core.name.split('/').pop() || core.name }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.soc-template-detail {
  display: grid;
  gap: 20px;
  color: var(--text-primary);
}

.soc-template-detail__header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
}

.soc-template-detail__header h1,
.soc-template-detail__header p {
  margin: 0;
}

.soc-template-detail__header p {
  color: var(--text-secondary);
}

.soc-template-detail__back,
.soc-template-detail__chip {
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
}

.soc-template-detail__back {
  padding: 8px 14px;
}

.soc-template-detail__main {
  display: grid;
  gap: 20px;
}

.soc-template-detail__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.soc-template-detail__chip {
  padding: 8px 12px;
}

@media (min-width: 960px) {
  .soc-template-detail__main {
    grid-template-columns: minmax(0, 1fr) 300px;
    align-items: start;
  }
}
</style>
