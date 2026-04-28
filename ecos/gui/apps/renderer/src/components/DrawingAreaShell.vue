<template>
  <section class="drawing-area-shell">
    <div class="drawing-area-shell__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.drawing-area-shell {
  height: 100%;
  min-height: 420px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 18px;
  overflow: hidden;
}

.drawing-area-shell__body {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
    var(--bg-primary);
  background-size: 24px 24px;
}
</style>
