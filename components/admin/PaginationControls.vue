<template>
  <div v-if="totalPages > 1" class="pagination-controls">
    <!-- Mobile: Simplified pagination -->
    <div class="flex flex-col sm:hidden gap-4">
      <div class="text-center text-size-4 text-foreground-muted">
        Mostrando {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, total) }} de {{ total }}
      </div>
      <div class="flex items-center justify-between gap-2">
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1 || loading"
          class="btn-secondary text-size-4 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="heroicons:chevron-left" class="w-4 h-4 mr-1" />
          <span class="hidden sm:inline">Anterior</span>
        </button>
        <div class="flex items-center gap-1">
          <span class="text-size-4 font-semibold text-foreground px-2">
            {{ currentPage }} / {{ totalPages }}
          </span>
        </div>
        <button
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage === totalPages || loading"
          class="btn-secondary text-size-4 flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span class="hidden sm:inline">Siguiente</span>
          <Icon name="heroicons:chevron-right" class="w-4 h-4 ml-1" />
        </button>
      </div>
    </div>

    <!-- Desktop: Full pagination -->
    <div class="hidden sm:flex items-center justify-between gap-4">
      <div class="text-size-4 text-foreground-muted">
        Mostrando {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, total) }} de {{ total }}
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1 || loading"
          class="btn-secondary text-size-4 disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'opacity-50 cursor-not-allowed': currentPage === 1 || loading }"
        >
          <Icon name="heroicons:chevron-left" class="w-4 h-4" />
        </button>
        
        <!-- First page -->
        <button
          v-if="showFirstPage"
          @click="goToPage(1)"
          :disabled="loading"
          :class="[
            'btn-secondary text-size-4',
            currentPage === 1 ? 'bg-accent-subtle/30 border-accent/30' : ''
          ]"
        >
          1
        </button>
        <span v-if="showFirstEllipsis" class="text-size-4 text-foreground-muted px-2">...</span>
        
        <!-- Visible page numbers -->
        <button
          v-for="page in visiblePages"
          :key="page"
          @click="goToPage(page)"
          :disabled="loading"
          :class="[
            'btn-secondary text-size-4',
            page === currentPage ? 'bg-accent-subtle/30 border-accent/30' : ''
          ]"
        >
          {{ page }}
        </button>
        
        <span v-if="showLastEllipsis" class="text-size-4 text-foreground-muted px-2">...</span>
        
        <!-- Last page -->
        <button
          v-if="showLastPage"
          @click="goToPage(totalPages)"
          :disabled="loading"
          :class="[
            'btn-secondary text-size-4',
            currentPage === totalPages ? 'bg-accent-subtle/30 border-accent/30' : ''
          ]"
        >
          {{ totalPages }}
        </button>
        
        <button
          @click="goToPage(currentPage + 1)"
          :disabled="currentPage === totalPages || loading"
          class="btn-secondary text-size-4 disabled:opacity-50 disabled:cursor-not-allowed"
          :class="{ 'opacity-50 cursor-not-allowed': currentPage === totalPages || loading }"
        >
          <Icon name="heroicons:chevron-right" class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentPage: number
  totalPages: number
  total: number
  pageSize: number
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  'page-change': [page: number]
}>()

const goToPage = (page: number) => {
  if (page >= 1 && page <= props.totalPages && !props.loading) {
    emit('page-change', page)
  }
}

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, props.currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(props.totalPages, start + maxVisible - 1)
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

const showFirstPage = computed(() => {
  return visiblePages.value[0] > 2
})

const showFirstEllipsis = computed(() => {
  return visiblePages.value[0] > 2
})

const showLastPage = computed(() => {
  const lastVisible = visiblePages.value[visiblePages.value.length - 1]
  return lastVisible < props.totalPages - 1
})

const showLastEllipsis = computed(() => {
  const lastVisible = visiblePages.value[visiblePages.value.length - 1]
  return lastVisible < props.totalPages - 1
})
</script>

<style scoped>
.pagination-controls {
  @apply mt-6 p-4;
}
</style>
