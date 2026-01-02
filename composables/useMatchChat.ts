import type { MatchMessage, CreateMatchMessagePayload } from '~/types'

export const useMatchChat = () => {
  const messages = ref<MatchMessage[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  const fetchMessages = async (matchId: string, clerkId: string) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<MatchMessage[]>(`/api/matches/${matchId}/messages`, {
        query: { clerk_id: clerkId }
      })
      messages.value = data
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const sendMessage = async (matchId: string, clerkId: string, payload: CreateMatchMessagePayload) => {
    loading.value = true
    error.value = null
    
    try {
      const data = await $fetch<MatchMessage>(`/api/matches/${matchId}/messages`, {
        method: 'POST',
        body: {
          clerk_id: clerkId,
          ...payload
        }
      })
      // Add the new message to the list
      messages.value = [...messages.value, data]
      return data
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  const clearMessages = () => {
    messages.value = []
  }
  
  return {
    messages: readonly(messages),
    loading: readonly(loading),
    error: readonly(error),
    fetchMessages,
    sendMessage,
    clearMessages
  }
}

