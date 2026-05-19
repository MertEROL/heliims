import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  projectId: "gso-takip-e106d",
  appId: "1:339280657022:web:23f86bbc2216cddfcef62f",
  storageBucket: "gso-takip-e106d.firebasestorage.app",
  apiKey: "AIzaSyBk58fE5kngjq3oS7ApVb-Bfrb0A5IQRUI",
  authDomain: "gso-takip-e106d.firebaseapp.com",
  messagingSenderId: "339280657022",
  measurementId: "G-KT6F44L2GM"
};

// Initialize Primary Firebase Instance
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Sicil translation helper
// Translates "123456" into "123456@gso.kurum"
const translateSicilToEmail = (sicil) => {
  const cleanSicil = sicil.trim();
  return `${cleanSicil}@gso.kurum`;
};

/**
 * Logs in a user using their Sicil number and password.
 * @param {string} sicil - Employee registration number.
 * @param {string} password - User password.
 * @returns {Promise<UserCredential>}
 */
export async function loginWithSicil(sicil, password) {
  const email = translateSicilToEmail(sicil);
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Logs out the currently signed-in user.
 * @returns {Promise<void>}
 */
export async function logoutUser() {
  return signOut(auth);
}

/**
 * Registers a new user. 
 * This uses a secondary Firebase App instance to avoid logging out the current admin user.
 * @param {string} sicil - New user's employee registration number.
 * @param {string} name - New user's full name.
 * @param {string} role - New user's role ('admin' | 'user').
 * @param {string} password - New user's password.
 * @returns {Promise<void>}
 */
export async function registerNewUser(sicil, name, role, password) {
  const email = translateSicilToEmail(sicil);
  const secondaryAppName = `SecondaryApp_${Date.now()}`;
  
  // 1. Create user in Firebase Authentication using secondary App instance
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;
    
    // 2. Write user details to Cloud Firestore database using primary db connection
    await setDoc(doc(db, "users", uid), {
      sicil: sicil.trim(),
      name: name.trim(),
      role: role,
      createdAt: new Date().toISOString()
    });
  } finally {
    // 3. Clean up the secondary app to prevent memory leaks
    await deleteApp(secondaryApp);
  }
}

/**
 * Listens for authentication state changes and retrieves current user details from Firestore.
 * @param {function} callback - Callback function that receives ({ user, userDetails } or null).
 */
export function onAuthStateChangedListener(callback) {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          callback({
            uid: user.uid,
            email: user.email,
            ...userDoc.data()
          });
        } else {
          // If auth user exists but Firestore profile is missing, create a fallback details object
          const sicilFromEmail = user.email.split("@")[0];
          callback({
            uid: user.uid,
            email: user.email,
            sicil: sicilFromEmail,
            name: `Kullanıcı (${sicilFromEmail})`,
            role: "user" // Default fallback role
          });
        }
      } catch (error) {
        console.error("Firestore user profile fetch error:", error);
        callback(null);
      }
    } else {
      callback(null);
    }
  });
}

// Export references to primary Firebase instances
export { auth, db };
