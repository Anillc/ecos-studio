<script setup lang="ts">
import type { SocTemplateSummary } from '@/composables/socTemplateMapper'

defineProps<{
  items: SocTemplateSummary[]
  loading: boolean
  error: string | null
}>()

defineEmits<{
  back: []
  open: [templateId: string]
  retry: []
}>()
</script>

<template>
  <section class="soc-template-gallery">
    <header class="soc-template-gallery__header">
      <button type="button" @click="$emit('back')">Back</button>
      <div>
        <h1>SoC Template Manager</h1>
      </div>
    </header>

    <div v-if="loading">Loading template catalog…</div>
    <div v-else-if="error">
      <p>{{ error }}</p>
      <button type="button" @click="$emit('retry')">Retry</button>
    </div>
    <div v-else-if="items.length === 0">No SoC templates available.</div>
    <article
      v-else
      v-for="item in items"
      :key="item.id"
      class="soc-template-gallery__card"
    >
      <h2>{{ item.name }}</h2>
      <p>{{ item.info }}</p>
      <div>{{ item.ioPinsCount }} IO Pins · {{ item.coreCount }} Cores</div>
      <button type="button" @click="$emit('open', item.id)">Open Details</button>
    </article>
  </section>
</template>
