<template>
  <component :is="tag" class="photo" :class="variantClass" :style="{ '--focal': PHOTOS[photo].focalPoint || 'center' }">
    <img
      :src="photoSrc(photo)"
      alt=""
      width="1600"
      height="1067"
      :loading="eager ? 'eager' : 'lazy'"
      :fetchpriority="eager ? 'high' : undefined"
      decoding="async"
      @error="failed = true"
      v-show="!failed"
    >
    <div class="photo-content">
      <slot />
      <NuxtLink to="/creditos" class="photo-credit">
        Foto de referencia
        <Icon name="heroicons:information-circle" class="w-[15px] h-[15px]" aria-hidden="true" />
      </NuxtLink>
    </div>
  </component>
</template>

<script setup lang="ts">
/**
 * PhotoCard / PhotoHeader (DESIGN.md §4, §8): real image, dedicated scrim, in-flow
 * white copy, minimum height, and a visible "Foto de referencia" credit. The image
 * is decorative (empty alt); a missing file falls back to the dark surface fill.
 */
import type { PhotoKey } from '~/utils/photos'

interface Props {
  photo: PhotoKey
  variant?: 'card' | 'priority' | 'compact' | 'profile'
  eager?: boolean
  tag?: string
}

const props = withDefaults(defineProps<Props>(), { variant: 'card', eager: false, tag: 'section' })
const failed = ref(false)
const variantClass = computed(() => (props.variant === 'card' ? undefined : `photo--${props.variant}`))
</script>

<style>
.photo--priority .photo-content { min-height: 340px; }
.photo--compact { margin-bottom: 28px; }
.photo--compact .photo-content { min-height: 220px; justify-content: flex-end; }
.photo--compact .photo-credit { margin-top: 0; }
.photo--compact h1 { font-size: var(--font-size-1); line-height: 1.12; letter-spacing: -0.035em; }
.photo--profile .photo-content { min-height: 440px; }
.photo--profile .photo-credit { align-self: center; }
@media (max-width: 767px) {
  .photo--priority .photo-content { min-height: 320px; }
  .photo--profile .photo-content { min-height: 420px; }
}
</style>
