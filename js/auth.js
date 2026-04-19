import { supabase } from './supabaseClient.js';

const ADMIN_CREDENTIALS = [
  { email: 'admin@mail.com', password: 'admin123', name: 'System Admin' },
  { email: 'reyan97531@gmail.com', password: 'BSF2206491', name: 'Reyan Abbas' },
  { email: 'tayyaba.fiaz03@gmail.com', password: 'BSF2206471', name: 'Tayyaba Fiaz' },
  { email: 'haseebkhaliq0001@gmail.com', password: 'BSF2206481', name: 'Haseeb Ullah' }
];

function getAdminMatch(email, password) {
  const e = String(email || '').trim().toLowerCase();
  const p = String(password || '');
  return ADMIN_CREDENTIALS.find(c => c.email === e && c.password === p);
}

function isAdminCredentialPair(email, password){
  return !!getAdminMatch(email, password);
}

// Register a new user and create profile row
export async function register({email, password, full_name, phone, role}){
  // create auth user
  const { data, error } = await supabase.auth.signUp({ email, password });
  if(error) throw error;

  // Wait for user id (in many flows the user is created immediately)
  const user = data.user;
  if(!user) return { user: null };

  // insert profile (must use same id as auth.user)
  const profile = {
    id: user.id,
    full_name,
    phone,
    role
  };
  const { error: pErr } = await supabase.from('profiles').insert(profile);
  if(pErr) throw pErr;

  // store minimal info locally
  localStorage.setItem('rental_user', JSON.stringify({id: user.id, email, role, full_name}));
  return { user };
}

export async function login({email, password}){
  const wantsAdmin = isAdminCredentialPair(email, password);
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });

  // If admin credentials were entered and account is missing, create it automatically.
  if(error && wantsAdmin){
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if(signUpError && !String(signUpError.message || '').toLowerCase().includes('already')) throw signUpError;
    const retry = await supabase.auth.signInWithPassword({ email, password });
    data = retry.data;
    error = retry.error;
  }

  if(error) throw error;
  const user = data?.user;
  if(!user) return { user: null };

  // fetch profile to get role and full_name
  let { data: profileData, error: profErr } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

  // Auto-bootstrap admin profile when logging in with fixed admin credentials.
  if(wantsAdmin){
    if(!profileData){
      const adminMatch = getAdminMatch(email, password);
      const adminProfile = {
        id: user.id,
        full_name: adminMatch ? adminMatch.name : 'System Admin',
        phone: '',
        role: 'admin'
      };
      const { error: insertErr } = await supabase.from('profiles').insert(adminProfile);
      if(insertErr) throw insertErr;
      profileData = adminProfile;
      profErr = null;
    } else if(profileData.role !== 'admin'){
      const { error: roleErr } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id);
      if(roleErr) throw roleErr;
      profileData.role = 'admin';
    }
  }

  if(profErr) throw profErr;
  if(!profileData) throw new Error('Profile not found for this account.');

  localStorage.setItem('rental_user', JSON.stringify({id: user.id, email: user.email, role: profileData?.role, full_name: profileData?.full_name}));
  return { user, profile: profileData };
}

export async function logout(){
  await supabase.auth.signOut();
  localStorage.removeItem('rental_user');
}

export function getLocalUser(){
  try{
    return JSON.parse(localStorage.getItem('rental_user'));
  }catch(e){ return null; }
}

export function requireAuth(redirect = '/login.html'){
  const u = getLocalUser();
  if(!u){ window.location.href = redirect; }
  return u;
}

export async function refreshLocalUser(){
  // Refresh role from profiles table
  const u = getLocalUser();
  if(!u) return null;
  if(u?.role === 'admin' && ADMIN_CREDENTIALS.find(c => c.email === u?.email?.toLowerCase())) return u;
  const { data, error } = await supabase.from('profiles').select('role,full_name').eq('id', u.id).single();
  if(!error && data){
    u.role = data.role;
    u.full_name = data.full_name;
    localStorage.setItem('rental_user', JSON.stringify(u));
  }
  return u;
}
export function isLandlord(){
  const user = getLocalUser();
  return user?.role === 'landlord';
}

export function isAdmin(){
  const user = getLocalUser();
  return user?.role === 'admin';
}
