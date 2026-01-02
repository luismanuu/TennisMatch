import type { MatchMessage, CreateMatchMessagePayload } from '~/types'

export const useMatchChat = () => {
  const messages = ref<MatchMessage[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  const fetchMessages = async (matchId: string, clerkId: string, since?: string) => {
    loading.value = true
    error.value = null
    
    try {
      const query: any = { clerk_id: clerkId }
      if (since) {
        query.since = since
      }
      
      const data = await $fetch<MatchMessage[]>(`/api/matches/${matchId}/messages`, { query })
      
      // If we're fetching incremental updates, append to existing messages (avoid duplicates)
      if (since && data.length > 0) {
        const existingIds = new Set(messages.value.map(m => m.id))
        const newMessages = data.filter(m => !existingIds.has(m.id))
        if (newMessages.length > 0) {
          messages.value = [...messages.value, ...newMessages]
        }
      } else {
        // Full refresh - replace all messages
        messages.value = data
      }
      
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
      // Reload all messages to ensure both players see the latest messages
      await fetchMessages(matchId, clerkId)
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

