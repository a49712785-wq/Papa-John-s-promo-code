// Deals grid + modal logic. Only runs on pages that have #pjGrid
// (currently just the homepage). Guarded so this shared file never
// throws on pages without these elements.
(function(){
  var grid = document.getElementById('pjGrid');
  if(!grid) return;

  var LAST_CHECKED = 'July 26, 2026';

  var DEALS = [
    { type:'code', code:'SM25', filter:'percent-off', verify:'official', discount:'25% off', tag:'Public code',
      title:'25% off full-priced online orders',
      desc:'One of the most active codes right now, for full-priced items on online and app orders. Best for carryout and delivery.',
      restrict:'Applies to full-priced menu items only. Confirm the discount shows in your cart total before paying.' },
    { type:'code', code:'TAKE25DEAL', filter:'percent-off', verify:'confirmed', discount:'25% off', tag:'Public code',
      title:'25% off carryout orders',
      desc:'Confirmed working by multiple recent sources for carryout orders specifically.',
      restrict:'Carryout only. Confirm your total before paying, since exact value can vary by source.' },
    { type:'offer', filter:'rewards', verify:'official', discount:'Up to 30% off', tag:'Member exclusive',
      title:'Email/text signup',
      desc:'New customers can unlock up to 30% off their first order by signing up for email or text alerts.',
      restrict:'Available to new customers only, tied to a first online order.' },
    { type:'offer', filter:'rewards', verify:'official', discount:'$9.99', tag:'Rewards exclusive',
      title:'Papa Rewards $9.99 pizza deal',
      desc:'Select pizzas at $9.99, available to Papa Rewards members through their account.',
      restrict:'Requires an active Papa Rewards account. Selection may vary by store.' },
    { type:'offer', filter:'student-military', verify:'checkout', discount:'~25% off', tag:'ID required',
      title:'Teacher/Military/Student ID discount',
      desc:'Around 25% off for ID-verified customers at participating locations.',
      restrict:'Requires a valid ID at checkout. Restricted to participating locations; exclusions may apply.' },
    { type:'offer', filter:'rewards', verify:'official', discount:'Free item', tag:'Rewards exclusive',
      title:'Birthday reward',
      desc:'Papa Rewards members may get a complimentary item during their birthday month.',
      restrict:'Requires an active Papa Rewards account with birthday info on file.' },
    { type:'offer', filter:'bundles-other', verify:'official', discount:'Bonus code', tag:'Gift card buyers',
      title:'Gift card bulk bonus',
      desc:'Buying gift cards in bulk sometimes comes with a bonus code toward a future order.',
      restrict:'Availability depends on current gift card promotions.' },
    { type:'offer', filter:'bundles-other', verify:'official', discount:'Set price', tag:'Bundle deal',
      title:'Papa Pairings bundle',
      desc:'Pairing two or more eligible items at a set bundle price, best for smaller orders.',
      restrict:'Bundle contents and pricing may vary by store.' },
    { type:'offer', filter:'bundles-other', verify:'confirmed', discount:'Small % back', tag:'Cashback app users',
      title:'Cashback app offers',
      desc:'Some cashback and rebate apps periodically list Papa John\u2019s for a small percentage back on top of any code you apply.',
      restrict:'Availability depends on your specific cashback app. Confirm terms there before ordering.' }
  ];

  var VERIFY_META = {
    confirmed:{label:'Community-reported', cls:'confirmed'},
    checkout:{label:'Confirm at checkout', cls:'checkout'},
    official:{label:'Official offer', cls:'official'},
    expired:{label:'Expired', cls:'expired'}
  };

  var overlay = document.getElementById('pjOverlay');
  var modal = document.getElementById('pjModal');
  var searchInput = document.getElementById('pjSearch');
  var noResults = document.getElementById('pjNoResults');
  var activeFilter = 'all';

  var checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg>';
  var eyeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>';
  var tagIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.61 3H4a1 1 0 0 0-1 1v5.61a2 2 0 0 0 .83 1.39l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>';
  var clockIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
  var warnIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  var thumbsUpIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>';
  var thumbsDownIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="transform:rotate(180deg)"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>';

  function maskCode(code){
    var visible = Math.min(3, Math.max(2, code.length - 3));
    return code.slice(0, visible) + '\u2022'.repeat(Math.max(3, code.length - visible));
  }

  function matchesSearch(d, q){
    if(!q) return true;
    var hay = (d.title + ' ' + d.desc + ' ' + d.tag + ' ' + (d.code || '')).toLowerCase();
    return hay.indexOf(q.toLowerCase()) !== -1;
  }

  function renderCards(){
    grid.innerHTML = '';
    var q = searchInput ? searchInput.value.trim() : '';
    var visibleCount = 0;
    DEALS.forEach(function(d, idx){
      var vm = VERIFY_META[d.verify];
      var isExpired = d.verify === 'expired';
      var matches = (activeFilter === 'all' || d.filter === activeFilter) && matchesSearch(d, q);
      if(matches) visibleCount++;
      var card = document.createElement('div');
      card.className = 'pj-card' + (isExpired ? ' is-expired' : '');
      card.hidden = !matches;
      card.innerHTML =
        '<div class="pj-card-top">' +
          '<span class="pj-tag ' + (d.type === 'code' ? 'code' : 'member') + '">' + d.tag + '</span>' +
          '<span class="pj-ribbon">' + d.discount + '</span>' +
        '</div>' +
        '<div class="pj-card-body">' +
          '<div class="pj-card-title">' + d.title + '</div>' +
          '<div class="pj-card-desc">' + d.desc + '</div>' +
        '</div>' +
        '<div class="pj-verify-row">' +
          '<span class="pj-verify-badge ' + vm.cls + '">' + (isExpired ? warnIcon : checkIcon) + ' ' + vm.label + '</span>' +
          '<span class="pj-last-checked">' + clockIcon + ' ' + LAST_CHECKED + '</span>' +
        '</div>' +
        '<div class="pj-card-footer">' +
          (d.type === 'code'
            ? '<div class="pj-code-face" data-idx="' + idx + '"><span class="pj-masked">' + (isExpired ? 'Expired code' : maskCode(d.code)) + '</span><span class="pj-reveal-label">' + eyeIcon + ' ' + (isExpired ? 'View details' : 'Reveal code') + '</span></div>'
            : '<button type="button" class="pj-btn-offer" data-idx="' + idx + '">' + checkIcon + ' Get official deal &amp; offers</button>'
          ) +
        '</div>';
      grid.appendChild(card);
    });
    grid.querySelectorAll('[data-idx]').forEach(function(el){
      el.addEventListener('click', function(){ openModal(DEALS[el.dataset.idx]); });
    });
    if(noResults) noResults.hidden = visibleCount !== 0;
  }

  function openModal(d){
    if(!overlay || !modal) return;
    var vm = VERIFY_META[d.verify];
    var isExpired = d.verify === 'expired';
    modal.innerHTML =
      '<button type="button" class="pj-modal-close" id="pjCloseBtn" aria-label="Close">&times;</button>' +
      '<span class="pj-tag ' + (d.type === 'code' ? 'code' : 'member') + '" style="margin-bottom:10px; display:inline-flex;">' + d.tag + '</span>' +
      '<div class="pj-modal-verify"><span class="pj-verify-badge ' + vm.cls + '">' + (isExpired ? warnIcon : checkIcon) + ' ' + vm.label + '</span><span>' + clockIcon + ' Last checked ' + LAST_CHECKED + '</span></div>' +
      '<p class="pj-modal-headline"><strong>' + d.discount + '</strong> &mdash; ' + d.title + '</p>' +
      '<p class="pj-modal-desc">' + d.desc + '</p>' +
      (isExpired
        ? '<div class="pj-offer-note warn">' + warnIcon + "<span>This code looks expired. It's kept here for reference only, don't rely on it working at checkout.</span></div>"
        : d.type === 'code'
          ? '<div class="pj-code-box"><span style="display:flex; align-items:center; gap:8px;">' + tagIcon + '<span class="pj-code-text">' + d.code + '</span></span><button type="button" class="pj-copy-inline" id="pjCopyBtn">Copy</button></div>'
          : '<div class="pj-offer-note">' + checkIcon + '<span>No code needed, follow the steps on papajohns.com or in the app to apply this offer.</span></div>'
      ) +
      '<button type="button" class="pj-modal-cta" id="pjCtaBtn" ' + (isExpired ? 'disabled' : '') + '>' + (isExpired ? 'No longer available' : "Take me to Papa John's") + '</button>' +
      '<div class="pj-feedback"><span class="pj-feedback-label">Did the code work?</span><div style="display:flex; gap:8px;"><button type="button" class="pj-fb-btn yes" id="pjYesBtn">Yes ' + thumbsUpIcon + '</button><button type="button" class="pj-fb-btn no" id="pjNoBtn">No ' + thumbsDownIcon + '</button></div></div>' +
      '<p class="pj-modal-restrict"><strong>Restrictions:</strong> ' + d.restrict + '</p>';
    overlay.classList.add('show');

    var closeBtn = document.getElementById('pjCloseBtn');
    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    var ctaBtn = document.getElementById('pjCtaBtn');
    if(ctaBtn && !isExpired){
      ctaBtn.addEventListener('click', function(){ window.open('https://www.papajohns.com', '_blank'); });
    }
    if(d.type === 'code' && !isExpired){
      var copyBtn = document.getElementById('pjCopyBtn');
      if(copyBtn) copyBtn.addEventListener('click', function(){ copyCode(d.code, copyBtn); });
    }
    var yesBtn = document.getElementById('pjYesBtn');
    var noBtn = document.getElementById('pjNoBtn');
    if(yesBtn && noBtn){
      var fbWrap = yesBtn.parentElement;
      yesBtn.addEventListener('click', function(){ fbWrap.innerHTML = '<span class="pj-fb-thanks yes">' + checkIcon + ' Thanks for the feedback</span>'; });
      noBtn.addEventListener('click', function(){ fbWrap.innerHTML = '<span class="pj-fb-thanks yes">' + checkIcon + ' Thanks for the feedback</span>'; });
    }
  }

  function copyCode(code, btn){
    function done(){ btn.classList.add('copied'); btn.textContent = 'Copied'; setTimeout(function(){ btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 1800); }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(code).then(done).catch(function(){ fallbackCopy(code, done); });
    } else {
      fallbackCopy(code, done);
    }
  }
  function fallbackCopy(code, done){
    var ta = document.createElement('textarea');
    ta.value = code; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta); done();
  }
  function closeModal(){ if(overlay) overlay.classList.remove('show'); }
  if(overlay) overlay.addEventListener('click', function(e){ if(e.target === overlay) closeModal(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape') closeModal(); });

  document.querySelectorAll('.filter').forEach(function(chip){
    chip.addEventListener('click', function(){
      document.querySelectorAll('.filter').forEach(function(c){ c.setAttribute('aria-pressed', 'false'); });
      chip.setAttribute('aria-pressed', 'true');
      activeFilter = chip.dataset.filter;
      renderCards();
    });
  });
  if(searchInput) searchInput.addEventListener('input', renderCards);

  renderCards();
})();
