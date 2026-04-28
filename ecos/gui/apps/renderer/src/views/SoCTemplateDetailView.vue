<script setup lang="ts">
defineProps<{
  templateId: string
}>()
</script>

<template>
  <section class="w-full max-w-2xl mx-auto px-8 py-10 text-(--text-primary)">
    <h1 class="text-2xl font-semibold mb-2">SoC Template</h1>
    <p class="text-sm text-(--text-secondary)">
      Template <span class="font-medium text-(--text-primary)">{{ templateId }}</span> is not ready yet, but this route is active.
    </p>
  </section>
</template>
