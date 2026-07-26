// Shared site-wide behavior. Runs on every page, so anything targeting a
// specific element MUST guard with an early return if that element
// doesn't exist on the current page (lesson from the last build: a
// missing guard here threw "Cannot read properties of null" on pages
// without the homepage's elements).

(function(){
  // Example pattern for any future shared behavior:
  // var el = document.getElementById('some-page-specific-id');
  // if(!el) return;
  // ... el.addEventListener(...)

  // Mobile nav hamburger toggle
  var toggle = document.getElementById('nav-toggle');
  var links = document.getElementById('nav-links');
  if(!toggle || !links) return;
  toggle.addEventListener('click', function(){
    var open = links.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  links.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){
      links.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();
