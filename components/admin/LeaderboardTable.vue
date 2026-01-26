<template>
  <div class="leaderboard-table">
    <div v-if="loading" class="p-8 text-center">
      <Icon name="heroicons:arrow-path" class="w-6 h-6 text-accent animate-spin mx-auto mb-2" />
      <p class="text-size-4 text-foreground-muted">Cargando...</p>
    </div>
    
    <div v-else-if="!data || data.length === 0" class="p-8 text-center">
      <Icon name="heroicons:inbox" class="w-8 h-8 text-foreground-muted mx-auto mb-2 opacity-50" />
      <p class="text-size-4 text-foreground-muted">No hay datos disponibles</p>
    </div>
    
    <div v-else class="overflow-x-auto">
      <table class="w-full divide-y divide-border-subtle">
        <thead class="bg-surface border-b border-border-subtle">
          <tr>
            <th 
              v-for="column in columns" 
              :key="column.key"
              class="text-left p-2 md:p-4 text-size-5 md:text-size-4 font-semibold text-foreground cursor-pointer hover:bg-surface-elevated transition-colors whitespace-nowrap"
              @click="sortBy(column.key)"
            >
              <div class="flex items-center gap-1 md:gap-2">
                <span class="hidden sm:inline">{{ column.label }}</span>
                <span class="sm:hidden">{{ getShortLabel(column.label) }}</span>
                <Icon 
                  v-if="sortColumn === column.key"
                  :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
                  class="w-3 h-3 md:w-4 md:h-4"
                />
              </div>
            </th>
            <th v-if="showActions" class="text-left p-2 md:p-4 text-size-5 md:text-size-4 font-semibold text-foreground whitespace-nowrap">
              <span class="hidden sm:inline">Acciones</span>
              <span class="sm:hidden">Acc.</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(row, index) in sortedData" 
            :key="row.id || index"
            class="border-b border-border-subtle hover:bg-surface/50 transition-colors"
          >
            <td 
              v-for="column in columns" 
              :key="column.key"
              class="p-3 md:p-4 text-size-4 font-regular"
              :class="column.class"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
                {{ formatValue(row[column.key], column) }}
              </slot>
            </td>
            <td v-if="showActions" class="p-2 md:p-4">
              <slot name="actions" :row="row">
                <NuxtLink 
                  v-if="row.id"
                  :to="`/admin/rankings/players/${row.id}`"
                  class="btn-primary text-size-5 md:text-size-4 !py-1.5 md:!py-2 !px-2 md:!px-4"
                >
                  <span class="hidden sm:inline">Ver Detalles</span>
                  <span class="sm:hidden">Ver</span>
                </NuxtLink>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Pagination -->
      <div v-if="pagination && totalPages > 1" class="flex items-center justify-between mt-6 p-4">
        <div class="text-size-4 text-foreground-muted">
          Mostrando {{ (currentPage - 1) * pageSize + 1 }} - {{ Math.min(currentPage * pageSize, total) }} de {{ total }}
        </div>
        <div class="flex gap-2">
          <button
            @click="goToPage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="btn-secondary text-size-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="heroicons:chevron-left" class="w-4 h-4" />
          </button>
          <button
            v-for="page in visiblePages"
            :key="page"
            @click="goToPage(page)"
            :class="[
              'btn-secondary text-size-4',
              page === currentPage ? 'bg-accent-subtle/30 border-accent/30' : ''
            ]"
          >
            {{ page }}
          </button>
          <button
            @click="goToPage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="btn-secondary text-size-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="heroicons:chevron-right" class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Column {
  key: string
  label: string
  class?: string
  sortable?: boolean
  formatter?: (value: any) => string
}

interface Props {
  data: any[]
  columns: Column[]
  loading?: boolean
  showActions?: boolean
  pagination?: boolean
  pageSize?: number
  currentPage?: number
  total?: number
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showActions: true,
  pagination: false,
  pageSize: 50,
  currentPage: 1,
  total: 0
})

const emit = defineEmits<{
  'page-change': [page: number]
  'sort-change': [column: string, direction: 'asc' | 'desc']
}>()

const sortColumn = ref<string | null>(null)
const sortDirection = ref<'asc' | 'desc'>('asc')

const sortedData = computed(() => {
  if (!props.data || props.data.length === 0) return []
  
  let result = [...props.data]
  
  if (sortColumn.value) {
    const column = props.columns.find(c => c.key === sortColumn.value)
    if (column?.sortable !== false) {
      result.sort((a, b) => {
        const aVal = a[sortColumn.value!]
        const bVal = b[sortColumn.value!]
        
        if (aVal === bVal) return 0
        const comparison = aVal > bVal ? 1 : -1
        return sortDirection.value === 'asc' ? comparison : -comparison
      })
    }
  }
  
  if (props.pagination) {
    const start = (props.currentPage - 1) * props.pageSize
    const end = start + props.pageSize
    return result.slice(start, end)
  }
  
  return result
})

const totalPages = computed(() => {
  return Math.ceil(props.total / props.pageSize)
})

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, props.currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)
  
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  
  return pages
})

const sortBy = (column: string) => {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
  
  emit('sort-change', column, sortDirection.value)
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    emit('page-change', page)
  }
}

const formatValue = (value: any, column: Column) => {
  if (column.formatter) {
    return column.formatter(value)
  }
  return value ?? 'N/A'
}

const getShortLabel = (label: string) => {
  const shortLabels: Record<string, string> = {
    'Rank': '#',
    'Nombre': 'Nom.',
    'ELO': 'SR',
    'Tier': 'Tier',
    'Partidos': 'Pts',
    'Racha': 'Racha',
    'Ciudad': 'Ciudad',
    'Categoría': 'Cat.'
  }
  return shortLabels[label] || label.substring(0, 4)
}
</script>
