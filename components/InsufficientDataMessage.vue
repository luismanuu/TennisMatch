<template>
  <div class="panel insufficient" role="note">
    <div class="flex items-center gap-3 text-foreground-muted">
      <Icon name="heroicons:information-circle" class="w-5 h-5 flex-shrink-0" aria-hidden="true" />
      <p class="text-size-4">{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>

<style scoped>
/* Incomplete data reads as a placeholder, not a result: no fill, dashed edge. Not opacity,
   which would drop the muted text under DESIGN.md §10's 4.5:1 in both appearances. */
.insufficient { background: transparent; border-style: dashed; }
</style>
