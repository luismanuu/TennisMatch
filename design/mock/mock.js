// Local prototype preferences and examples only; never calls product APIs.
let appearance = 'dark'
try { appearance = localStorage.getItem('te-mock-appearance') === 'light' ? 'light' : 'dark' } catch {}
document.documentElement.dataset.appearance = appearance
document.querySelectorAll('input[name="appearance"]').forEach(input => {
  input.checked = input.value === appearance
  input.addEventListener('change', () => {
    document.documentElement.dataset.appearance = input.value
    try { localStorage.setItem('te-mock-appearance', input.value) } catch {}
  })
})
document.querySelector('#home-state')?.addEventListener('change', event => {
  const pending = event.target.value === 'pending'
  document.querySelector('[data-pending]').hidden = !pending
  document.querySelector('[data-clear]').hidden = pending
  // The clear-state hero already contains the scheduling action.
  document.querySelector('.quick-actions .button').hidden = !pending
})
document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('#demo-message').textContent = button.dataset.demo
  document.querySelector('#demo-dialog').showModal()
}))
