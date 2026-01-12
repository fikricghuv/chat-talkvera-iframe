/**
 * Generate UUID v4 dengan fallback untuk browser yang tidak support crypto.randomUUID
 */
function generateUUID(): string {
  // Try native crypto.randomUUID first (fastest & paling secure)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      console.warn('crypto.randomUUID failed, using fallback');
    }
  }

  // Fallback 1: crypto.getRandomValues (support lebih luas)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    } catch (e) {
      console.warn('crypto.getRandomValues failed, using Math.random fallback');
    }
  }

  // Fallback 2: Math.random (less secure, tapi always available)
  console.warn('Using Math.random for UUID generation (not cryptographically secure)');
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSenderId(): string {
  const SENDER_ID_KEY = 'sender_id';

  try {
    let senderId = localStorage.getItem(SENDER_ID_KEY);

    if (!senderId) {
      // Generate new UUID dengan fallback
      senderId = generateUUID();
      localStorage.setItem(SENDER_ID_KEY, senderId);
    }

    return senderId;
  } catch (error) {
    // Fallback jika localStorage disabled/blocked
    console.error('localStorage error, using session-only ID:', error);
    
    // Generate temporary ID untuk session ini
    const tempId = generateUUID();
    console.warn('⚠️ Using temporary sender ID (not persisted):', tempId);
    return tempId;
  }
}