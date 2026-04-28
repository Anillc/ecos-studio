<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import SoCTemplateDetail from '@/components/SoCTemplateDetail.vue'
import { loadSocTemplateDetail } from '@/composables/socTemplateCatalog'
import type { SocTemplateDetail as SocTemplateDetailModel } from '@/composables/socTemplateMapper'
import { getDefaultSocCoreId } from '@/composables/socTemplatePreviewSelection'

const props = defineProps<{
  templateId: string
}>()

const router = useRouter()
const template = ref<SocTemplateDetailModel | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const selectedCoreId = ref<number | null>(null)

async function loadDetail(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    const detail = await loadSocTemplateDetail(props.templateId)
    template.value = detail
    selectedCoreId.value = getDefaultSocCoreId(detail)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to load SoC template data'
  } finally {
    loading.value = false
  }
}

watch(() => props.templateId, loadDetail, { immediate: true })
</script>

<template>
  <div v-if="loading">Loading template detail...</div>
  <div v-else-if="error">
    <p>{{ error }}</p>
    <button type="button" @click="loadDetail">Retry</button>
  </div>
  <SoCTemplateDetail
    v-else-if="template"
    :template="template"
    :selected-core-id="selectedCoreId"
    @back="router.push('/soc')"
    @select-core="selectedCoreId = $event"
  />
</template>
