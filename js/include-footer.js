(function(){
  var el = document.getElementById('site-footer');
  if(!el) return;
  fetch('/partials/footer.html')
    .then(function(res){ return res.text(); })
    .then(function(html){ el.innerHTML = html; })
    .catch(function(err){ console.error('Footer include failed:', err); });
})();
