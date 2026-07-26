(function(){
  var el = document.getElementById('site-header-inject');
  if(!el) return;
  fetch('/partials/header.html')
    .then(function(res){ return res.text(); })
    .then(function(html){
      el.innerHTML = html;
      var toggle = document.getElementById('nav-toggle');
      var links = document.getElementById('nav-links');
      if(toggle && links){
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
      }
    })
    .catch(function(err){ console.error('Header include failed:', err); });
})();
