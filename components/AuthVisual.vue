<template>
  <PhotoPanel photo="hero" tag="aside" class="auth-visual" eager sizes="(max-width: 899px) 320px, 50vw">
    <template #decor><CourtLines rally /></template>
    <p class="auth-visual__kicker">{{ kicker }}</p>
    <p class="auth-visual__title">Una cancha.<br>Tu próximo partido.</p>
  </PhotoPanel>
</template>

<script setup lang="ts">
/** Photo side of the sign-in / sign-up screens (mock index headline); decorative, the form carries the h1. */
withDefaults(defineProps<{ kicker?: string }>(), { kicker: 'Tenis Ecuador' })
</script>
