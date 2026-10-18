// Haptic feedback utility for native mobile touch response
export function triggerHaptic(type = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10)
        break
      case 'medium':
        navigator.vibrate(22)
        break
      case 'heavy':
        navigator.vibrate(40)
        break
      case 'success':
        navigator.vibrate([15, 35, 20])
        break
      case 'selection':
        navigator.vibrate(8)
        break
      default:
        navigator.vibrate(12)
    }
  } catch (e) {
    // Silently ignore in browsers without vibration permissions
  }
}
