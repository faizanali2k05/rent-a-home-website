import { supabase } from './supabaseClient.js';
import { getLocalUser, logout, refreshLocalUser } from './auth.js';

export function generateInvoice(booking, property, type = 'INVOICE', month = null) {
  const title = type === 'RECEIPT' ? 'Payment Receipt' : 'Property Invoice';
  const invoiceHtml = `
    <html>
      <head>
        <title>${title} - Rent a Home</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>body{padding:40px; font-family:sans-serif;} .header{border-bottom:2px solid #eee; padding-bottom:20px; margin-bottom:20px;}</style>
      </head>
      <body>
        <div class="header d-flex justify-content-between">
          <div><h1>${type}</h1><p class="text-muted">ID: ${booking.id.slice(0,8).toUpperCase()}</p></div>
          <div class="text-end"><h4>Rent a Home</h4><p>${new Date().toLocaleDateString()}</p></div>
        </div>
        <div class="row mb-4">
          <div class="col-6"><h5>Property</h5><p>${property.title}<br>${property.city}</p></div>
          <div class="col-6 text-end"><h5>Info</h5><p>${month ? 'Rent Month: ' + month : 'Lease: ' + booking.start_date + ' to ' + booking.end_date}</p></div>
        </div>
        <table class="table">
          <thead><tr><th>Description</th><th class="text-end">Amount</th></tr></thead>
          <tbody>
            <tr><td>${month ? 'Rent for ' + month : 'Total Rent'}</td><td class="text-end">$${property.price}</td></tr>
            <tr><td><strong>Total Paid</strong></td><td class="text-end"><strong>$${property.price}</strong></td></tr>
          </tbody>
        </table>
        <div class="mt-5 text-center text-muted"><p>Thank you for choosing Rent a Home.</p></div>
        <script>window.onload = () => window.print();</script>
      </body>
    </html>
  `;
  const win = window.open('', '_blank');
  win.document.write(invoiceHtml);
  win.document.close();
}

export function initNavbar(){
  const user = getLocalUser();
  const navAuth = document.getElementById('nav-auth');
  const navList = document.querySelector('.nav-list');
  const menuButton = document.querySelector('.mobile-menu');
  if(!navAuth) return;
  if (navList) navList.innerHTML = '';
  if(user){
    navAuth.innerHTML = `
      <a href="index.html#footer" class="nav-auth-link secondary">About Us</a>
      <a href="dashboard.html" class="nav-auth-link primary">My Dashboard</a>
      <button type="button" id="btn-logout" class="nav-auth-link secondary nav-auth-button">Logout</button>
    `;
  }else{
    navAuth.innerHTML = `
      <a href="index.html#footer" class="nav-auth-link secondary">About Us</a>
      <a href="login.html" class="nav-auth-link secondary">Login</a>
      <a href="register.html" class="nav-auth-link primary">Sign Up</a>
    `;
  }

  const closeMenu = () => {
    menuButton?.classList.remove('active');
    navList?.classList.remove('active');
    navAuth.classList.remove('active');
    document.body.classList.remove('menu-open');
  };

  const toggleMenu = () => {
    menuButton.classList.toggle('active');
    navList?.classList.toggle('active');
    navAuth.classList.toggle('active');
    document.body.classList.toggle('menu-open');
  };

  document.querySelectorAll('.nav-list a, #nav-auth a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await logout();
    closeMenu();
    window.location.href = 'index.html';
  });

  window.showMenu = toggleMenu;
}

export async function loadNotifications(containerId){
  const u = getLocalUser();
  if(!u) return;
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', u.id).order('created_at', {ascending:false}).limit(10);
  const el = document.getElementById(containerId);
  if(!el) return;
  if(error){ el.innerText = 'Failed to load notifications'; return; }
  if(!data.length){ el.innerHTML = '<div class="small text-muted py-3">You\'re all caught up!</div>'; return; }
  el.innerHTML = data.map(n=>`
    <div class="p-3 border-bottom hover-bg">
      <div class="fw-bold small">${n.title}</div>
      <div class="small text-muted">${n.message}</div>
      <div class="text-end" style="font-size:0.7rem; color:#cbd5e1">${new Date(n.created_at).toLocaleDateString()}</div>
    </div>
  `).join('');
}

export function showLoading(container, show=true){
  if(!container) return;
  container.style.opacity = show ? '0.6' : '1';
}

export function showError(container, message){
  if(!container) return; container.innerHTML = `<div class="alert alert-danger">${message}</div>`;
}

// Run when pages load
document.addEventListener('DOMContentLoaded', async ()=>{
  // Ensure we refresh local user information first, then render navbar
  await refreshLocalUser();
  initNavbar();
});

/* --------- merged from appUI.js (UI helpers & slideshow) --------- */
window.showMenu = window.showMenu || function showMenuFallback() {};


if (window.gsap) {
  const doAnim = (sel, opts) => { if (document.querySelectorAll(sel).length) gsap.from(sel, opts); };
  doAnim('.navbar', { duration: 1, delay: 0.3, x: -40, opacity: 0, ease: 'expo.inOut' });
  doAnim('.header-headline', { duration: 1.2, delay: 0.5, y: 80, opacity: 0, ease: 'expo.inOut' });
  doAnim('.header-subtitle', { duration: 1.2, delay: 0.5, y: 20, opacity: 0, ease: 'expo.inOut' });
  doAnim('.cta', { duration: 1.2, delay: 0.6, y: 20, opacity: 0, ease: 'expo.inOut' });
  doAnim('form', { duration: 1.2, delay: 0.3, y: 80, opacity: 0, ease: 'expo.inOut' });
  doAnim('.product-info', { duration: 1.2, delay: 0.5, x: -100, opacity: 0, ease: 'expo.inOut' });
  // product cards may be added dynamically later; animate when present
  const animateCards = () => {
    const cards = document.querySelectorAll('.product-card');
    if (cards.length) gsap.from(cards, { duration: 1.2, delay: 0.5, y: 200, opacity: 0, ease: 'expo.inOut', stagger: 0.08 });
  };
  animateCards();
  // Also observe for dynamically added product cards
  const grid = document.getElementById('properties-grid');
  if (grid) {
    const obs = new MutationObserver((muts) => { animateCards(); });
    obs.observe(grid, { childList: true, subtree: true });
  }
}

// Single background image for `#hover-bg`
document.addEventListener('DOMContentLoaded', () => {
  const bg = document.getElementById('hover-bg');
  if (!bg) return;
  const singleBackground = './images/1.jpeg';
  bg.style.backgroundImage = `url('${singleBackground}')`;
  bg.style.opacity = '0.78';
  bg.style.transform = 'scale(1.02)';
  bg.style.filter = 'brightness(0.5) saturate(1.06)';
});

/* --------- end merged content --------- */
