// Debug localStorage modifications
if (typeof window !== 'undefined') {
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalClear = localStorage.clear;

  localStorage.setItem = function(key: string, value: string) {
    if (key === 'auth_token') {
      console.log('🔐 localStorage.setItem called for auth_token:');
      console.log('  - Token length:', value.length, 'characters');
      console.log('  - Token preview:', value.substring(0, 50) + '...');
      console.trace('  - Stack trace:');
    }
    return originalSetItem.call(this, key, value);
  };

  localStorage.removeItem = function(key: string) {
    if (key === 'auth_token') {
      console.log('🗑️ localStorage.removeItem called for auth_token');
      console.log('  - Previous value existed:', !!localStorage.getItem(key));
      console.trace('  - Stack trace:');
    }
    return originalRemoveItem.call(this, key);
  };

  localStorage.clear = function() {
    const authTokenExists = !!localStorage.getItem('auth_token');
    console.log('🧹 localStorage.clear called - all data will be removed');
    console.log('  - Auth token will be lost:', authTokenExists);
    console.trace('  - Stack trace:');
    return originalClear.call(this);
  };

  // Also monitor direct property access
  const originalGetItem = localStorage.getItem;
  localStorage.getItem = function(key: string) {
    const value = originalGetItem.call(this, key);
    if (key === 'auth_token' && Math.random() < 0.1) { // Only log 10% of getItem calls to avoid spam
      console.log('🔍 localStorage.getItem called for auth_token:', value ? 'found' : 'not found');
    }
    return value;
  };

  console.log('🔍 LocalStorage debugging enabled - monitoring auth_token operations');
}

export {};
