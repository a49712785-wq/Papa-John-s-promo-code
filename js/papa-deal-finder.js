
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
  const pool = withinBudget.length ? withinBudget : candidates;
  const ranked = [...pool].sort((a,b) => a.costPerPerson - b.costPerPerson).slice(0,3);

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

</script>

    </div>
  </div>
</section>

  <section id="data-methodology">
    <div class="wrap">
      <div class="section-head"><h2>Papa John's Promo Code Data: 102 Stores, 1,714 Deals, 50 States</h2></div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:8px; font-size:15px; line-height:1.7;">We pulled deal information directly from individual Papa John's ordering and deals pages at 102 sampled locations across 99 cities in 50 states plus D.C. Prices and offers were recorded on <strong>September 22, 2026</strong>. This is a dated snapshot, not a live feed. Offers and prices can change after collection, so always confirm on the ordering page before checkout.</p>
    </div>
  </section>

  <section id="ultimate-pepperoni" class="band">
    <div class="wrap">
      <div class="section-head"><h2>Papa John's Ultimate Pepperoni Pizza Price by Location: $12.99 to $21.99</h2></div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:8px; font-size:15px; line-height:1.7;">The same named deal can cost a different amount depending on your store, even within one state.</p>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:14px; font-size:15px; line-height:1.7;">Ultimate Pepperoni Pizza appeared at all 102 sampled stores at <strong>5 different prices: $12.99&ndash;$21.99</strong>, a $9.00 spread.</p>
      <div class="table-scroll">
      <table class="data">
        <tr><th>Sampled Location</th><th>Current Price</th><th>Displayed Original</th><th>Displayed Savings</th></tr>
        <tr><td>Cincinnati, OH</td><td>$12.99</td><td>$18.99</td><td>$6.00</td></tr>
        <tr><td>Rockford, IL</td><td>$12.99</td><td>$21.99</td><td>$9.00</td></tr>
        <tr><td>Springfield, IL</td><td>$12.99</td><td>$21.99</td><td>$9.00</td></tr>
        <tr><td>Milwaukee, WI</td><td>$12.99</td><td>$21.99</td><td>$9.00</td></tr>
        <tr><td>Elizabeth, NJ</td><td>$12.99</td><td>$21.99</td><td>$9.00</td></tr>
        <tr><td>San Francisco, CA</td><td>$21.99</td><td>$27.99</td><td>$6.00</td></tr>
      </table>
      </div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:18px; font-size:15px; line-height:1.7;">Same pattern within California alone: 5 of 6 sampled cities priced at $13.99, and San Francisco stood apart at $21.99:</p>
      <div class="table-scroll">
      <table class="data">
        <tr><th>Sampled City</th><th>Current Price</th><th>Displayed Original</th><th>Displayed Savings</th></tr>
        <tr><td>Los Angeles</td><td>$13.99</td><td>$22.99</td><td>$9.00</td></tr>
        <tr><td>Sacramento</td><td>$13.99</td><td>$23.00</td><td>$9.01</td></tr>
        <tr><td>Bakersfield</td><td>$13.99</td><td>$22.49</td><td>$8.50</td></tr>
        <tr><td>San Jose</td><td>$13.99</td><td>$28.99</td><td>$15.00</td></tr>
        <tr><td>San Diego</td><td>$13.99</td><td>$30.00</td><td>$16.01</td></tr>
        <tr><td>San Francisco</td><td>$21.99</td><td>$27.99</td><td>$6.00</td></tr>
      </table>
      </div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:18px; font-size:15px; line-height:1.7;">Other widely-carried deals show the same spread: Papa Pairings ($6.99&ndash;$11.99), Ultimate Bundle ($14.99&ndash;$23.99), The Works Large ($13.99&ndash;$17.99).</p>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:14px; font-size:15px; line-height:1.7;"><strong>Why:</strong> not city size, since LA and San Diego price the same as much smaller markets. It's store/market-specific. <strong>Bottom line: don't assume a price from another city applies to yours.</strong> Check your store below.</p>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:10px; font-size:13.5px; font-style:italic;">One store sampled per city.</p>
    </div>
  </section>

  <section id="largest-saving">
    <div class="wrap">
      <div class="section-head"><h2>Largest Displayed Saving: 24 Chicken Wings for $19.99 in Tacoma, WA</h2></div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:8px; font-size:15px; line-height:1.7;">Among the 661 deals where we had both a current and original price to compare, the median displayed saving was $5.90. The largest was in Tacoma, WA:</p>
      <div class="table-scroll">
      <table class="data">
        <tr><th>Sampled Location</th><th>Deal</th><th>Current Price</th><th>Original Price</th><th>Displayed Savings</th></tr>
        <tr><td>Tacoma, WA</td><td>24 Chicken Wings</td><td>$19.99</td><td>$38.99</td><td>$19.00</td></tr>
        <tr><td>Portland, OR</td><td>24 Chicken Wings</td><td>$19.99</td><td>$37.99</td><td>$18.00</td></tr>
        <tr><td>Vancouver, WA</td><td>24 Chicken Wings</td><td>$19.99</td><td>$37.99</td><td>$18.00</td></tr>
      </table>
      </div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:18px; font-size:15px; line-height:1.7;">Worth noticing: the <em>current</em> price is identical at $19.99 in all three cities. It's the <em>displayed original price</em> that differs, which is why the savings figure isn't a reliable ranking signal on its own. Compare the current price first; treat displayed savings as context, not the deciding number.</p>
    </div>
  </section>

  <section id="which-deal-fits" class="band">
    <div class="wrap">
      <div class="section-head"><h2>Which Papa John's Deal Fits Your Order?</h2></div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:8px; font-size:15px; line-height:1.7;">The biggest headline discount isn't automatically the most useful offer for what you're ordering. Match the deal type to your situation:</p>
      <ul style="max-width:760px; color:var(--pj-muted); margin-top:14px; font-size:15px; line-height:1.8; padding-left:20px;">
        <li><strong>Ordering for one</strong>: check single-pizza pricing before paying for a bundle sized for more people.</li>
        <li><strong>Ordering for two or more</strong>: compare bundle pricing against buying the same items separately; bundles only win if you'd have bought everything in them anyway.</li>
        <li><strong>Feeding a group</strong>: family-size and multi-pizza deals are where combining items creates real value.</li>
        <li><strong>On a fixed budget</strong>: set your limit first, then filter to deals that fit it, rather than adding items to chase a bigger discount.</li>
        <li><strong>Chasing the lowest price</strong>: use the current price at your specific location, not the discount percentage.</li>
      </ul>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:18px; font-size:15px; line-height:1.7;"><strong>How this works in practice</strong> (San Francisco used here just to show the method): two people, about $25 to spend. Ultimate Pepperoni alone runs $21.99 there, using most of the budget on one item. Papa Pairings, which ranged from $6.99&ndash;$11.99 across our sample, leaves more room within that budget for an additional item. The bigger discount (Ultimate Pepperoni's $6.00 displayed saving) isn't the better fit here; the deal structure is. <strong>Plan My Order runs this exact comparison for your own city and order</strong> once you enter them above, not just San Francisco.</p>
    </div>
  </section>

  <section id="plan-my-order">
    <div class="wrap">
      <div class="section-head"><h2>Plan My Order: Papa John's Deal Finder by Order Size and Budget</h2></div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:8px; font-size:15px; line-height:1.7;">Tell the tool what you're ordering, how many people you're feeding, and what matters most: price, savings, or deal type. It narrows the full deal list down to what actually fits, instead of you scanning every offer at your store.</p>
    </div>
  </section>

  <section id="promo-vs-rewards" class="band">
    <div class="wrap">
      <div class="section-head"><h2>Papa John's Promo Codes vs. Papa Rewards: How the Two Work Together</h2></div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:8px; font-size:15px; line-height:1.7;">A promo code and Papa Rewards solve different problems, and treating them as interchangeable can cost you money either way.</p>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:14px; font-size:15px; line-height:1.7;"><strong>How Papa Rewards works</strong>, per Papa John's own program page: you earn 1 point for every $1 spent, and you receive $1 in Papa Dough for every $10 spent. Papa Dough applies to a future order, not the one that earned it. This comes from Papa John's official program terms, not from our 102-store deal dataset &mdash; the two are separate sources.</p>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:14px; font-size:15px; line-height:1.7;"><strong>Which one actually saves you more depends on how often you order:</strong></p>
      <ul style="max-width:760px; color:var(--pj-muted); margin-top:10px; font-size:15px; line-height:1.8; padding-left:20px;">
        <li><strong>One-time order:</strong> a promo code's savings applies now; Rewards only pays off if you plan to come back.</li>
        <li><strong>Repeat customer:</strong> weigh both &mdash; the promo code's discount on this order, plus the Papa Dough balance building toward the next one.</li>
        <li><strong>Bigger order:</strong> compare a promo code's displayed savings (see the tables above) against the Papa Dough you'd earn at $1 per $10 spent, to see which actually nets more for that order.</li>
      </ul>
    </div>
  </section>

  <section id="state-directory">
    <div class="wrap">
      <div class="section-head"><h2>Papa John's Promo Codes and Coupons by State (All 50 States + D.C.)</h2></div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:8px; font-size:15px; line-height:1.7;">We sampled 102 locations across 99 cities in all 50 states plus D.C. States with multiple sampled cities let you compare more than one local price point; single-location states reflect the one store we sampled there.</p>
      <div class="table-scroll">
      <table class="data">
        <tr><th>State</th><th>Sampled Cities</th><th>Locations</th><th>Deal Records</th><th>Highest Displayed Savings in Sample</th></tr>
        <tr><td>Alabama</td><td>Huntsville</td><td>1</td><td>15</td><td>$8.00</td></tr>
        <tr><td>Alaska</td><td>Anchorage</td><td>1</td><td>18</td><td>$6.00</td></tr>
        <tr><td>Arizona</td><td>Chandler, Mesa, Phoenix, Tucson</td><td>4</td><td>71</td><td>$10.00</td></tr>
        <tr><td>Arkansas</td><td>Little Rock</td><td>1</td><td>21</td><td>$8.50</td></tr>
        <tr><td>California</td><td>Bakersfield, Los Angeles, Sacramento, San Diego, San Francisco, San Jose</td><td>6</td><td>77</td><td>$16.01</td></tr>
        <tr><td>Colorado</td><td>Denver</td><td>1</td><td>21</td><td>$13.00</td></tr>
        <tr><td>Connecticut</td><td>Bridgeport</td><td>1</td><td>13</td><td>$5.00</td></tr>
        <tr><td>Delaware</td><td>Wilmington</td><td>1</td><td>20</td><td>$7.00</td></tr>
        <tr><td>Florida</td><td>Fort Lauderdale, Jacksonville, Miami, Orlando, Tallahassee, Tampa</td><td>6</td><td>109</td><td>$8.00</td></tr>
        <tr><td>Georgia</td><td>Atlanta, Augusta, Columbus, Savannah</td><td>4</td><td>67</td><td>$16.99</td></tr>
        <tr><td>Hawaii</td><td>Honolulu</td><td>1</td><td>20</td><td>$11.00</td></tr>
        <tr><td>Idaho</td><td>Boise</td><td>1</td><td>15</td><td>$9.01</td></tr>
        <tr><td>Illinois</td><td>Aurora, Chicago, Naperville, Peoria, Rockford, Springfield</td><td>6</td><td>111</td><td>$14.00</td></tr>
        <tr><td>Indiana</td><td>Indianapolis</td><td>1</td><td>20</td><td>$7.20</td></tr>
        <tr><td>Iowa</td><td>Des Moines</td><td>1</td><td>20</td><td>$7.00</td></tr>
        <tr><td>Kansas</td><td>Wichita</td><td>1</td><td>15</td><td>$9.01</td></tr>
        <tr><td>Kentucky</td><td>Louisville</td><td>1</td><td>20</td><td>$7.20</td></tr>
        <tr><td>Louisiana</td><td>New Orleans</td><td>1</td><td>15</td><td>$8.00</td></tr>
        <tr><td>Maine</td><td>Portland</td><td>1</td><td>17</td><td>$7.00</td></tr>
        <tr><td>Maryland</td><td>Baltimore</td><td>1</td><td>15</td><td>$7.00</td></tr>
        <tr><td>Massachusetts</td><td>Boston</td><td>1</td><td>17</td><td>$6.00</td></tr>
        <tr><td>Michigan</td><td>Ann Arbor, Dearborn, Detroit, Grand Rapids</td><td>4</td><td>62</td><td>$9.00</td></tr>
        <tr><td>Minnesota</td><td>Minneapolis</td><td>1</td><td>15</td><td>$8.51</td></tr>
        <tr><td>Mississippi</td><td>Jackson</td><td>1</td><td>14</td><td>$13.00</td></tr>
        <tr><td>Missouri</td><td>Kansas City</td><td>1</td><td>18</td><td>$7.50</td></tr>
        <tr><td>Montana</td><td>Billings</td><td>1</td><td>17</td><td>$8.00</td></tr>
        <tr><td>Nebraska</td><td>Omaha</td><td>1</td><td>20</td><td>$10.00</td></tr>
        <tr><td>Nevada</td><td>Las Vegas</td><td>1</td><td>18</td><td>$6.96</td></tr>
        <tr><td>New Hampshire</td><td>Manchester</td><td>1</td><td>17</td><td>$6.00</td></tr>
        <tr><td>New Jersey</td><td>Elizabeth, Jersey City, Newark, Paterson</td><td>4</td><td>53</td><td>$9.00</td></tr>
        <tr><td>New Mexico</td><td>Albuquerque</td><td>1</td><td>19</td><td>$9.00</td></tr>
        <tr><td>New York</td><td>Albany, Buffalo, New York, Rochester, Syracuse, Yonkers</td><td>6</td><td>90</td><td>$8.50</td></tr>
        <tr><td>North Carolina</td><td>Charlotte, Durham, Greensboro, Raleigh</td><td>4</td><td>77</td><td>$7.50</td></tr>
        <tr><td>North Dakota</td><td>Fargo</td><td>1</td><td>15</td><td>$9.01</td></tr>
        <tr><td>Ohio</td><td>Cincinnati, Cleveland, Columbus, Toledo</td><td>4</td><td>67</td><td>$8.00</td></tr>
        <tr><td>Oklahoma</td><td>Oklahoma City</td><td>1</td><td>19</td><td>$7.00</td></tr>
        <tr><td>Oregon</td><td>Portland</td><td>1</td><td>18</td><td>$18.00</td></tr>
        <tr><td>Pennsylvania</td><td>Allentown, Erie, Philadelphia, Pittsburgh</td><td>4</td><td>65</td><td>$11.00</td></tr>
        <tr><td>Rhode Island</td><td>Warwick</td><td>1</td><td>17</td><td>$6.00</td></tr>
        <tr><td>South Carolina</td><td>Charleston</td><td>1</td><td>17</td><td>$6.00</td></tr>
        <tr><td>South Dakota</td><td>Sioux Falls</td><td>1</td><td>20</td><td>$7.50</td></tr>
        <tr><td>Tennessee</td><td>Nashville</td><td>1</td><td>20</td><td>$7.20</td></tr>
        <tr><td>Texas</td><td>Austin, Dallas, El Paso, Fort Worth, Houston, San Antonio</td><td>6</td><td>105</td><td>$9.01</td></tr>
        <tr><td>Utah</td><td>Salt Lake City</td><td>1</td><td>16</td><td>$8.40</td></tr>
        <tr><td>Virginia</td><td>Chesapeake, Norfolk, Richmond, Virginia Beach</td><td>4</td><td>52</td><td>$9.00</td></tr>
        <tr><td>Washington</td><td>Seattle, Spokane, Tacoma, Vancouver</td><td>4</td><td>76</td><td>$19.00</td></tr>
        <tr><td>West Virginia</td><td>Charleston</td><td>1</td><td>14</td><td>$9.01</td></tr>
        <tr><td>Wisconsin</td><td>Milwaukee</td><td>1</td><td>18</td><td>$9.00</td></tr>
        <tr><td>Wyoming</td><td>Cheyenne</td><td>1</td><td>18</td><td>$8.00</td></tr>
        <tr><td>Washington, D.C.</td><td>Washington</td><td>1</td><td>20</td><td>$9.00</td></tr>
      </table>
      </div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:14px; font-size:13.5px; font-style:italic;">The savings column is the highest displayed saving we observed in that state's sample.</p>
    </div>
  </section>

  <section id="city-directory" class="band">
    <div class="wrap">
      <div class="section-head"><h2>Papa John's Deals by City: Price and Savings Data for 99 Cities</h2></div>
      <div class="table-scroll">
      <table class="data">
        <tr><th>Sampled City</th><th>Deals Tracked</th><th>What We Found</th></tr>
        <tr><td>Tacoma, WA</td><td>18</td><td>24 Chicken Wings at $19.99 vs. $38.99, the largest displayed saving in our entire sample: $19.00</td></tr>
        <tr><td>San Diego, CA</td><td>14</td><td>Ultimate Pepperoni at $13.99 with $16.01 in displayed savings, one of the strongest single-item values we recorded</td></tr>
        <tr><td>San Francisco, CA</td><td>7</td><td>Ultimate Pepperoni at $21.99, the one clear outlier against $13.99 in every other sampled California city</td></tr>
        <tr><td>Chicago, IL</td><td>21</td><td>Ultimate Pepperoni at $12.99, the low end of the national range</td></tr>
        <tr><td>Los Angeles, CA</td><td>13</td><td>Ultimate Pepperoni at $13.99 with $9.00 in displayed savings</td></tr>
        <tr><td>Detroit, MI</td><td>13</td><td>Family Special listed at $25.99</td></tr>
        <tr><td>Anchorage, AK</td><td>18</td><td>Family Special listed at $32.99</td></tr>
      </table>
      </div>
    </div>
  </section>

  <section id="faq" class="band">
    <div class="wrap">
      <div class="section-head"><h2>Papa John's Promo Code FAQs</h2></div>

      <details class="faq-item">
        <summary>Does Papa John's Have Promo Codes, or Only App/Website Deals?</summary>
        <p>Both. Our sample included code-at-checkout deals and offers that applied automatically with no code. The mix varies by store, so check your location's own deal page.</p>
      </details>

      <details class="faq-item">
        <summary>Why Do Papa John's Promo Codes Cost Different Amounts by Location?</summary>
        <p>Prices differ by store, not by a simple rule. Ultimate Pepperoni ranged $12.99&ndash;$21.99 across our 102 stores, and it isn't just "big city vs. small city" &mdash; LA and San Diego match much smaller markets. Check your own store's price rather than one you saw elsewhere.</p>
      </details>

      <details class="faq-item">
        <summary>How Do I Find Papa John's Deals Near Me?</summary>
        <p>Search by city, state, or ZIP in the finder above, then use Plan My Order to narrow results by order size and budget.</p>
      </details>

      <details class="faq-item">
        <summary>Is the Cheapest Papa John's Deal Always the Best Value?</summary>
        <p>Not necessarily. A bundle or BOGO can beat a low single-item price depending on group size &mdash; see the San Francisco example above, where the bigger discount wasn't the better fit.</p>
      </details>

      <details class="faq-item">
        <summary>How Much Can You Save With a Papa John's Promo Code?</summary>
        <p>It varies. Of 661 records with both prices, the median displayed saving was $5.90; the largest was $19.00 (24 Chicken Wings, Tacoma, WA).</p>
      </details>

      <details class="faq-item">
        <summary>Are All Papa John's Deals Available at Every Store?</summary>
        <p>No. Of 402 unique deal titles, 220 appeared at only one sampled location. A deal named for another city may not exist at yours &mdash; confirm on your own store's page.</p>
      </details>

      <details class="faq-item">
        <summary>How Current Is This Papa John's Deal Data?</summary>
        <p>Collected September 22, 2026, from each store's own page. It's a snapshot, not live &mdash; confirm before checkout.</p>
      </details>

      <details class="faq-item">
        <summary>Can I Stack Multiple Papa John's Promo Codes?</summary>
        <p>Don't assume codes or offers combine. Our dataset tracked prices and structures, not stacking rules, so check your cart at checkout before counting on it.</p>
      </details>

      <details class="faq-item">
        <summary>Do Papa John's Deals Work for Both Delivery and Carryout?</summary>
        <p>Not always &mdash; some bundles/BOGO deals are carryout-only. Check the fine print on your store's page.</p>
      </details>

      <details class="faq-item">
        <summary>Does a Papa John's Promo Code Work on DoorDash, Uber Eats, or Grubhub?</summary>
        <p>May not. Third-party platforms often run their own promotions and rules, so check the code's terms and that checkout page before assuming it applies.</p>
      </details>

      <details class="faq-item">
        <summary>Is There a Minimum Order for Papa John's Promo Codes?</summary>
        <p>Some offers may require a minimum spend or other conditions our dataset didn't capture &mdash; check the specific offer's terms.</p>
      </details>

      <details class="faq-item">
        <summary>Why Isn't My Papa John's Promo Code Working?</summary>
        <p>Common causes: expired code, unmet minimum spend, an excluded item, or trying to stack two discounts. If it fails, try selecting the deal directly on the store's page instead of entering a code &mdash; many of our sampled offers worked that way.</p>
      </details>

      <details class="faq-item">
        <summary>How Do I Get Papa John's Text Alerts?</summary>
        <p>Text "START" to 47272 to subscribe to Papa John's official email/text program for weekly discounts on menu items, per Papa John's own specials page. This is a separate signup from promo codes and isn't something our dataset tracked.</p>
      </details>

      <details class="faq-item">
        <summary>Does Papa John's Offer a Military Discount?</summary>
        <p>There's no confirmed, standing corporate-wide military discount. What you'll see online (specific percentages, specific codes) generally traces back to individual franchise locations or promotions that have since expired, not a nationwide policy. If this matters to your order, ask your specific store directly rather than relying on a percentage you saw on a coupon site.</p>
      </details>

      <details class="faq-item">
        <summary>How Do I Apply a Papa John's Promo Code at Checkout?</summary>
        <p>Per Papa John's own instructions: sign in to your account (or check out as a guest), add your items to the cart, and look for the promo code box, which appears at the top of the menu page or on the checkout page. Enter the code, hit apply, and confirm the discount shows before you pay.</p>
      </details>

    </div>
  </section>

  <section id="bottom-line">
    <div class="wrap">
      <div class="section-head"><h2>Bottom Line: How to Find the Best Papa John's Promo Code Near You</h2></div>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:8px; font-size:15px; line-height:1.7;">The same Papa John's deal can carry a different price depending on where you're ordering from, sometimes by $9 or more, even within one state, and the difference doesn't track a simple rule like city size. That's exactly why a single nationwide promo code is the wrong starting point.</p>
      <p style="max-width:760px; color:var(--pj-muted); margin-top:14px; font-size:15px; line-height:1.7;">Start with your location, compare what's actually showing at your store, then match the deal structure to your order size rather than chasing the biggest headline discount. Select your location above to see it.</p>
    </div>
  </section>

</main>

<footer id="site-footer" class="site-footer">
  <div class="wrap">
    <p><strong>papajohnscoupons.us</strong> is an independent site and is not affiliated with, endorsed by, or operated by Papa John's International, Inc. or any of its franchisees.</p>
    <p style="margin-top:8px;">All trademarks, logos, and brand names referenced on this site belong to their respective owners. Codes and offers are provided for reference only and are not guaranteed to be current or valid at checkout &mdash; always confirm the discount in your cart before paying.</p>
    <p style="margin-top:16px; display:flex; gap:16px; flex-wrap:wrap;">
      <a href="/bogo-deal/">BOGO Deal</a>
      <a href="/tuesday-special/">Tuesday Special</a>
      <a href="/papa-rewards/">Papa Rewards</a>
      <a href="/student-discount/">Student Discount</a>
      <a href="/military-discount/">Military Discount</a>
    </p>
    <p style="margin-top:16px; display:flex; gap:16px; flex-wrap:wrap;">
      <a href="/about-us/">About Us</a>
      <a href="/contact-us/">Contact Us</a>
      <a href="/disclaimer/">Disclaimer</a>
      <a href="/terms-conditions/">Terms &amp; Conditions</a>
    </p>
  </div>
</footer>

<div class="pj-overlay" id="pjOverlay">
  <div class="pj-modal" id="pjModal"></div>
</div>

<script src="/js/script.js?v=1">