/**
 * KSA Zonhoven - Automatic Device & Screen Detection
 * Intelligently switches between desktop and mobile versions
 * while respecting explicit user preference.
 */
(function() {
  const MOBILE_BREAKPOINT = 768; // px
  const STORAGE_KEY = 'ksa_preferred_view';
  
  // Read query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const viewParam = urlParams.get('view');
  const noMobileParam = urlParams.get('nomobile');

  // Check explicit overrides from URL
  if (viewParam === 'desktop' || noMobileParam === '1' || noMobileParam === 'true') {
    try { sessionStorage.setItem(STORAGE_KEY, 'desktop'); } catch (e) {}
  } else if (viewParam === 'mobile' || urlParams.has('tab')) {
    try { sessionStorage.setItem(STORAGE_KEY, 'mobile'); } catch (e) {}
  }

  // Get current stored preference
  let preferredView = null;
  try {
    preferredView = sessionStorage.getItem(STORAGE_KEY);
  } catch (e) {}

  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isSmallScreen = window.innerWidth <= MOBILE_BREAKPOINT || 
    (window.matchMedia && window.matchMedia('(max-width: ' + MOBILE_BREAKPOINT + 'px)').matches);

  const pathname = window.location.pathname.toLowerCase();
  const isMobilePage = pathname.endsWith('mobile.html') || pathname.includes('/mobile');

  // If already on mobile page, remember mobile preference
  if (isMobilePage && preferredView !== 'desktop') {
    try { sessionStorage.setItem(STORAGE_KEY, 'mobile'); } catch (e) {}
  }

  // Route: If on desktop page and is mobile screen
  if (!isMobilePage) {
    if (preferredView !== 'desktop' && (isSmallScreen || isMobileUA)) {
      const targetHash = window.location.hash || '';
      window.location.replace('mobile.html' + targetHash);
    }
  } 
  // Route: If on mobile page, only send to desktop if explicitly requested or on large non-touch screen without mobile preference
  else {
    if (preferredView === 'desktop' || (preferredView !== 'mobile' && !isTouchDevice && !isMobileUA && window.innerWidth > 1024)) {
      const targetHash = window.location.hash || '';
      window.location.replace('index.html' + targetHash);
    }
  }

  // Helper function accessible to UI buttons
  window.switchKsaView = function(targetView) {
    try {
      sessionStorage.setItem(STORAGE_KEY, targetView);
    } catch (e) {}
    
    if (targetView === 'desktop') {
      window.location.href = 'index.html?view=desktop' + (window.location.hash || '');
    } else {
      window.location.href = 'mobile.html?view=mobile' + (window.location.hash || '');
    }
  };
})();
