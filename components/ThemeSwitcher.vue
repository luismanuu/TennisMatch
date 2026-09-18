<template>
  <div class="theme-switcher" role="radiogroup" aria-label="Tema visual">
    <button
      v-for="key in themeKeys"
      :key="key"
      type="button"
      role="radio"
      :aria-checked="theme === key"
      :title="`${themes[key].name} · ${themes[key].description}`"
      class="theme-swatch"
      :class="[`theme-swatch-${key}`, { 'is-active': theme === key }]"
      @click="setTheme(key)"
    >
      <span class="sr-only">{{ themes[key].name }}</span>
    </button>
    <span v-if="showLabel" class="text-size-4 text-foreground-muted ml-1">{{ themes[theme].name }}</span>
  </div>
</template>

<script setup lang="ts">
/**
 * Three-swatch theme picker. Purely a preview aid until a theme is chosen as
 * the default in app.config.ts — remove or hide it afterwards if you like.
 */
defineProps<{ showLabel?: boolean }>()
const { theme, themes, themeKeys, setTheme } = useTheme()
</script>
