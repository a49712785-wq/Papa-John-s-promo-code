const DEALS = JSON.parse(document.getElementById('deals-data').textContent);
const STORES = JSON.parse(document.getElementById('stores-data').textContent);

const STATE_NAMES = {};
STORES.forEach(s => STATE_NAMES[s.s] = s.sn);

const TYPE_LABELS = {
  'Single Item — Fixed Price': 'Single Item',
  'Bundle / Multi-Item Combo': 'Bundle',
  'BOGO (Buy One, Get One Free)': 'BOGO',
  'Percentage Discount (Whole Order)': '% Off',
  'Free Delivery Threshold': 'Free Delivery',
  'Add-On Item': 'Add-On',
  'Build-Your-Own / Create-Your-Own': 'Build Your Own',
  'Free Item with Minimum Spend': 'Free w/ Min Spend',
  'Military / Special Audience Discount': 'Military'
};

function haversine(lat1, lon1, lat2, lon2){
  const R = 3958.8;
  const p1 = lat1*Math.PI/180, p2 = lat2*Math.PI/180;
  const dphi = (lat2-lat1)*Math.PI/180, dl = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dphi/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

// ---------- Theme ----------
const toolRoot = document.getElementById('pj-deal-finder');
const themeBtn = document.getElementById('themeToggle');
function applyTheme(t){
  if(t) toolRoot.setAttribute('data-theme', t);
  else toolRoot.removeAttribute('data-theme');
}
try {
  const saved = localStorage.getItem('vdf-theme');
  if(saved) applyTheme(saved);
} catch(e){}
themeBtn.addEventListener('click', () => {
  const cur = toolRoot.getAttribute('data-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  let next;
  if(!cur) next = prefersDark ? 'light' : 'dark';
  else if(cur === 'dark') next = 'light';
  else next = 'dark';
  applyTheme(next);
  try { localStorage.setItem('vdf-theme', next); } catch(e){}
});

// ---------- Stats ----------
const totalStates = new Set(STORES.map(s=>s.s)).size;
document.getElementById('statRow').innerHTML = `
  <div class="stat"><span class="num">${STORES.length}</span><span class="lab trust">✓ sampled stores</span></div>
  <div class="stat"><span class="num">${totalStates}</span><span class="lab">states + DC covered</span></div>
  <div class="stat"><span class="num">${DEALS.length.toLocaleString()}</span><span class="lab">real deals tracked</span></div>
`;

// ---------- Datalist ----------
const dl = document.getElementById('locations');
STORES.forEach(s => {
  const opt = document.createElement('option');
  opt.value = `${s.c}, ${s.s}`;
  dl.appendChild(opt);
});

// ---------- Example chips ----------
const exampleCities = ['Chicago, IL','Los Angeles, CA','Houston, TX','Miami, FL','New York, NY','Atlanta, GA'];
const chipsWrap = document.getElementById('exampleChips');
exampleCities.forEach(c => {
  const b = document.createElement('button');
  b.className = 'chip'; b.type='button'; b.textContent = c;
  b.addEventListener('click', () => { document.getElementById('searchInput').value = c; runSearch(c); });
  chipsWrap.appendChild(b);
});

// ---------- State grid ----------
const byState = {};
STORES.forEach(s => { (byState[s.s] = byState[s.s]||[]).push(s); });
const stateGrid = document.getElementById('stateGrid');
Object.keys(byState).sort((a,b)=> STATE_NAMES[a].localeCompare(STATE_NAMES[b])).forEach(code => {
  const list = byState[code];
  const tile = document.createElement('button');
  tile.className = 'state-tile'; tile.type='button';
  tile.innerHTML = `<div class="sname">${STATE_NAMES[code]}${list.length>1?'<span class="multi-dot"></span>':''}</div>
                     <div class="scount">${list.length} ${list.length>1?'cities':'city'}</div>`;
  tile.addEventListener('click', () => {
    if(list.length === 1){
      showStore(list[0], {exact:true});
    } else {
      showStateChoice(code, list);
    }
    document.getElementById('results').scrollIntoView({behavior:'smooth', block:'start'});
  });
  stateGrid.appendChild(tile);
});

// ---------- Search ----------
const resultsEl = document.getElementById('results');
let currentStore = null;
let activeType = 'All';
let sortMode = 'savings';

function normalize(s){ return (s||'').toString().trim().toLowerCase(); }

function findMatches(query){
  const q = normalize(query);
  if(!q) return [];
  // exact "City, ST" match
  let matches = STORES.filter(s => normalize(`${s.c}, ${s.s}`) === q);
  if(matches.length) return matches;
  // zip prefix match
  matches = STORES.filter(s => s.z && s.z.toString().startsWith(q));
  if(matches.length) return matches;
  // state code exact
  matches = STORES.filter(s => normalize(s.s) === q);
  if(matches.length) return matches;
  // state name exact/contains
  matches = STORES.filter(s => normalize(s.sn).includes(q));
  if(matches.length) return matches;
  // city contains
  matches = STORES.filter(s => normalize(s.c).includes(q));
  if(matches.length) return matches;
  return [];
}

function runSearch(query){
  const matches = findMatches(query);
  if(matches.length === 0){
    renderNoMatch(query);
  } else if(matches.length === 1){
    showStore(matches[0], {exact:true});
  } else {
    // multiple matches (state-level query) -> let them pick, unless query looks like a specific city already in list
    const exactCity = matches.find(s => normalize(s.c) === normalize(query.split(',')[0]));
    if(exactCity){ showStore(exactCity, {exact:true}); }
    else { showStateChoice(matches[0].s, matches); }
  }
}

document.getElementById('searchBtn').addEventListener('click', () => runSearch(document.getElementById('searchInput').value));
document.getElementById('searchInput').addEventListener('keydown', (e) => { if(e.key==='Enter') runSearch(e.target.value); });

document.getElementById('locateBtn').addEventListener('click', () => {
  if(!navigator.geolocation){ renderNoMatch('', 'Location access isn\'t available in this browser.'); return; }
  resultsEl.innerHTML = `<p style="padding:30px 0;color:var(--ink-soft)">Locating you…</p>`;
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude, longitude} = pos.coords;
    let nearest = null, best = Infinity;
    STORES.forEach(s => {
      const d = haversine(latitude, longitude, s.lat, s.lng);
      if(d < best){ best = d; nearest = s; }
    });
    showStore(nearest, {exact:false, distance:best});
    document.getElementById('results').scrollIntoView({behavior:'smooth', block:'start'});
  }, () => {
    renderNoMatch('', 'Couldn\'t get your location — try searching by city or ZIP instead.');
  });
});

function showStateChoice(stateCode, list){
  currentStore = null;
  resultsEl.innerHTML = `
    <div class="store-banner">
      <div><div class="city display">${STATE_NAMES[stateCode]}</div>
      <div class="addr">${list.length} covered cities — pick one to see its deals</div></div>
    </div>
    <div class="state-grid" style="margin-top:14px" id="cityChoice"></div>
  `;
  const wrap = document.getElementById('cityChoice');
  list.forEach(s => {
    const tile = document.createElement('button');
    tile.className = 'state-tile'; tile.type='button';
    tile.innerHTML = `<div class="sname">${s.c}</div><div class="scount">${s.n} deals</div>`;
    tile.addEventListener('click', () => showStore(s, {exact:true}));
    wrap.appendChild(tile);
  });
}

function renderNoMatch(query, customMsg){
  currentStore = null;
  resultsEl.innerHTML = `
    <div class="empty-state">
      <h3 class="display">No exact match${query? ` for "${query}"`:''}</h3>
      <p>${customMsg || 'That city or ZIP isn\'t in our verified dataset yet. Browse the states below, or try a nearby larger city — most states currently have one flagship store.'}</p>
    </div>
  `;
}

function showStore(store, {exact, distance} = {}){
  currentStore = store;
  activeType = 'All';
  sortMode = 'savings';
  render();
}

function dealsForCurrentStore(){
  if(!currentStore) return [];
  return DEALS.filter(d => d.s === currentStore.s && d.c === currentStore.c);
}

function render(){
  if(!currentStore) return;
  const all = dealsForCurrentStore();
  const types = ['All', ...new Set(all.map(d=>d.dt))];

  let list = activeType === 'All' ? all : all.filter(d => d.dt === activeType);
  list = [...list].sort((a,b) => {
    if(sortMode === 'savings') return (b.sv||0) - (a.sv||0);
    if(sortMode === 'price-low') return (a.cp ?? 9999) - (b.cp ?? 9999);
    if(sortMode === 'price-high') return (b.cp ?? -1) - (a.cp ?? -1);
    return (a.t||'').localeCompare(b.t||'');
  });

  const bannerHTML = `
    <div class="store-banner">
      <div>
        <div class="city display">${currentStore.c}, ${currentStore.s}</div>
        <div class="addr">${currentStore.a}</div>
      </div>
      <div class="verify-badge">✓ Store data · checked ${DEALS.find(d=>d.s===currentStore.s && d.c===currentStore.c)?.d || ''}</div>
    </div>
  `;

  const filterHTML = `
    <div class="filter-bar">
      ${types.map(t => `<button class="type-chip ${t===activeType?'active':''}" data-type="${t}">${t==='All'?'All':(TYPE_LABELS[t]||t)}</button>`).join('')}
      <select class="sort-select" id="sortSelect">
        <option value="savings" ${sortMode==='savings'?'selected':''}>Best savings first</option>
        <option value="price-low" ${sortMode==='price-low'?'selected':''}>Lowest price first</option>
        <option value="price-high" ${sortMode==='price-high'?'selected':''}>Highest price first</option>
        <option value="alpha" ${sortMode==='alpha'?'selected':''}>A–Z</option>
      </select>
    </div>
  `;

  const cardsHTML = list.length ? `<div class="deal-grid">${list.map(dealCard).join('')}</div>` :
    `<div class="empty-state"><h3 class="display">Nothing in this category</h3><p>Try a different filter above.</p></div>`;

  resultsEl.innerHTML = bannerHTML + filterHTML + cardsHTML;

  resultsEl.querySelectorAll('.type-chip').forEach(btn => {
    btn.addEventListener('click', () => { activeType = btn.dataset.type; render(); });
  });
  const sortSel = document.getElementById('sortSelect');
  if(sortSel) sortSel.addEventListener('change', (e) => { sortMode = e.target.value; render(); });
}

function dealCard(d){
  const hasPrice = d.cp !== null && d.cp !== undefined;
  const hasOrig = d.op !== null && d.op !== undefined;
  const hasSavings = d.sv !== null && d.sv !== undefined && d.sv !== '';
  return `
    <div class="deal-card">
      <div class="deal-top">
        ${d.b ? `<span class="badge-tag">${d.b}</span>` : '<span></span>'}
        <span class="type-tag">${TYPE_LABELS[d.dt] || d.dt}</span>
      </div>
      <p class="deal-title">${d.t}</p>
      ${hasPrice ? `
        <div class="price-row">
          <span class="price-current">$${Number(d.cp).toFixed(2)}</span>
          ${hasOrig ? `<span class="price-original">$${Number(d.op).toFixed(2)}</span>` : ''}
          ${hasSavings ? `<span class="savings-tag">save $${Number(d.sv).toFixed(2)}</span>` : ''}
        </div>
      ` : `<div class="no-price-note">No listed price — check store for terms.</div>`}
    </div>
  `;
}

// initial: show a popular city so the page isn't empty
const initial = STORES.find(s => s.c === 'Chicago');
if(initial) showStore(initial, {exact:true});

// ---------- Tab switching ----------
const tabFinderBtn = document.getElementById('tabFinderBtn');
const tabBestBtn = document.getElementById('tabBestBtn');
const tabFinder = document.getElementById('tabFinder');
const tabBest = document.getElementById('tabBest');

// Establish the initial state explicitly so the tool never renders all tabs at once.
tabFinder.style.display = '';
tabBest.style.display = 'none';

tabFinderBtn.addEventListener('click', () => {
  tabFinder.style.display = ''; tabBest.style.display = 'none';
  tabFinderBtn.classList.add('active'); tabBestBtn.classList.remove('active');
});
tabBestBtn.addEventListener('click', () => {
  tabFinder.style.display = 'none'; tabBest.style.display = '';
  tabBestBtn.classList.add('active'); tabFinderBtn.classList.remove('active');
  if(!bestRendered){ renderBest(); bestRendered = true; }
});

let bestRendered = false;
let boardView = 'savings'; // 'savings' | 'bystate'

const savedDeals = DEALS.filter(d => d.sv !== null && d.sv !== undefined && d.sv !== '' && d.cp);
const nationwideAvgSavings = savedDeals.length
  ? savedDeals.reduce((sum,d)=>sum+Number(d.sv),0) / savedDeals.length
  : 0;

function avgSavingsForStore(store){
  if(!store) return nationwideAvgSavings;
  const list = DEALS.filter(d => d.s===store.s && d.c===store.c && d.sv!==null && d.sv!==undefined && d.sv!=='');
  if(!list.length) return nationwideAvgSavings;
  return list.reduce((sum,d)=>sum+Number(d.sv),0) / list.length;
}

function renderBest(){
  const wrap = document.getElementById('bestContent');
  const perOrderSavings = avgSavingsForStore(currentStore).toFixed(2);

  wrap.innerHTML = `
    <div class="calc-card">
      <div class="calc-left">
        <h3 class="display">Your yearly savings estimate</h3>
        <p>Based on the average discount across ${currentStore ? `${currentStore.c}, ${currentStore.s}'s` : 'all tracked'} tracked deals (~$${perOrderSavings} per order). Adjust how often you order.</p>
        <div class="calc-input-row">
          <span style="font-size:13.5px;color:var(--ink-soft)">Orders per month</span>
          <input type="number" id="calcOrders" min="0" max="30" value="2">
        </div>
      </div>
      <div class="calc-result">
        <span class="amt" id="calcAmt">$0</span>
        <span class="cap">estimated savings per year</span>
      </div>
    </div>

    <div class="board-toggle">
      <button class="type-chip ${boardView==='savings'?'active':''}" data-view="savings">Biggest displayed savings</button>
      <button class="type-chip ${boardView==='bystate'?'active':''}" data-view="bystate">Large 1-topping pizza, by state</button>
    </div>
    <div id="boardHolder"></div>
  `;

  const calcInput = document.getElementById('calcOrders');
  const calcAmt = document.getElementById('calcAmt');
  function updateCalc(){
    const n = Math.max(0, Number(calcInput.value)||0);
    const yearly = n * 12 * Number(perOrderSavings);
    calcAmt.textContent = '$' + yearly.toFixed(0);
  }
  calcInput.addEventListener('input', updateCalc);
  updateCalc();

  wrap.querySelectorAll('.board-toggle .type-chip').forEach(btn => {
    btn.addEventListener('click', () => { boardView = btn.dataset.view; renderBoard(); wrap.querySelectorAll('.board-toggle .type-chip').forEach(b=>b.classList.toggle('active', b===btn)); });
  });

  renderBoard();
}

function renderBoard(){
  const holder = document.getElementById('boardHolder');
  if(boardView === 'savings'){
    const top = [...savedDeals].sort((a,b)=>b.sv-a.sv).slice(0,25);
    holder.innerHTML = `
      <div class="table-wrap"><table class="board-table">
        <thead><tr><th>#</th><th>Location</th><th>Deal</th><th>Price</th><th>Savings</th></tr></thead>
        <tbody>
          ${top.map((d,i)=>`
            <tr>
              <td class="rank-num">${i+1}</td>
              <td class="board-loc">${d.c}, ${d.s}</td>
              <td class="board-title">${d.t}</td>
              <td class="board-price">$${Number(d.cp).toFixed(2)}</td>
              <td class="board-save">save $${Number(d.sv).toFixed(2)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <p class="board-note">Ranked by dollar amount saved vs. the listed original price, across every tracked deal in the dataset.</p>
    `;
  } else {
    const matches = DEALS.filter(d => {
      const t = (d.t||'').toUpperCase();
      return d.cp && t.includes('LARGE') && (t.includes('1-TOPPING') || t.includes('1 TOPPING') || t.includes('ONE TOPPING'));
    });
    const byState = {};
    matches.forEach(d => {
      if(!byState[d.s] || d.cp < byState[d.s].cp) byState[d.s] = d;
    });
    const ranked = Object.values(byState).sort((a,b)=>a.cp-b.cp);
    holder.innerHTML = `
      <div class="table-wrap"><table class="board-table">
        <thead><tr><th>#</th><th>State</th><th>City</th><th>Listed as</th><th>Price</th></tr></thead>
        <tbody>
          ${ranked.map((d,i)=>`
            <tr>
              <td class="rank-num">${i+1}</td>
              <td class="board-loc">${d.sn}</td>
              <td class="board-title">${d.c}</td>
              <td class="board-title">${d.t}</td>
              <td class="board-price">$${Number(d.cp).toFixed(2)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <p class="board-note">Covers ${ranked.length} of 51 states/DC where a comparable large 1-topping pizza deal is currently tracked. States without a matching item aren't shown yet.</p>
    `;
  }
}

// ---------- Tab 3: Plan My Order ----------
const tabPlanBtn = document.getElementById('tabPlanBtn');
const tabPlan = document.getElementById('tabPlan');

tabPlanBtn.addEventListener('click', () => {
  tabFinder.style.display = 'none'; tabBest.style.display = 'none'; tabPlan.style.display = '';
  tabPlanBtn.classList.add('active'); tabFinderBtn.classList.remove('active'); tabBestBtn.classList.remove('active');
  const planInput = document.getElementById('planSearchInput');
  if(currentStore && !planInput.value) planInput.value = `${currentStore.c}, ${currentStore.s}`;
  renderPlan();
});
// also hide plan tab when switching to the other two
tabFinderBtn.addEventListener('click', () => { tabPlan.style.display = 'none'; tabPlanBtn.classList.remove('active'); });
tabBestBtn.addEventListener('click', () => { tabPlan.style.display = 'none'; tabPlanBtn.classList.remove('active'); });

// -- Tab 3 store picker --
function planSetStore(store){
  currentStore = store;
  document.getElementById('planStoreLabel').textContent = `${store.c}, ${store.s}`;
  document.getElementById('planSearchFeedback').innerHTML = `<span style="color:var(--green)">✓ Using ${store.c}, ${store.s} — ${store.a}</span>`;
  renderPlan();
}

function planRunSearch(query){
  const feedback = document.getElementById('planSearchFeedback');
  const matches = findMatches(query);
  if(matches.length === 0){
    feedback.innerHTML = `That city, state, or ZIP isn't in our covered data yet. Try a nearby larger city, or check the "Find My Deals" tab to browse by state.`;
    return;
  }
  if(matches.length === 1){
    planSetStore(matches[0]);
    return;
  }
  const exactCity = matches.find(s => normalize(s.c) === normalize(query.split(',')[0]));
  if(exactCity){ planSetStore(exactCity); return; }
  feedback.innerHTML = `Multiple cities match "${query}" — pick one: ` +
    matches.map(s => `<button class="chip" data-pick="${s.c}|${s.s}" style="margin:4px 4px 0 0">${s.c}, ${s.s}</button>`).join('');
  feedback.querySelectorAll('[data-pick]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [c,s] = btn.dataset.pick.split('|');
      const store = STORES.find(x=>x.c===c && x.s===s);
      if(store) planSetStore(store);
    });
  });
}

document.getElementById('planSearchBtn').addEventListener('click', () => planRunSearch(document.getElementById('planSearchInput').value));
document.getElementById('planSearchInput').addEventListener('keydown', (e) => { if(e.key==='Enter') planRunSearch(e.target.value); });
document.getElementById('planLocateBtn').addEventListener('click', () => {
  const feedback = document.getElementById('planSearchFeedback');
  if(!navigator.geolocation){ feedback.textContent = "Location access isn't available in this browser."; return; }
  feedback.textContent = 'Locating you…';
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude, longitude} = pos.coords;
    let nearest = null, best = Infinity;
    STORES.forEach(s => { const d = haversine(latitude, longitude, s.lat, s.lng); if(d < best){ best = d; nearest = s; } });
    document.getElementById('planSearchInput').value = `${nearest.c}, ${nearest.s}`;
    planSetStore(nearest);
    feedback.innerHTML = `<span style="color:var(--green)">✓ Nearest sampled store: ${nearest.c}, ${nearest.s} (~${best.toFixed(0)} mi away)</span>`;
  }, () => { feedback.textContent = "Couldn't get your location — try searching instead."; });
});

// -- Title parsing: size, pizza quantity, whether it's a pizza item --
const SIZE_SLICES = { PERSONAL: 6, SMALL: 6, MEDIUM: 8, LARGE: 10, XLARGE: 12 };
const QTY_WORDS = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 };
const NON_PIZZA_KW = ['WING','GARLIC KNOT','KNOT','BREAD','STICK','SALAD','COOKIE','BROWNIE','DESSERT','DRINK','PEPSI','SODA','LITER','DIP','CUP'];

function parseDealTitle(title){
  const t = (title||'').toUpperCase();
  let size = null;
  if(t.includes('EXTRA LARGE') || t.includes('X-LARGE') || t.includes(' XL ') || t.includes('XL 1-TOPPING') || t.startsWith('XL ')) size = 'XLARGE';
  else if(t.includes('LARGE')) size = 'LARGE';
  else if(t.includes('MEDIUM')) size = 'MEDIUM';
  else if(t.includes('PERSONAL')) size = 'PERSONAL';
  else if(t.includes('SMALL')) size = 'SMALL';

  let qty = 1;
  for(const w in QTY_WORDS){ if(t.startsWith(w+' ')){ qty = QTY_WORDS[w]; break; } }

  const hasNonPizzaKw = NON_PIZZA_KW.some(k => t.includes(k));
  const isPizza = t.includes('PIZZA') || (size && !hasNonPizzaKw);

  return { size, qty, isPizza, hasNonPizzaKw };
}

const APPETITE_SLICES = { light: 2, average: 2.5, big: 3.5 };
let appetiteLevel = 'average';

function estimateServes(size, qty){
  const slicesEach = SIZE_SLICES[size] || 8; // default to medium-ish if size unknown but flagged pizza
  const totalSlices = slicesEach * qty;
  return totalSlices / APPETITE_SLICES[appetiteLevel];
}

function renderPlan(){
  document.getElementById('planStoreLabel').textContent = currentStore ? `${currentStore.c}, ${currentStore.s}` : 'your selected store';
  const holder = document.getElementById('planContent');
  holder.innerHTML = `
    <div class="plan-form">
      <div class="plan-field">
        <label>How many people?</label>
        <input type="number" id="planPeople" min="1" max="20" value="4">
      </div>
      <div class="plan-field">
        <label>Budget (total, $)</label>
        <input type="number" id="planBudget" min="5" max="200" value="30">
      </div>
      <div class="plan-field">
        <label>Appetite level</label>
        <div class="appetite-group">
          <div class="appetite-opt ${appetiteLevel==='light'?'active':''}" data-level="light">Light</div>
          <div class="appetite-opt ${appetiteLevel==='average'?'active':''}" data-level="average">Average</div>
          <div class="appetite-opt ${appetiteLevel==='big'?'active':''}" data-level="big">Big eaters</div>
        </div>
      </div>
    </div>
    <p class="plan-note">Serving counts are estimates based on typical slice counts per size and your appetite setting, not exact Papa John's data — use them as a guide. Only pizza items are ranked here; sides and drinks aren't included in the per-person math.</p>
    <div id="planResults"></div>
  `;

  holder.querySelectorAll('.appetite-opt').forEach(el => {
    el.addEventListener('click', () => {
      appetiteLevel = el.dataset.level;
      holder.querySelectorAll('.appetite-opt').forEach(o=>o.classList.toggle('active', o===el));
      computePlan();
    });
  });
  document.getElementById('planPeople').addEventListener('input', computePlan);
  document.getElementById('planBudget').addEventListener('input', computePlan);

  computePlan();
}

function computePlan(){
  const resultsWrap = document.getElementById('planResults');
  if(!currentStore){
    resultsWrap.innerHTML = `<div class="empty-state"><h3 class="display">Search your store above</h3><p>Enter a city, state, or ZIP in the box above (or use your location) so we know which store's deals to plan from.</p></div>`;
    return;
  }
  const people = Math.max(1, Number(document.getElementById('planPeople').value)||1);
  const budget = Math.max(1, Number(document.getElementById('planBudget').value)||1);

  const storeDeals = dealsForCurrentStore().filter(d => d.cp);
  const candidates = [];
  storeDeals.forEach(d => {
    const parsed = parseDealTitle(d.t);
    if(!parsed.isPizza) return;
    const serves = estimateServes(parsed.size || 'MEDIUM', parsed.qty);
    const costPerPerson = d.cp / serves;
    candidates.push({ deal: d, serves, costPerPerson, size: parsed.size, qty: parsed.qty });
  });

  const withinBudget = candidates.filter(c => c.deal.cp <= budget);
  const affordableAndEnough = withinBudget.filter(c => c.serves >= people);
  const enough = candidates.filter(c => c.serves >= people);
  const pool = affordableAndEnough.length ? affordableAndEnough : (withinBudget.length ? withinBudget : (enough.length ? enough : candidates));
  const ranked = [...pool].sort((a,b) => {
    const aEnough = a.serves >= people;
    const bEnough = b.serves >= people;
    if(aEnough !== bEnough) return aEnough ? -1 : 1;
    return a.costPerPerson - b.costPerPerson;
  }).slice(0,3);

  if(!ranked.length){
    resultsWrap.innerHTML = `<div class="empty-state"><h3 class="display">No pizza deals matched</h3><p>Try raising the budget, or check "Find My Deals" — this store's current offers may be mostly sides or drinks right now.</p></div>`;
    return;
  }

  const lastDate = storeDeals[0]?.d || '';
  resultsWrap.innerHTML = ranked.map((c,i) => {
    const servesRounded = Math.max(1, Math.round(c.serves));
    const enoughFor = servesRounded >= people ? `feeds about ${servesRounded}, enough for your group` : `feeds about ${servesRounded}, a bit short for ${people}`;
    const budgetDiff = budget - c.deal.cp;
    const budgetNote = c.deal.cp <= budget ? `$${budgetDiff.toFixed(2)} under your $${budget} budget` : `$${Math.abs(budgetDiff).toFixed(2)} over your $${budget} budget`;
    return `
      <div class="pick-card">
        <div class="pick-rank">${i+1}</div>
        <div class="pick-body">
          <p class="pick-title">${c.deal.t}</p>
          <p class="pick-reason">~$${c.costPerPerson.toFixed(2)}/person &middot; ${enoughFor} &middot; ${budgetNote}.</p>
          <div class="pick-meta">
            <span>Store: ${currentStore.c}, ${currentStore.s} (exact match)</span>
            <span>Data checked: ${c.deal.d || lastDate}</span>
          </div>
        </div>
        <div class="pick-price">
          <div class="cur">$${Number(c.deal.cp).toFixed(2)}</div>
          <div class="pp">$${c.costPerPerson.toFixed(2)}/person</div>
        </div>
      </div>
    `;
  }).join('');
}

