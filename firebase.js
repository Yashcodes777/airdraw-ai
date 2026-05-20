/**
 * firebase.js
 * Firebase initialization, Authentication, and Firestore integration.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB71Pz-wU5XFxmEQybTgKWG0-nZI-eoy04",
  authDomain: "airdraw-saas.firebaseapp.com",
  projectId: "airdraw-saas",
  storageBucket: "airdraw-saas.firebasestorage.app",
  messagingSenderId: "969764487218",
  appId: "1:969764487218:web:106b54aca94b45e39d3c2b",
  measurementId: "G-1KL2Y3ZQWX"
};

let app, auth, db;
let currentUser = null;

// Only initialize if config is provided (avoids crash if user hasn't set it up yet)
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} else {
    console.warn("Firebase is not configured. Auth and Save/Load will be disabled.");
}

export function initFirebase(drawingEngine) {
    const loginBtn = document.getElementById('btn-login');
    const logoutBtn = document.getElementById('btn-logout');
    const userInfo = document.getElementById('user-info');
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-name');
    
    const saveBtn = document.getElementById('btn-save');
    const loadBtn = document.getElementById('btn-load');
    const authDependentGroups = document.querySelectorAll('.auth-dependent');
    
    if (!app) {
        loginBtn.addEventListener('click', () => alert("Please configure Firebase in firebase.js first."));
        return;
    }

    // Auth Listeners
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            loginBtn.classList.add('hidden');
            userInfo.classList.remove('hidden');
            userAvatar.src = user.photoURL;
            userName.textContent = user.displayName;
            
            authDependentGroups.forEach(el => el.classList.remove('hidden'));
        } else {
            currentUser = null;
            loginBtn.classList.remove('hidden');
            userInfo.classList.add('hidden');
            
            authDependentGroups.forEach(el => el.classList.add('hidden'));
        }
    });

    // Login
    loginBtn.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed", error);
            alert("Login failed: " + error.message);
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
    });

    // Save Drawing
    saveBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        
        saveBtn.textContent = 'Saving...';
        const dataUrl = drawingEngine.getImageData();
        
        try {
            const userDrawingsRef = collection(db, `users/${currentUser.uid}/drawings`);
            await addDoc(userDrawingsRef, {
                imageUrl: dataUrl,
                createdAt: serverTimestamp()
            });
            alert('Drawing saved successfully!');
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("Failed to save drawing. Payload might be too large for Firestore free tier. Consider Firebase Storage.");
        } finally {
            saveBtn.textContent = '💾 Save';
        }
    });

    // Load Drawings Modal Logic
    const galleryModal = document.getElementById('gallery-modal');
    const galleryGrid = document.getElementById('gallery-grid');
    const galleryLoader = document.getElementById('gallery-loader');
    const galleryEmpty = document.getElementById('gallery-empty');
    
    loadBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        
        galleryModal.classList.remove('hidden');
        galleryGrid.innerHTML = '';
        galleryLoader.classList.remove('hidden');
        galleryEmpty.classList.add('hidden');
        
        try {
            const userDrawingsRef = collection(db, `users/${currentUser.uid}/drawings`);
            const q = query(userDrawingsRef, orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            
            galleryLoader.classList.add('hidden');
            
            if (querySnapshot.empty) {
                galleryEmpty.classList.remove('hidden');
                return;
            }
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                
                const item = document.createElement('div');
                item.className = 'gallery-item';
                
                const img = document.createElement('img');
                img.src = data.imageUrl;
                
                const dateText = document.createElement('p');
                const date = data.createdAt ? data.createdAt.toDate().toLocaleString() : 'Just now';
                dateText.textContent = date;
                
                item.appendChild(img);
                item.appendChild(dateText);
                
                item.addEventListener('click', () => {
                    drawingEngine.loadImageData(data.imageUrl);
                    galleryModal.classList.add('hidden');
                });
                
                galleryGrid.appendChild(item);
            });
            
        } catch (error) {
            console.error("Error loading drawings: ", error);
            galleryLoader.classList.add('hidden');
            galleryEmpty.classList.remove('hidden');
            galleryEmpty.textContent = 'Error loading drawings. ' + error.message;
        }
    });
}
