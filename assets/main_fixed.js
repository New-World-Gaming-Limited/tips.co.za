/**
 * main.js — southafricancasinosites.co.za
 * Vanilla JS, no dependencies, ES6+
 * Features: Theme Toggle, Mobile Menu, FAQ Accordion, Copy to Clipboard,
 *           Smooth Scroll, Back to Top, Table Sorting, Active Nav Highlight,
 *           Lazy Load Images, Sticky Header Shadow, Affiliate Disclosure,
 *           Table of Contents, Search/Filter, Rating Animation, Cookie Consent
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─────────────────────────────────────────────
  // 1. THEME TOGGLE (Dark / Light Mode)
  // ─────────────────────────────────────────────
  (function initTheme() {
    const html       = document.documentElement;
    const toggleBtn  = document.getElementById('theme-toggle');

    const SUN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1"  x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22"   x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1"  y1="12" x2="3"  y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78"  x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
    </svg>`;

    const MOON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`;

    /** Apply theme to <html> and update button icon */
    function applyTheme(isDark) {
      if (isDark) {
        html.setAttribute('data-theme', 'dark');
      } else {
        html.removeAttribute('data-theme');
      }
      if (toggleBtn) {
        toggleBtn.innerHTML = isDark ? SUN_ICON : MOON_ICON;
        toggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
      }
    }

    // Resolve initial preference: window._storage → system preference
    const stored = window._storage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;

    applyTheme(isDark);

    // Toggle on button click
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const currentlyDark = html.getAttribute('data-theme') === 'dark';
        const next = !currentlyDark;
        applyTheme(next);
        window._storage.setItem('theme', next ? 'dark' : 'light');
      });
    }

    // Sync with OS preference changes (only when no explicit user choice stored)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!window._storage.getItem('theme')) {
        applyTheme(e.matches);
      }
    });
  })();


  // ─────────────────────────────────────────────
  // 2. MOBILE MENU
  // ─────────────────────────────────────────────
  (function initMobileMenu() {
    const hamburger  = document.getElementById('hamburger');
    const mobileNav  = document.querySelector('.mobile-nav');
    const body       = document.body;

    if (!hamburger || !mobileNav) return;

    const focusableSelectors = 'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])';

    function getFocusableElements() {
      return Array.from(mobileNav.querySelectorAll(focusableSelectors)).filter(
        (el) => !el.disabled && el.offsetParent !== null
      );
    }

    function openMenu() {
      body.classList.add('nav-open');
      hamburger.setAttribute('aria-expanded', 'true');
      mobileNav.setAttribute('aria-hidden', 'false');
      // Focus first element inside nav
      const focusable = getFocusableElements();
      if (focusable.length) focusable[0].focus();
    }

    function closeMenu() {
      body.classList.remove('nav-open');
      hamburger.setAttribute('aria-expanded', 'false');
      mobileNav.setAttribute('aria-hidden', 'true');
      hamburger.focus();
    }

    function isMenuOpen() {
      return body.classList.contains('nav-open');
    }

    hamburger.addEventListener('click', () => {
      isMenuOpen() ? closeMenu() : openMenu();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (isMenuOpen() && !mobileNav.contains(e.target) && e.target !== hamburger) {
        closeMenu();
      }
    });

    // Close when a nav link is clicked
    mobileNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    // Trap focus within the mobile nav when open
    document.addEventListener('keydown', (e) => {
      if (!isMenuOpen()) return;

      if (e.key === 'Escape') {
        closeMenu();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = getFocusableElements();
        if (!focusable.length) return;

        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    });
  })();


  // ─────────────────────────────────────────────
  // 3. FAQ ACCORDIONS
  // ─────────────────────────────────────────────
  (function initFaqAccordions() {
    const faqLists = document.querySelectorAll('.faq-list');

    faqLists.forEach((list) => {
      const items     = list.querySelectorAll('.faq-item');
      const questions = list.querySelectorAll('.faq-question');

      questions.forEach((question) => {
        const item   = question.closest('.faq-item');
        const answer = item.querySelector('.faq-answer');

        if (!answer) return;

        // Initialise max-height for closed state
        answer.style.maxHeight = '0';
        answer.style.overflow  = 'hidden';
        answer.style.transition = 'max-height 0.3s ease';

        question.setAttribute('aria-expanded', 'false');

        question.addEventListener('click', () => {
          const isOpen = item.classList.contains('faq-open');

          // Close all items in this list first
          items.forEach((otherItem) => {
            const otherAnswer   = otherItem.querySelector('.faq-answer');
            const otherQuestion = otherItem.querySelector('.faq-question');
            if (otherItem !== item) {
              otherItem.classList.remove('faq-open');
              if (otherAnswer) otherAnswer.style.maxHeight = '0';
              if (otherQuestion) otherQuestion.setAttribute('aria-expanded', 'false');
            }
          });

          // Toggle clicked item
          if (isOpen) {
            item.classList.remove('faq-open');
            answer.style.maxHeight = '0';
            question.setAttribute('aria-expanded', 'false');
          } else {
            item.classList.add('faq-open');
            answer.style.maxHeight = answer.scrollHeight + 'px';
            question.setAttribute('aria-expanded', 'true');
          }
        });
      });
    });
  })();


  // ─────────────────────────────────────────────
  // 4. COPY TO CLIPBOARD (Promo Codes)
  // ─────────────────────────────────────────────
  (function initCopyButtons() {
    const copyBtns = document.querySelectorAll('.copy-btn');

    copyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-code');
        if (!code) return;

        const originalText = btn.textContent;

        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = 'Copied!';
          btn.classList.add('copied');
          btn.setAttribute('aria-label', 'Code copied to clipboard');

          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
            btn.setAttribute('aria-label', 'Copy promo code');
          }, 2000);
        }).catch(() => {
          // Fallback for older browsers / HTTP
          try {
            const textarea = document.createElement('textarea');
            textarea.value = code;
            textarea.style.position = 'fixed';
            textarea.style.opacity  = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            btn.textContent = 'Copied!';
            btn.classList.add('copied');
            setTimeout(() => {
              btn.textContent = originalText;
              btn.classList.remove('copied');
            }, 2000);
          } catch (_) {
            btn.textContent = 'Copy failed';
            setTimeout(() => { btn.textContent = originalText; }, 2000);
          }
        });
      });
    });
  })();


  // ─────────────────────────────────────────────
  // 5. SMOOTH SCROLL (Anchor Links)
  // ─────────────────────────────────────────────
  (function initSmoothScroll() {
    const HEADER_OFFSET = 56; // px — height of sticky header

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const hash   = anchor.getAttribute('href');
        if (hash === '#') return;

        const target = document.querySelector(hash);
        if (!target) return;

        e.preventDefault();

        const targetTop = target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;

        window.scrollTo({ top: targetTop, behavior: 'smooth' });

        // Update URL hash without jumping
        if (history.pushState) {
          history.pushState(null, null, hash);
        }
      });
    });
  })();


  // ─────────────────────────────────────────────
  // 6. BACK TO TOP BUTTON
  // ─────────────────────────────────────────────
  (function initBackToTop() {
    const btn = document.querySelector('.back-to-top');
    if (!btn) return;

    const SHOW_THRESHOLD = 300; // px from top

    function onScroll() {
      if (window.scrollY > SHOW_THRESHOLD) {
        btn.classList.add('visible');
        btn.setAttribute('aria-hidden', 'false');
      } else {
        btn.classList.remove('visible');
        btn.setAttribute('aria-hidden', 'true');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // run on init

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();


  // ─────────────────────────────────────────────
  // 7. TABLE SORTING
  // ─────────────────────────────────────────────
  (function initTableSorting() {
    const sortableHeaders = document.querySelectorAll('.sortable-header');

    sortableHeaders.forEach((header) => {
      header.style.cursor = 'pointer';
      header.setAttribute('role', 'button');
      header.setAttribute('tabindex', '0');
      header.setAttribute('aria-sort', 'none');

      function sortTable() {
        const table   = header.closest('table');
        const tbody   = table ? table.querySelector('tbody') : null;
        if (!table || !tbody) return;

        const headers    = Array.from(table.querySelectorAll('.sortable-header'));
        const colIndex   = headers.indexOf(header);
        const isAsc      = header.getAttribute('aria-sort') !== 'ascending';

        // Reset all header sort states
        headers.forEach((h) => {
          h.setAttribute('aria-sort', 'none');
          h.classList.remove('sort-asc', 'sort-desc');
        });

        header.setAttribute('aria-sort', isAsc ? 'ascending' : 'descending');
        header.classList.add(isAsc ? 'sort-asc' : 'sort-desc');

        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.sort((a, b) => {
          const cellA = a.querySelectorAll('td')[colIndex];
          const cellB = b.querySelectorAll('td')[colIndex];
          const rawA  = cellA ? cellA.textContent.trim() : '';
          const rawB  = cellB ? cellB.textContent.trim() : '';

          // Strip common currency/percent symbols for numeric comparison
          const numA = parseFloat(rawA.replace(/[^0-9.\-]/g, ''));
          const numB = parseFloat(rawB.replace(/[^0-9.\-]/g, ''));

          let comparison;
          if (!isNaN(numA) && !isNaN(numB)) {
            comparison = numA - numB; // numeric sort
          } else {
            comparison = rawA.localeCompare(rawB, 'en-ZA', { sensitivity: 'base' });
          }

          return isAsc ? comparison : -comparison;
        });

        // Re-append rows in sorted order
        rows.forEach((row) => tbody.appendChild(row));
      }

      header.addEventListener('click', sortTable);
      header.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sortTable();
        }
      });
    });
  })();


  // ─────────────────────────────────────────────
  // 8. ACTIVE NAV HIGHLIGHT
  // ─────────────────────────────────────────────
  (function initActiveNav() {
    const currentPath = window.location.pathname.replace(/\/$/, ''); // strip trailing slash

    document.querySelectorAll('nav a, .main-nav a').forEach((link) => {
      const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, '');

      if (linkPath === currentPath || (currentPath === '' && linkPath === '/index')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  })();


  // ─────────────────────────────────────────────
  // 9. LAZY LOAD IMAGES
  // ─────────────────────────────────────────────
  (function initLazyLoad() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    if (!lazyImages.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const img = entry.target;

          img.src = img.getAttribute('data-src');
          img.removeAttribute('data-src');

          if (img.getAttribute('data-srcset')) {
            img.srcset = img.getAttribute('data-srcset');
            img.removeAttribute('data-srcset');
          }

          img.classList.add('loaded');
          obs.unobserve(img);
        });
      }, {
        rootMargin: '200px 0px', // start loading 200px before viewport
        threshold: 0
      });

      lazyImages.forEach((img) => observer.observe(img));
    } else {
      // Fallback: load all images immediately for browsers without IntersectionObserver
      lazyImages.forEach((img) => {
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
      });
    }
  })();


  // ─────────────────────────────────────────────
  // 10. STICKY HEADER SHADOW
  // ─────────────────────────────────────────────
  (function initStickyHeader() {
    const header = document.querySelector('header, .site-header');
    if (!header) return;

    const SCROLL_THRESHOLD = 10; // px

    function onScroll() {
      if (window.scrollY > SCROLL_THRESHOLD) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // init on load
  })();


  // ─────────────────────────────────────────────
  // 11. AFFILIATE DISCLOSURE DISMISS
  // ─────────────────────────────────────────────
  (function initAffiliateDisclosure() {
    const bar       = document.querySelector('.disclosure-bar, .affiliate-disclosure');
    const dismissBtn = document.querySelector('.disclosure-dismiss, .disclosure-close');

    if (!bar) return;

    // Check if already dismissed this session
    if (window._sessionStore.getItem('disclosureDismissed') === 'true') {
      bar.style.display = 'none';
      return;
    }

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        bar.style.maxHeight  = bar.scrollHeight + 'px'; // set explicit height for animation
        requestAnimationFrame(() => {
          bar.style.transition = 'max-height 0.3s ease, opacity 0.3s ease';
          bar.style.maxHeight  = '0';
          bar.style.opacity    = '0';
          bar.style.overflow   = 'hidden';
        });
        bar.addEventListener('transitionend', () => {
          bar.style.display = 'none';
        }, { once: true });

        window._sessionStore.setItem('disclosureDismissed', 'true');
      });
    }
  })();


  // ─────────────────────────────────────────────
  // 12. TABLE OF CONTENTS — Active Section Highlight
  // ─────────────────────────────────────────────
  (function initTocHighlight() {
    const tocLinks   = document.querySelectorAll('.toc a[href^="#"], .sidebar-toc a[href^="#"]');
    if (!tocLinks.length) return;

    const sectionIds = Array.from(tocLinks).map((link) => {
      const hash = link.getAttribute('href');
      return { link, section: document.querySelector(hash) };
    }).filter((item) => item.section !== null);

    const HEADER_OFFSET = 56 + 16; // header height + small buffer

    function getActiveSection() {
      const scrollY = window.scrollY + HEADER_OFFSET;

      // Find the last section whose top is above current scroll position
      let active = null;
      for (const item of sectionIds) {
        const top = item.section.offsetTop;
        if (scrollY >= top) {
          active = item;
        }
      }
      return active;
    }

    function highlightToc() {
      const activeItem = getActiveSection();

      tocLinks.forEach((link) => {
        link.classList.remove('toc-active');
        link.removeAttribute('aria-current');
      });

      if (activeItem) {
        activeItem.link.classList.add('toc-active');
        activeItem.link.setAttribute('aria-current', 'true');
      }
    }

    window.addEventListener('scroll', highlightToc, { passive: true });
    highlightToc(); // init
  })();


  // ─────────────────────────────────────────────
  // 13. SEARCH / FILTER (Comparison Tables)
  // ─────────────────────────────────────────────
  (function initTableFilter() {
    const filterInputs = document.querySelectorAll('.table-filter, .casino-filter');

    filterInputs.forEach((input) => {
      // Find the associated table — look for data-target, or nearest table
      const targetSelector = input.getAttribute('data-target');
      const table = targetSelector
        ? document.querySelector(targetSelector)
        : input.closest('section, .filter-section')?.querySelector('table');

      if (!table) return;

      const tbody = table.querySelector('tbody');
      if (!tbody) return;

      // Cache row brand name cell index (default: first column)
      const brandColIndex = parseInt(input.getAttribute('data-col') || '0', 10);

      input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        const rows  = tbody.querySelectorAll('tr');
        let visibleCount = 0;

        rows.forEach((row) => {
          const cell = row.querySelectorAll('td')[brandColIndex];
          const text = cell ? cell.textContent.toLowerCase() : '';
          const match = !query || text.includes(query);
          row.style.display = match ? '' : 'none';
          if (match) visibleCount++;
        });

        // Show/hide empty state message
        let emptyMsg = table.parentElement.querySelector('.table-empty-msg');
        if (!emptyMsg) {
          emptyMsg = document.createElement('p');
          emptyMsg.className = 'table-empty-msg';
          emptyMsg.textContent = 'No casinos match your search.';
          emptyMsg.style.cssText = 'display:none; text-align:center; padding:1rem; color:var(--color-muted, #888);';
          table.parentElement.appendChild(emptyMsg);
        }
        emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
      });
    });
  })();


  // ─────────────────────────────────────────────
  // 14. RATING ANIMATION (Score Bars)
  // ─────────────────────────────────────────────
  (function initRatingAnimation() {
    const ratingBars = document.querySelectorAll('.rating-bar, .score-bar');
    if (!ratingBars.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const bar = entry.target;

          // Score can be set via data-score (0–10) or data-percent (0–100)
          let percent;
          if (bar.hasAttribute('data-percent')) {
            percent = parseFloat(bar.getAttribute('data-percent'));
          } else if (bar.hasAttribute('data-score')) {
            percent = (parseFloat(bar.getAttribute('data-score')) / 10) * 100;
          } else {
            // Fall back to inline width style already set
            return;
          }

          percent = Math.min(100, Math.max(0, percent));

          // Reset to 0 and animate to target
          const fill = bar.querySelector('.rating-fill, .score-fill, .bar-fill') || bar;
          fill.style.width      = '0%';
          fill.style.transition = 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)';

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              fill.style.width = percent + '%';
            });
          });

          obs.unobserve(bar);
        });
      }, { threshold: 0.2 });

      ratingBars.forEach((bar) => observer.observe(bar));
    } else {
      // Fallback: set width immediately
      ratingBars.forEach((bar) => {
        const fill = bar.querySelector('.rating-fill, .score-fill, .bar-fill') || bar;
        let percent;
        if (bar.hasAttribute('data-percent')) {
          percent = parseFloat(bar.getAttribute('data-percent'));
        } else if (bar.hasAttribute('data-score')) {
          percent = (parseFloat(bar.getAttribute('data-score')) / 10) * 100;
        }
        if (percent !== undefined) fill.style.width = percent + '%';
      });
    }
  })();


  // ─────────────────────────────────────────────
  // 15. COOKIE CONSENT BANNER
  // ─────────────────────────────────────────────
  (function initCookieConsent() {
    const STORAGE_KEY = 'cookieConsent';
    const existing    = window._storage.getItem(STORAGE_KEY);

    // Already responded — do nothing
    if (existing === 'accepted' || existing === 'declined') return;

    // Build and inject the banner
    const banner = document.createElement('div');
    banner.className   = 'cookie-banner';
    banner.id          = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.setAttribute('aria-live', 'polite');

    banner.innerHTML = `
      <div class="cookie-banner__content">
        <p class="cookie-banner__text">
          We use cookies to improve your experience and analyse site traffic.
          By clicking "Accept", you consent to our use of cookies.
          <a href="/privacy-policy.html" class="cookie-banner__link">Learn more</a>.
        </p>
        <div class="cookie-banner__actions">
          <button class="cookie-btn cookie-btn--decline" id="cookie-decline">Decline</button>
          <button class="cookie-btn cookie-btn--accept" id="cookie-accept">Accept</button>
        </div>
      </div>
    `;

    // Minimal inline styles so the banner works without a separate CSS rule
    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background: var(--color-surface, #1e1e1e);
      color: var(--color-text, #f0f0f0);
      border-top: 1px solid var(--color-border, #333);
      padding: 1rem 1.5rem;
      box-shadow: 0 -2px 12px rgba(0,0,0,0.15);
      font-size: 0.875rem;
    `;

    document.body.appendChild(banner);

    function dismissBanner(choice) {
      window._storage.setItem(STORAGE_KEY, choice);
      banner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      banner.style.transform  = 'translateY(100%)';
      banner.style.opacity    = '0';
      banner.addEventListener('transitionend', () => banner.remove(), { once: true });
    }

    document.getElementById('cookie-accept').addEventListener('click', () => dismissBanner('accepted'));
    document.getElementById('cookie-decline').addEventListener('click', () => dismissBanner('declined'));

    // Trap focus within the banner (Escape closes as decline)
    banner.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dismissBanner('declined');
    });

    // Focus the accept button by default
    setTimeout(() => {
      const acceptBtn = document.getElementById('cookie-accept');
      if (acceptBtn) acceptBtn.focus();
    }, 300);
  })();


}); // end DOMContentLoaded
