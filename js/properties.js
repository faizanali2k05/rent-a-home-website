import { supabase } from './supabaseClient.js';

// Fetch properties with optional filters
export async function fetchProperties({city, minPrice, maxPrice, bedrooms, limit = 20, offset = 0} = {}){
  let q = supabase.from('properties').select('*').eq('is_deleted', false).order('created_at', {ascending:false}).range(offset, offset + limit -1);
  if(city) q = q.ilike('city', `%${city}%`);
  if(bedrooms) q = q.eq('bedrooms', bedrooms);
  // price range
  if(minPrice) q = q.gte('price', minPrice);
  if(maxPrice) q = q.lte('price', maxPrice);
  const { data, error } = await q;
  if(error) throw error;
  return data;
}

export async function getPropertyById(id){
  const { data, error } = await supabase.from('properties').select('*').eq('id', id).single();
  if(error) throw error;
  return data;
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
  const { data, error } = await supabase.from('properties').update(updates).eq('id', id).select().single();
  if(error) throw error;
  return data;
}

export async function softDeleteProperty(id){
  const { data, error } = await supabase.from('properties').update({ is_deleted: true }).eq('id', id).select().single();
  if(error) throw error;
  return data;
}
