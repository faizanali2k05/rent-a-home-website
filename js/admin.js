import { supabase } from './supabaseClient.js';
import { addProperty, updateProperty, deleteProperty, fetchProperties } from './properties.js';

export async function loadAdminOverviewData(){
  const [propertiesRes, bookingsRes, paymentsRes, profilesRes] = await Promise.all([
    supabase.from('properties').select('*').order('created_at', { ascending: false }),
    supabase.from('bookings').select('id,status,property_id,tenant_id,created_at').order('created_at', { ascending: false }),
    supabase.from('payments').select('id,amount,month,paid_at').order('paid_at', { ascending: false }),
    supabase.from('profiles').select('id,role,full_name')
  ]);

  const properties = propertiesRes.data || [];
  const bookings = bookingsRes.data || [];
  const payments = paymentsRes.data || [];
  const profiles = profilesRes.data || [];

  const analytics = {
    totalListings: properties.length,
    availableListings: properties.filter((p) => p.availability !== false).length,
    totalBookings: bookings.length,
    approvedBookings: bookings.filter((b) => b.status === 'approved').length,
    pendingBookings: bookings.filter((b) => b.status === 'pending').length,
    totalRevenue: payments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    totalUsers: profiles.length,
    landlords: profiles.filter((p) => p.role === 'landlord').length,
    tenants: profiles.filter((p) => p.role === 'tenant').length
  };

  const reports = {
    latestBookings: bookings.slice(0, 10),
    latestPayments: payments.slice(0, 10),
    bookingStatusBreakdown: [
      { label: 'Pending', value: analytics.pendingBookings },
      { label: 'Approved', value: analytics.approvedBookings },
      { label: 'Rejected', value: bookings.filter((b) => b.status === 'rejected').length }
    ]
  };

  const errors = [
    propertiesRes.error ? `Listings: ${propertiesRes.error.message}` : null,
    bookingsRes.error ? `Bookings: ${bookingsRes.error.message}` : null,
    paymentsRes.error ? `Payments: ${paymentsRes.error.message}` : null,
    profilesRes.error ? `Profiles: ${profilesRes.error.message}` : null
  ].filter(Boolean);

  return { analytics, reports, properties, errors };
}

export async function createAdminListing(userId, payload){
  return addProperty({ owner: userId, ...payload });
}

export async function updateAdminListing(id, updates){
  return updateProperty(id, updates);
}

export async function deleteAdminListing(id){
  return deleteProperty(id);
}

export async function fetchAdminListings(){
  return fetchProperties({ limit: 200 });
}

export function subscribeToAdminRealtime(onChange){
  const channel = supabase
    .channel('admin-dashboard-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, (payload) => {
      onChange?.({ source: 'properties', payload });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, (payload) => {
      onChange?.({ source: 'bookings', payload });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, (payload) => {
      onChange?.({ source: 'payments', payload });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
