import { supabase } from './supabaseClient.js';

// Fetch properties with optional filters
export async function fetchProperties({city, minPrice, maxPrice, bedrooms, limit = 20, offset = 0} = {}){
  try{
    let q = supabase.from('properties').select('*').order('created_at', {ascending:false}).range(offset, offset + limit -1);
    if(city) q = q.ilike('city', `%${city}%`);
    if(bedrooms) q = q.eq('bedrooms', bedrooms);
    if(minPrice) q = q.gte('price', minPrice);
    if(maxPrice) q = q.lte('price', maxPrice);
    const { data, error } = await q;
    console.log('fetchProperties query result:', { dataLength: data?.length, error });
    if(error){
      console.error('fetchProperties error:', error);
      // Provide richer error info to help debugging (RLS / permission issues often appear here)
      if(error.details) console.error('details:', error.details);
      if(error.hint) console.error('hint:', error.hint);
      // Return empty array so UI can still render gracefully
      return [];
    }
    console.log('Returning', data?.length || 0, 'properties');
    return data || [];
  }catch(err){
    console.error('Unexpected fetchProperties exception:', err);
    return [];
  }
}

export async function getPropertyById(id){
  try {
    const { data, error } = await supabase.from('properties').select('*').eq('id', id).single();
    if(error) {
      console.error('getPropertyById error:', error);
      if(error.details) console.error('details:', error.details);
      if(error.hint) console.error('hint:', error.hint);
      throw error;
    }
    console.log('Property loaded:', data);
    return data;
  } catch(err) {
    console.error('Unexpected error in getPropertyById:', err);
    throw err;
  }
}

// Previously used to upload multiple images to a bucket, now removed as we use direct URLs
export async function addProperty({owner, title, description, city, address, price, bedrooms, bathrooms, amenities = [], availability = true, imageUrl}){
  // Ensure owner is the authenticated user if not provided
  if(!owner){
    try{
      const { data: userData } = await supabase.auth.getUser();
      owner = userData?.user?.id;
    }catch(e){ /* ignore - will fail later if owner missing */ }
  }

  const payload = { 
    owner, 
    title, 
    description, 
    city, 
    address, 
    price, 
    bedrooms, 
    bathrooms, 
    amenities, 
    availability, 
    image_url: imageUrl 
  };
  
  const { data, error } = await supabase.from('properties').insert(payload).select().single();
  if(error) throw error;
  return data;
}

export async function updateProperty(id, updates){
  try {
    // Don't select after update - just do the update
    const { error } = await supabase.from('properties').update(updates).eq('id', id);
    if(error){
      console.error('Update RLS/DB Error:', error);
      if(error.details) console.error('Details:', error.details);
      if(error.hint) console.error('Hint:', error.hint);
      throw error;
    }
    // Fetch fresh data after successful update
    const { data, fetchError } = await supabase.from('properties').select('*').eq('id', id).single();
    if(fetchError) {
      console.error('Fetch after update error:', fetchError);
      // Return empty object if fetch fails, but update succeeded
      return { id };
    }
    console.log('Property updated successfully. New data:', data);
    return data;
  } catch(err) {
    console.error('Unexpected error in updateProperty:', err);
    throw err;
  }
}

export async function deleteProperty(id){
  try {
    // Hard delete - completely remove from database
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if(error){
      console.error('Delete RLS/DB Error:', error);
      if(error.details) console.error('Details:', error.details);
      if(error.hint) console.error('Hint:', error.hint);
      throw error;
    }
    console.log('Property permanently deleted');
    return { id, deleted: true };
  } catch(err) {
    console.error('Unexpected error in deleteProperty:', err);
    throw err;
  }
}

export async function softDeleteProperty(id){
  // Deprecated: Use deleteProperty instead for hard delete
  return deleteProperty(id);
}

// Get properties owned by current user
export async function getMyProperties(){
  try{
    const { data: userData, error: authError } = await supabase.auth.getUser();
    console.log('getMyProperties - Auth check:', { userData: userData?.user?.id, authError });
    
    const ownerId = userData?.user?.id;
    if(!ownerId) throw new Error('Not authenticated - cannot get user ID');
    
    console.log('Fetching properties where owner =', ownerId);
    const { data, error } = await supabase.from('properties').select('*').eq('owner', ownerId).order('created_at', {ascending:false});
    
    console.log('getMyProperties query result:', { 
      userId: ownerId,
      propertiesFound: data?.length || 0, 
      error: error?.message,
      data: data 
    });
    
    if(error) throw error;
    return data || [];
  }catch(err){
    console.error('Error fetching user properties:', err);
    return [];
  }
}

// Debug function: Get ALL properties (bypass owner filter) to check if properties exist at all
export async function getAllPropertiesDebug(){
  try{
    console.log('DEBUG: Fetching ALL properties (no owner filter)...');
    const { data, error } = await supabase.from('properties').select('*').order('created_at', {ascending:false});
    console.log('DEBUG: All properties in database:', { count: data?.length || 0, data: data, error });
    return data || [];
  }catch(err){
    console.error('DEBUG: Error fetching all properties:', err);
    return [];
  }
}
