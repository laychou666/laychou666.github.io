(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const papers = [...document.querySelectorAll('.publication')];
  const filters = [...document.querySelectorAll('.filter-button')];
  const labels = {all:'all research areas',multimodal:'multimodal research',agents:'agent research'};
  const setFilter = (category) => {
    if (!Object.hasOwn(labels, category)) category = 'all';
    papers.forEach(paper => {
      paper.hidden = category !== 'all' && paper.dataset.category !== category;
    });
    filters.forEach(button => {
      const selected = button.dataset.filter === category;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelector('.filter-status').textContent = `Showing ${labels[category]}.`;
  };
  filters.forEach(button => button.addEventListener('click', () => setFilter(button.dataset.filter)));
  const navLinks = [...document.querySelectorAll('.nav-link')];
  const navSections = navLinks.map(link => document.querySelector(link.getAttribute('href')));
  let pending = false;
  function updateNavigation() {
    let active = 0;
    navSections.forEach((section, index) => {
      if (section && section.getBoundingClientRect().top <= 150) active = index;
    });
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      active = navLinks.length - 1;
    }
    navLinks.forEach((link, index) => {
      link.classList.toggle('active', index === active);
      if (index === active) link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
    pending = false;
  }
  window.addEventListener('scroll', () => {
    if (!pending) { pending = true; requestAnimationFrame(updateNavigation); }
  }, {passive:true});
  window.addEventListener('resize', updateNavigation);
  updateNavigation();
})();
