// Apply the saved day/night theme before first paint so dark mode doesn't flash white.
// A separate file (not an inline <script>) so the Content-Security-Policy can forbid inline scripts.
(function () {
  try {
    var mode = localStorage.getItem('et_theme') || 'system';
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
