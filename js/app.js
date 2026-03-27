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
  if(!navAuth) return;
  if(user){
    navAuth.innerHTML = `
      <span class="me-3 d-none d-md-inline text-white-50">Signed in as <strong>${user.full_name || user.email}</strong></span>
      <a href="dashboard.html" class="btn btn-sm btn-outline-light me-2">My Dashboard</a>
      <button id="btn-logout" class="btn btn-sm btn-danger">Logout</button>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', async ()=>{ await logout(); window.location.href = 'index.html';});
  }else{
    navAuth.innerHTML = `
      <a href="login.html" class="btn btn-sm btn-outline-light me-2">Login</a>
      <a href="register.html" class="btn btn-sm btn-light">Get Started</a>
    `;
  }
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
  initNavbar();
  await refreshLocalUser();
});
