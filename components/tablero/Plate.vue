<template>
  <span class="t-cell" aria-hidden="true">
    <Transition name="t-flip">
      <span :key="String(value)" class="t-plate" :class="toneClass">{{ value }}</span>
    </Transition>
  </span>
</template>

<script setup lang="ts">
/**
 * One enamel plate in its hook cell (DESIGN.md "Plates"). When the value changes the
 * old plate swings off its hooks while the new one drops on: both share one grid cell,
 * so the swap never shifts the row. Decorative for assistive tech: the owner supplies text.
 */
const props = withDefaults(defineProps<{ value: string | number; tone?: 'plate' | 'lamp' | 'blank'; word?: boolean }>(), {
  tone: 'plate',
  word: false
})
const toneClass = computed(() => [
  props.tone === 'lamp' && 't-plate--lamp',
  props.tone === 'blank' && 't-plate--blank',
  props.word && 't-plate--word'
])
</script>
