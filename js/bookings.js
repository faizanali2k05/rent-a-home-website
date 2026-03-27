import { supabase } from './supabaseClient.js';

export async function createBooking({property_id, tenant_id, start_date, end_date, message}){
  const payload = { property_id, tenant_id, start_date, end_date, message, status: 'pending' };
  const { data, error } = await supabase.from('bookings').insert(payload).select().single();
  if(error) throw error;
  // create a notification for landlord
  try{
    const prop = await supabase.from('properties').select('owner,title').eq('id', property_id).single();
    if(prop.data){
      await supabase.from('notifications').insert({ user_id: prop.data.owner, type: 'booking_request', title: 'New booking request', message: `New booking for ${prop.data.title}`, meta: { booking: data.id } });
    }
  }catch(e){/* non-fatal */}
  return data;
}

export async function payBooking(bookingId) {
  const { data, error } = await supabase.from('bookings').update({ is_paid: true }).eq('id', bookingId).select().single();
  if (error) throw error;

  // Notify landlord
  try {
    const prop = await supabase.from('properties').select('owner,title').eq('id', data.property_id).single();
    if(prop.data) {
      // Notify landlord
      await supabase.from('notifications').insert({ 
        user_id: prop.data.owner, 
        type: 'payment_received', 
        title: 'Payment Received', 
        message: `Rent payment received for ${prop.data.title}`, 
        meta: { booking: bookingId } 
      });
      // Notify tenant
      await supabase.from('notifications').insert({ 
        user_id: data.tenant_id, 
        type: 'payment_success', 
        title: 'Payment Successful', 
        message: `Your rent for ${prop.data.title} has been confirmed.`, 
        meta: { booking: bookingId } 
      });
    }
  } catch(e) {}
  return data;
}

export async function respondBooking({booking_id, status}){
  // status: approved | rejected
  const { data, error } = await supabase.from('bookings').update({ status }).eq('id', booking_id).select().single();
  if(error) throw error;
  
  // notify tenant
  try{
    const prop = await supabase.from('properties').select('title').eq('id', data.property_id).single();
    const title = prop.data?.title || 'Property';
    await supabase.from('notifications').insert({ 
      user_id: data.tenant_id, 
      type: 'booking_response', 
      title: `Booking ${status}`, 
      message: `Your booking for "${title}" was ${status}`, 
      meta: { booking: booking_id } 
    });
  }catch(e){/* non-fatal */}
  return data;
}

export async function fetchBookingsForUser(userId){
  // try RPC first (optional helper on DB). If it exists, return its result.
  try{
    const rpcRes = await supabase.rpc('get_bookings_for_user', { uid: userId });
    if(!rpcRes.error && rpcRes.data) return rpcRes.data;
  }catch(e){ /* ignore and fallback */ }

  // Fallback: fetch bookings where user is tenant
  const tenantRes = await supabase.from('bookings').select('*').eq('tenant_id', userId);
  if(tenantRes.error) throw tenantRes.error;
  const tenantBookings = tenantRes.data || [];

  // Fetch properties owned by user, then bookings for those properties
  const propsRes = await supabase.from('properties').select('id').eq('owner', userId);
  if(propsRes.error) throw propsRes.error;
  const propIds = (propsRes.data || []).map(p=>p.id);
  let ownerBookings = [];
  if(propIds.length){
    const bookRes = await supabase.from('bookings').select('*').in('property_id', propIds);
    if(bookRes.error) throw bookRes.error;
    ownerBookings = bookRes.data || [];
  }

  // Merge and return unique bookings
  const merged = [...tenantBookings];
  const existing = new Set(tenantBookings.map(b=>b.id));
  for(const b of ownerBookings){ if(!existing.has(b.id)){ merged.push(b); existing.add(b.id); } }
  return merged;
}
