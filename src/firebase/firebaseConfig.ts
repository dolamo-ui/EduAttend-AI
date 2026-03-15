// Import the functions you need from the SDKs you need
import { initializeApp }        from 'firebase/app';
import { getAuth }              from 'firebase/auth';
import { getFirestore }         from 'firebase/firestore';
import { getStorage }           from 'firebase/storage';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCyPKLDfI62zU7P2PhcC5EVoBsSDEZgGxs",
  authDomain: "smartattendance-9fa4f.firebaseapp.com",
  projectId: "smartattendance-9fa4f",
  storageBucket: "smartattendance-9fa4f.firebasestorage.app",
  messagingSenderId: "354742898874",
  appId: "1:354742898874:web:43bdf817aed736c0277283",
  measurementId: "G-N5J2QYMQ9C"
};

// Initialize Firebase
const app     = initializeApp(firebaseConfig);
 
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
export default app;