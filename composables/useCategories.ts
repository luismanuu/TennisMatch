import type { Category } from '~/types'

export const useCategories = () => {
  const categories = ref<Category[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  const fetchCategories = async () => {
    if (categories.value.length > 0) {
      return categories.value // Return cached categories
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<Category[]>('/api/categories')
      categories.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  return {
    categories: readonly(categories),
    loading: readonly(loading),
    error: readonly(error),
    fetchCategories
  }
}

