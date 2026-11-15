
// ══════════════════════════════════════════════════════
//  FIREBASE CONFIG — Yibex Store
//  SIN Storage — imágenes guardadas en Firestore
// ══════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAkn0HJjTP1cgbi4MuE9uzm8JGH2blxjnA",
  authDomain: "yibexstore-3f2ae.firebaseapp.com",
  projectId: "yibexstore-3f2ae",
  storageBucket: "yibexstore-3f2ae.firebasestorage.app",
  messagingSenderId: "600444423434",
  appId: "1:600444423434:web:e7544d691de4b27e747ef3"
};

const fbApp = initializeApp(firebaseConfig);
const db    = getFirestore(fbApp);
const auth  = getAuth(fbApp);

// ── Expose Firebase utilities globally ──
window._fb = { db, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, onSnapshot, addDoc, auth, signInWithEmailAndPassword, signOut };

// ══════════════════════════════════════════════════════
//  IMAGEN: comprimir base64 a ~80KB antes de guardar en Firestore
//  Firestore tiene límite de 1MB por documento — con esta
//  compresión caben perfectamente imágenes de productos.
// ══════════════════════════════════════════════════════
function compressForFirestore(dataUrl, maxW, maxH, quality){
  return new Promise(resolve=>{
    const img = new Image();
    img.onload = ()=>{
      const canvas = document.createElement('canvas');
      let w = img.naturalWidth, h = img.naturalHeight;
      const ratio = Math.min(maxW/w, maxH/h, 1);
      w = Math.round(w*ratio); h = Math.round(h*ratio);
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = ()=>resolve(dataUrl);
    img.src = dataUrl;
  });
}
// Para productos: máx 600×800px (3:4), calidad 0.88 → ~120-200KB
window._compressProd = (dataUrl)=>compressForFirestore(dataUrl, 600, 800, 0.88);
// Para sliders: máx 1920×1080px (16:9), calidad 0.88 → ~300-700KB
window._compressSlide = (dataUrl)=>compressForFirestore(dataUrl, 1920, 1080, 0.88);
// Para categorías: máx 480×640px (3:4), calidad 0.85
window._compressCat = (dataUrl)=>compressForFirestore(dataUrl, 480, 640, 0.85);

// No se usa Storage — estas funciones son no-op para compatibilidad
window._fbUploadImg = async (path, dataUrl)=>dataUrl;
window._fbDeleteImg = async ()=>{};

// ══════════════════════════════════════════════════════
//  REAL-TIME LISTENERS
// ══════════════════════════════════════════════════════
async function startListeners(){
  // 1. PRODUCTOS — tiempo real
  onSnapshot(collection(db,'products'), snap=>{
    prods = [];
    snap.forEach(d=>{ prods.push({...d.data(), _fbId: d.id}); });
    prods.sort((a,b)=>new Date(b.dateAdded)-new Date(a.dateAdded));
    renderNuevo();
    renderTienda();
    renderAPL();
  });

  // 2. CATEGORÍAS — tiempo real
  onSnapshot(doc(db,'config','cats'), snap=>{
    if(snap.exists()){
      const data = snap.data();
      if(data && data.list) cats = data.list;
    }
    renderCatHighlights();
    renderTienda();
    renderCE();
    popSels();
  });

  // 3. CONFIGURACIÓN — tiempo real
  onSnapshot(doc(db,'config','site'), snap=>{
    if(snap.exists()){
      site = snap.data()||{};
      applyConfig();
    }
  });

  // 4. RESEÑAS — tiempo real
  onSnapshot(collection(db,'reviews'), snap=>{
    reviews = [];
    snap.forEach(d=>{ reviews.push({...d.data(), id: d.id}); });
    reviews.sort((a,b)=>new Date(b.date)-new Date(a.date));
    renderResenas();
    renderAdmRes();
  });
}

function applyConfig(){
  try{
    const wa = site.wa||'573507243351';
    const waFloat = document.getElementById('wa-float');
    if(waFloat) waFloat.href = `https://wa.me/${wa}`;
    for(let i=0;i<3;i++){ if(site['slide'+i]) applySlide(i, site['slide'+i], site['slidePos'+i]||'center center'); }
    if(site.h1){ const el=document.getElementById('hero-h1'); if(el) el.innerHTML=site.h1.split('\n').join('<br>'); }
    if(site.sub){ const el=document.getElementById('hero-sub'); if(el) el.innerHTML=site.sub.split('\n').join('<br>'); }
    if(site.ig){ let el=document.getElementById('social-ig'); if(el) el.href=site.ig; el=document.getElementById('slide-ig'); if(el) el.href=site.ig; }
    if(site.fb){ let el=document.getElementById('social-fb'); if(el) el.href=site.fb; el=document.getElementById('slide-fb'); if(el) el.href=site.fb; }
    if(site.tk){ let el=document.getElementById('social-tk'); if(el) el.href=site.tk; el=document.getElementById('slide-tk'); if(el) el.href=site.tk; }
    if(site.wa){ const el=document.getElementById('slide-wa'); if(el) el.href=`https://wa.me/${site.wa}`; }
  }catch(e){ console.warn('applyConfig:',e); }
}
window._applyConfig = applyConfig;

// ── Inicializar: cargar datos y arrancar listeners ──
async function fbInit(){
  try{
    toast('⏳ Cargando tienda...');

    // Categorías
    const catsSnap = await getDoc(doc(db,'config','cats'));
    if(catsSnap.exists() && catsSnap.data().list){ cats = catsSnap.data().list; }
    

    // Config del sitio
    const siteSnap = await getDoc(doc(db,'config','site'));
    if(siteSnap.exists()){ site = siteSnap.data()||{}; }
    applyConfig();

    // Productos
    const prodsSnap = await getDocs(collection(db,'products'));
    prods = [];
    prodsSnap.forEach(d=>{ prods.push({...d.data(), _fbId: d.id}); });
    prods.sort((a,b)=>new Date(b.dateAdded)-new Date(a.dateAdded));

    // Reseñas
    const revSnap = await getDocs(collection(db,'reviews'));
    reviews=[]; revSnap.forEach(d=>reviews.push({...d.data(), id:d.id}));
    reviews.sort((a,b)=>new Date(b.date)-new Date(a.date));

    // Renderizar todo
    renderCatHighlights();
    renderNuevo();
    renderTienda();
    popSels();
    updC();
    renderResenas();
    renderAPL();
    initResStars();

    // Arrancar escuchas en tiempo real
    startListeners();
    toast('✔ Tienda cargada');
  }catch(e){
    console.error('fbInit error:', e);
    toast('⚠ Error de conexión. Verifica las reglas de Firebase y recarga.');
  }
}
window._fbInit = fbInit;

document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(fbInit, 300); });
