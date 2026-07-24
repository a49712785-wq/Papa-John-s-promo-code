(function(){
  var el = document.getElementById('site-header-inject');
  if(!el) return;
  fetch('/partials/header.html')
    .then(function(res){ return res.text(); })
    .then(function(html){ el.innerHTML = html; })
    .catch(function(err){ console.error('Header include failed:', err); });
})();
