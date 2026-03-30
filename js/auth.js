import { supabase } from './supabaseClient.js';

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
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if(error) throw error;
  const user = data.user;
  if(!user) return { user: null };

  // fetch profile to get role and full_name
  const { data: profileData, error: profErr } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if(profErr) throw profErr;

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
