<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SoCTemplateGallery from '@/components/SoCTemplateGallery.vue'
import { loadSocTemplateCatalog } from '@/composables/socTemplateCatalog'
import type { SocTemplateSummary } from '@/composables/socTemplateMapper'

const router = useRouter()
const items = ref<SocTemplateSummary[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function loadCatalog(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    items.value = await loadSocTemplateCatalog()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load SoC template data'
  } finally {
    loading.value = false
  }
}

function handleOpen(templateId: string): void {
  router.push({ name: 'SoCTemplateDetail', params: { templateId } })
}

onMounted(loadCatalog)
</script>

<template>
  <section>
    <p>Fixed data source: ysyxSoCASIC.json</p>
    <SoCTemplateGallery
      :items="items"
      :loading="loading"
      :error="error"
      @back="router.push('/')"
      @open="handleOpen"
      @retry="loadCatalog"
    />
  </section>
</template>
