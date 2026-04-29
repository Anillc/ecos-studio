<script setup lang="ts">
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  buildFlowLogViewerExtensions,
  FLOW_LOG_VIEWER_TAIL_THRESHOLD_PX,
  isFlowLogViewerNearTail,
} from './flowLogCodeViewer'

const props = withDefaults(defineProps<{
  content: string
  live?: boolean
  missing?: boolean
  loading?: boolean
}>(), {
  live: false,
  missing: false,
  loading: false,
})

const rootRef = ref<HTMLElement | null>(null)
const isViewerEmpty = computed(() => !props.content)

let view: EditorView | null = null

function destroyViewer(): void {
  view?.destroy()
  view = null
}

function ensureViewerState(): void {
  if (isViewerEmpty.value || !rootRef.value) {
    if (view) destroyViewer()
    return
  }

  if (view) return

  view = new EditorView({
    parent: rootRef.value,
    state: EditorState.create({
      doc: props.content,
      extensions: buildFlowLogViewerExtensions(),
    }),
  })
}

function syncViewerContent(nextContent: string): void {
  if (!view) return

  const currentContent = view.state.doc.toString()
  if (currentContent === nextContent) return

  const scrollDOM = view.scrollDOM
  const shouldFollowTail = props.live && isFlowLogViewerNearTail({
    scrollHeight: scrollDOM.scrollHeight,
    scrollTop: scrollDOM.scrollTop,
    clientHeight: scrollDOM.clientHeight,
  }, FLOW_LOG_VIEWER_TAIL_THRESHOLD_PX)

  const changes = nextContent.startsWith(currentContent)
    ? { from: currentContent.length, insert: nextContent.slice(currentContent.length) }
    : { from: 0, to: currentContent.length, insert: nextContent }

  view.dispatch({ changes })

  if (shouldFollowTail) {
    requestAnimationFrame(() => {
      if (!view) return
      view.scrollDOM.scrollTop = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight)
    })
  }
}

onMounted(() => {
  ensureViewerState()
})

watch(() => props.content, (nextContent) => {
  ensureViewerState()
  syncViewerContent(nextContent)
}, { flush: 'post' })

watch([rootRef, isViewerEmpty], () => {
  ensureViewerState()
}, { flush: 'post' })

onUnmounted(() => {
  destroyViewer()
})
</script>

<template>
  <div class="flow-log-viewer-shell">
    <div v-if="isViewerEmpty" class="flow-log-viewer-empty">
      <i class="ri-file-list-3-line"></i>
      <p>{{ loading ? 'Loading log content…' : missing ? 'Log file not found' : 'No log content yet' }}</p>
      <span v-if="loading">Reading the selected step log on demand.</span>
      <span v-else-if="missing">The selected step did not produce a readable log file.</span>
      <span v-else>Select a started step or wait for the current step to emit logs.</span>
    </div>
    <div v-else class="flow-log-viewer-editor-wrap" :class="{ 'is-live': live }">
      <div ref="rootRef" class="flow-log-viewer-editor"></div>
      <span v-if="live" class="flow-log-terminal-cursor" aria-hidden="true"></span>
    </div>
  </div>
</template>

<style scoped>
.flow-log-viewer-shell {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  background: var(--bg-primary);
}

.flow-log-viewer-editor-wrap,
.flow-log-viewer-editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.flow-log-viewer-editor-wrap {
  position: relative;
  display: flex;
}

.flow-log-viewer-editor {
  overflow: hidden;
}

.flow-log-terminal-cursor {
  position: absolute;
  right: 18px;
  bottom: 14px;
  width: 7px;
  height: 15px;
  border-radius: 1px;
  background: var(--accent-color);
  box-shadow: 0 0 10px rgba(var(--accent-rgb, 59, 130, 246), 0.55);
  pointer-events: none;
  animation: flow-log-cursor-blink 1s steps(1, end) infinite;
}

@keyframes flow-log-cursor-blink {
  0%,
  49% {
    opacity: 0.95;
  }

  50%,
  100% {
    opacity: 0;
  }
}

.flow-log-viewer-empty {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  color: var(--text-secondary);
  background: var(--bg-primary);
  text-align: center;
}

.flow-log-viewer-empty i {
  font-size: 28px;
  opacity: 0.35;
}

.flow-log-viewer-empty p {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
}

.flow-log-viewer-empty span {
  font-size: 10px;
  opacity: 0.7;
  max-width: 320px;
  line-height: 1.45;
}
</style>
