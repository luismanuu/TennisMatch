<template>
  <div class="glass-card opacity-60">
    <div class="flex items-center gap-3 text-foreground-muted p-6">
      <Icon name="heroicons:information-circle" class="w-5 h-5 flex-shrink-0" />
      <p class="text-size-4">{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string
}>()
</script>
