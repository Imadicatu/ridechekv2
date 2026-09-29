// ============================================================
// RideCheck Firebase Configuration & Initialization
// ============================================================
// วิธีใช้: 
// 1. สร้าง Firebase Project ที่ https://console.firebase.google.com
// 2. เปิด Firestore Database (region: asia-southeast1)
// 3. คัดลอก Firebase Config จากหน้า Project Settings > General > Your apps > Web app
// 4. วางทับ firebaseConfig ด้านล่าง
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyCcO4VryoEv76JcyW0I7kjs_BxvUHHyNxk",
    authDomain: "ridecheck-thailand.firebaseapp.com",
    projectId: "ridecheck-thailand",
    storageBucket: "ridecheck-thailand.firebasestorage.app",
    messagingSenderId: "777995887748",
    appId: "1:777995887748:web:9d8e64ae21d311aa724ed1",
    measurementId: "G-3GWY4J07P2"
};

// ===== Firebase Initialization =====
let firebaseApp = null;
let firestoreDB = null;
let FIREBASE_READY = false;

function initFirebase() {
    try {
        // Check if config has been set
        if (firebaseConfig.apiKey === "YOUR_API_KEY_HERE") {
            console.warn('[RideCheck Firebase] ⚠️ Firebase Config ยังไม่ได้ตั้งค่า — ระบบจะใช้ localStorage เป็น Fallback');
            FIREBASE_READY = false;
            return false;
        }

        firebaseApp = firebase.initializeApp(firebaseConfig);
        firestoreDB = firebase.firestore();

        // Enable offline persistence (sync across tabs + work offline)
        firestoreDB.enablePersistence({ synchronizeTabs: true }).catch(err => {
            if (err.code === 'failed-precondition') {
                console.warn('[RideCheck Firebase] Multiple tabs open — persistence limited to one tab');
            } else if (err.code === 'unimplemented') {
                console.warn('[RideCheck Firebase] Browser does not support persistence');
            }
        });

        FIREBASE_READY = true;
        console.log('[RideCheck Firebase] ✅ เชื่อมต่อ Firestore สำเร็จ! Project:', firebaseConfig.projectId);
        return true;
    } catch (err) {
        console.error('[RideCheck Firebase] ❌ เชื่อมต่อล้มเหลว:', err);
        FIREBASE_READY = false;
        return false;
    }
}

// Auto-initialize on load
if (typeof firebase !== 'undefined') {
    initFirebase();
} else {
    console.warn('[RideCheck Firebase] Firebase SDK ยังไม่ถูกโหลด');
}
