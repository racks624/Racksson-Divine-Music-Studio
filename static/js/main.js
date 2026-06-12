// main.js — app wide helpers (theme switch, small UI)
document.addEventListener('DOMContentLoaded', () => {
   console.log("Racksson Main UI initialized.");
   // theme loader
   const saved = localStorage.getItem('racksson-theme');
   if (saved) document.documentElement.classList.add(saved);
   
   document.querySelectorAll('.btn').forEach(b => {
      b.addEventListener('mouseenter', () => b.classList.add('pulsing'));
      b.addEventListener('mouseleave', () => b.classList.remove('pulsing'));
   });
});

function switchTheme(name) {
   const cls = ['theme-golden', 'theme-indigo', 'theme-violet'];
   cls.forEach(c => document.documentElement.classList.remove(c));
   if (name) document.documentElement.classList.add(name);
   localStorage.setItem('racksson-theme', name);
}