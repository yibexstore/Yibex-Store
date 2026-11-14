
// ── DATA ── (Firebase-powered, no localStorage for admin data)
const AH='49c96d47e8609b95fb2dc580bb1947e3a288a3a8208c76fecb62e707451ccf32';
const OW=7*24*60*60*1000;
const dAgo=n=>new Date(Date.now()-n*864e5).toISOString();

const DC=[
  {id:'skinny',label:'Skinny',img:null},
  {id:'wide-leg',label:'Wide Leg',img:null},
  {id:'mom-fit',label:'Mom Fit',img:null},
  {id:'flare',label:'Flare',img:null},
];

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
  const l=(label||'').toLowerCase();
  if(l.includes('falda')||l.includes('skirt'))
    return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg"><path d="M30 10 Q50 8 70 10 L85 130 Q50 140 15 130 Z" fill="currentColor" opacity=".85"/><rect x="28" y="5" width="44" height="10" rx="3" fill="currentColor"/></svg>`;
  if(l.includes('cargo'))
    return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg"><path d="M25 10 L30 80 L10 130 L45 135 L50 80 L55 80 L60 135 L90 130 L70 80 L75 10 Z" fill="currentColor" opacity=".85"/><rect x="10" y="55" width="28" height="20" rx="3" fill="currentColor" opacity=".6"/><rect x="62" y="55" width="28" height="20" rx="3" fill="currentColor" opacity=".6"/><rect x="24" y="5" width="52" height="9" rx="3" fill="currentColor"/></svg>`;
  if(l.includes('short')||l.includes('bermuda'))
    return `<svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg"><path d="M20 10 L25 80 L48 80 L50 45 L52 80 L75 80 L80 10 Z" fill="currentColor" opacity=".85"/><rect x="19" y="5" width="62" height="9" rx="3" fill="currentColor"/></svg>`;
  if(l.includes('todo')||l.includes('all'))
    return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg"><path d="M28 12 L32 90 L12 135 L48 138 L50 90 L52 90 L52 138 L88 135 L68 90 L72 12 Z" fill="currentColor" opacity=".85"/><rect x="26" y="5" width="48" height="10" rx="3" fill="currentColor"/></svg>`;
  // default jean
  return `<svg viewBox="0 0 100 140" xmlns="http://www.w3.org/2000/svg"><path d="M28 12 L32 90 L12 135 L48 138 L50 90 L52 90 L52 138 L88 135 L68 90 L72 12 Z" fill="currentColor" opacity=".85"/><rect x="26" y="5" width="48" height="10" rx="3" fill="currentColor"/></svg>`;
}

function renderCatHighlights(){
  const row=document.getElementById('col-cats-row');
  if(!row)return;
  const toShow=cats;
  row.innerHTML=toShow.map(c=>`
    <div class="col-cat-item" onclick="scrollToTiendaCat('${c.id}')">
      <div class="col-cat-icon" style="color:var(--gold)">
        ${c.img
          ? `<img src="${c.img}" alt="${c.label}" style="width:100%;height:100%;object-fit:cover;object-position:center center;transform:scale(${c.imgZoom||1}) translate(${(c.imgDx||0)/(c.imgZoom||1)}px,${(c.imgDy||0)/(c.imgZoom||1)}px);transform-origin:center center;pointer-events:none">`
          : getCatSVG(c.label)
        }
      </div>
      <span class="col-cat-name">${c.label}</span>
    </div>`).join('');
}
function scrollToTiendaCat(id){
  setTiendaTab(id);
  document.getElementById('tienda').scrollIntoView({behavior:'smooth'});
}

const NEW_TTL = 3*24*60*60*1000; // 3 días para etiqueta "Nuevo"

function renderNuevo(){
  const now = Date.now();
  // Productos genuinamente nuevos (menos de 3 días)
  const genuineNew = prods.filter(p => now - new Date(p.dateAdded).getTime() < NEW_TTL);
  const sec = document.getElementById('nuevo');
  if(!sec) return;

  let toShow = genuineNew;

  if(!toShow.length){
    // Fallback: mostrar últimos 4 rotando cada 12h
    const sorted = [...prods].sort((a,b)=>new Date(b.dateAdded)-new Date(a.dateAdded));
    const base4 = sorted.slice(0,4);
    // Rotación: cada 12h mezclar con seed de tiempo
    const rotSeed = Math.floor(now / (12*60*60*1000));
    const shuffled = shuffleSeed([...prods], rotSeed);
    // Mezclar base4 con aleatorios sin repetir, máximo 4
    const fallbackIds = new Set(base4.map(p=>p.id));
    shuffled.forEach(p=>{ if(fallbackIds.size<4) fallbackIds.add(p.id); });
    toShow = prods.filter(p=>fallbackIds.has(p.id));
  }

  if(!toShow.length){ sec.style.display='none'; return; }
  sec.style.display = 'block';
  document.getElementById('nuevo-scroll').innerHTML = toShow.map(p=>mkCard(p, false)).join('');
  updNA();
}

function shuffleSeed(arr, seed){
  let s = seed;
  for(let i=arr.length-1;i>0;i--){
    s = (s*1664525+1013904223)&0xffffffff;
    const j = Math.abs(s) % (i+1);
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}
function scrollN(d){const s=document.getElementById('nuevo-scroll');s.scrollBy({left:d*250,behavior:'smooth'});setTimeout(updNA,360);}
function updNA(){const s=document.getElementById('nuevo-scroll');document.getElementById('nL').style.display=s.scrollLeft>10?'flex':'none';document.getElementById('nR').style.display=s.scrollLeft+s.clientWidth<s.scrollWidth-10?'flex':'none';}

// ── TIENDA TABS ──
let acT='todo';
let filt={cat:[],pMin:null,pMax:null};

function renderTienda(){
  const tb=document.getElementById('tienda-tabs');
  tb.innerHTML=[{id:'todo',label:'Todos'},...cats].map(c=>
    `<button class="ttab ${acT===c.id?'on':''}" onclick="setTiendaTab('${c.id}',this)">${c.label}</button>`
  ).join('');
  const bl=document.getElementById('tienda-blocks');
  const catsShow=acT==='todo'?cats:[...cats.filter(c=>c.id===acT)];
  bl.innerHTML=catsShow.map(c=>{
    const items=prods.filter(p=>p.category===c.id&&applyFilt(p));
    const cnt=items.length;
    return`<div class="tienda-block vis">
      <div class="tienda-block-hdr">
        <h3>${c.label}</h3>
        <span>${cnt} prenda${cnt!==1?'s':''}</span>
      </div>
      <div class="col-prod-grid">${cnt?items.map(mkCard).join(''):`<p class="empty-cat">Próximamente en esta categoría...</p>`}</div>
    </div>`;
  }).join('');
  if(acT==='todo'){
    const covIds=cats.map(c=>c.id);
    const unc=prods.filter(p=>!covIds.includes(p.category)&&applyFilt(p));
    if(unc.length)bl.innerHTML+=`<div class="tienda-block vis"><div class="tienda-block-hdr"><h3>Otros</h3><span>${unc.length} prendas</span></div><div class="col-prod-grid">${unc.map(mkCard).join('')}</div></div>`;
  }
}
function setTiendaTab(id,btn){
  acT=id;
  document.querySelectorAll('.ttab').forEach(t=>t.classList.remove('on'));
  if(btn)btn.classList.add('on');
  else{const b=document.querySelector(`.ttab[onclick*="${id}"]`);if(b)b.classList.add('on');}
  renderTienda();
}
function applyFilt(p){
  if(filt.cat&&filt.cat.length&&!filt.cat.includes(p.category))return false;
  if(filt.pMin!==null&&filt.pMin!==undefined&&p.price<filt.pMin)return false;
  if(filt.pMax!==null&&filt.pMax!==undefined&&p.price>filt.pMax)return false;
  return true;
}

// ── ÚLTIMAS UNIDADES: rotación cada 6h ──
function getHotIds(){
  if(!prods || !prods.length) return new Set();
  const key='rds4_hot';
  const seed6h = Math.floor(Date.now()/(6*60*60*1000));
  let stored = null;
  try{ stored=JSON.parse(localStorage.getItem(key)); }catch(e){}
  if(stored && stored.seed===seed6h) return new Set(stored.ids);
  const shuffled = shuffleSeed([...prods], seed6h);
  const ids = shuffled.slice(0,6).map(p=>p._fbId||p.id);
  localStorage.setItem(key, JSON.stringify({seed:seed6h, ids}));
  return new Set(ids);
}

// ── PRODUCT CARD ──
function pSVG(p){
  const ch={'negro':'#1C1C1E','azul oscuro':'#1B3A6B','azul claro':'#4a6fa5','gris claro':'#6a7888','cafe':'#8B7355','verde':'#2D6A4F'};
  const c=ch[p.color]||'#2a2a3a';
  const tp=p.type;
  if(tp==='falda short')return`<path d="M60 40L140 40L162 210L38 210Z" fill="${c}" opacity=".55"/><rect x="55" y="30" width="90" height="13" rx="3" fill="${c}" opacity=".8"/>`;
  if(tp==='shorts'||tp==='bermuda')return`<path d="M38 28L162 28L152 145L112 145L100 108L88 145L48 145Z" fill="${c}" opacity=".55"/><rect x="33" y="18" width="134" height="13" rx="3" fill="${c}" opacity=".8"/>`;
  if(tp==='flare')return`<path d="M50 25L150 25L170 265L130 265L100 175L70 265L30 265Z" fill="${c}" opacity=".55"/><rect x="45" y="15" width="110" height="13" rx="3" fill="${c}" opacity=".8"/>`;
  if(tp==='skinny')return`<path d="M60 25L140 25L128 265L112 265L100 175L88 265L72 265Z" fill="${c}" opacity=".55"/><rect x="55" y="15" width="90" height="13" rx="3" fill="${c}" opacity=".8"/>`;
  const cg=(tp==='jean cargo')?`<rect x="50" y="122" width="30" height="34" rx="2" fill="${c}" stroke="rgba(255,255,255,.1)" stroke-width="1.5"/><rect x="120" y="122" width="30" height="34" rx="2" fill="${c}" stroke="rgba(255,255,255,.1)" stroke-width="1.5"/>`:'' ;
  return`<path d="M38 25L162 25L152 265L112 265L100 175L88 265L48 265Z" fill="${c}" opacity=".55"/><rect x="33" y="15" width="134" height="13" rx="3" fill="${c}" opacity=".8"/>${cg}`;
}
function mkCard(p, allowHot=true){
  const now=Date.now();
  const iN=now-new Date(p.dateAdded).getTime()<NEW_TTL;
  const hotIds=allowHot?getHotIds():new Set();
  const isHot=allowHot&&!iN&&hotIds.has(p._fbId||p.id);
  const sc=p.imgScale||1;const po=p.imgPos||'center center';
  const ih=p.img?`<img src="${p.img}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;object-position:${po};transform:scale(${sc});transform-origin:${po}">`:`<svg viewBox="0 0 200 300" fill="none">${pSVG(p)}</svg>`;
  const sizeTxt=p.sizeFrom&&p.sizeTo?`${p.sizeFrom} – ${p.sizeTo}`:(p.size||'');
  const pricesHTML=p.priceM
    ?`<div class="pc-prices">
        <div class="pc-price-col"><span class="pc-price-col-label">Precio detal</span><span class="pc-price-detal">${fmt(p.price)}</span></div>
        <div class="pc-price-divider"></div>
        <div class="pc-price-col"><span class="pc-price-col-label">Mayoristas</span><span class="pc-price-mayor-val">${fmt(p.priceM)}</span></div>
      </div>`
    :`<div class="pc-prices">
        <div class="pc-price-col"><span class="pc-price-col-label">Precio detal</span><span class="pc-price-detal">${fmt(p.price)}</span></div>
      </div>`;
  const pid = JSON.stringify(p._fbId||p.id);
  const ci=cart.find(x=>x.id===(p._fbId||p.id));
  return`<div class="pc" onclick='openM(${pid})'>
    <div class="pc-img">
      ${ih}
      ${iN?'<span class="pc-new">Nuevo</span>':''}
      ${isHot?`<span class="pc-hot${iN?' pc-hot-new':''}">🔥 Últimas unidades</span>`:''}
      <button class="pc-heart" onclick="event.stopPropagation();this.classList.toggle('liked')">♡</button>
    </div>
    <div class="pc-body">
      <div class="pc-name">${p.name}</div>
      ${pricesHTML}
      ${sizeTxt?`<div class="pc-sizes"><svg class="pc-sizes-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gold);flex-shrink:0"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Tallas disponibles: ${sizeTxt}</div>`:''}
      ${ci
        ?`<div class="pc-qty-ctrl" onclick="event.stopPropagation()">
            <button class="pc-qty-btn" onclick='event.stopPropagation();qtyCart(${pid},-1)'>−</button>
            <span class="pc-qty-num">${ci.qty}</span>
            <button class="pc-qty-btn" onclick='event.stopPropagation();qtyCart(${pid},1)'>+</button>
          </div>`
        :`<button class="pc-add" onclick='event.stopPropagation();addCart(${pid})'>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            Agregar al carrito
          </button>`}
      <button class="pc-buy-now" onclick='event.stopPropagation();pedirAhora(${pid})'>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        Pedir ahora
      </button>
    </div>
  </div>`;
}
function mkCSVG(id){
  if(id==='flare')return`<path d="M50 25L150 25L170 265L130 265L100 175L70 265L30 265Z" fill="rgba(201,168,76,.25)"/><rect x="45" y="15" width="110" height="12" rx="3" fill="rgba(201,168,76,.4)"/>`;
  if(id==='skinny')return`<path d="M60 25L140 25L128 265L112 265L100 175L88 265L72 265Z" fill="rgba(201,168,76,.25)"/><rect x="55" y="15" width="90" height="12" rx="3" fill="rgba(201,168,76,.4)"/>`;
  if(id==='mom-fit')return`<path d="M36 25L164 25L152 265L112 265L100 175L88 265L48 265Z" fill="rgba(201,168,76,.25)"/><rect x="31" y="15" width="138" height="12" rx="3" fill="rgba(201,168,76,.4)"/>`;
  if(id==='wide-leg')return`<path d="M32 25L168 25L158 265L116 265L100 175L84 265L42 265Z" fill="rgba(201,168,76,.25)"/><rect x="27" y="15" width="146" height="12" rx="3" fill="rgba(201,168,76,.4)"/>`;
  if(id==='falda-short'||id==='falda')return`<path d="M60 40L140 40L162 210L38 210Z" fill="rgba(201,168,76,.25)"/><rect x="55" y="30" width="90" height="12" rx="3" fill="rgba(201,168,76,.4)"/>`;
  return`<path d="M38 25L162 25L152 265L112 265L100 175L88 265L48 265Z" fill="rgba(201,168,76,.25)"/><rect x="33" y="15" width="134" height="12" rx="3" fill="rgba(201,168,76,.4)"/>`;
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
  const p=prods.find(x=>x._fbId===id||x._fbId===String(id)||x.id===id);if(!p)return;
  const wa=site.wa||'573507243351';
  const msg=encodeURIComponent(`Hola Stilos R-D, quiero realizar este pedido\n\n\u2022 ${p.name}\n  Precio: ${fmt(p.price)}\n  Cantidad: 1\n\nTotal: ${fmt(p.price)}`);
  window.open(`https://wa.me/${wa}?text=${msg}`,'_blank');
}

// ── CART ──
function updC(){const n=cart.reduce((a,i)=>a+i.qty,0);const b=document.getElementById('cart-bubble');if(b){b.textContent=n;b.classList.toggle('on',n>0);}const t=document.getElementById('nav-cart-tot');if(t)t.textContent=n>0?fmt(cart.reduce((a,i)=>a+i.price*i.qty,0)):'';}
function addCart(id){
  const p=prods.find(x=>x._fbId===id||x._fbId===String(id)||x.id===id);
  if(!p)return;
  const pid=p._fbId||p.id;
  const ci=cart.find(x=>x.id===pid);
  if(ci)ci.qty++;
  else cart.push({id:pid,name:p.name,price:p.price,qty:1,img:p.img,sizeFrom:p.sizeFrom,sizeTo:p.sizeTo});
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
  const wa=site.wa||'573507243351';
  const items=cart.map(i=>`<div class="c-item">
    <div class="c-img">${i.img?`<img src="${i.img}">`:'👗'}</div>
    <div class="c-inf">
      <div class="c-n">${i.name}</div>
      <div class="c-m">${i.sizeFrom&&i.sizeTo?`Tallas ${i.sizeFrom}\u2013${i.sizeTo}`:''}</div>
      <div class="c-qty-row">
        <button class="c-qty-btn" onclick='qtyCart("${i.id}",-1)'>\u2212</button>
        <span class="c-qty-num">${i.qty}</span>
        <button class="c-qty-btn" onclick='qtyCart("${i.id}",1)'>+</button>
      </div>
      <div class="c-p">${fmt(i.price*i.qty)}</div>
    </div>
    <button class="c-rm" onclick='rmCart("${i.id}")'>✕</button>
  </div>`).join('');
  const waLines=cart.map(i=>`\u2022 ${i.name}\n  Precio unitario: ${fmt(i.price)}\n  Cantidad: ${i.qty}\n  Subtotal: ${fmt(i.price*i.qty)}`).join('\n\n');
  const waMsg=encodeURIComponent(`Hola Stilos R-D, quiero realizar este pedido\n\n${waLines}\n\nTotal: ${fmt(tot)}`);
  el.innerHTML=`<div class="c-items">${items}</div><div class="c-sum"><div class="sr"><span>Total</span><span class="sr-tot">${fmt(tot)}</span></div><button class="wa-ord" onclick="window.open('https://wa.me/${wa}?text=${waMsg}','_blank')">💬 Pedir por WhatsApp</button></div>`;
}

// ── PRODUCT PAGE VIEW ──
let pdpSelectedSize = null;

function openM(id){
  const p = prods.find(x => x._fbId===id || x._fbId===String(id) || x.id===id); if(!p) return;
  const ov = document.getElementById('pdp-ov');
  const isNew = Date.now() - new Date(p.dateAdded).getTime() < OW;

  // Bar title
  document.getElementById('pdp-bar-title').textContent = p.name;

  // Image
  const wrap = document.getElementById('pdp-img-wrap');
  // Remove old img/svg if any (keep badge and heart)
  wrap.querySelectorAll('img,svg.pdp-svg').forEach(el=>el.remove());
  if(p.img){
    const img = document.createElement('img');
    img.src = p.img;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    wrap.insertBefore(img, wrap.firstChild);
  } else {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 200 300');
    svg.setAttribute('fill','none');
    svg.classList.add('pdp-svg');
    svg.style.cssText = 'width:50%;opacity:.15;display:block;margin:auto;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)';
    svg.innerHTML = pSVG(p);
    wrap.insertBefore(svg, wrap.firstChild);
  }

  // Badge new
  document.getElementById('pdp-badge-new').style.display = isNew ? 'block' : 'none';

  // Reset heart
  const heart = document.getElementById('pdp-heart');
  heart.classList.remove('liked');
  heart.textContent = '♡';

  // Name
  document.getElementById('pdp-name').textContent = p.name;

  // Prices
  document.getElementById('pdp-price-detal').textContent = fmt(p.price);
  const mayorBox = document.getElementById('pdp-price-mayor-box');
  if(p.priceM){
    mayorBox.style.display = 'block';
    document.getElementById('pdp-price-mayor-val').textContent = fmt(p.priceM);
  } else {
    mayorBox.style.display = 'none';
  }

  // Sizes
  const sizesWrap = document.getElementById('pdp-sizes-wrap');
  if(p.sizeFrom && p.sizeTo){
    sizesWrap.style.display = 'block';
    document.getElementById('pdp-sizes-range').textContent = `${p.sizeFrom} – ${p.sizeTo}`;
  } else if(p.size){
    sizesWrap.style.display = 'block';
    document.getElementById('pdp-sizes-range').textContent = p.size;
  } else {
    sizesWrap.style.display = 'none';
  }

  // Action buttons
  const _pid = p._fbId || p.id;
  document.getElementById('pdp-btn-cart').onclick = () => { addCart(_pid); renderNuevo(); renderTienda(); toast(`✔ ${p.name} agregado`); };
  document.getElementById('pdp-btn-wa').onclick = () => pedirAhora(_pid);

  // Recommended: same category first, then fill with others to reach min 6
  const sameCat = prods.filter(x => x.id !== p.id && x.category === p.category);
  const others  = prods.filter(x => x.id !== p.id && x.category !== p.category);
  const recs = [...sameCat, ...others].slice(0, Math.max(6, sameCat.length));
  const recGrid = document.getElementById('pdp-rec-grid');
  const pdpRec  = document.getElementById('pdp-rec');
  if(recs.length){
    recGrid.innerHTML = recs.map(mkCard).join('');
    pdpRec.style.display = 'block';
  } else {
    pdpRec.style.display = 'none';
  }

  // Open & scroll to top
  ov.classList.add('on');
  ov.scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function pdpSelectSize(btn, size){
  document.querySelectorAll('.pdp-size-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  pdpSelectedSize = size;
}

function closeM(){
  document.getElementById('pdp-ov').classList.remove('on');
  document.body.style.overflow = '';
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
    await signInWithEmailAndPassword(auth, 'rdstilos2@gmail.com', pwd);
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
    <div style="background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.12);border-radius:2px;padding:12px;text-align:center">
      <div id="crop-prev-${key}" style="width:100%;aspect-ratio:${aspect==='free'?'16/9':'3/4'};background:rgba(0,0,0,.3);overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;margin-bottom:10px;border-radius:2px">
        <span style="color:rgba(255,255,255,.2);font-size:1.4rem">🖼</span>
        <img id="crop-img-${key}" style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:cover" alt="">
      </div>
      <input type="file" id="crop-file-${key}" accept="image/*" style="display:none" onchange="cropLoad('${key}',event,'${aspect}',${aspect==='free'?'null':"'3/4'"})">
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        <button onclick="document.getElementById('crop-file-${key}').click()" style="padding:7px 16px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;border-radius:2px">📁 Elegir imagen</button>
        <button id="crop-accept-${key}" onclick="cropAccept('${key}')" style="display:none;padding:7px 16px;background:var(--gold);border:none;color:var(--dark);font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;font-weight:700;cursor:pointer;border-radius:2px">✔ Aceptar</button>
      </div>
      <div id="crop-range-${key}" style="display:none;margin-top:10px">
        <label style="font-size:.52rem;color:var(--gold-d);letter-spacing:.1em">Zoom</label>
        <input type="range" min="1" max="3" step="0.01" value="1" style="width:100%;margin-top:4px;accent-color:var(--gold)" oninput="cropZoom('${key}',this.value)">
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
      document.getElementById(`crop-accept-${key}`).style.display='inline-block';
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
        border:1px solid rgba(201,168,76,.15);
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
          border:1.5px solid rgba(201,168,76,.25);border-radius:2px;
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
          <span style="font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-d);flex-shrink:0;min-width:38px">Zoom</span>
          <input type="range" id="scrop-range-${key}" min="1" max="3" step="0.01" value="1"
            style="flex:1;accent-color:var(--gold);height:3px;cursor:pointer"
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
        " onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='rgba(255,255,255,.15)'">
          📁 Elegir imagen
        </button>
        <button id="scrop-accept-${key}" onclick="scropAccept('${key}')" style="
          display:none;padding:8px 18px;
          background:var(--gold);border:none;color:var(--dark);
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
async function addP(){
  const nm=document.getElementById('f-nm').value.trim();
  const px=parseFloat(document.getElementById('f-px').value);
  const pm_val=parseFloat(document.getElementById('f-pm').value);
  if(!nm){toast('⚠ Escribe el nombre del producto');return;}
  if(!px||isNaN(px)){toast('⚠ El precio detal es requerido');return;}
  const cropKey='prod-new';
  const s=cropState[cropKey];
  const pData={
    name:nm,
    price:px,
    priceM:isNaN(pm_val)?null:pm_val,
    sizeFrom:document.getElementById('f-sz-from').value.trim()||null,
    sizeTo:document.getElementById('f-sz-to').value.trim()||null,
    category:document.getElementById('f-ct').value,
    dateAdded:new Date().toISOString(),
    img:null
  };
  async function _finalize(imgData){
    pData.img = imgData;
    toast('⏳ Guardando producto...');
    try{
      const {db, collection, addDoc} = window._fb;
      const docRef = await addDoc(collection(db,'products'), pData);
      pData._fbId = docRef.id;
    }catch(e){
      toast('⚠ Error guardando: '+e.message); return;
    }
    ['f-nm','f-px','f-pm','f-sz-from','f-sz-to'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    if(cropState['prod-new']){cropState['prod-new']={src:null,zoom:1,dx:0,dy:0,dragging:false,startX:0,startY:0,onAccept:null};}
    const ci=document.getElementById('crop-img-prod-new');if(ci){ci.src='';ci.style.display='none';}
    const ca=document.getElementById('crop-accept-prod-new');if(ca)ca.style.display='none';
    const cr=document.getElementById('crop-range-prod-new');if(cr)cr.style.display='none';
    toast('✔ Producto agregado. Visible para todos.');
  }
  if(s && s.src){
    const img=new Image();
    img.onload=async()=>{
      // Render canvas at 600x800 (3:4)
      const canvas=document.createElement('canvas');canvas.width=600;canvas.height=800;
      const ctx=canvas.getContext('2d');
      const iw=img.naturalWidth,ih=img.naturalHeight;
      const scale=s.zoom*Math.max(600/iw,800/ih);
      ctx.drawImage(img,(600-iw*scale)/2+s.dx,(800-ih*scale)/2+s.dy,iw*scale,ih*scale);
      const dataUrl = canvas.toDataURL('image/jpeg',0.88);
      await _finalize(dataUrl);
    };
    img.onerror=async()=>{ await _finalize(null); };
    img.src=s.src;
  } else {
    await _finalize(null);
  }
}

async function delP(id){
  const p = prods.find(x=>x.id===id || x._fbId===id);
  if(!confirm('¿Seguro que quieres eliminar este producto?'))return;
  try{
    const {db, doc, deleteDoc} = window._fb;
    const fbId = p && p._fbId ? p._fbId : id;
    await deleteDoc(doc(db,'products', String(fbId)));
    // Delete image from storage if it's a Firebase URL
    if(p && p.img && p.img.includes('firebasestorage')) await window._fbDeleteImg(p.img);
    toast('✔ Producto eliminado');
  }catch(e){ toast('⚠ Error eliminando: '+e.message); }
}

function openEM(id){
  // id can be numeric id or _fbId string
  const p=prods.find(x=>x.id===id||x._fbId===id||x._fbId===String(id));if(!p)return;
  document.getElementById('e-id').value=p._fbId||p.id;
  document.getElementById('e-nm').value=p.name;
  document.getElementById('e-px').value=p.price;
  document.getElementById('e-pm').value=p.priceM||'';
  document.getElementById('e-sz-from').value=p.sizeFrom||'';
  document.getElementById('e-sz-to').value=p.sizeTo||'';
  document.getElementById('e-ct').value=p.category||'';
  // Show image in edit crop
  const key='prod-edit';
  if(p.img){
    if(!cropState[key])cropState[key]={src:null,zoom:1,dx:0,dy:0,dragging:false,startX:0,startY:0};
    cropState[key].src=p.img;
    const ci=document.getElementById(`crop-img-${key}`);
    if(ci){ci.src=p.img;ci.style.display='block';}
    const ca=document.getElementById(`crop-accept-${key}`);
    if(ca)ca.style.display='inline-block';
  }
  document.getElementById('em').style.display='flex';
}
function closeEM(){document.getElementById('em').style.display='none';}
async function saveEM(){
  const fbId=document.getElementById('e-id').value;
  const p=prods.find(x=>x._fbId===fbId||String(x.id)===String(fbId));if(!p)return;
  const updates={
    name:document.getElementById('e-nm').value,
    price:parseFloat(document.getElementById('e-px').value),
    priceM:parseFloat(document.getElementById('e-pm').value)||null,
    sizeFrom:document.getElementById('e-sz-from').value.trim()||null,
    sizeTo:document.getElementById('e-sz-to').value.trim()||null,
    category:document.getElementById('e-ct').value
  };
  const key='prod-edit';
  const s=cropState[key];
  async function _finalize(newImgData){
    if(newImgData !== undefined) updates.img = newImgData;
    try{
      const {db, doc, updateDoc} = window._fb;
      await updateDoc(doc(db,'products', String(p._fbId||fbId)), updates);
      closeEM();
      toast('✔ Producto actualizado');
    }catch(e){ toast('⚠ Error actualizando: '+e.message); }
  }
  if(s && s.src && s.src !== p.img){
    const img=new Image();
    img.onload=async()=>{
      const canvas=document.createElement('canvas');canvas.width=600;canvas.height=800;
      const ctx=canvas.getContext('2d');
      const iw=img.naturalWidth,ih=img.naturalHeight;
      const scale=s.zoom*Math.max(600/iw,800/ih);
      ctx.drawImage(img,(600-iw*scale)/2+s.dx,(800-ih*scale)/2+s.dy,iw*scale,ih*scale);
      const dataUrl=canvas.toDataURL('image/jpeg',0.88);
      await _finalize(dataUrl);
    };
    img.onerror=async()=>{ await _finalize(undefined); };
    img.src=s.src;
  } else {
    await _finalize(undefined);
  }
}

function renderAPL(){
  const el=document.getElementById('adm-pl');
  if(!prods.length){el.innerHTML='<div style="padding:28px;text-align:center;color:rgba(255,255,255,.2);font-size:.72rem;font-style:italic;letter-spacing:.06em">Aún no hay productos.</div>';return;}
  el.innerHTML=prods.map((p,i)=>{
    const pid = p._fbId || p.id;
    return`
    <div class="adm-table-row">
      <div class="atr-img">${p.img?`<img src="${p.img}">`:'👗'}</div>
      <div><div class="atr-name">${p.name}</div><div class="atr-type">${p.category||''}</div></div>
      <div><div class="atr-price">${fmt(p.price)}</div>${p.priceM?`<div class="atr-size" style="color:#4caf50">M: ${fmt(p.priceM)}</div>`:''}<div class="atr-size">${p.sizeFrom&&p.sizeTo?`${p.sizeFrom}–${p.sizeTo}`:''}</div></div>
      <div class="atr-size">${p.category||''}</div>
      <div class="atr-actions">
        <button class="xb gh" data-pid="${pid}" onclick="openEM(this.dataset.pid)">✎</button>
        <button class="xb d" data-pid="${pid}" onclick="delP(this.dataset.pid)">✕</button>
      </div>
    </div>`;
  }).join('');
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
      renderCE();
    });
  };
  r.readAsDataURL(file);
}
function addCat(){cats.push({id:'cat-'+Date.now(),label:'Nueva categoría',img:null,imgZoom:1,imgPos:'center center'});renderCE();}
function delCat(i){if(!confirm('¿Eliminar esta categoría?'))return;cats.splice(i,1);renderCE();}
async function saveCats(){
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
  const wa=site.wa||'573507243351';
  document.getElementById('cfg-wa').value=wa;
  document.getElementById('cfg-ig').value=site.ig||'https://www.instagram.com/stilosrdjeans?igsh=MTFtY3d1eHoxMWV3bg==';
  document.getElementById('cfg-fb').value=site.fb||'https://www.facebook.com/profile.php?id=61574894803320';
  document.getElementById('cfg-tk').value=site.tk||'https://www.tiktok.com/@stilosrdjeans?_r=1&_t=ZS-961KXhOKUBp';
  document.getElementById('cfg-h1').value=site.h1||'JEANS QUE REALZAN TU ESTILO.';
  document.getElementById('cfg-sub').value=site.sub||'Jeans que realzan tu esencia.';
}
async function saveCfg(){
  site.wa=(document.getElementById('cfg-wa').value.trim()||'573507243351').replace(/[^0-9]/g,'');
  site.ig=document.getElementById('cfg-ig').value.trim();
  site.fb=document.getElementById('cfg-fb').value.trim();
  site.tk=document.getElementById('cfg-tk').value.trim();
  site.h1=document.getElementById('cfg-h1').value||'JEANS QUE REALZAN TU ESTILO.';
  site.sub=document.getElementById('cfg-sub').value||'Jeans que realzan tu esencia.';
  await svS();
  // Apply locally too
  const wa=site.wa;
  const waFloat=document.getElementById('wa-float');if(waFloat)waFloat.href=`https://wa.me/${wa}`;
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
const DR=[
  {id:'r1',name:'Camila Escobar',date:'2026-03-25',stars:5,msg:'Me encantó cómo me quedó. Pedí un baggy y es perfecto, no aprieta y se ve demasiado lindo. Ya quiero otro color.',approved:true},
  {id:'r2',name:'Daniela Gil',date:'2026-02-13',stars:4,msg:'Los jeans con brillitos son hermosos, pensé que se iban a caer pero no, están súper bien hechos, los recomiendo.',approved:true},
  {id:'r3',name:'Andrés',date:'2025-12-18',stars:5,msg:'Se lo regalé a mi novia y le encantó, le quedó perfecto y dijo que era de los más cómodos que tiene. Muy buena compra.',approved:true},
  {id:'r4',name:'Valeria.1048',date:'2025-10-08',stars:5,msg:'Compré una falda short y me gustó mucho porque no se sube al caminar, además la tela es suave y se ve muy bonito puesto.',approved:true},
  {id:'r5',name:'Juliana Peña',date:'2025-05-02',stars:4,msg:'Pedí unos palazos y uff, son frescos y quedan elegantes pero cómodos. Literal los uso para todo.',approved:true},
];
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
        <div class="res-adm-name">${r.name} ${r.approved?'<span style="color:#2d9c5f;font-size:.55rem">✔ Aprobada</span>':'<span style="color:var(--gold);font-size:.55rem">⏳ Pendiente</span>'}</div>
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

