// Clear authentication state only if explicitly requested
(function clearAuthState() {
    // Only clear if there's a specific flag or if we're on the login page for a fresh start
    const urlParams = new URLSearchParams(window.location.search);
    const shouldClear = urlParams.has('clear_auth') || 
                       localStorage.getItem('force_clear_auth') === 'true';
    
    if (shouldClear) {
        // Clear localStorage
        localStorage.removeItem('firebase_token');
        localStorage.removeItem('access_token');
        localStorage.removeItem('last_login_time');
        localStorage.removeItem('cached_user_data');
        localStorage.removeItem('user_cache_time');
        localStorage.removeItem('force_clear_auth');
        
        // Clear sessionStorage
        sessionStorage.removeItem('firebase_token');
        sessionStorage.removeItem('access_token');
        
        console.log('Authentication state cleared');
    } else {
        console.log('Authentication state preserved');
    }
})();