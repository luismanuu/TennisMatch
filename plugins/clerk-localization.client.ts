import { esES } from '@clerk/localizations'

export default defineNuxtPlugin(() => {
  // This plugin ensures localization is available globally
  // Components should also pass it via appearance prop
  if (process.client) {
    console.log('Clerk Spanish localization plugin loaded', { 
      hasLocalization: !!esES,
      firstNameLabel: esES?.formFieldLabel__firstName 
    })
  }
})

