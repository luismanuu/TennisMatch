/**
 * Composable for WhatsApp functionality
 * Formats phone numbers and generates WhatsApp links
 */

export const useWhatsApp = () => {
  /**
   * Cleans and formats a phone number for WhatsApp
   * Removes spaces, dashes, parentheses, and other non-numeric characters
   * Ensures the number starts with country code
   * 
   * @param phoneNumber - The phone number to format
   * @param countryCode - The country code (default: '593' for Ecuador)
   * @returns Formatted phone number ready for WhatsApp link
   */
  const formatPhoneForWhatsApp = (phoneNumber: string, countryCode: string = '593'): string => {
    if (!phoneNumber) return ''
    
    // Remove all non-numeric characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '')
    
    // Remove leading + if present
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1)
    }
    
    // If the number already starts with the country code, return as is
    if (cleaned.startsWith(countryCode)) {
      return cleaned
    }
    
    // If the number starts with 0, remove it (common in Ecuador: 0999999999)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1)
    }
    
    // Add country code if not present
    if (!cleaned.startsWith(countryCode)) {
      cleaned = countryCode + cleaned
    }
    
    return cleaned
  }

  /**
   * Generates a WhatsApp link for a phone number
   * 
   * @param phoneNumber - The phone number to create a link for
   * @param message - Optional pre-filled message
   * @param countryCode - The country code (default: '593' for Ecuador)
   * @returns WhatsApp URL
   */
  const getWhatsAppLink = (phoneNumber: string, message: string = '', countryCode: string = '593'): string => {
    if (!phoneNumber) return ''
    
    const formattedNumber = formatPhoneForWhatsApp(phoneNumber, countryCode)
    
    if (!formattedNumber) return ''
    
    // WhatsApp Web/App URL format: https://wa.me/[country code][phone number]
    let url = `https://wa.me/${formattedNumber}`
    
    // Add message if provided
    if (message) {
      const encodedMessage = encodeURIComponent(message)
      url += `?text=${encodedMessage}`
    }
    
    return url
  }

  /**
   * Opens WhatsApp in a new window/tab
   * 
   * @param phoneNumber - The phone number to contact
   * @param message - Optional pre-filled message
   */
  const openWhatsApp = (phoneNumber: string, message: string = '') => {
    const link = getWhatsAppLink(phoneNumber, message)
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer')
    }
  }

  return {
    formatPhoneForWhatsApp,
    getWhatsAppLink,
    openWhatsApp
  }
}
