<template>
  <div class="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
    <TransitionGroup name="toast" tag="div">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'panel rounded-lg border shadow-lg flex items-center gap-3 min-w-[300px]',
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/30' :
          toast.type === 'error' ? 'bg-red-500/10 border-red-500/30' :
          toast.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
          'bg-blue-500/10 border-blue-500/30'
        ]"
      >
        <Icon
          :name="
            toast.type === 'success' ? 'heroicons:check-circle' :
            toast.type === 'error' ? 'heroicons:x-circle' :
            toast.type === 'warning' ? 'heroicons:exclamation-triangle' :
            'heroicons:information-circle'
          "
          :class="[
            'w-5 h-5 flex-shrink-0',
            toast.type === 'success' ? 'text-green-400' :
            toast.type === 'error' ? 'text-red-400' :
            toast.type === 'warning' ? 'text-yellow-400' :
            'text-blue-400'
          ]"
        />
        <p class="text-size-4 font-regular text-foreground flex-1">{{ toast.message }}</p>
        <button
          @click="dismissToast(toast.id)"
          class="text-foreground-muted hover:text-foreground transition-colors"
        >
          <Icon name="heroicons:x-mark" class="w-4 h-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
const { toasts, dismissToast } = useToastNotifications()
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>

