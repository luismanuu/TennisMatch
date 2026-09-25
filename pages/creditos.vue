<template>
  <PageLayout>
    <PageHeader
      title="Fotografía"
      subtitle="Imágenes de referencia. No representan los clubes ni los partidos mencionados en la aplicación."
    />
    <div class="credit-grid">
      <article v-for="(credit, key) in PHOTOS" :key="key" class="panel credit-card">
        <img class="credit-image" :src="photoSrc(key)" :alt="credit.description" width="1600" height="1067" loading="lazy" decoding="async">
        <h2>{{ credit.author }}</h2>
        <p>{{ credit.file.replace('File:', '') }}</p>
        <p class="meta">{{ credit.license }}. Presentación: recorte visual y capa oscura, sin modificar el archivo original.</p>
        <div class="credit-links">
          <a class="text-link" :href="credit.page" target="_blank" rel="noopener">
            Fuente original
            <Icon name="heroicons:arrow-up-right" class="w-4 h-4" aria-hidden="true" />
          </a>
          <a class="text-link" :href="licenseUrl(credit.license)" target="_blank" rel="noopener">Licencia</a>
        </div>
      </article>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
useHead({ title: 'Créditos de fotografías · Tenis Ecuador' })
</script>

<style scoped>
.credit-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.credit-card { display: flex; flex-direction: column; gap: 16px; overflow-wrap: anywhere; }
.credit-card h2 { font-size: 22px; line-height: 1.3; }
.credit-image { width: 100%; height: 180px; object-fit: cover; border-radius: 12px; background: var(--photo-fallback); }
.credit-links { display: flex; flex-wrap: wrap; gap: 0 24px; margin-top: auto; }
@media (max-width: 767px) { .credit-grid { grid-template-columns: 1fr; } }
</style>
