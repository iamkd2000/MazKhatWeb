// Firebase Configuration
// Replace these with your actual Firebase credentials from Firebase Console

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, initializeAuth, getReactNativePersistence, browserLocalPersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
    apiKey: "AIzaSyCZfkdHFqHeXJBPX6OEAHyI1AsP34_WxO4",
    authDomain: "group-expense-tracker-12e88.firebaseapp.com",
    projectId: "group-expense-tracker-12e88",
    storageBucket: "group-expense-tracker-12e88.appspot.com",
    messagingSenderId: "789268637283",
    appId: "1:789268637283:web:779b841cff4334a3d47a56"
};

console.log("Firebase: Initializing app...");
const app = initializeApp(firebaseConfig);

console.log("Firebase: Initializing Firestore...");
export const db = getFirestore(app);

console.log("Firebase: Initializing Auth for", Platform.OS);
let authInstance;
if (Platform.OS === 'web') {
    authInstance = getAuth(app); // Default web persistence is usually enough
} else {
    authInstance = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
    });
}

export const auth = authInstance;
