<template>
  <div class="page-container">
    <!-- Ambient Background Effects -->
    <div class="page-ambient-bg">
      <div class="grid-pattern"></div>
    </div>

    <!-- Navigation -->
    <AppNavigation />
    
    <!-- Spacer for fixed nav -->
    <div class="h-16"></div>

    <!-- Page Content -->
    <div class="page-content">
      <div :class="containerClass">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  containerSize?: 'narrow' | 'medium' | 'wide'
}

const props = withDefaults(defineProps<Props>(), {
  containerSize: 'medium'
})

const containerClass = computed(() => {
  const sizeMap = {
    narrow: 'container-narrow',
    medium: 'container-medium',
    wide: 'container-wide'
  }
  return `${sizeMap[props.containerSize]} px-6`
})
</script>


