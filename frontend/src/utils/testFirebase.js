// Test Firebase configuration
import { auth } from '../firebase';

export const testFirebaseConnection = () => {
  console.log('Testing Firebase connection...');
  console.log('Firebase Auth instance:', auth);
  console.log('Firebase project ID:', auth.app.options.projectId);
  console.log('Firebase auth domain:', auth.app.options.authDomain);
  
  if (auth.app.options.projectId && auth.app.options.authDomain) {
    console.log('✅ Firebase configuration looks correct!');
    return true;
  } else {
    console.error('❌ Firebase configuration may be incorrect');
    return false;
  }
};

// Call this function to test
// testFirebaseConnection();