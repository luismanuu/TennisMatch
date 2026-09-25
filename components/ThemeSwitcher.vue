<template>
  <fieldset class="appearance-choice">
    <legend class="appearance-legend">Tema visual</legend>
    <label v-for="key in themeKeys" :key="key" class="theme-choice">
      <input
        type="radio"
        name="appearance"
        :value="key"
        :checked="theme === key"
        @change="setTheme(key)"
      >
      <span class="swatch" :class="`swatch-${key}`" aria-hidden="true"></span>
      <span>{{ themes[key].name }}</span>
    </label>
  </fieldset>
</template>

<script setup lang="ts">
/** Appearance setting (DESIGN_SYSTEM.md §3): native radios in 56px rows; the whole row is the target. */
const { theme, themes, themeKeys, setTheme } = useTheme()
</script>

<style scoped>
.appearance-choice { border: 0; padding: 0; margin: 0; }
.appearance-legend { font-weight: 600; margin-bottom: 12px; }
</style>
