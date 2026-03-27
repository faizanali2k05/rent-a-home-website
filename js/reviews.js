import { supabase } from './supabaseClient.js';

export async function fetchReviews(propertyId) {
  const { data, error } = await supabase.from('reviews').select(`*, profiles(full_name)`).eq('property_id', propertyId).order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addReview({ property_id, tenant_id, rating, comment }) {
  const { data, error } = await supabase.from('reviews').insert({ property_id, tenant_id, rating, comment }).select().single();
  if (error) throw error;
  return data;
}
