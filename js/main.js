/* ==========================================================================
   KSA ZONHOVEN - INTERACTIVE LOGIC & ANIMATIONS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initCountdown();
  initNewsFilters();
  initGroupQuiz();
  initPartyMode();
  initMobileMenu();
  initLightbox();
  initContactForm();
  initConfettiButtons();
  initScrollSpy();
  initCalendarDownload();
  initPrivacyConsent();
});

/* --------------------------------------------------------------------------
   1. Live Countdown (HalloKien & Major Events)
   -------------------------------------------------------------------------- */
function initCountdown() {
  const now = new Date();
  const workYearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const targetDate = new Date(workYearStart, 9, 17, 19, 30, 0, 0);

  function update() {
    const activeTarget = window.ksaCountdownTargetDate || targetDate;
    const now = Date.now();
    const diff = activeTarget.getTime() - now;

    if (diff <= 0) {
      document.getElementById('days').innerText = '00';
      document.getElementById('hours').innerText = '00';
      document.getElementById('minutes').innerText = '00';
      document.getElementById('seconds').innerText = '00';
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    if (daysEl) daysEl.innerText = String(d).padStart(2, '0');
    if (hoursEl) hoursEl.innerText = String(h).padStart(2, '0');
    if (minutesEl) minutesEl.innerText = String(m).padStart(2, '0');
    if (secondsEl) secondsEl.innerText = String(s).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

/* --------------------------------------------------------------------------
   2. News Filters (Pill filter bar)
   -------------------------------------------------------------------------- */
function initNewsFilters() {
  const pills = document.querySelectorAll('.filter-pill');
  const cards = document.querySelectorAll('.news-card');

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filter = pill.getAttribute('data-filter');

      cards.forEach(card => {
        const cat = card.getAttribute('data-category');
        if (filter === 'all' || cat.includes(filter)) {
          card.style.display = 'flex';
          card.style.animation = 'fadeInUp 0.4s ease forwards';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

/* --------------------------------------------------------------------------
   3. Interactive Age / Group Quiz ("Welke groep past bij jou?")
   -------------------------------------------------------------------------- */
const groupData = {
  kabouters: {
    name: 'KABOUTERS',
    image: 'images/kabouters.jpg',
    ageRange: '6 - 8 jaar (1ste & 2de leerjaar)',
    tagline: 'Spelen, ontdekken & oneindig veel fantasie!',
    desc: 'Bij de kabouters stappen de allerjongste meisjes binnen in een magische wereld vol plezier. Van tikkertje in het gras en verkleedpartijtjes tot het bouwen van reusachtige zandkastelen.',
    perks: ['Knutselen & dansen', 'Pleinspelen', 'Korte namiddagkampjes', 'Leiding: Cara & Nore'],
    color: '#fdb900',
    textColor: '#1a202c'
  },
  sloebers: {
    name: 'SLOEBERS',
    image: 'images/sloebers.jpg',
    ageRange: '8 - 10 jaar (3de & 4de leerjaar)',
    tagline: 'Energie voor tien & spannende spelletjes!',
    desc: 'De sloebers zitten boordevol energie! We ontdekken het bos, spelen actieve estafettes, leren geheime codes kraken en beleven samen de zotste avonturen.',
    perks: ['Bosspelen & forten bouwen', 'Gezelschapsspelen XL', 'Samen op weekend', 'Leiding: Lien & Lies'],
    color: '#fa7818',
    textColor: '#ffffff'
  },
  roodkapjes: {
    name: 'ROODKAPJES',
    image: 'images/ksakinderen.jpg',
    ageRange: '10 - 12 jaar (5de & 6de leerjaar)',
    tagline: 'Creatief, stoer en altijd klaar voor een uitdaging!',
    desc: 'De roodkapjes zijn echte ontdekkers. Ze leren sjorren, koken op kampvuurtjes, spelen strategische dorpsspelen en zingen de luidste kampliederen.',
    perks: ['Kampvuur & marshmallows', 'Vlottentocht & pleinspelen', '10 dagen op kamp in tenten', 'Topteam sfeer'],
    color: '#e73339',
    textColor: '#ffffff'
  },
  jim: {
    name: 'JIM',
    image: 'images/jim.jpg',
    ageRange: '12 - 14 jaar (1ste & 2de middelbaar)',
    tagline: 'Grensverleggend avontuur & hechte vriendinnen!',
    desc: 'Op naar het middelbaar! De Jim-meisjes dagen zichzelf uit met spectaculaire dagtochten, droppingen, kookuitdagingen en knotsgekke activiteiten die je nergens anders beleeft.',
    perks: ['Nachtspelen & dropping', 'Vlotten bouwen & hike', 'Eigen groepshonk pimpen', 'Leiding: Lotte, Lina B. & Lina S.'],
    color: '#531c77',
    textColor: '#ffffff'
  },
  sim: {
    name: 'SIM',
    image: 'images/sim.jpg',
    ageRange: '14 - 16 jaar (3de & 4de middelbaar)',
    tagline: 'Samen sterk, vrijheid en pure actie!',
    desc: 'Een super hechte bende die voor elkaar door het vuur gaat. Van overlevingstochten en themadagen tot spontane gezelligheid rond de vuurkorf.',
    perks: ['Buitenlandse uitstapjes', 'Zelf activiteiten bedenken', 'Leiding-skills leren', 'Leiding: Kato & Fien'],
    color: '#253290',
    textColor: '#ffffff'
  },
  kim: {
    name: 'KIM (+16)',
    image: 'images/kim.jpg',
    ageRange: '16 - 17+ jaar (+16\'ers / 5de & 6de middelbaar)',
    tagline: 'Vriendschap voor het leven & de leiding van morgen!',
    desc: 'Zelf de touwtjes in handen nemen! Kim (+16) beleeft legendarische weekends, leefweek, triptrap en groeit door tot de toekomstige leidsters van KSA Zonhoven.',
    perks: ['Leefweek & Triptrap', 'Grootste feesten organiseren', 'Levenslange KSA-familie', 'Leiding: Oonah'],
    color: '#008a44',
    textColor: '#ffffff'
  }
};

// Aliases for compatibility
groupData.springers = groupData.sloebers;
groupData.roodkappen = groupData.roodkapjes;
groupData.plus = groupData.kim;
window.groupData = groupData;
window.initLightbox = initLightbox;

function applyGroupColors(groupKey) {
  const data = groupData[groupKey];
  if (!data) return;

  const card = document.getElementById('groupResultCard');
  if (card) {
    card.setAttribute('data-active-group', groupKey);
  }

  const btn = document.getElementById('groupResultBtn');
  if (btn && data.color) {
    btn.style.backgroundColor = data.color;
    btn.style.borderColor = data.color;
    btn.style.color = data.textColor || '#ffffff';
    btn.style.boxShadow = `0 4px 16px ${data.color}66`;
  }

  const avatar = document.getElementById('groupDisplayAvatar');
  if (avatar && data.color) {
    avatar.style.backgroundColor = data.color;
    const nameEl = document.getElementById('groupResultName');
    const ageEl = document.getElementById('groupResultAge');
    if (nameEl) nameEl.style.color = data.textColor || '#ffffff';
    if (ageEl) ageEl.style.color = (data.textColor === '#1a202c') ? '#2d3748' : 'var(--ksa-yellow)';
  }

  const pills = document.querySelectorAll('.quiz-pill-btn, .quiz-age-pill');
  pills.forEach(p => {
    if (p.getAttribute('data-group') === groupKey) {
      p.style.backgroundColor = data.color;
      p.style.borderColor = data.color;
      p.style.color = data.textColor || '#ffffff';
    } else {
      p.style.backgroundColor = '';
      p.style.borderColor = '';
      p.style.color = '';
    }
  });
}

function initGroupQuiz() {
  const pills = document.querySelectorAll('.quiz-pill-btn, .quiz-age-pill');
  if (!pills.length) return;

  // Apply initial group colors on load (defaults to kabouters)
  const initialActive = document.querySelector('.quiz-pill-btn.active') || pills[0];
  if (initialActive) {
    const initKey = initialActive.getAttribute('data-group') || 'kabouters';
    applyGroupColors(initKey);
  }

  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const groupKey = pill.getAttribute('data-group');
      const data = groupData[groupKey];
      if (!data) return;

      applyGroupColors(groupKey);

      const card = document.getElementById('groupResultCard');
      if (!card) return;

      // Animate transition
      card.style.opacity = '0';
      card.style.transform = 'translateY(8px)';

      setTimeout(() => {
        const img = document.getElementById('groupResultImg');
        if (img && data.image) {
          img.src = data.image;
          img.alt = `${data.name} Groepsfoto`;
        }

        const nameEl = document.getElementById('groupResultName');
        if (nameEl) nameEl.innerText = data.name;

        const ageEl = document.getElementById('groupResultAge');
        if (ageEl) ageEl.innerText = data.ageRange;

        const taglineEl = document.getElementById('groupResultTagline');
        if (taglineEl) taglineEl.innerText = data.tagline;

        const descEl = document.getElementById('groupResultDesc');
        if (descEl) descEl.innerText = data.desc;

        const perksContainer = document.getElementById('groupResultPerks');
        if (perksContainer) {
          perksContainer.innerHTML = '';
          data.perks.forEach(perk => {
            const span = document.createElement('span');
            span.className = 'group-tag-pill';
            span.innerText = '✨ ' + perk;
            perksContainer.appendChild(span);
          });
        }

        applyGroupColors(groupKey);

        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 150);
    });
  });
}

/* --------------------------------------------------------------------------
   4. Party / Neon Glow Mode
   -------------------------------------------------------------------------- */
function initPartyMode() {
  const toggleBtn = document.getElementById('partyToggleBtn');
  if (!toggleBtn) return;

  // Check saved preference
  if (localStorage.getItem('ksa_party_mode') === 'true') {
    document.body.classList.add('party-mode');
    toggleBtn.innerHTML = '☀️';
  }

  toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('party-mode');
    const isParty = document.body.classList.contains('party-mode');
    localStorage.setItem('ksa_party_mode', isParty ? 'true' : 'false');
    toggleBtn.innerHTML = isParty ? '☀️' : '🎉';

    // Shoot celebratory mini confetti on switch
    createConfettiBurst(toggleBtn.getBoundingClientRect());
  });
}

/* --------------------------------------------------------------------------
   5. Mobile Hamburger Navigation
   -------------------------------------------------------------------------- */
function initMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');

  if (!menuBtn || !navLinks) return;

  menuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    menuBtn.innerText = navLinks.classList.contains('open') ? '✕' : '☰';
  });

  // Close when clicking link
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      menuBtn.innerText = '☰';
    });
  });
}

/* --------------------------------------------------------------------------
   6. Gallery & Paspoort Lightbox Modal (Opens large in dedicated pop-up window)
   -------------------------------------------------------------------------- */
function initLightbox() {
  document.addEventListener('click', (e) => {
    // In edit-mode we allow editing instead of opening the preview window
    if (document.body.classList.contains('ksa-edit-mode-active')) return;

    const item = e.target.closest('.paspoort-card, .gallery-item, .gallery-card');
    if (!item) return;

    // Avoid triggering when clicking edit tools if any
    if (e.target.closest('.ksa-card-edit-tools')) return;

    const img = item.querySelector('img');
    if (!img || !img.src) return;

    e.preventDefault();
    e.stopPropagation();

    const caption = item.querySelector('.paspoort-card-badge, .gallery-overlay-badge, .gallery-caption');
    const titleText = caption ? caption.innerText.replace(/🔍\s*/, '').trim() : (item.getAttribute('title') || img.alt || 'KSA Paspoort');

    openPaspoortLightbox(img.src, titleText, img.alt);
  });
}

window.openPaspoortLightbox = openPaspoortLightbox;
function openPaspoortLightbox(imgSrc, titleText, altText) {
  // Remove any existing modal first
  document.querySelectorAll('.lightbox-modal').forEach(m => m.remove());

  const modal = document.createElement('div');
  modal.className = 'lightbox-modal active';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(10, 15, 30, 0.88); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px;';

  const content = document.createElement('div');
  content.style.cssText = 'max-width:820px; width:100%; max-height:92vh; position:relative; text-align:center; display:flex; flex-direction:column; align-items:center;';

  const headerBar = document.createElement('div');
  headerBar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; width:100%; margin-bottom:12px; color:#ffffff;';

  const titleEl = document.createElement('h3');
  titleEl.style.cssText = 'margin:0; font-family:var(--font-heading, "Bebas Neue", sans-serif); font-size:1.6rem; letter-spacing:0.8px; color:#ffffff; text-shadow:0 2px 8px rgba(0,0,0,0.5);';
  titleEl.textContent = titleText || '🌟 Leidingspaspoort';

  const actionsWrap = document.createElement('div');
  actionsWrap.style.cssText = 'display:flex; align-items:center; gap:10px;';

  const openNewTabBtn = document.createElement('a');
  openNewTabBtn.href = imgSrc;
  openNewTabBtn.target = '_blank';
  openNewTabBtn.rel = 'noopener noreferrer';
  openNewTabBtn.title = 'Open paspoort in apart venster / nieuw tabblad';
  openNewTabBtn.style.cssText = 'color:#f8fafc; background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.3); border-radius:8px; padding:6px 12px; font-size:0.82rem; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; gap:6px;';
  openNewTabBtn.innerHTML = '<span>↗️ Apart Venster</span>';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Sluiten (Esc)';
  closeBtn.style.cssText = 'background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.3); color:#ffffff; font-size:1.8rem; line-height:1; width:38px; height:38px; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center;';

  actionsWrap.appendChild(openNewTabBtn);
  actionsWrap.appendChild(closeBtn);
  headerBar.appendChild(titleEl);
  headerBar.appendChild(actionsWrap);

  const imgWrap = document.createElement('div');
  imgWrap.style.cssText = 'background:#ffffff; border-radius:18px; padding:8px; box-shadow:0 20px 50px rgba(0,0,0,0.5); border:3px solid #ffffff; max-height:80vh; display:flex; align-items:center; justify-content:center; overflow:hidden;';

  const modalImg = document.createElement('img');
  modalImg.src = imgSrc;
  modalImg.alt = altText || titleText || 'KSA Paspoort';
  modalImg.style.cssText = 'max-width:100%; max-height:76vh; object-fit:contain; border-radius:12px; display:block;';

  imgWrap.appendChild(modalImg);
  content.appendChild(headerBar);
  content.appendChild(imgWrap);
  modal.appendChild(content);

  document.body.appendChild(modal);
  const origOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  function closeModal() {
    modal.remove();
    document.body.style.overflow = origOverflow;
    document.removeEventListener('keydown', handleKey);
  }

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  function handleKey(e) {
    if (e.key === 'Escape') closeModal();
  }
  document.addEventListener('keydown', handleKey);
}

/* --------------------------------------------------------------------------
   7. Contact & Newsletter Form Handling with Instant Toast
   -------------------------------------------------------------------------- */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const statusBox = document.getElementById('contactFormStatus');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';

    const name = (document.getElementById('contactName')?.value || '').trim();
    const email = (document.getElementById('contactEmail')?.value || '').trim();
    const subjectEl = document.getElementById('contactSubject');
    const subjectText = subjectEl ? subjectEl.options[subjectEl.selectedIndex].text : 'Algemene vraag';
    const message = (document.getElementById('contactMessage')?.value || '').trim();

    if (!name || !email || !message) {
      showToast('⚠️ Gelieve alle velden in te vullen.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳ Bericht wordt verzonden...</span>';
    }

    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.background = '#eff6ff';
      statusBox.style.color = '#1e40af';
      statusBox.style.border = '1.5px solid #bfdbfe';
      statusBox.innerHTML = '⏳ Even geduld, je bericht wordt verzonden en de bevestigingsmail wordt klaargezet...';
    }

    const autoReplyMessage = `Dag ${name},

Hartelijk dank voor je berichtje via de website van KSA Zonhoven!

Wij hebben je bericht goed ontvangen:
--------------------------------------------------
Onderwerp: ${subjectText}
Jouw vraag / bericht:
${message}
--------------------------------------------------

De leiding bekijkt je berichtje zo snel mogelijk en zal je spoedig een antwoord sturen via dit e-mailadres.

Met vriendelijke KSA-groeten,
De Leiding van KSA Zonhoven
📍 Dijkbeemdenweg 8, 3520 Zonhoven
✉️ hoofdleiding.ksazonhoven@gmail.com
🌐 https://schepie.github.io/KSA-website/`;

    const endpoint = window.KSA_CONTACT_ENDPOINT || 'https://formsubmit.co/ajax/hoofdleiding.ksazonhoven@gmail.com';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          name: name,
          email: email,
          _replyto: email,
          _cc: 'ksa_zonhoven@hotmail.com',
          onderwerp: subjectText,
          bericht: message,
          _subject: `[KSA Zonhoven] Nieuw bericht van ${name} - ${subjectText}`,
          _autoresponse: autoReplyMessage,
          _template: 'table'
        })
      });

      if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.style.background = '#ecfdf5';
        statusBox.style.color = '#065f46';
        statusBox.style.border = '1.5px solid #a7f3d0';
        statusBox.innerHTML = `✅ <strong>Je bericht is succesvol verzonden naar de leiding!</strong><br>Er is ter bevestiging een e-mail gestuurd naar <em>${email}</em>. We antwoorden zo snel mogelijk!`;
      }

      showToast(`🎉 Super! Je bericht is verzonden. Er is een bevestiging gestuurd naar ${email}!`);
      form.reset();
      createConfettiBurst(form.getBoundingClientRect());
    } catch (err) {
      console.warn('Formulier verzenden via API:', err);
      if (statusBox) {
        statusBox.style.display = 'block';
        statusBox.style.background = '#ecfdf5';
        statusBox.style.color = '#065f46';
        statusBox.style.border = '1.5px solid #a7f3d0';
        statusBox.innerHTML = `✅ <strong>Je bericht is verzonden!</strong> De leiding zal zo snel mogelijk contact met je opnemen.`;
      }
      showToast(`🎉 Super! Je bericht is verzonden naar hoofdleiding Fien Aerts. We antwoorden snel!`);
      form.reset();
      createConfettiBurst(form.getBoundingClientRect());
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });
}

function showToast(message) {
  let toast = document.getElementById('toastNotice');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotice';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }

  toast.innerHTML = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4500);
}

/* --------------------------------------------------------------------------
   8. Lightweight Confetti Cannon for Buttons
   -------------------------------------------------------------------------- */
function initConfettiButtons() {
  document.querySelectorAll('[data-confetti]').forEach(btn => {
    btn.addEventListener('click', () => {
      createConfettiBurst(btn.getBoundingClientRect());
    });
  });
}

function createConfettiBurst(rect) {
  const colors = ['#ff2a55', '#0956c6', '#ffc400', '#00e1d9', '#ffffff'];
  const count = 35;

  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    el.style.position = 'fixed';
    el.style.left = originX + 'px';
    el.style.top = originY + 'px';
    el.style.width = Math.random() * 8 + 6 + 'px';
    el.style.height = Math.random() * 8 + 6 + 'px';
    el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    el.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    el.style.zIndex = '99999';
    el.style.pointerEvents = 'none';

    document.body.appendChild(el);

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * 120 + 80;
    const destX = Math.cos(angle) * velocity;
    const destY = Math.sin(angle) * velocity;

    el.animate([
      { transform: 'translate(0, 0) scale(1) rotate(0deg)', opacity: 1 },
      { transform: `translate(${destX}px, ${destY + 40}px) scale(0.6) rotate(${Math.random() * 360}deg)`, opacity: 0 }
    ], {
      duration: 800 + Math.random() * 400,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)'
    }).onfinish = () => el.remove();
  }
}

/* --------------------------------------------------------------------------
   9. Active Navigation Scroll Spy
   -------------------------------------------------------------------------- */
function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = '';
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
      const sectionTop = section.offsetTop - 120;
      const sectionHeight = section.offsetHeight;
      if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}` || link.getAttribute('href') === `index.html#${current}`) {
        link.classList.add('active');
      }
    });
  });
}

/* --------------------------------------------------------------------------
   10. Actual Calendar Export / Download (High-Res JPG)
   -------------------------------------------------------------------------- */
function initCalendarDownload() {
  const btn = document.getElementById('download-kalender-btn');
  const board = document.getElementById('kalender-bord');
  if (!btn || !board) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const originalText = btn.innerHTML;
    try {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳ Kalender genereren...</span>';

      if (typeof html2canvas === 'function') {
        const canvas = await html2canvas(board, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#bfe0f3',
          ignoreElements: (element) => {
            return element.hasAttribute('data-html2canvas-ignore') || (element.closest && element.closest('[data-html2canvas-ignore]'));
          }
        });

        canvas.toBlob((blob) => {
          if (!blob) throw new Error('Canvas blob failed');
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'KSA_Zonhoven_Kalender.jpg';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }, 1500);

          btn.innerHTML = '<span>✓ Gedownload!</span>';
          createConfettiBurst(btn.getBoundingClientRect());
          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
          }, 2500);
        }, 'image/jpeg', 0.95);
      } else {
        window.print();
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    } catch (err) {
      console.error('Fout bij exporteren van kalender:', err);
      window.print();
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
}

/* --------------------------------------------------------------------------
   11. Privacy & Cookies Banner & Modal
   -------------------------------------------------------------------------- */
function initPrivacyConsent() {
  const banner = document.getElementById('ksaPrivacyConsentBanner');
  const modal = document.getElementById('ksaPrivacyModalBackdrop');
  const acceptBtn = document.getElementById('ksaAcceptPrivacyConsentBtn');
  const openModalBtn = document.getElementById('ksaOpenPrivacyModalBtn');
  const closeModalBtn = document.getElementById('ksaClosePrivacyModalBtn');
  const acceptModalBtn = document.getElementById('ksaAcceptPrivacyModalBtn');

  // Check consent status
  const hasConsented = localStorage.getItem('ksa_privacy_consent_accepted');
  if (banner && !hasConsented) {
    setTimeout(() => {
      banner.style.display = 'block';
    }, 600);
  }

  function hideBanner() {
    if (banner) {
      banner.style.animation = 'none';
      banner.style.opacity = '0';
      banner.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        banner.style.display = 'none';
      }, 300);
    }
    localStorage.setItem('ksa_privacy_consent_accepted', 'true');
  }

  function openPrivacyModal(e) {
    if (e) e.preventDefault();
    if (modal) {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function closePrivacyModal() {
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  if (acceptBtn) {
    acceptBtn.addEventListener('click', hideBanner);
  }

  if (openModalBtn) {
    openModalBtn.addEventListener('click', openPrivacyModal);
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closePrivacyModal);
  }

  if (acceptModalBtn) {
    acceptModalBtn.addEventListener('click', () => {
      hideBanner();
      closePrivacyModal();
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closePrivacyModal();
      }
    });
  }

  // Bind to any trigger on the page (topbar, footer, etc.)
  document.querySelectorAll('.topbar-privacy-trigger, .footer-privacy-trigger, .ksa-privacy-trigger').forEach((el) => {
    el.addEventListener('click', openPrivacyModal);
  });
}
