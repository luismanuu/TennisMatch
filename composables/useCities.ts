import type { City } from '~/types'

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(typeof err === 'string' ? err : 'Unknown error')
}

export const useCities = () => {
  const cities = ref<City[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  const fetchCities = async () => {
    if (cities.value.length > 0) {
      return cities.value // Return cached cities
    }
    
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<City[]>('/api/cities')
      cities.value = data
      return data
    } catch (err: unknown) {
      error.value = toError(err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  return {
    cities: readonly(cities),
    loading: readonly(loading),
    error: readonly(error),
    fetchCities
  }
}
