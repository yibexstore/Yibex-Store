
// ── DATA ── (Firebase-powered, no localStorage for admin data)
const ADMIN_EMAIL='yibiermunoz2@gmail.com';
const OW=7*24*60*60*1000;
const dAgo=n=>new Date(Date.now()-n*864e5).toISOString();

const DC=[];

// Global state — populated by Firebase real-time listeners
let cats = DC.slice();
let prods = [];
let cart = JSON.parse(localStorage.getItem('rds4_ct')||'[]'); // cart stays local (per user)
let site = {};

// ── FIREBASE SAVE FUNCTIONS ──

// Save categories to Firestore
const svC = async ()=>{
  try{
    const {db, doc, setDoc} = window._fb;
    await setDoc(doc(db,'config','cats'), {list: cats});
  }catch(e){
    toast('⚠ Error guardando categorías: '+e.message);
    console.warn('svC Firebase error:',e);
  }
};

// Save a single product (add or update) — images go to Storage
const svP = async ()=>{
  // No-op: individual product saves handle their own Firestore writes
};

// Cart stays local — only for current user's session
const svCt = ()=>localStorage.setItem('rds4_ct',JSON.stringify(cart));

// Save site config to Firestore — includes compressed base64 slides
const svS = async ()=>{
  try{
    const {db, doc, setDoc} = window._fb;
    await setDoc(doc(db,'config','site'), site);
  }catch(e){
    toast('⚠ Error guardando configuración: '+e.message);
    console.warn('svS error:',e);
  }
};

// Apply saved data — handled by Firebase module's applyConfig()
// Cart total update on load
(()=>{ try{ updC(); }catch(e){} })();

// ── HERO SLIDER ──
let curSlide=0,slideTimer=null;
function goSlide(i){
  document.querySelectorAll('.hero-slide').forEach((s,j)=>s.classList.toggle('on',j===i));
  document.querySelectorAll('.hdot').forEach((d,j)=>d.classList.toggle('on',j===i));
  curSlide=i;resetTimer();
}
function nextSlide(){goSlide((curSlide+1)%3);}
function resetTimer(){clearInterval(slideTimer);slideTimer=setInterval(nextSlide,3500);}
resetTimer();

// Navbar scroll
window.addEventListener('scroll',()=>document.getElementById('nav').classList.toggle('scrolled',window.scrollY>60));

// ── CATEGORIES ──
/* Category clothing SVG icons */
function getCatSVG(label){
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 12L84 30L84 70L50 88L16 70L16 30Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/><path d="M16 30L50 48L84 30M50 48L50 88" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`;
}

function renderCatHighlights(){
  const row=document.getElementById('col-cats-row');
  if(!row)return;
  const _sec=document.getElementById('coleccion'); if(_sec) _sec.style.display=(cats&&cats.length)?'':'none';
  const toShow=cats;
  row.innerHTML=toShow.map(c=>`
    <div class="col-cat-item" onclick="scrollToTiendaCat('${c.id}')">
      <div class="col-cat-icon" style="color:var(--accent)">
        ${c.img
          ? `<img src="${c.img}" alt="${c.label}" style="width:100%;height:100%;object-fit:cover;object-position:center center;transform:scale(${c.imgZoom||1}) translate(${(c.imgDx||0)/(c.imgZoom||1)}px,${(c.imgDy||0)/(c.imgZoom||1)}px);transform-origin:center center;pointer-events:none">`
          : getCatSVG(c.label)
        }
      </div>
      <span class="col-cat-name">${c.label}</span>
    </div>`).join('');
  hsInit('hs-cats');setTimeout(()=>hsUpdate('hs-cats'),60);
}
function scrollToTiendaCat(id){
  setTiendaTab(id);
  document.getElementById('tienda').scrollIntoView({behavior:'smooth'});
}

const NEW_TTL = 7*24*60*60*1000; // 3 días para etiqueta "Nuevo"

// ══════════════════════════════════════════════
//  CATÁLOGO PAGINADO (24 por página + "Ver más")
// ══════════════════════════════════════════════
const SITE_URL='https://yibexstore.github.io/Yibex-Store/';
const PAGE_SIZE=16;
const pgs={};
let promoIds=[];
let searchQ='',searchLoading=false;
let admQ='',admIds=[];
const WA_SVG=`<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
const CART_SVG=`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`;

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function pgGet(k){return pgs[k]||(pgs[k]={last:null,done:false,loading:false,ids:[],pages:[],cur:1,total:null,counting:false});}
function tabKey(){return acT==='todo'?'__all':acT;}
function ingestProd(d){
  const p={...d.data(),_fbId:d.id};
  const i=prods.findIndex(x=>x._fbId===d.id);
  if(i>=0)prods[i]=p;else prods.push(p);
  return p;
}
function findProd(id){return prods.find(x=>x._fbId===id||x._fbId===String(id)||x.id===id);}
function normTxt(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();}
function buildKw(name){
  const set=new Set();
  normTxt(name).split(' ').forEach(w=>{
    if(!w)return;
    for(let i=Math.min(3,w.length);i<=Math.min(w.length,20);i++)set.add(w.slice(0,i));
  });
  return [...set].slice(0,150);
}
function catLabel(id){const c=cats.find(x=>x.id===id);return c?c.label:'General';}
function prodLink(id){return SITE_URL+'?p='+encodeURIComponent(id);}
function isPromoActive(p){
  if(!p||!p.promo||!(p.promoOld>p.price))return false;
  if(p.promoUntil){const end=new Date(p.promoUntil+'T23:59:59').getTime();if(!isNaN(end)&&Date.now()>end)return false;}
  return true;
}
function pctOff(p){return Math.round((1-p.price/p.promoOld)*100);}
function newDocId(){
  // IDs "al revés" por fecha: el orden natural de Firestore deja lo más nuevo primero
  return String(9999999999999-Date.now()).padStart(13,'0')+'-'+Math.random().toString(36).slice(2,6);
}

async function loadPage(key){
  const st=pgGet(key);
  if(st.loading||st.done)return false;
  st.loading=true;let got=0;
  try{
    const {db,collection,getDocs,query,where,limit,startAfter}=window._fb;
    const cons=[];
    if(key!=='__all')cons.push(where('category','==',key));
    if(st.last)cons.push(startAfter(st.last));
    cons.push(limit(PAGE_SIZE));
    const snap=await getDocs(query(collection(db,'products'),...cons));
    const ids=[];
    snap.forEach(d=>{const p=ingestProd(d);ids.push(p._fbId);if(!st.ids.includes(p._fbId))st.ids.push(p._fbId);});
    got=ids.length;
    if(got){st.pages.push(ids);st.last=snap.docs[snap.docs.length-1];}
    if(got<PAGE_SIZE)st.done=true;
  }catch(e){
    console.warn('loadPage',e);
    toast('⚠ No se pudieron cargar los productos');
    st.done=true;
  }
  st.loading=false;
  return got>0;
}
async function loadCount(key){
  const st=pgGet(key);
  if(st.total!==null||st.counting)return;
  st.counting=true;
  try{
    const {db,collection,query,where,getCountFromServer}=window._fb;
    const q=key==='__all'?query(collection(db,'products')):query(collection(db,'products'),where('category','==',key));
    const s=await getCountFromServer(q);
    st.total=s.data().count;
  }catch(e){console.warn('loadCount',e);}
  st.counting=false;
}
function totalPages(st){return st.total!==null?Math.max(1,Math.ceil(st.total/PAGE_SIZE)):null;}
async function goPage(n){
  const key=tabKey();const st=pgGet(key);
  if(n<1||st.loading)return;
  const tp=totalPages(st);
  if(tp&&n>tp)return;
  if(n>st.pages.length+1)return;
  if(n===st.pages.length+1){
    if(st.done)return;
    const pr=loadPage(key);renderTienda();
    if(!(await pr)){renderTienda();return;}
  }
  st.cur=n;renderTienda();
  document.getElementById('tienda').scrollIntoView({behavior:'smooth'});
}
async function loadPromos(){
  try{
    const {db,collection,getDocs,query,where,limit}=window._fb;
    const snap=await getDocs(query(collection(db,'products'),where('promo','==',true),limit(16)));
    promoIds=[];
    snap.forEach(d=>{const p=ingestProd(d);promoIds.push(p._fbId);});
  }catch(e){console.warn('loadPromos',e);}
}
async function catalogInit(){await Promise.all([loadPage('__all'),loadCount('__all'),loadPromos(),loadFeatured()]);}
async function refreshCatalog(){
  Object.keys(pgs).forEach(k=>delete pgs[k]);
  prods=[];promoIds=[];admQ='';admIds=[];
  const si=document.getElementById('adm-srch');if(si)si.value='';
  const k=tabKey();
  await Promise.all([loadPage('__all'),loadCount('__all'),k!=='__all'?loadPage(k):null,k!=='__all'?loadCount(k):null,loadPromos(),loadFeatured()]);
  renderNuevo();renderVendido();renderTienda();renderAPL();
  if(typeof cvRefresh==="function")cvRefresh();
}
async function openLinkedProduct(){
  try{
    const pid=new URLSearchParams(location.search).get('p');
    if(!pid)return;
    let p=findProd(pid);
    if(!p){const {db,doc,getDoc}=window._fb;const s=await getDoc(doc(db,'products',pid));if(s.exists())p=ingestProd(s);}
    if(p)openM(p._fbId);else toast('⚠ Ese producto ya no está disponible');
  }catch(e){console.warn('openLinkedProduct',e);}
}
async function loadMore(){
  const k=tabKey();const st=pgGet(k);
  if(st.loading||st.done)return;
  const pr=loadPage(k);renderTienda();await pr;renderTienda();
}

// ── VISTAS (inicio / sobre nosotros) + MENÚ ──
function toggleMenu(on){document.getElementById('sm').classList.toggle('on',on);document.getElementById('sm-ov').classList.toggle('on',on);}
function showView(v,fromHistory){
  const home=document.getElementById('view-home'),nos=document.getElementById('view-nosotros');
  if(!home||!nos)return;
  home.style.display=v==='nosotros'?'none':'';
  nos.style.display=v==='nosotros'?'':'none';
  if(!fromHistory){
    try{
      if(v==='nosotros')history.pushState(null,'','#sobre-nosotros');
      else if(location.hash==='#sobre-nosotros')history.pushState(null,'',location.pathname+location.search);
    }catch(e){}
  }
  if(v==='nosotros')window.scrollTo(0,0);
}
function goTo(where){
  toggleMenu(false);
  if(where==='nosotros'){showView('nosotros');return;}
  showView('home');
  setTimeout(()=>{
    const id={catalogo:'tienda',categorias:'coleccion'}[where];
    if(!id){window.scrollTo({top:0,behavior:'smooth'});return;}
    let el=document.getElementById(id);
    if(!el||el.style.display==='none')el=document.getElementById('tienda');
    el.scrollIntoView({behavior:'smooth'});
  },50);
}
function syncViewFromUrl(){
  showView(location.hash==='#sobre-nosotros'?'nosotros':'home',true);
  const id=location.hash.slice(1);
  if(id&&id!=='sobre-nosotros')setTimeout(()=>{const el=document.getElementById(id);if(el)el.scrollIntoView();},30);
}
window.addEventListener('popstate',syncViewFromUrl);
window.addEventListener('hashchange',syncViewFromUrl);
if(location.hash==='#sobre-nosotros')showView('nosotros',true);

// ── CARRUSELES HORIZONTALES (flechas con rebote) ──
function hsGo(id,d){const t=document.getElementById(id).querySelector('.hs-track');t.scrollBy({left:d*t.clientWidth*0.85,behavior:'smooth'});}
function hsUpdate(id){
  const w=document.getElementById(id);if(!w)return;
  const t=w.querySelector('.hs-track');if(!t)return;
  const more=t.scrollWidth-t.clientWidth>12;
  const atEnd=t.scrollLeft+t.clientWidth>=t.scrollWidth-12;
  w.querySelector('.hs-l').style.display=(more&&t.scrollLeft>12)?'flex':'none';
  const r=w.querySelector('.hs-r');
  r.style.display=(more&&!atEnd)?'flex':'none';
  r.classList.toggle('bounce',more&&!atEnd);
}
function hsInit(id){
  const w=document.getElementById(id);if(!w||w._hs)return;
  w._hs=1;
  const t=w.querySelector('.hs-track');
  t.addEventListener('scroll',()=>{hsUpdate(id);if(id==='hs-tienda')tiendaScrolled(t);},{passive:true});
}
window.addEventListener('resize',()=>['hs-cats','hs-nuevo','hs-tienda'].forEach(hsUpdate));
function tiendaScrolled(t){
  if(!t.isConnected||!t.clientWidth)return;
  if(searchQ||window.innerWidth<900)return;
  const st=pgGet(tabKey());
  if(st.done||st.loading)return;
  if(t.scrollLeft+t.clientWidth>=t.scrollWidth-350)loadMore();
}

// ── LO MÁS VENDIDO (3 productos elegidos en el panel) ──
let featIds=[];
async function loadFeatured(){
  try{
    const {db,collection,getDocs,query,where,limit}=window._fb;
    const snap=await getDocs(query(collection(db,'products'),where('featured','==',true),limit(3)));
    featIds=[];
    snap.forEach(d=>{const p=ingestProd(d);featIds.push(p._fbId);});
  }catch(e){console.warn('loadFeatured',e);}
}
function mkFeat(p,rank){
  const nm=esc(p.name),sold=!!p.soldOut,act=isPromoActive(p);
  const pid=JSON.stringify(p._fbId||p.id);
  const pos=p.imgPos||'center center',sc=p.imgScale||1;
  const ih=p.img?`<img src="${p.img}" alt="${nm}" loading="lazy" style="object-position:${pos};transform:scale(${sc});transform-origin:${pos}${sold?';opacity:.45':''}">`:`<svg viewBox="0 0 200 300" fill="none">${pSVG(p)}</svg>`;
  return`<div class="vd-card" onclick='openM(${pid})'>${ih}<span class="vd-rank">#${rank}</span>${sold?'<span class="pc-soldout">Agotado</span>':''}<div class="vd-info"><div class="vd-name">${nm}</div><div class="vd-price">${act?`<s>${fmt(p.promoOld)}</s>`:''}${fmt(p.price)}</div></div></div>`;
}
function renderVendido(){
  const sec=document.getElementById('vendido');if(!sec)return;
  let list=featIds.map(findProd).filter(Boolean),fb=false;
  if(!list.length){
    list=pgGet('__all').ids.map(findProd).filter(p=>p&&!p.soldOut).slice(0,3);
    fb=true;
  }
  if(!list.length){sec.style.display='none';return;}
  sec.style.display='block';
  const ey=sec.querySelector('.sec-ey'),tt=sec.querySelector('.sec-title');
  if(ey)ey.textContent=fb?'Te recomendamos':'Selección de la semana';
  if(tt)tt.textContent=fb?'Productos destacados':'Lo más vendido esta semana';
  document.getElementById('vendido-grid').innerHTML=list.map((p,i)=>mkFeat(p,i+1)).join('');
}
// ── BÚSQUEDA (al terminar de escribir) ──
let searchAll=[],searchShown=16,searchNote='',searchCatSugs=[],searchRaw='';
let vocab=null;
function lev(a,b){
  if(a===b)return 0;
  const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
  let prev=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){
    const cur=[i];
    for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev=cur;
  }
  return prev[n];
}
async function loadVocab(){
  if(vocab)return vocab;
  try{
    const {db,doc,getDoc}=window._fb;
    const s=await getDoc(doc(db,'config','vocab'));
    vocab=(s.exists()&&Array.isArray(s.data().words))?s.data().words:[];
  }catch(e){vocab=[];}
  return vocab;
}
async function kwQuery(tok,lim){
  const {db,collection,getDocs,query,where,limit}=window._fb;
  const snap=await getDocs(query(collection(db,'products'),where('kw','array-contains',tok),limit(lim)));
  const out=[];snap.forEach(d=>out.push(ingestProd(d)));return out;
}
async function catProducts(c){
  const {db,collection,getDocs,query,where,limit}=window._fb;
  const snap=await getDocs(query(collection(db,'products'),where('category','==',c.id),limit(24)));
  const out=[];snap.forEach(d=>out.push(ingestProd(d)));return out;
}
function prodText(p){return normTxt((p.name||'')+' '+(p.keywords||'')+' '+catLabel(p.category));}
async function doSearch(scroll){
  const raw=document.getElementById('srch').value.trim();
  const toks=normTxt(raw).split(' ').filter(Boolean);
  if(!toks.length){clearSearch();return;}
  const hv=document.getElementById('view-home');
  if(hv&&hv.style.display==='none')showView('home');
  const q=toks.join(' ');
  searchQ=q;searchRaw=raw;searchAll=[];searchShown=16;searchNote='';searchCatSugs=[];searchLoading=true;
  renderTienda();
  if(scroll!==false)document.getElementById('tienda').scrollIntoView({behavior:'smooth'});
  try{
    const found=new Map();
    const add=p=>{if(p&&!found.has(p._fbId))found.set(p._fbId,p);};
    const main=[...toks].sort((a,b)=>b.length-a.length)[0].slice(0,20);
    (await kwQuery(main,60)).filter(p=>toks.every(t=>prodText(p).includes(t))).forEach(add);
    // si lo escrito coincide con una categoría, mostrar sus productos
    const hits=cats.filter(c=>{const nl=normTxt(c.label);return toks.some(t=>t.length>=3&&(nl.includes(t)||(nl.length>=4&&t.includes(nl))));});
    for(const c of hits.slice(0,2))(await catProducts(c)).forEach(add);
    // sin resultados: corregir errores de escritura y sugerir categorías parecidas
    if(!found.size){
      const v=await loadVocab();
      const alts=[];
      for(const t of toks){
        if(t.length<3)continue;
        const maxD=t.length<=4?1:2;
        v.map(w=>({w,d:w.startsWith(t)?0:lev(t,w)})).filter(x=>x.d<=maxD).sort((x,y)=>x.d-y.d||x.w.length-y.w.length).slice(0,2).forEach(x=>alts.push(x.w));
      }
      const uniq=[...new Set(alts)].slice(0,3);
      for(const w of uniq)(await kwQuery(w,30)).forEach(add);
      if(found.size)searchNote='Mostrando resultados para «'+uniq.join(' / ')+'».';
      const sim=cats.filter(c=>{const nl=normTxt(c.label);return toks.some(t=>t.length>=3&&(lev(t,nl)<=3||nl.startsWith(t.slice(0,3))));});
      searchCatSugs=sim.length?sim.slice(0,5):(found.size?[]:cats.slice(0,6));
    }
    if(searchQ!==q)return;
    searchAll=[...found.keys()];
  }catch(e){console.warn('doSearch',e);toast('⚠ No se pudo buscar');}
  if(searchQ!==q)return;
  searchLoading=false;renderTienda();
}
function searchMore(){searchShown+=16;renderTienda();}
function clearSearch(){
  searchQ='';searchRaw='';searchAll=[];searchLoading=false;searchNote='';searchCatSugs=[];
  const i=document.getElementById('srch');if(i)i.value='';
  renderTienda();
}

// ── LO + NUEVO (novedades y promociones) ──
// Máximo 8 productos. Cada 45 min sale el que lleva más tiempo (8 × 45 min = 6 h exactas)
// y entra uno elegido al azar. Es determinista (semilla = hora), así todos los visitantes ven lo mismo.
const NV_MAX=8, NV_TICK=45*60*1000, NV_ANCHOR=Date.UTC(2026,0,1);
function nvRand(seed){ // mulberry32
  let a=(seed+0x6D2B79F5)|0;
  a=Math.imul(a^(a>>>15),a|1);
  a^=a+Math.imul(a^(a>>>7),a|61);
  return((a^(a>>>14))>>>0)/4294967296;
}
function nvPool(){
  const seen=new Set(),out=[];
  const first=(pgGet('__all').pages[0]||[]);
  [...promoIds.map(findProd).filter(p=>p&&isPromoActive(p)),...first.map(findProd)].forEach(p=>{
    if(p&&!seen.has(p._fbId)){seen.add(p._fbId);out.push(p);}
  });
  const avail=out.filter(p=>!p.soldOut);
  return (avail.length>NV_MAX?avail:out).sort((a,b)=>a._fbId<b._fbId?-1:1);
}
function nvPick(pool,now){
  if(pool.length<=NV_MAX)return pool.slice();
  const ids=pool.map(p=>p._fbId);
  const tickNow=Math.floor((now-NV_ANCHOR)/NV_TICK);
  const vis=[];let left=null;
  for(let t=0;t<=tickNow;t++){
    if(vis.length>=NV_MAX)left=vis.shift();
    let cands=ids.filter(id=>!vis.includes(id));
    if(left!==null&&cands.length>1)cands=cands.filter(id=>id!==left);
    vis.push(cands[Math.floor(nvRand(t)*cands.length)]);
  }
  return vis.slice().reverse().map(findProd).filter(Boolean);
}
let nvKey='';
function renderNuevo(force){
  const sec=document.getElementById('nuevo');
  if(!sec)return;
  const toShow=nvPick(nvPool(),Date.now());
  if(!toShow.length){sec.style.display='none';return;}
  sec.style.display='block';
  document.getElementById('nuevo-scroll').innerHTML=toShow.map(mkCard).join('');
  nvKey=toShow.map(p=>p._fbId).join(',');
  updNA();
}
// cada minuto revisa si ya toca cambiar algún producto de Novedades
setInterval(()=>{
  try{
    const toShow=nvPick(nvPool(),Date.now());
    if(toShow.map(p=>p._fbId).join(',')!==nvKey)renderNuevo();
  }catch(e){console.warn('nvTimer',e);}
},60000);

function shuffleSeed(arr, seed){
  let s = seed;
  for(let i=arr.length-1;i>0;i--){
    s = (s*1664525+1013904223)&0xffffffff;
    const j = Math.abs(s) % (i+1);
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function scrollN(d){hsGo('hs-nuevo',d);}
function updNA(){hsInit('hs-nuevo');hsUpdate('hs-nuevo');}

// ── TIENDA TABS ──
let acT='todo';
let filt={cat:[],pMin:null,pMax:null};

function renderTienda(){
  const tb=document.getElementById('tienda-tabs');
  tb.innerHTML=[{id:'todo',label:'Todos'},...cats].map(c=>
    `<button class="ttab ${(!searchQ&&acT===c.id)?'on':''}" onclick="setTiendaTab('${c.id}',this)">${esc(c.label)}</button>`
  ).join('');
  const bl=document.getElementById('tienda-blocks');
  let hdr,items,below='',empty;
  if(searchQ){
    const all=searchAll.map(findProd).filter(Boolean);
    items=all.slice(0,searchShown);
    hdr=`<h3>Resultados para “${esc(searchRaw)}”</h3><span>${searchLoading?'Buscando...':all.length+' encontrado'+(all.length!==1?'s':'')}</span>`;
    empty=searchLoading?'Buscando...':'No encontramos productos con esa búsqueda. Prueba con otra palabra o escríbenos por WhatsApp.';
    const sugs=searchCatSugs.length?`<div class="sr-sugs"><p>${items.length?'También puedes mirar:':'Quizás te interesen estas categorías:'}</p>${searchCatSugs.map(c=>`<button class="ttab" onclick="setTiendaTab('${c.id}')">${esc(c.label)}</button>`).join('')}</div>`:'';
    below=(searchLoading?'':sugs)
      +(all.length>searchShown?`<div class="more-wrap always"><button class="btn-outline-gold" onclick="searchMore()">Ver más resultados</button></div>`:'')
      +`<div class="more-wrap always"><button class="btn-outline-gold" onclick="clearSearch()">Quitar búsqueda</button></div>`;
  }else{
    const st=pgGet(tabKey());
    items=(st.pages[st.cur-1]||[]).map(findProd).filter(Boolean);
    hdr=`<h3>${esc(acT==='todo'?'Todos los productos':catLabel(acT))}</h3>`;
    empty=(st.loading||!st.done)?'Cargando productos...':'Próximamente en esta categoría...';
    const tp=totalPages(st),known=st.pages.length;
    const multi=tp?tp>1:(known>1||!st.done);
    if(multi){
      const maxN=tp?Math.min(tp,known+1):(st.done?known:known+1);
      const hasNext=tp?st.cur<tp:(st.cur<known||!st.done);
      let nums='';
      for(let i=1;i<=maxN;i++)nums+=`<button class="pg-num${i===st.cur?' on':''}" onclick="goPage(${i})" aria-label="Página ${i}">${i}</button>`;
      below=`<div class="pager">
        <button class="pg-btn" onclick="goPage(${st.cur-1})" ${(st.cur<=1||st.loading)?'disabled':''}>‹ Anterior</button>
        <div class="pg-nums">${nums}</div>
        <button class="pg-btn" onclick="goPage(${st.cur+1})" ${(!hasNext||st.loading)?'disabled':''}>${st.loading?'Cargando...':'Siguiente ›'}</button>
      </div>
      <p class="pg-info">Página ${st.cur}${tp?' de '+tp:''}${st.total!==null?' · '+st.total+' productos':''}</p>`;
    }
  }
  const note=(searchQ&&searchNote&&!searchLoading)?`<p class="sr-note">${esc(searchNote)}</p>`:'';
  const grid=items.length?`<div class="cat-grid">${items.map(p=>mkCard(p)).join('')}</div>`:`<p class="empty-cat">${empty}</p>`;
  bl.innerHTML=`<div class="tienda-block vis"><div class="tienda-block-hdr">${hdr}</div>${note}${grid}${below}</div>`;
}
async function setTiendaTab(id,btn){
  acT=id;searchQ='';searchAll=[];searchNote='';searchCatSugs=[];
  const si=document.getElementById('srch');if(si)si.value='';
  const key=tabKey();const st=pgGet(key);
  st.cur=1;
  renderTienda();
  if(!st.pages.length&&!st.done){await Promise.all([loadPage(key),loadCount(key)]);}
  else if(st.total===null){await loadCount(key);}
  renderTienda();
}
function applyFilt(p){
  if(filt.cat&&filt.cat.length&&!filt.cat.includes(p.category))return false;
  if(filt.pMin!==null&&filt.pMin!==undefined&&p.price<filt.pMin)return false;
  if(filt.pMax!==null&&filt.pMax!==undefined&&p.price>filt.pMax)return false;
  return true;
}

// (Se eliminó la etiqueta aleatoria "Últimas unidades": ahora la escribe el administrador por producto, solo cuando es cierto.)
function getHotIds(){return new Set();}

// ── PRODUCT CARD ──
function pSVG(p){
  return`<g transform="translate(0,28)"><path d="M100 60L150 85L150 140L100 165L50 140L50 85Z" fill="rgba(255,255,255,.06)" stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-linejoin="round"/><path d="M50 85L100 110L150 85M100 110L100 165" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-linejoin="round"/></g>`;
}
function mkCard(p, allowHot=true){
  const now=Date.now();
  const iN=now-new Date(p.dateAdded).getTime()<NEW_TTL;
  const act=isPromoActive(p);
  const sold=!!p.soldOut;
  const sc=p.imgScale||1;const po=p.imgPos||'center center';
  const nm=esc(p.name);
  const ih=p.img?`<img src="${p.img}" alt="${nm}" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:${po};transform:scale(${sc});transform-origin:${po}${sold?';opacity:.45':''}">`:`<svg viewBox="0 0 200 300" fill="none">${pSVG(p)}</svg>`;
  const pricesHTML=`<div class="pc-prices"><div class="pc-price-col">${act?`<span class="pc-old">${fmt(p.promoOld)}</span>`:''}<span class="pc-price-detal">${fmt(p.price)}</span></div></div>`;
  const pid = JSON.stringify(p._fbId||p.id);
  const ci=cart.find(x=>x.id===(p._fbId||p.id));
  let actions;
  if(sold){
    actions=`<button class="pc-add" disabled style="opacity:.55;cursor:not-allowed">Agotado</button>`;
  }else{
    actions=`${ci
        ?`<div class="pc-qty-ctrl" onclick="event.stopPropagation()">
            <button class="pc-qty-btn" onclick='event.stopPropagation();qtyCart(${pid},-1)'>−</button>
            <span class="pc-qty-num">${ci.qty}</span>
            <button class="pc-qty-btn" onclick='event.stopPropagation();qtyCart(${pid},1)'>+</button>
          </div>`
        :`<button class="pc-add" onclick='event.stopPropagation();addCart(${pid})'>
            ${CART_SVG}
            Agregar al carrito
          </button>`}
      <button class="pc-buy-now" onclick='event.stopPropagation();pedirAhora(${pid})'>
        ${WA_SVG}
        Pedir por WhatsApp
      </button>`;
  }
  return`<div class="pc" onclick='openM(${pid})'>
    <div class="pc-img">
      ${ih}
      ${sold?'<span class="pc-soldout">Agotado</span>':''}
      ${(!sold&&act)?`<span class="pc-promo">PROMO −${pctOff(p)}%</span>`:''}
      ${(!sold&&!act&&iN)?'<span class="pc-new">Nuevo</span>':''}
      ${(!sold&&p.tag)?`<span class="pc-hot${(act||iN)?' pc-hot-new':''}">${esc(p.tag)}</span>`:''}
    </div>
    <div class="pc-body">
      <div class="pc-name">${nm}</div>
      ${pricesHTML}
      ${actions}
    </div>
  </div>`;
}
function mkCSVG(id){
  return`<g transform="translate(0,28)"><path d="M100 60L150 85L150 140L100 165L50 140L50 85Z" fill="rgba(255,255,255,.06)" stroke="rgba(59,130,246,.55)" stroke-width="2" stroke-linejoin="round"/><path d="M50 85L100 110L150 85M100 110L100 165" fill="none" stroke="rgba(59,130,246,.55)" stroke-width="2" stroke-linejoin="round"/></g>`;
}

// ── FILTERS ──
// ── FILTROS ──
function applyF(){filt.pMin=+document.getElementById('pmin').value||null;filt.pMax=+document.getElementById('pmax').value||null;renderTienda();}
function clearF(){filt={cat:[],pMin:null,pMax:null};document.querySelectorAll('.schip').forEach(e=>e.classList.remove('on'));document.getElementById('pmin').value='';document.getElementById('pmax').value='';renderTienda();}
function toggleSB(){
  document.getElementById('sb').classList.toggle('on');
  document.getElementById('sb-ov').classList.toggle('on');
  // Populate cat chips dynamically
  const chips=document.getElementById('sb-cat-chips');
  if(chips){
    chips.innerHTML=cats.map(c=>`<button class="schip ${filt.cat&&filt.cat.includes(c.id)?'on':''}" onclick="togCat('${c.id}',this)">${c.label}</button>`).join('');
  }
}
function togCat(id,btn){
  if(!filt.cat)filt.cat=[];
  const i=filt.cat.indexOf(id);
  if(i>-1){filt.cat.splice(i,1);btn.classList.remove('on');}
  else{filt.cat.push(id);btn.classList.add('on');}
  renderTienda();
}
function closeSB(){document.getElementById('sb').classList.remove('on');document.getElementById('sb-ov').classList.remove('on');}

// ── PEDIR AHORA ──
function pedirAhora(id){
  const p=findProd(id);if(!p)return;
  if(p.soldOut){toast('Este producto está agotado');return;}
  const wa=site.wa||'';
  if(!wa){toast('⚠ Falta configurar el WhatsApp de la tienda');return;}
  const msg=encodeURIComponent(`Hola Yibex Store 👋, quiero pedir este producto:\n\n• ${p.name}\n  Categoría: ${catLabel(p.category)}\n  Precio: ${fmt(p.price)}\n  Link: ${prodLink(p._fbId||p.id)}\n\nTotal: ${fmt(p.price)}`);
  window.open(`https://wa.me/${wa}?text=${msg}`,'_blank');
}

// ── CART ──
function updC(){const n=cart.reduce((a,i)=>a+i.qty,0);document.querySelectorAll('.cart-bubble').forEach(bb=>{bb.textContent=n;bb.classList.toggle('on',n>0);});const t=document.getElementById('nav-cart-tot');if(t)t.textContent=n>0?fmt(cart.reduce((a,i)=>a+i.price*i.qty,0)):'';}
function addCart(id){
  const p=prods.find(x=>x._fbId===id||x._fbId===String(id)||x.id===id);
  if(!p)return;
  if(p.soldOut){toast('Este producto está agotado');return;}
  const pid=p._fbId||p.id;
  const ci=cart.find(x=>x.id===pid);
  if(ci)ci.qty++;
  else cart.push({id:pid,name:p.name,price:p.price,qty:1,img:p.img,category:p.category});
  svCt();updC();renderNuevo();renderTienda();toast(`✔ ${p.name} agregado`);
}
function rmCart(id){cart=cart.filter(x=>x.id!==id);svCt();updC();renderCart();}
function qtyCart(id,delta){const ci=cart.find(x=>x.id===id);if(!ci)return;ci.qty+=delta;if(ci.qty<1)cart=cart.filter(x=>x.id!==id);svCt();updC();renderCart();renderNuevo();renderTienda();}
function openCart(){document.getElementById('cart-ov').classList.add('on');renderCart();}
function closeCart(){document.getElementById('cart-ov').classList.remove('on');}
function renderCart(){
  const el=document.getElementById('cart-content');
  if(!cart.length){el.innerHTML='<p class="c-empty">Tu carrito está vacío</p>';return;}
  const tot=cart.reduce((a,i)=>a+i.price*i.qty,0);
  const wa=site.wa||'';
  const items=cart.map(i=>`<div class="c-item">
    <div class="c-img">${i.img?`<img src="${i.img}">`:'📦'}</div>
    <div class="c-inf">
      <div class="c-n">${i.name}</div>
      <div class="c-m">${esc(catLabel(i.category))}</div>
      <div class="c-qty-row">
        <button class="c-qty-btn" onclick='qtyCart("${i.id}",-1)'>\u2212</button>
        <span class="c-qty-num">${i.qty}</span>
        <button class="c-qty-btn" onclick='qtyCart("${i.id}",1)'>+</button>
      </div>
      <div class="c-p">${fmt(i.price*i.qty)}</div>
    </div>
    <button class="c-rm" onclick='rmCart("${i.id}")'>✕</button>
  </div>`).join('');
  const waLines=cart.map(i=>`• ${i.name}\n  Categoría: ${catLabel(i.category)}\n  Cantidad: ${i.qty}\n  Precio unitario: ${fmt(i.price)}\n  Subtotal: ${fmt(i.price*i.qty)}\n  Link: ${prodLink(i.id)}`).join('\n\n');
  const waMsg=encodeURIComponent(`Hola Yibex Store 👋, quiero realizar este pedido:\n\n${waLines}\n\nTotal: ${fmt(tot)}`);
  el.innerHTML=`<div class="c-items">${items}</div><div class="c-sum"><div class="sr"><span>Total</span><span class="sr-tot">${fmt(tot)}</span></div><button class="wa-ord" onclick="window.open('https://wa.me/${wa}?text=${waMsg}','_blank')">💬 Pedir por WhatsApp</button></div>`;
}

// ── PRODUCT PAGE VIEW ──
let pdpSelectedSize = null;

let pdpCurId=null;
function openM(id){
  const p=findProd(id);if(!p)return;
  const ov=document.getElementById('pdp-ov');
  const pid=p._fbId||p.id;
  pdpCurId=pid;
  const isNew=Date.now()-new Date(p.dateAdded).getTime()<OW;
  const act=isPromoActive(p);
  const sold=!!p.soldOut;

  document.getElementById('pdp-bar-title').textContent=p.name;

  // Imagen
  const wrap=document.getElementById('pdp-img-wrap');
  wrap.querySelectorAll('img,svg.pdp-svg').forEach(el=>el.remove());
  if(p.img){
    const img=document.createElement('img');
    img.src=p.img;
    img.alt=p.name;
    img.style.cssText='width:100%;height:100%;object-fit:cover'+(sold?';opacity:.5':'');
    wrap.insertBefore(img,wrap.firstChild);
  }else{
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 200 300');
    svg.setAttribute('fill','none');
    svg.classList.add('pdp-svg');
    svg.style.cssText='width:50%;opacity:.15;display:block;margin:auto;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)';
    svg.innerHTML=pSVG(p);
    wrap.insertBefore(svg,wrap.firstChild);
  }
  document.getElementById('pdp-badge-new').style.display=(isNew&&!sold)?'block':'none';

  document.getElementById('pdp-name').textContent=p.name;

  // Precio único (+ promoción real si el admin la activó)
  document.getElementById('pdp-price-detal').textContent=fmt(p.price);
  const oldEl=document.getElementById('pdp-price-old');
  const badge=document.getElementById('pdp-promo-badge');
  if(act&&!sold){
    oldEl.textContent=fmt(p.promoOld);oldEl.style.display='block';
    badge.textContent='PROMO −'+pctOff(p)+'%';badge.style.display='inline-block';
  }else{oldEl.style.display='none';badge.style.display='none';}

  // Etiqueta (la escribe el administrador)
  const tagEl=document.getElementById('pdp-tag');
  const tagTxt=sold?'Agotado':(p.tag||'');
  tagEl.textContent=tagTxt;tagEl.style.display=tagTxt?'inline-block':'none';

  // Descripción
  const dEl=document.getElementById('pdp-desc');
  dEl.textContent=p.desc||'';
  dEl.style.display=p.desc?'block':'none';

  // Botones
  const bc=document.getElementById('pdp-btn-cart'),bw=document.getElementById('pdp-btn-wa');
  bc.disabled=sold;bw.disabled=sold;
  bc.style.opacity=bw.style.opacity=sold?'.5':'';
  bc.style.cursor=bw.style.cursor=sold?'not-allowed':'';
  bc.onclick=()=>addCart(pid);
  bw.onclick=()=>pedirAhora(pid);

  // Recomendados (misma categoría)
  const pdpRec=document.getElementById('pdp-rec');
  pdpRec.style.display='none';
  pdpRecs(p);

  try{history.replaceState(null,'','?p='+encodeURIComponent(pid));}catch(e){}
  ov.classList.add('on');
  ov.scrollTop=0;
  document.body.style.overflow='hidden';
}
async function pdpRecs(p){
  const pid=p._fbId||p.id;
  const show=()=>{
    if(pdpCurId!==pid)return;
    let recs=prods.filter(x=>(x._fbId||x.id)!==pid&&x.category===p.category);
    if(recs.length<4){
      const others=prods.filter(x=>(x._fbId||x.id)!==pid&&x.category!==p.category);
      recs=[...recs,...others];
    }
    let h=0;for(const ch of String(pid))h=(h*31+ch.charCodeAt(0))|0;
    recs=shuffleSeed(recs.slice(),h).slice(0,8);
    const grid=document.getElementById('pdp-rec-grid'),box=document.getElementById('pdp-rec');
    if(recs.length){grid.innerHTML=recs.map(x=>mkCard(x)).join('');box.style.display='block';}
    else box.style.display='none';
  };
  show();
  if(prods.filter(x=>x.category===p.category).length<9){
    try{
      const {db,collection,getDocs,query,where,limit}=window._fb;
      const snap=await getDocs(query(collection(db,'products'),where('category','==',p.category),limit(12)));
      snap.forEach(d=>ingestProd(d));
      show();
    }catch(e){console.warn('pdpRecs',e);}
  }
}

function pdpSelectSize(btn, size){
  document.querySelectorAll('.pdp-size-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  pdpSelectedSize = size;
}

function closeM(){
  pdpCurId=null;
  document.getElementById('pdp-ov').classList.remove('on');
  document.body.style.overflow='';
  try{history.replaceState(null,'',location.pathname);}catch(e){}
}
function closeMOut(e){} // kept for compatibility
function aClick(){if(!document.getElementById('adm-ov').classList.contains('on'))openAL();}

// ── ADMIN: LOGO TAP (4 veces abre panel) ──
var logoTaps=0,logoTimer=null;
function logoTap(){
  logoTaps++;
  clearTimeout(logoTimer);
  if(logoTaps>=4){logoTaps=0;openAL();return;}
  logoTimer=setTimeout(()=>{logoTaps=0;},1500);
}

function openAL(){
  document.getElementById('adm-ov').classList.add('on');
  document.getElementById('adm-login').style.display='block';
  document.getElementById('adm-dash').classList.remove('on');
  document.getElementById('adm-pwd').value='';
  document.getElementById('adm-err').style.display='none';
  setTimeout(()=>document.getElementById('adm-pwd').focus(),200);
}
async function chkP(){
  const pwd = document.getElementById('adm-pwd').value.trim();
  if(!pwd){ toast('⚠ Ingresa tu contraseña'); return; }
  const btn = document.querySelector('.adm-in');
  if(btn){ btn.disabled = true; btn.textContent = 'Verificando...'; }
  try {
    const { auth, signInWithEmailAndPassword } = window._fb;
    await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pwd);
    document.getElementById('adm-err').style.display = 'none';
    document.getElementById('adm-login').style.display = 'none';
    document.getElementById('adm-dash').classList.add('on');
    renderAPL(); renderCE(); popSels(); loadCfgFields(); buildCroppers();
  } catch(e) {
    document.getElementById('adm-err').style.display = 'block';
    document.getElementById('adm-pwd').value = '';
    setTimeout(() => document.getElementById('adm-pwd').focus(), 50);
  } finally {
    if(btn){ btn.disabled = false; btn.textContent = 'Ingresar al Panel'; }
  }
}
function closeAdm(){
  document.getElementById('adm-ov').classList.remove('on');
  try { const { auth, signOut } = window._fb; signOut(auth); } catch(e){}
}
function swT(n,btn){
  document.querySelectorAll('.adm-tab').forEach(t=>t.classList.remove('on'));
  document.querySelectorAll('.atc').forEach(t=>t.classList.remove('on'));
  document.getElementById('tab-'+n).classList.add('on');
  btn.classList.add('on');
  if(n==='resenas') renderAdmRes();
}

// ── ADMIN: CROP 3:4 ──
const cropState={};

function buildCropBox(mountId,key,aspect,onAccept){
  const container=document.getElementById(mountId);
  if(!container||container.dataset.built)return;
  container.dataset.built='1';
  container.innerHTML=`
    <div class="cb">
      <div class="cb-prev" id="crop-prev-${key}">
        <span class="cb-ph">🖼</span>
        <img id="crop-img-${key}" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover" alt="">
      </div>
      <div class="cb-side">
        <input type="file" id="crop-file-${key}" accept="image/*" style="display:none" onchange="cropLoad('${key}',event,'${aspect}')">
        <button type="button" class="cb-btn" id="crop-pick-${key}" onclick="document.getElementById('crop-file-${key}').click()">📁 Elegir foto</button>
        <p class="cb-help" id="crop-help-${key}">Se recorta en formato vertical. Elige la foto y arrástrala para acomodarla.</p>
        <div id="crop-range-${key}" style="display:none">
          <label class="cb-lbl">🔍 Zoom</label>
          <input type="range" min="1" max="3" step="0.01" value="1" style="width:100%;accent-color:var(--accent)" oninput="cropZoom('${key}',this.value)">
        </div>
        <button type="button" id="crop-accept-${key}" style="display:none"></button>
      </div>
    </div>`;
  cropState[key]={src:null,zoom:1,dx:0,dy:0,dragging:false,startX:0,startY:0,onAccept};
  // drag to reposition — mouse
  const prev=container.querySelector(`#crop-prev-${key}`);
  prev.style.cursor='grab';
  prev.addEventListener('mousedown',e=>{if(!cropState[key].src)return;cropState[key].dragging=true;cropState[key].startX=e.clientX-cropState[key].dx;cropState[key].startY=e.clientY-cropState[key].dy;prev.style.cursor='grabbing';e.preventDefault();});
  document.addEventListener('mousemove',e=>{const s=cropState[key];if(!s||!s.dragging)return;s.dx=e.clientX-s.startX;s.dy=e.clientY-s.startY;cropApplyTransform(key);});
  document.addEventListener('mouseup',()=>{if(cropState[key])cropState[key].dragging=false;prev.style.cursor='grab';});
  // drag to reposition — touch
  prev.addEventListener('touchstart',e=>{if(!cropState[key].src)return;const t=e.touches[0];cropState[key].dragging=true;cropState[key].startX=t.clientX-cropState[key].dx;cropState[key].startY=t.clientY-cropState[key].dy;e.preventDefault();},{passive:false});
  prev.addEventListener('touchmove',e=>{const s=cropState[key];if(!s||!s.dragging)return;const t=e.touches[0];s.dx=t.clientX-s.startX;s.dy=t.clientY-s.startY;cropApplyTransform(key);e.preventDefault();},{passive:false});
  prev.addEventListener('touchend',()=>{if(cropState[key])cropState[key].dragging=false;});
}

function cropLoad(key,event,aspect){
  const file=event.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{
    // Pre-compress so canvas operations are fast and localStorage stays light
    compressImg(e.target.result, 1200, 1600, 0.85, src=>{
      cropState[key].src=src;cropState[key].zoom=1;cropState[key].dx=0;cropState[key].dy=0;
      const img=document.getElementById(`crop-img-${key}`);
      img.src=src;img.style.display='block';img.style.transform='scale(1) translate(0,0)';
      const ph=document.querySelector(`#crop-prev-${key} .cb-ph`);if(ph)ph.style.display='none';
      const pk=document.getElementById(`crop-pick-${key}`);if(pk)pk.textContent='🔄 Cambiar foto';
      const hp=document.getElementById(`crop-help-${key}`);if(hp)hp.textContent='✔ Foto lista. Arrastra para mover y usa el zoom si quieres acercarla.';
      document.getElementById(`crop-range-${key}`).style.display='block';
      const rangeEl=document.querySelector(`#crop-range-${key} input`);
      if(rangeEl)rangeEl.value=1;
    });
  };
  r.readAsDataURL(file);
}
function cropZoom(key,val){
  cropState[key].zoom=parseFloat(val);
  cropApplyTransform(key);
}
function cropApplyTransform(key){
  const s=cropState[key];
  const img=document.getElementById(`crop-img-${key}`);
  if(img)img.style.transform=`scale(${s.zoom}) translate(${s.dx/s.zoom}px,${s.dy/s.zoom}px)`;
}
function cropAccept(key){
  const s=cropState[key];
  if(!s||!s.src){toast('⚠ Primero elige una imagen');return;}
  // Render to canvas with 3:4 ratio (or free)
  const img=new Image();
  img.onload=()=>{
    const canvas=document.createElement('canvas');
    const W=600,H=800; // 3:4
    canvas.width=W;canvas.height=H;
    const ctx=canvas.getContext('2d');
    const iw=img.naturalWidth,ih=img.naturalHeight;
    // scale to fill
    const scale=s.zoom*Math.max(W/iw,H/ih);
    const sw=iw*scale,sh=ih*scale;
    const ox=(W-sw)/2+s.dx;const oy=(H-sh)/2+s.dy;
    ctx.drawImage(img,ox,oy,sw,sh);
    const dataUrl=canvas.toDataURL('image/jpeg',0.85);
    if(s.onAccept)s.onAccept(dataUrl);
    toast('✔ Imagen recortada y lista');
  };
  img.src=s.src;
}

// ── SLIDER CROP: drag libre con mouse Y touch, preview 16:9 escritorio ──
function buildSliderCrop(mountId, key, onAccept){
  const container = document.getElementById(mountId);
  if(!container || container.dataset.built) return;
  container.dataset.built = '1';

  container.innerHTML = `
    <div style="background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.12);border-radius:2px;padding:12px">
      <!-- Preview 16:9 escritorio -->
      <div id="scrop-prev-${key}" style="
        width:100%;aspect-ratio:16/9;
        background:rgba(0,0,0,.45);
        overflow:hidden;position:relative;
        display:flex;align-items:center;justify-content:center;
        margin-bottom:12px;border-radius:2px;
        cursor:grab;user-select:none;touch-action:none;
        border:1px solid rgba(59,130,246,.15);
      ">
        <span id="scrop-ph-${key}" style="color:rgba(255,255,255,.18);font-size:2rem;pointer-events:none">🖼</span>
        <img id="scrop-img-${key}" style="
          display:none;position:absolute;
          transform-origin:center center;
          will-change:transform;
          pointer-events:none;
        " alt="">
        <div style="
          position:absolute;inset:0;pointer-events:none;
          border:1.5px solid rgba(59,130,246,.25);border-radius:2px;
          box-shadow:inset 0 0 40px rgba(0,0,0,.3);
        "></div>
        <div id="scrop-hint-${key}" style="
          position:absolute;bottom:8px;left:50%;transform:translateX(-50%);
          background:rgba(0,0,0,.6);color:rgba(255,255,255,.5);
          font-size:.48rem;letter-spacing:.12em;text-transform:uppercase;
          padding:4px 10px;border-radius:20px;pointer-events:none;
          display:none;
        ">☝ Arrastra para reposicionar</div>
      </div>
      <!-- Zoom -->
      <div id="scrop-zoom-row-${key}" style="display:none;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);padding:8px 12px;border-radius:2px">
          <span style="font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-d);flex-shrink:0;min-width:38px">Zoom</span>
          <input type="range" id="scrop-range-${key}" min="1" max="3" step="0.01" value="1"
            style="flex:1;accent-color:var(--accent);height:3px;cursor:pointer"
            oninput="scropZoom('${key}',this.value)">
          <span id="scrop-zval-${key}" style="font-size:.56rem;color:rgba(255,255,255,.4);min-width:32px;text-align:right">1×</span>
        </div>
      </div>
      <!-- Botones -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        <input type="file" id="scrop-file-${key}" accept="image/*" style="display:none" onchange="scropLoad('${key}',event)">
        <button onclick="document.getElementById('scrop-file-${key}').click()" style="
          padding:8px 18px;background:rgba(255,255,255,.07);
          border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);
          font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;
          cursor:pointer;border-radius:2px;transition:all .2s;
        " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='rgba(255,255,255,.15)'">
          📁 Elegir imagen
        </button>
        <button id="scrop-accept-${key}" onclick="scropAccept('${key}')" style="
          display:none;padding:8px 18px;
          background:var(--accent);border:none;color:var(--dark);
          font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;
          font-weight:700;cursor:pointer;border-radius:2px;transition:all .2s;
        ">✔ Guardar posición</button>
      </div>
    </div>`;

  cropState[key] = {src:null, zoom:1, dx:0, dy:0, dragging:false, startX:0, startY:0, onAccept};

  const prev = document.getElementById(`scrop-prev-${key}`);

  // ── Mouse events ──
  prev.addEventListener('mousedown', e => {
    const s = cropState[key];
    if(!s.src) return;
    s.dragging = true;
    s.startX = e.clientX - s.dx;
    s.startY = e.clientY - s.dy;
    prev.style.cursor = 'grabbing';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    const s = cropState[key];
    if(!s || !s.dragging) return;
    s.dx = e.clientX - s.startX;
    s.dy = e.clientY - s.startY;
    scropApply(key);
  });
  document.addEventListener('mouseup', () => {
    const s = cropState[key];
    if(s) s.dragging = false;
    prev.style.cursor = 'grab';
  });

  // ── Touch events ──
  prev.addEventListener('touchstart', e => {
    const s = cropState[key];
    if(!s.src) return;
    s.dragging = true;
    const t = e.touches[0];
    s.startX = t.clientX - s.dx;
    s.startY = t.clientY - s.dy;
    e.preventDefault();
  }, {passive:false});
  prev.addEventListener('touchmove', e => {
    const s = cropState[key];
    if(!s || !s.dragging) return;
    const t = e.touches[0];
    s.dx = t.clientX - s.startX;
    s.dy = t.clientY - s.startY;
    scropApply(key);
    e.preventDefault();
  }, {passive:false});
  prev.addEventListener('touchend', () => {
    const s = cropState[key];
    if(s) s.dragging = false;
  });
}

function scropLoad(key, event){
  const file = event.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = e => {
    // Compress hero slides: max 1920x1080, quality 0.88
    compressImg(e.target.result, 1920, 1080, 0.88, src=>{
      const s = cropState[key];
      s.src = src; s.zoom = 1; s.dx = 0; s.dy = 0;
      const img = document.getElementById(`scrop-img-${key}`);
      img.onload = () => scropApply(key);
      img.src = src;
      img.style.display = 'block';
      document.getElementById(`scrop-ph-${key}`).style.display = 'none';
      document.getElementById(`scrop-hint-${key}`).style.display = 'block';
      document.getElementById(`scrop-zoom-row-${key}`).style.display = 'block';
      document.getElementById(`scrop-accept-${key}`).style.display = 'inline-block';
      const rng = document.getElementById(`scrop-range-${key}`);
      if(rng) rng.value = 1;
      document.getElementById(`scrop-zval-${key}`).textContent = '1×';
    });
  };
  r.readAsDataURL(file);
}

function scropZoom(key, val){
  const s = cropState[key]; if(!s) return;
  s.zoom = parseFloat(val);
  document.getElementById(`scrop-zval-${key}`).textContent = parseFloat(val).toFixed(2) + '×';
  scropApply(key);
}

function scropApply(key){
  const s = cropState[key]; if(!s) return;
  const prev = document.getElementById(`scrop-prev-${key}`);
  const img  = document.getElementById(`scrop-img-${key}`);
  if(!img || !prev) return;
  const pw = prev.offsetWidth, ph = prev.offsetHeight;
  const iw = img.naturalWidth,  ih = img.naturalHeight;
  if(!iw || !ih) return;
  // Scale to fill preview at zoom=1
  const baseScale = Math.max(pw/iw, ph/ih);
  const scale = baseScale * s.zoom;
  img.style.width  = (iw * scale) + 'px';
  img.style.height = (ih * scale) + 'px';
  img.style.left   = ((pw - iw*scale)/2 + s.dx) + 'px';
  img.style.top    = ((ph - ih*scale)/2 + s.dy) + 'px';
  img.style.transform = '';
}

function scropAccept(key){
  const s = cropState[key]; if(!s||!s.src){toast('⚠ Primero elige una imagen');return;}
  const prev = document.getElementById(`scrop-prev-${key}`);
  const img  = document.getElementById(`scrop-img-${key}`);
  const srcImg = new Image();
  srcImg.onload = () => {
    const W = 1920, H = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const pw = prev.offsetWidth, ph = prev.offsetHeight;
    const iw = srcImg.naturalWidth, ih = srcImg.naturalHeight;
    const baseScale = Math.max(pw/iw, ph/ih);
    const scale = baseScale * s.zoom;
    // Map from preview coords to output coords
    const ratio = W / pw;
    const ox = ((pw - iw*scale)/2 + s.dx) * ratio;
    const oy = ((ph - ih*scale)/2 + s.dy) * (H/ph);
    ctx.drawImage(srcImg, ox, oy, iw*scale*ratio, ih*scale*(H/ph));
    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
    if(s.onAccept) s.onAccept(dataUrl);
    toast('✔ Slide guardado correctamente');
  };
  srcImg.src = s.src;
}

function buildCroppers(){
  buildCropBox('prod-crop-mount','prod-new','3/4',null);
  buildCropBox('edit-crop-mount','prod-edit','3/4',null);
  for(let i=0;i<3;i++){
    const key=`slide-${i}`;
    buildSliderCrop(`slide-crop-${i}`, key, async (dataUrl)=>{
      try{
        toast('⏳ Comprimiendo slide...');
        // Compress slide: max 960x540, quality 0.75
        const compressed = await window._compressSlide(dataUrl);
        site[`slide${i}`] = compressed;
        await svS();
        applySlide(i, compressed, 'center center');
        toast('✔ Slide guardado. Todos lo verán.');
      }catch(e){ toast('⚠ Error guardando slide: '+e.message); }
    });
    if(site[`slide${i}`]){
      const s = cropState[key];
      if(s){
        s.src = site[`slide${i}`];
        const img = document.getElementById(`scrop-img-${key}`);
        if(img){ img.src = site[`slide${i}`]; img.style.display='block'; img.onload=()=>scropApply(key); }
        const ph=document.getElementById(`scrop-ph-${key}`); if(ph) ph.style.display='none';
        const hint=document.getElementById(`scrop-hint-${key}`); if(hint) hint.style.display='block';
        const zrow=document.getElementById(`scrop-zoom-row-${key}`); if(zrow) zrow.style.display='block';
        const btn=document.getElementById(`scrop-accept-${key}`); if(btn) btn.style.display='inline-block';
      }
    }
  }
}

async function saveSlides(){
  let saved = 0;
  for(let i=0;i<3;i++){
    if(site['slide'+i]){
      applySlide(i, site['slide'+i], site['slidePos'+i]||'center center');
      saved++;
    }
  }
  await svS();
  toast(saved>0 ? '✔ Sliders guardados. Todos los visitantes los verán.' : '⚠ No hay imágenes. Usa "Guardar posición" en cada slide primero.');
}

// ── ADMIN: PRODUCTS ──
function readProdForm(prefix){
  const g=id=>document.getElementById(prefix+id);
  const price=parseFloat(g('px').value);
  return{
    name:g('nm')?g('nm').value.trim():'',
    price,
    desc:g('desc').value.trim(),
    soldOut:g('av').value==='0',
    category:g('ct').value,
    keywords:g('kwd').value.trim()
  };
}
function validateProd(d){
  if(!d.name){toast('⚠ Escribe el nombre del producto');return false;}
  if(!d.price||isNaN(d.price)||d.price<=0){toast('⚠ El precio es obligatorio');return false;}
  if(!d.category){toast('⚠ Elige una categoría (créala primero en la pestaña Categorías)');return false;}
  return true;
}
async function cropToDataUrl(s){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=async()=>{
      const canvas=document.createElement('canvas');canvas.width=600;canvas.height=800;
      const ctx=canvas.getContext('2d');
      const iw=img.naturalWidth,ih=img.naturalHeight;
      const scale=s.zoom*Math.max(600/iw,800/ih);
      ctx.drawImage(img,(600-iw*scale)/2+s.dx,(800-ih*scale)/2+s.dy,iw*scale,ih*scale);
      resolve(await window._compressProd(canvas.toDataURL('image/jpeg',0.9)));
    };
    img.onerror=()=>resolve(null);
    img.src=s.src;
  });
}
let savingProd=false,savingEM=false,savingCfg=false,savingCats=false;
function setBusy(btn,on,txt){
  if(!btn)return;
  if(on){btn.dataset.o=btn.innerHTML;btn.disabled=true;btn.innerHTML=txt||'Guardando...';}
  else{btn.disabled=false;if(btn.dataset.o)btn.innerHTML=btn.dataset.o;}
}
function markDirty(id){const b=document.getElementById(id);if(b)b.style.display='';}
function clearDirty(id){const b=document.getElementById(id);if(b)b.style.display='none';}
async function addVocab(text){
  try{
    const words=[...new Set(normTxt(text).split(' ').filter(w=>w.length>=3))];
    if(!words.length)return;
    const {db,doc,setDoc,arrayUnion}=window._fb;
    for(let i=0;i<words.length;i+=40)await setDoc(doc(db,'config','vocab'),{words:arrayUnion(...words.slice(i,i+40))},{merge:true});
  }catch(e){console.warn('addVocab',e);}
}
async function addP(){
  if(savingProd)return;
  const d=readProdForm('f-');
  if(!validateProd(d))return;
  savingProd=true;
  const btn=document.getElementById('btn-add-prod');
  setBusy(btn,true,'Guardando...');
  try{
    const s=cropState['prod-new'];
    const imgData=(s&&s.src)?await cropToDataUrl(s):null;
    const pData={...d,tag:randomTag(),promo:false,dateAdded:new Date().toISOString(),img:imgData,kw:buildKw(d.name+' '+d.keywords)};
    const {db,doc,setDoc}=window._fb;
    await setDoc(doc(db,'products',newDocId()),pData);
    addVocab(d.name+' '+d.keywords);
    ['f-nm','f-px','f-desc','f-kwd'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    document.getElementById('f-av').value='1';
    if(cropState['prod-new']){cropState['prod-new']={src:null,zoom:1,dx:0,dy:0,dragging:false,startX:0,startY:0,onAccept:null};}
    const ci=document.getElementById('crop-img-prod-new');if(ci){ci.src='';ci.style.display='none';}
    const ca=document.getElementById('crop-accept-prod-new');if(ca)ca.style.display='none';
    const cr=document.getElementById('crop-range-prod-new');if(cr)cr.style.display='none';
    await refreshCatalog();
    toast('✔ Producto agregado. Visible para todos.');
  }catch(e){toast('⚠ Error guardando: '+e.message);}
  finally{savingProd=false;setBusy(btn,false);}
}
// ── ADMIN: VISTA DE UNA CATEGORÍA (explorar, importar fotos/carpeta, editar) ──
let cvCat=null,cvBusy=false;
const cvSel=new Set();
function cvOpen(i){
  const c=cats[i];if(!c)return;
  cvCat=c.id;cvSel.clear();
  document.getElementById('cv-title').textContent=c.label||'Categoría';
  document.getElementById('cv-status').textContent='';
  document.getElementById('cv-list').style.display='none';
  document.getElementById('cv').style.display='block';
  document.getElementById('cv-pl').innerHTML='<div style="padding:28px;text-align:center;color:rgba(255,255,255,.3);font-size:.72rem">Cargando...</div>';
  cvRefresh();
}
function cvClose(){
  cvCat=null;cvSel.clear();
  document.getElementById('cv').style.display='none';
  document.getElementById('cv-list').style.display='';
}
async function cvRefresh(){
  if(!cvCat)return;
  const key=cvCat,st=pgGet(key);
  if(!st.ids.length&&!st.done)await loadPage(key);
  await loadCount(key);
  if(cvCat===key)cvRender();
}
async function cvMore(){if(!cvCat)return;await loadPage(cvCat);cvRender();}
function cvTog(id,on){on?cvSel.add(String(id)):cvSel.delete(String(id));cvSelUpd();}
function cvSelUpd(){
  const n=cvSel.size;
  const b=document.getElementById('cv-bulk-del'),c=document.getElementById('cv-sel-n'),a=document.getElementById('cv-selall');
  if(c)c.textContent=n;if(b)b.style.display=n?'inline-flex':'none';
  if(a){const rows=document.querySelectorAll('#cv-pl .adm-chk');a.checked=rows.length>0&&n>=rows.length;}
}
function cvSelAll(on){
  document.querySelectorAll('#cv-pl .adm-chk').forEach(c=>{c.checked=on;on?cvSel.add(c.dataset.pid):cvSel.delete(c.dataset.pid);});
  cvSelUpd();
}
function cvRender(){
  const el=document.getElementById('cv-pl');
  if(!el||!cvCat)return;
  const st=pgGet(cvCat);
  const list=st.ids.map(findProd).filter(Boolean);
  const cnt=document.getElementById('cv-count');
  if(cnt){const t=st.total!==null?st.total:list.length;cnt.textContent=t+' producto'+(t===1?'':'s')+' en esta categoría';}
  if(!list.length){el.innerHTML='<div style="padding:28px;text-align:center;color:rgba(255,255,255,.2);font-size:.72rem;font-style:italic;letter-spacing:.06em">Esta categoría aún no tiene productos.</div>';cvSelUpd();return;}
  el.innerHTML=list.map(p=>{
    const pid=p._fbId||p.id;
    const act=isPromoActive(p);
    return`
    <div class="adm-table-row">
      <div class="atr-img"><input type="checkbox" class="adm-chk" data-pid="${pid}" ${cvSel.has(String(pid))?'checked':''} onchange="cvTog(this.dataset.pid,this.checked)" onclick="event.stopPropagation()">${p.img?`<img src="${p.img}">`:'📦'}</div>
      <div><div class="atr-name">${esc(p.name)}</div><div class="atr-type">${esc(catLabel(p.category))}</div></div>
      <div><div class="atr-price">${fmt(p.price)}</div>${act?`<div class="atr-size" style="color:#4caf50">PROMO (antes ${fmt(p.promoOld)})</div>`:(p.promo?`<div class="atr-size" style="color:#ffb74d">Promo vencida</div>`:'')}${p.tag?`<div class="atr-size">${esc(p.tag)}</div>`:''}</div>
      <div class="atr-size" style="${p.soldOut?'color:#ff6b6b':'color:#4caf50'}">${p.soldOut?'Agotado':'Disponible'}</div>
      <div class="atr-actions">
        <button class="xb gh" title="Marcar agotado / disponible" data-pid="${pid}" onclick="toggleSold(this.dataset.pid)">${p.soldOut?'✔':'⛔'}</button>
        <button class="xb gh" data-pid="${pid}" onclick="openEM(this.dataset.pid)">✎</button>
        <button class="xb d adm-del" title="Eliminar producto" data-pid="${pid}" onclick="delP(this.dataset.pid)">🗑 Eliminar</button>
      </div>
    </div>`;
  }).join('')+(st.done?'':`<div style="padding:16px;text-align:center"><button class="adm-ghost-btn" onclick="cvMore()">Cargar más productos</button></div>`);
  cvSelUpd();
}
async function cvDelSel(){
  const ids=[...cvSel];if(!ids.length)return;
  if(!confirm('¿Eliminar '+ids.length+' producto'+(ids.length>1?'s':'')+'? Esta acción no se puede deshacer.'))return;
  const b=document.getElementById('cv-bulk-del');if(b)b.disabled=true;
  try{
    const {db,doc,deleteDoc}=window._fb;
    for(let i=0;i<ids.length;i+=10)await Promise.all(ids.slice(i,i+10).map(id=>deleteDoc(doc(db,'products',id))));
    cart=cart.filter(x=>!cvSel.has(String(x.id)));svCt();updC();
    cvSel.clear();
    await refreshCatalog();
    toast('✔ '+ids.length+' producto'+(ids.length>1?'s eliminados':' eliminado'));
  }catch(e){toast('⚠ Error eliminando: '+e.message);}
  if(b)b.disabled=false;
}
function cvReadFile(f){return new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>res(null);r.readAsDataURL(f);});}
async function cvImport(inp){
  const all=[...inp.files];
  inp.value='';
  if(cvBusy||!cvCat)return;
  const files=all.filter(f=>(f.type||'').startsWith('image/')||/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name))
                 .sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  if(!files.length){toast('⚠ No encontré fotos para importar');return;}
  const catName=(cats.find(c=>c.id===cvCat)||{}).label||'esta categoría';
  if(!confirm('¿Importar '+files.length+' foto'+(files.length>1?'s':'')+' a «'+catName+'»?\nMantén esta pestaña abierta hasta que termine.'))return;
  cvBusy=true;
  const cat=cvCat;
  const bF=document.getElementById('cv-btn-files'),bD=document.getElementById('cv-btn-folder');
  bF.disabled=bD.disabled=true;
  const st=document.getElementById('cv-status');
  const {db,doc,setDoc}=window._fb;
  let ok=0,fail=0;
  files.reverse(); // así la primera foto queda de primera en la tienda
  for(let i=0;i<files.length;i++){
    st.textContent='Subiendo '+(i+1)+' de '+files.length+'...';
    try{
      const src=await cvReadFile(files[i]);
      const img=src?await cropToDataUrl({src,zoom:1,dx:0,dy:0}):null;
      if(!img)throw new Error('imagen no válida');
      const pData={name:'Producto nuevo',price:0,desc:'',soldOut:false,category:cat,keywords:'',tag:randomTag(),promo:false,dateAdded:new Date().toISOString(),img,kw:[]};
      await setDoc(doc(db,'products',newDocId()),pData);
      ok++;
      await new Promise(r=>setTimeout(r,3));
    }catch(e){fail++;console.warn('cvImport',files[i].name,e);}
  }
  try{await refreshCatalog();}catch(e){}
  st.textContent='Listo: '+ok+' subida'+(ok===1?'':'s')+(fail?', '+fail+' con error':'')+'. Ahora edita cada una (✎) para poner nombre y precio.';
  toast(fail?'⚠ '+ok+' subidas, '+fail+' con error':'✔ '+ok+' fotos importadas');
  bF.disabled=bD.disabled=false;
  cvBusy=false;
}

async function toggleSold(id){
  const p=findProd(id);if(!p)return;
  try{
    const {db,doc,updateDoc}=window._fb;
    await updateDoc(doc(db,'products',String(p._fbId)),{soldOut:!p.soldOut});
    p.soldOut=!p.soldOut;
    renderAPL();renderNuevo();renderTienda();if(typeof cvRender==="function")cvRender();
    toast(p.soldOut?'⛔ Marcado como agotado':'✔ Marcado como disponible');
  }catch(e){toast('⚠ Error: '+e.message);}
}

const TAGS=['Recomendado','Tendencia','Favorito','Buen precio','Popular','Lo mejor'];
function randomTag(){return TAGS[Math.floor(Math.random()*TAGS.length)];}

// ── selección múltiple para eliminar ──
const admSel=new Set();
function admSelUpd(){
  const n=admSel.size;
  const b=document.getElementById('adm-bulk-del'),c=document.getElementById('adm-sel-n'),a=document.getElementById('adm-selall');
  if(c)c.textContent=n;if(b)b.style.display=n?'inline-flex':'none';
  if(a){const rows=document.querySelectorAll('#adm-pl .adm-chk');a.checked=rows.length>0&&n>=rows.length;}
}
function admTog(id,on){on?admSel.add(String(id)):admSel.delete(String(id));admSelUpd();}
function admSelAll(on){
  document.querySelectorAll('#adm-pl .adm-chk').forEach(c=>{c.checked=on;on?admSel.add(c.dataset.pid):admSel.delete(c.dataset.pid);});
  admSelUpd();
}
async function delSelected(){
  const ids=[...admSel];if(!ids.length)return;
  if(!confirm('¿Eliminar '+ids.length+' producto'+(ids.length>1?'s':'')+'? Esta acción no se puede deshacer.'))return;
  const b=document.getElementById('adm-bulk-del');if(b)b.disabled=true;
  try{
    const {db,doc,deleteDoc}=window._fb;
    for(let i=0;i<ids.length;i+=10)await Promise.all(ids.slice(i,i+10).map(id=>deleteDoc(doc(db,'products',id))));
    cart=cart.filter(x=>!admSel.has(String(x.id)));svCt();updC();
    admSel.clear();
    await refreshCatalog();
    admSelUpd();
    toast('✔ '+ids.length+' producto'+(ids.length>1?'s eliminados':' eliminado'));
  }catch(e){toast('⚠ Error eliminando: '+e.message);}
  if(b)b.disabled=false;
}
async function delP(id){
  const p=findProd(id);
  if(!confirm('¿Seguro que quieres eliminar este producto?'))return;
  try{
    const {db,doc,deleteDoc}=window._fb;
    await deleteDoc(doc(db,'products',String(p&&p._fbId?p._fbId:id)));
    cart=cart.filter(x=>x.id!==(p&&p._fbId?p._fbId:id));svCt();updC();
    await refreshCatalog();
    admSel.delete(String(id));admSelUpd();
    toast('✔ Producto eliminado');
  }catch(e){toast('⚠ Error eliminando: '+e.message);}
}

function openEM(id){
  const p=findProd(id);if(!p)return;
  const set=(k,v)=>{document.getElementById(k).value=v;};
  set('e-id',p._fbId||p.id);
  set('e-nm',p.name);
  set('e-px',p.price);
  set('e-desc',p.desc||'');
  set('e-av',p.soldOut?'0':'1');
  set('e-ct',p.category||'');
  set('e-kwd',p.keywords||'');
  clearDirty('btn-save-em');
  const key='prod-edit';
  if(p.img){
    if(!cropState[key])cropState[key]={src:null,zoom:1,dx:0,dy:0,dragging:false,startX:0,startY:0};
    cropState[key].src=p.img;
    const ci=document.getElementById(`crop-img-${key}`);
    if(ci){ci.src=p.img;ci.style.display='block';}
    const ph=document.querySelector(`#crop-prev-${key} .cb-ph`);if(ph)ph.style.display='none';
    const rg=document.getElementById(`crop-range-${key}`);if(rg)rg.style.display='block';
  }
  document.getElementById('em').style.display='flex';
}
function closeEM(){document.getElementById('em').style.display='none';}
async function saveEM(){
  if(savingEM)return;
  const fbId=document.getElementById('e-id').value;
  const p=findProd(fbId);if(!p)return;
  const d=readProdForm('e-');
  if(!validateProd(d))return;
  savingEM=true;
  const btn=document.getElementById('btn-save-em');
  setBusy(btn,true,'Guardando...');
  try{
    const updates={...d,kw:buildKw(d.name+' '+d.keywords)};
    const s=cropState['prod-edit'];
    if(s&&s.src&&s.src!==p.img){updates.img=await cropToDataUrl(s);}
    const {db,doc,updateDoc}=window._fb;
    await updateDoc(doc(db,'products',String(p._fbId||fbId)),updates);
    addVocab(d.name+' '+d.keywords);
    clearDirty('btn-save-em');
    closeEM();
    await refreshCatalog();
    toast('✔ Producto actualizado');
  }catch(e){toast('⚠ Error actualizando: '+e.message);}
  finally{savingEM=false;setBusy(btn,false);clearDirty('btn-save-em');}
}

async function admSearch(){
  const toks=normTxt(document.getElementById('adm-srch').value).split(' ').filter(Boolean);
  if(!toks.length){admQ='';admIds=[];renderAPL();return;}
  admQ=toks.join(' ');admIds=[];
  const main=[...toks].sort((a,b)=>b.length-a.length)[0].slice(0,20);
  try{
    const {db,collection,getDocs,query,where,limit}=window._fb;
    const snap=await getDocs(query(collection(db,'products'),where('kw','array-contains',main),limit(60)));
    snap.forEach(d=>{const p=ingestProd(d);if(toks.every(t=>normTxt(p.name).includes(t)))admIds.push(p._fbId);});
  }catch(e){toast('⚠ No se pudo buscar: '+e.message);}
  renderAPL();
}
async function admMore(){await loadPage('__all');renderAPL();}

function renderAPL(){
  const el=document.getElementById('adm-pl');
  if(!el)return;
  const st=pgGet('__all');
  const ids=admQ?admIds:st.ids;
  const list=ids.map(findProd).filter(Boolean);
  if(!list.length){el.innerHTML='<div style="padding:28px;text-align:center;color:rgba(255,255,255,.2);font-size:.72rem;font-style:italic;letter-spacing:.06em">'+(admQ?'Sin resultados.':'Aún no hay productos.')+'</div>';return;}
  el.innerHTML=list.map(p=>{
    const pid=p._fbId||p.id;
    const act=isPromoActive(p);
    return`
    <div class="adm-table-row">
      <div class="atr-img"><input type="checkbox" class="adm-chk" data-pid="${pid}" ${admSel.has(String(pid))?'checked':''} onchange="admTog(this.dataset.pid,this.checked)" onclick="event.stopPropagation()">${p.img?`<img src="${p.img}">`:'📦'}</div>
      <div><div class="atr-name">${esc(p.name)}</div><div class="atr-type">${esc(catLabel(p.category))}</div></div>
      <div><div class="atr-price">${fmt(p.price)}</div>${act?`<div class="atr-size" style="color:#4caf50">PROMO (antes ${fmt(p.promoOld)})</div>`:(p.promo?`<div class="atr-size" style="color:#ffb74d">Promo vencida</div>`:'')}${p.tag?`<div class="atr-size">${esc(p.tag)}</div>`:''}</div>
      <div class="atr-size" style="${p.soldOut?'color:#ff6b6b':'color:#4caf50'}">${p.soldOut?'Agotado':'Disponible'}</div>
      <div class="atr-actions">
        <button class="xb gh" title="Marcar agotado / disponible" data-pid="${pid}" onclick="toggleSold(this.dataset.pid)">${p.soldOut?'✔':'⛔'}</button>
        <button class="xb gh" data-pid="${pid}" onclick="openEM(this.dataset.pid)">✎</button>
        <button class="xb d adm-del" title="Eliminar producto" data-pid="${pid}" onclick="delP(this.dataset.pid)">🗑 Eliminar</button>
      </div>
    </div>`;
  }).join('')+((admQ||st.done)?'':`<div style="padding:16px;text-align:center"><button class="adm-ghost-btn" onclick="admMore()">Cargar más productos</button></div>`);
  admSelUpd();
}

// ── ADMIN: CATEGORÍAS ──
function renderCE(){
  const el=document.getElementById('cat-ed');
  el.innerHTML=cats.map((c,i)=>{
    const zoom=c.imgZoom||1;
    const dx=c.imgDx||0;
    const dy=c.imgDy||0;
    return`
    <div class="ce-item${c.img?' has-img':''}">
      <button class="ce-del" onclick="delCat(${i})">✕</button>
      <div id="ce-drag-${i}" class="ce-img" style="overflow:hidden;${c.img?'cursor:grab;touch-action:none':''}">
        ${c.img
          ?`<img id="ce-prev-${i}" src="${c.img}" style="width:100%;height:100%;object-fit:cover;transform-origin:center center;transform:scale(${zoom}) translate(${dx/zoom}px,${dy/zoom}px);pointer-events:none">`
          :`<svg viewBox="0 0 100 140">${mkCSVG(c.id)}</svg>`
        }
        <input type="file" id="ce-img-inp-${i}" accept="image/*" style="display:${c.img?'none':'block'};position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%" onchange="catImgNew(${i},event)">
      </div>
      ${c.img?`
      <p class="ce-img-label" style="font-size:.42rem;color:rgba(255,255,255,.35)">☝ Arrastra · Toca 2× para cambiar</p>
      <div class="ce-adj">
        <span class="ce-adj-lbl">Zoom</span>
        <input type="range" min="0.5" max="3" step="0.05" value="${zoom}"
          oninput="cats[${i}].imgZoom=+this.value;ceDragApply(${i})">
      </div>
      <button style="font-size:.48rem;letter-spacing:.1em;color:rgba(255,255,255,.3);background:none;border:none;cursor:pointer;text-transform:uppercase;margin-top:2px" onclick="document.getElementById('ce-img-inp-${i}-rep').click()">📁 Cambiar imagen</button>
      <input type="file" id="ce-img-inp-${i}-rep" accept="image/*" style="display:none" onchange="catImgNew(${i},event)">
      `:`<p class="ce-img-label">Toca para agregar</p>`}
      <input class="ce-n" value="${c.label}" onchange="cats[${i}].label=this.value">
      <button class="adm-ghost-btn" style="margin-top:8px;width:100%;padding:8px 6px;font-size:.55rem" onclick="cvOpen(${i})">📂 Ver productos</button>
    </div>`;
  }).join('');
  // Bind drag after render
  cats.forEach((_,i)=>{ if(cats[i].img) setTimeout(()=>ceBindDrag(i),0); });
}
function updateCEPreview(i,reRenderPos){
  const img=document.getElementById(`ce-prev-${i}`);
  if(!img)return;
  const zoom=cats[i].imgZoom||1;
  const pos=cats[i].imgPos||'center center';
  img.style.transform=`scale(${zoom})`;
  img.style.objectPosition=pos;
  if(reRenderPos)renderCE();
}

// Category drag state
const ceDrag={};

function ceDragStart(i,cx,cy){
  ceDrag[i]={dragging:true,startX:cx-(cats[i].imgDx||0),startY:cy-(cats[i].imgDy||0)};
}
function ceDragMove(i,cx,cy){
  if(!ceDrag[i]||!ceDrag[i].dragging)return;
  cats[i].imgDx=(cx-ceDrag[i].startX);
  cats[i].imgDy=(cy-ceDrag[i].startY);
  ceDragApply(i);
}
function ceDragEnd(i){if(ceDrag[i])ceDrag[i].dragging=false;}
function ceDragApply(i){
  const img=document.getElementById(`ce-prev-${i}`);
  if(!img)return;
  const zoom=cats[i].imgZoom||1;
  const dx=cats[i].imgDx||0;
  const dy=cats[i].imgDy||0;
  img.style.transform=`scale(${zoom}) translate(${dx/zoom}px,${dy/zoom}px)`;
  img.style.objectPosition='center center';
}
function ceBindDrag(i){
  const el=document.getElementById(`ce-drag-${i}`);
  if(!el||el.dataset.bound)return;
  el.dataset.bound='1';
  el.style.cursor='grab';
  el.addEventListener('mousedown',e=>{ceDragStart(i,e.clientX,e.clientY);el.style.cursor='grabbing';e.preventDefault();});
  document.addEventListener('mousemove',e=>{ceDragMove(i,e.clientX,e.clientY);});
  document.addEventListener('mouseup',()=>{ceDragEnd(i);el.style.cursor='grab';});
  el.addEventListener('touchstart',e=>{const t=e.touches[0];ceDragStart(i,t.clientX,t.clientY);e.preventDefault();},{passive:false});
  el.addEventListener('touchmove',e=>{const t=e.touches[0];ceDragMove(i,t.clientX,t.clientY);e.preventDefault();},{passive:false});
  el.addEventListener('touchend',()=>ceDragEnd(i));
}
// ── Compress image to target size before storing ──
function compressImg(src, maxW, maxH, quality, cb){
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    let w = img.naturalWidth, h = img.naturalHeight;
    // Scale down to fit within maxW x maxH keeping aspect ratio
    const ratio = Math.min(maxW/w, maxH/h, 1);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    cb(canvas.toDataURL('image/jpeg', quality));
  };
  img.src = src;
}

function catImgNew(i,event){
  const file=event.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=e=>{
    // Compress: max 400x533px (exact 3:4 ratio matching page display), quality 0.75
    compressImg(e.target.result, 400, 534, 0.75, compressed=>{
      cats[i].img=compressed;
      cats[i].imgZoom=cats[i].imgZoom||1;
      cats[i].imgDx=0;
      cats[i].imgDy=0;
      renderCE();markDirty('btn-save-cats');
    });
  };
  r.readAsDataURL(file);
}
function addCat(){cats.push({id:'cat-'+Date.now(),label:'Nueva categoría',img:null,imgZoom:1,imgPos:'center center'});renderCE();markDirty('btn-save-cats');}
function delCat(i){if(!confirm('¿Eliminar esta categoría?'))return;cats.splice(i,1);renderCE();markDirty('btn-save-cats');}
async function _saveCatsRaw(){
  toast('⏳ Guardando categorías...');
  for(let i=0;i<cats.length;i++){
    const c=cats[i];
    if(c.img && c.img.startsWith('data:')){
      try{
        cats[i].img = await window._compressCat(c.img);
      }catch(e){ console.warn('cat compress error:',e); }
    }
    c.imgDx=c.imgDx||0; c.imgDy=c.imgDy||0; c.imgZoom=c.imgZoom||1;
  }
  await svC();
  renderCatHighlights(); renderTienda(); popSels();
  toast('✔ Categorías guardadas. Todos las verán.');
}

// ── ADMIN: CONFIG ──
function loadCfgFields(){
  const wa=site.wa||'';
  document.getElementById('cfg-wa').value=wa;
  document.getElementById('cfg-ig').value=site.ig||'';
  document.getElementById('cfg-fb').value=site.fb||'';
  document.getElementById('cfg-tk').value=site.tk||'';
}
async function _saveCfgRaw(){
  site.wa=(document.getElementById('cfg-wa').value.trim()||'').replace(/[^0-9]/g,'');
  site.ig=document.getElementById('cfg-ig').value.trim();
  site.fb=document.getElementById('cfg-fb').value.trim();
  site.tk=document.getElementById('cfg-tk').value.trim();
  await svS();
  // Apply locally too
  const wa=site.wa;
  const waFloat=document.getElementById('wa-float');if(waFloat)waFloat.href=`https://wa.me/${wa}`;document.querySelectorAll('[data-wa]').forEach(e=>{e.href=wa?`https://wa.me/${wa}`:'#';});
  if(site.ig){const el=document.getElementById('social-ig');if(el)el.href=site.ig;}
  if(site.fb){const el=document.getElementById('social-fb');if(el)el.href=site.fb;}
  if(site.tk){const el=document.getElementById('social-tk');if(el)el.href=site.tk;}
  if(site.ig){const el=document.getElementById('slide-ig');if(el)el.href=site.ig;}
  if(site.fb){const el=document.getElementById('slide-fb');if(el)el.href=site.fb;}
  if(site.tk){const el=document.getElementById('slide-tk');if(el)el.href=site.tk;}
  if(site.wa){const el=document.getElementById('slide-wa');if(el)el.href=`https://wa.me/${site.wa}`;}
  if(site.h1){const el=document.getElementById('hero-h1');if(el)el.innerHTML=site.h1.split('\n').join('<br>');}
  if(site.sub){const el=document.getElementById('hero-sub');if(el)el.innerHTML=site.sub.split('\n').join('<br>');}
  toast('✔ Configuración guardada. Todos los visitantes la verán.');
}

// ── SLIDES ──
function applySlide(i,src,pos){
  const bg=document.getElementById(`slide-bg-${i}`);
  const ph=document.getElementById(`hero-ph-${i}`);
  if(bg&&src){bg.style.backgroundImage=`url(${src})`;bg.style.backgroundSize='cover';bg.style.backgroundPosition=pos||'center';}
  if(ph&&src)ph.style.display='none';
}

// ── POPULATING SELECTS ──
function popSels(){
  const o=cats.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
  ['f-ct','e-ct'].forEach(id=>{const s=document.getElementById(id);if(s)s.innerHTML=o;});
}

// ── SUBSCRIBE ──
function subscribeEmail(){const v=document.getElementById('foot-email').value.trim();if(!v||!v.includes('@')){toast('⚠ Ingresa un correo válido');return;}toast('✔ ¡Gracias! Te mantendremos informada.');document.getElementById('foot-email').value='';}


// ── UTILIDADES ──
function fmt(n){return'$ '+n.toLocaleString('es-CO')}
function toast(msg){const t=document.getElementById('toast');if(!t)return;t.textContent=msg;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2500);}


// ── RESEÑAS ──
const DR=[];
let reviews = [];
// svR now handled by Firebase — individual operations write directly

let resStarSel = 5;
function initResStars(){
  const stars = document.querySelectorAll('#res-star-pick span');
  stars.forEach((s,i)=>{
    s.classList.toggle('on', i<resStarSel);
    s.addEventListener('mouseover',()=>stars.forEach((x,j)=>x.classList.toggle('on',j<=i)));
    s.addEventListener('mouseout',()=>stars.forEach((x,j)=>x.classList.toggle('on',j<resStarSel)));
    s.addEventListener('click',()=>{resStarSel=+s.dataset.v;stars.forEach((x,j)=>x.classList.toggle('on',j<resStarSel));});
  });
}

function starsHTML(n){return'★'.repeat(n)+'☆'.repeat(5-n);}

function fmtDate(d){
  try{
    const dt=new Date(d);
    return dt.toLocaleDateString('es-CO',{year:'numeric',month:'short',day:'numeric'});
  }catch(e){return d;}
}

function renderResenas(){
  const el=document.getElementById('res-grid');
  if(!el)return;
  const approved=reviews.filter(r=>r.approved);
  if(!approved.length){
    el.innerHTML='<p style="text-align:center;color:var(--textd);font-style:italic;font-size:.8rem;grid-column:1/-1;padding:24px 0">Sé la primera en comentar.</p>';
    return;
  }
  el.innerHTML=approved.map(r=>`
    <div class="res-card">
      <div class="res-card-stars">${starsHTML(r.stars)}</div>
      <p class="res-card-msg">${r.msg}</p>
      <div class="res-card-footer">
        <div>
          <div class="res-card-name">${r.name}</div>
          <div class="res-verified">✔ Compra verificada</div>
        </div>
        <span class="res-card-date">${fmtDate(r.date)}</span>
      </div>
    </div>`).join('');
}

function renderAdmRes(){
  const el=document.getElementById('adm-res-list');
  if(!el)return;
  if(!reviews.length){el.innerHTML='<p style="font-size:.66rem;color:rgba(255,255,255,.2);text-align:center;padding:28px;font-style:italic">No hay reseñas aún.</p>';return;}
  el.innerHTML=reviews.map(r=>`
    <div class="res-adm-row">
      <div class="res-adm-body">
        <div class="res-adm-name">${r.name} ${r.approved?'<span style="color:#2d9c5f;font-size:.55rem">✔ Aprobada</span>':'<span style="color:var(--accent);font-size:.55rem">⏳ Pendiente</span>'}</div>
        <div class="res-adm-stars">${starsHTML(r.stars)}</div>
        <div class="res-adm-msg">"${r.msg}"</div>
        <div class="res-adm-date">${fmtDate(r.date)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:7px;flex-shrink:0">
        ${!r.approved?`<button class="res-adm-del" style="background:rgba(45,156,95,.12);border-color:rgba(45,156,95,.3);color:#2d9c5f" onclick="approveRes('${r.id}')">✔ Aprobar</button>`:''}
        <button class="res-adm-del" onclick="deleteRes('${r.id}')">✕ Eliminar</button>
      </div>
    </div>`).join('');
}

async function approveRes(id){
  try{
    const {db, doc, updateDoc} = window._fb;
    await updateDoc(doc(db,'reviews', String(id)), {approved:true});
    toast('✔ Reseña aprobada');
  }catch(e){ toast('⚠ Error: '+e.message); }
}
async function deleteRes(id){
  if(!confirm('¿Eliminar esta reseña?'))return;
  try{
    const {db, doc, deleteDoc} = window._fb;
    await deleteDoc(doc(db,'reviews', String(id)));
    toast('✔ Reseña eliminada');
  }catch(e){ toast('⚠ Error: '+e.message); }
}
async function submitRes(){
  const name=document.getElementById('res-inp-name').value.trim();
  const msg=document.getElementById('res-inp-msg').value.trim();
  if(!name){toast('⚠ Ingresa tu nombre');return;}
  if(msg.length<10){toast('⚠ El comentario es muy corto');return;}
  const r={name,date:new Date().toISOString().slice(0,10),stars:resStarSel,msg,approved:false};
  try{
    const {db, collection, addDoc} = window._fb;
    await addDoc(collection(db,'reviews'), r);
    document.getElementById('res-inp-name').value='';
    document.getElementById('res-inp-msg').value='';
    resStarSel=5;
    document.querySelectorAll('#res-star-pick span').forEach((s,j)=>s.classList.toggle('on',j<5));
    toast('✔ ¡Gracias! Tu reseña será publicada pronto.');
  }catch(e){ toast('⚠ Error enviando reseña: '+e.message); }
}

// ── INIT ── (Firebase module handles data loading & real-time listeners)
// These run immediately for UI that doesn't need Firebase data
updC();
initResStars();
if(document.getElementById('nuevo-scroll'))
  document.getElementById('nuevo-scroll').addEventListener('scroll',updNA);



// ── PANEL: guardar con bloqueo y solo cuando hay cambios ──
async function saveCats(){
  if(savingCats)return;savingCats=true;
  const btn=document.getElementById('btn-save-cats');setBusy(btn,true,'Guardando...');
  try{await _saveCatsRaw();clearDirty('btn-save-cats');}
  catch(e){toast('⚠ Error guardando: '+e.message);}
  finally{savingCats=false;setBusy(btn,false);clearDirty('btn-save-cats');}
}
async function saveCfg(){
  if(savingCfg)return;savingCfg=true;
  const btn=document.getElementById('btn-save-cfg');setBusy(btn,true,'Guardando...');
  try{await _saveCfgRaw();clearDirty('btn-save-cfg');}
  catch(e){toast('⚠ Error guardando: '+e.message);}
  finally{savingCfg=false;setBusy(btn,false);clearDirty('btn-save-cfg');}
}
['input','change'].forEach(ev=>document.addEventListener(ev,e=>{
  const t=e.target;if(!t||!t.closest)return;
  if(t.closest('#tab-cfg'))markDirty('btn-save-cfg');
  if(t.closest('#tab-cats'))markDirty('btn-save-cats');
  if(t.closest('#em .em-body'))markDirty('btn-save-em');
}));
document.addEventListener('pointerup',e=>{const t=e.target;if(t&&t.closest&&t.closest('#em [id*="crop"]'))markDirty('btn-save-em');});

/* Header: se oculta al bajar y aparece apenas se sube un poco */
(function(){
  const nav=document.getElementById('nav');if(!nav)return;
  let last=window.scrollY,ticking=false;
  function update(){
    const y=window.scrollY,d=y-last;
    if(y<80){nav.classList.remove('nav-hidden');}
    else if(d>6){nav.classList.add('nav-hidden');}
    else if(d<-6){nav.classList.remove('nav-hidden');}
    if(Math.abs(d)>6||y<80)last=y;
    ticking=false;
  }
  window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(update);}},{passive:true});
})();
