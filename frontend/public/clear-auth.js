// Clear all authentication state
(function clearAuthState() {
    // Clear localStorage
    localStorage.removeItem('firebase_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('last_login_time');
    
    // Clear sessionStorage
    sessionStorage.removeItem('firebase_token');
    sessionStorage.removeItem('access_token');
    
    console.log('Authentication state cleared');
})();