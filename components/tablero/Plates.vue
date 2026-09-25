<template>
  <span class="t-plates">
    <span v-if="label" class="sr-only">{{ label }}</span>
    <TableroPlate v-for="(d, i) in digits" :key="i" :value="d" :tone="tone" />
  </span>
</template>

<script setup lang="ts">
/** A number hung one plate per digit (SR, rank, counts). `label` is what a screen reader hears. */
import { plateDigits } from '~/utils/tablero'

const props = withDefaults(defineProps<{ value: number | null | undefined; minDigits?: number; tone?: 'plate' | 'lamp'; label?: string }>(), {
  minDigits: 1,
  tone: 'plate',
  label: undefined
})
const digits = computed(() => plateDigits(props.value, props.minDigits))
</script>
