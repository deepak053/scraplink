import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Package, User, Phone, Mail, Clock, CheckCircle, XCircle, DollarSign, Calendar, Send } from 'lucide-react';
import { LoadingSpinner } from '../../components/UI/LoadingSpinner';
import { sendPickupSlotEmail } from '../../lib/emailService';
import { format } from 'date-fns';

interface PickupRequest {
  request_id: string;
  scrap_id: string;
  recycler_id: string;
  pickup_status: 'pending' | 'accepted' | 'completed';
  request_date: string;
  pickup_slot?: string;
  proposed_slots?: string;
  slot_notified?: boolean;
  scrap_listing?: {
    scrap_id: string;
    scrap_type: string;
    weight: number;
    estimated_price: number;
    description: string;
    status: string;
    user_id: string;
  };
  recycler?: {
    user_id: string;
    email: string;
    name?: string;
    phone?: string;
  };
}

export default function PickupRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PickupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [finalPrice, setFinalPrice] = useState<{ [key: string]: number }>({});
  const [pickupSlots, setPickupSlots] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user) {
      fetchPickupRequests();
    }
  }, [user]);

  const fetchPickupRequests = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching pickup requests for user:', user?.id);

      const { data: pickupRequests, error: requestsError } = await supabase
        .from('pickup_requests')
        .select(`
          request_id,
          scrap_id,
          recycler_id,
          pickup_status,
          request_date,
          pickup_slot,
          proposed_slots,
          slot_notified,
          scrap_listing:scrap_listings (
            scrap_id,
            scrap_type,
            weight,
            estimated_price,
            description,
            status,
            user_id
          )
        `)
        .eq('scrap_listings.user_id', user?.id)
        .order('request_date', { ascending: false });

      if (requestsError) {
        console.error('❌ Supabase fetch error:', requestsError);
        throw requestsError;
      }

      console.log('📦 Raw requests fetched:', pickupRequests);

      // Get recycler details for each request
      const requestsWithDetails = await Promise.all(
        (pickupRequests || []).map(async (request: any) => {
          const { data: recycler, error: recyclerError } = await supabase
            .from('users')
            .select('user_id, email, name, phone')
            .eq('user_id', request.recycler_id)
            .single();

          if (recyclerError) console.warn(`⚠️ Could not fetch recycler ${request.recycler_id}:`, recyclerError);

          return {
            ...request,
            // Handle both possible join names (aliased or direct)
            scrap_listing: request.scrap_listing || (Array.isArray(request.scrap_listings) ? request.scrap_listings[0] : request.scrap_listings),
            recycler: recycler
          } as PickupRequest;
        })
      );

      console.log('✅ Final requests with details:', requestsWithDetails);
      setRequests(requestsWithDetails);

      // Pre-fill pickup slots with the values requested by recyclers
      const initialSlots: { [key: string]: string } = {};
      requestsWithDetails.forEach((r) => {
        if (r.pickup_slot && r.pickup_slot !== 'Not specified') {
          initialSlots[r.request_id] = r.pickup_slot;
        }
      });
      setPickupSlots(prev => ({ ...prev, ...initialSlots }));
    } catch (error: any) {
      console.error('Error fetching pickup requests:', error);
      alert('Error loading requests: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    console.log('🚀 Accepting request:', requestId);
    try {
      setActionLoading(requestId);
      const slot = pickupSlots[requestId];

      if (!slot || slot.trim() === '') {
        alert('Please enter a pickup slot (e.g., Date and Time)');
        setActionLoading(null);
        return;
      }

      const { error: updateError } = await supabase
        .from('pickup_requests')
        .update({
          pickup_status: 'accepted',
          pickup_slot: slot
        })
        .eq('request_id', requestId);

      if (updateError) {
        console.error('❌ DB Update failed:', updateError);
        throw updateError;
      }

      // Update the listing status to accepted
      const request = requests.find(r => r.request_id === requestId);
      if (request?.scrap_id) {
        await supabase
          .from('scrap_listings')
          .update({ status: 'accepted' })
          .eq('scrap_id', request.scrap_id);
      }

      console.log('📧 Sending email to recycler...');
      // Send email notification
      if (request && request.recycler) {
        try {
          const dateObj = new Date(slot);
          const formattedSlotForEmail = isNaN(dateObj.getTime()) ? slot : format(dateObj, 'PPpp');

          const emailResponse = await sendPickupSlotEmail({
            to_email: request.recycler.email,
            to_name: request.recycler.name || 'Customer',
            from_name: user?.user_metadata?.name || 'Scrap Link Seller',
            scrap_type: request.scrap_listing?.scrap_type || 'Metal',
            weight: request.scrap_listing?.weight || 0,
            pickup_slot: formattedSlotForEmail
          });
          console.log('✅ Email service response:', emailResponse);

          // Mark as notified in DB
          const { error: notifyError } = await supabase
            .from('pickup_requests')
            .update({ slot_notified: true })
            .eq('request_id', requestId);

          if (notifyError) console.warn('⚠️ Failed to mark slot_notified in DB:', notifyError);

        } catch (emailErr: any) {
          console.error('Failed to send notification email:', emailErr);
          alert('Request accepted, but email notification failed: ' + (emailErr.message || 'Unknown error'));
        }
      }

      alert('Request accepted and pickup slot scheduled!');
      await fetchPickupRequests();
    } catch (error: any) {
      console.error('Error accepting request:', error);
      alert('Failed to accept request: ' + (error.message || 'Unknown error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      setActionLoading(requestId);

      const { error } = await supabase
        .from('pickup_requests')
        .delete()
        .eq('request_id', requestId);

      if (error) throw error;

      await fetchPickupRequests();
      alert('Request rejected successfully.');
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      alert('Failed to reject request: ' + (error.message || 'Unknown error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteTransaction = async (requestId: string) => {
    try {
      setActionLoading(requestId);
      const request = requests.find(r => r.request_id === requestId);
      const price = finalPrice[requestId];

      if (!price || price <= 0) {
        alert('Please enter a valid final price');
        setActionLoading(null);
        return;
      }

      if (!request) {
        alert('Request not found');
        setActionLoading(null);
        return;
      }

      // Update pickup request
      const { error: requestError } = await supabase
        .from('pickup_requests')
        .update({
          pickup_status: 'completed'
        })
        .eq('request_id', requestId);

      if (requestError) throw requestError;

      // Update listing status
      if (request.scrap_id) {
        await supabase
          .from('scrap_listings')
          .update({ status: 'completed' })
          .eq('scrap_id', request.scrap_id);
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          seller_id: request.scrap_listing?.user_id,
          recycler_id: request.recycler_id,
          scrap_id: request.scrap_id,
          final_price: price,
          status: 'completed'
        });

      if (transactionError) {
        console.error('Transaction creation error:', transactionError);
        throw transactionError;
      }

      // Clear the final price input
      setFinalPrice(prev => {
        const newPrices = { ...prev };
        delete newPrices[requestId];
        return newPrices;
      });

      alert('Transaction completed successfully!');
      await fetchPickupRequests();

      // Trigger a custom event to notify other components
      window.dispatchEvent(new CustomEvent('transactionCompleted', {
        detail: { transactionId: transactionError }
      }));
    } catch (error) {
      console.error('Error completing transaction:', error);
      alert('Failed to complete transaction. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendConfirmation = async (requestId: string) => {
    console.log('🔄 Resending confirmation email for request:', requestId);
    try {
      setActionLoading(requestId);
      const request = requests.find(r => r.request_id === requestId);

      if (!request || !request.recycler) {
        alert('Request or recycler information not found');
        return;
      }

      if (!request.pickup_slot) {
        alert('No pickup slot assigned to this request');
        return;
      }

      console.log('📧 Resending email to recycler:', request.recycler.email);
      try {
        const emailResponse = await sendPickupSlotEmail({
          to_email: request.recycler.email,
          to_name: request.recycler.name || 'Customer',
          from_name: user?.user_metadata?.name || 'Scrap Link Seller',
          scrap_type: request.scrap_listing?.scrap_type || 'Metal',
          weight: request.scrap_listing?.weight || 0,
          pickup_slot: request.pickup_slot
        });
        console.log('✅ Confirmation email resent:', emailResponse);

        // Update the slot_notified flag
        await supabase
          .from('pickup_requests')
          .update({ slot_notified: true })
          .eq('request_id', requestId);

        alert('Confirmation email resent successfully!');
        await fetchPickupRequests();
      } catch (emailErr: any) {
        console.error('❌ Failed to resend email:', emailErr);
        alert('Failed to resend email: ' + (emailErr.message || 'Unknown error'));
      }
    } catch (error: any) {
      console.error('Error resending confirmation:', error);
      alert('Failed to resend confirmation: ' + (error.message || 'Unknown error'));
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      accepted: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Pickup Requests</h1>
          <p className="mt-2 text-gray-600">Manage pickup requests for your scrap listings</p>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No pickup requests</h3>
            <p className="text-gray-600">You don't have any pickup requests yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((request) => (
              <div key={request.request_id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Package className="w-6 h-6 text-indigo-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        Pickup Request
                      </h3>
                    </div>
                    {getStatusBadge(request.pickup_status)}
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Scrap Details */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 flex items-center">
                        <Package className="w-4 h-4 mr-2" />
                        Scrap Details
                      </h4>
                      {request.scrap_listing ? (
                        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                          <p><span className="font-medium">Type:</span> {request.scrap_listing.scrap_type}</p>
                          <p><span className="font-medium">Weight:</span> {request.scrap_listing.weight} kg</p>
                          <p><span className="font-medium">Estimated Price:</span> ₹{request.scrap_listing.estimated_price}</p>
                          <p><span className="font-medium">Description:</span> {request.scrap_listing.description}</p>
                          <p><span className="font-medium">Status:</span>
                            <span className={`ml-2 px-2 py-1 rounded text-xs ${request.scrap_listing.status === 'available' ? 'bg-green-100 text-green-800' :
                              request.scrap_listing.status === 'accepted' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                              {request.scrap_listing.status}
                            </span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-red-600">⚠️ Scrap listing details not available</p>
                      )}
                    </div>

                    {/* Recycler Details */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900 flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Recycler Details
                      </h4>
                      {request.recycler ? (
                        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                          <p className="flex items-center">
                            <User className="w-4 h-4 mr-2 text-gray-500" />
                            <span className="font-medium">Name:</span>
                            <span className="ml-2">{request.recycler.name || 'Not provided'}</span>
                          </p>
                          <p className="flex items-center">
                            <Mail className="w-4 h-4 mr-2 text-gray-500" />
                            <span className="font-medium">Email:</span>
                            <span className="ml-2">{request.recycler.email}</span>
                          </p>
                          <p className="flex items-center">
                            <Phone className="w-4 h-4 mr-2 text-gray-500" />
                            <span className="font-medium">Phone:</span>
                            <span className="ml-2">{request.recycler.phone || 'Not provided'}</span>
                          </p>
                        </div>
                      ) : (
                        <p className="text-red-600">⚠️ Recycler details not available</p>
                      )}
                    </div>
                  </div>

                  {/* Request Timeline */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="flex items-center text-sm text-gray-600 space-x-4">
                      <span className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        Requested: {new Date(request.request_date).toLocaleDateString()}
                      </span>
                      {request.pickup_slot && (
                        <span className="flex items-center text-indigo-600 font-medium">
                          <Calendar className="w-4 h-4 mr-1" />
                          Pickup Slot: {request.pickup_slot}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    {request.pickup_status === 'pending' && (
                      <div className="space-y-6">
                        {request.proposed_slots && (
                          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                            <label className="block text-sm font-medium text-indigo-900 mb-2 flex items-center">
                              <Calendar className="w-4 h-4 mr-2" />
                              Select from Recycler's Proposals
                            </label>
                            <select
                              className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  // The value is the ISO string from recycler
                                  setPickupSlots({ ...pickupSlots, [request.request_id]: val });
                                }
                              }}
                              value={pickupSlots[request.request_id] || ""}
                            >
                              <option value="">-- Choose a proposed slot --</option>
                              {(() => {
                                try {
                                  const slots = JSON.parse(request.proposed_slots);
                                  return Array.isArray(slots) ? slots.map((slot, i) => {
                                    const dateObj = new Date(slot);
                                    const formattedLabel = isNaN(dateObj.getTime())
                                      ? slot
                                      : format(dateObj, 'PPpp'); // Nice human readable format inside dropdown
                                    return (
                                      <option key={i} value={slot}>
                                        {formattedLabel}
                                      </option>
                                    );
                                  }) : null;
                                } catch (e) {
                                  return null;
                                }
                              })()}
                            </select>
                            <p className="mt-2 text-xs text-indigo-600 italic">
                              * Selecting a proposal will auto-fill the calendar below.
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <label className="block text-sm font-medium text-gray-700">
                              Confirm or Set Pickup Slot
                            </label>
                            <div className="relative">
                              <input
                                type="datetime-local"
                                value={pickupSlots[request.request_id] || ''}
                                onChange={(e) => setPickupSlots({ ...pickupSlots, [request.request_id]: e.target.value })}
                                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex items-end space-x-3">
                            <button
                              onClick={() => handleAcceptRequest(request.request_id)}
                              disabled={actionLoading === request.request_id || !pickupSlots[request.request_id]}
                              className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center font-medium shadow-sm transition-colors"
                            >
                              {actionLoading === request.request_id ? (
                                <LoadingSpinner />
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Accept Request
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleRejectRequest(request.request_id)}
                              disabled={actionLoading === request.request_id}
                              className="bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center justify-center font-medium transition-colors"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {request.pickup_status === 'accepted' && (
                      <div className="space-y-3">
                        {/* Notification Status */}
                        {request.slot_notified && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-sm text-green-800 flex items-center">
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Recycler has been notified via email
                            </p>
                          </div>
                        )}

                        {/* Resend Confirmation Button */}
                        <button
                          onClick={() => handleResendConfirmation(request.request_id)}
                          disabled={actionLoading === request.request_id}
                          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center font-medium"
                        >
                          {actionLoading === request.request_id ? (
                            <LoadingSpinner />
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Resend Confirmation Email
                            </>
                          )}
                        </button>

                        <div className="flex items-center space-x-3">
                          <label className="flex-1">
                            <span className="block text-sm font-medium text-gray-700 mb-1">
                              Final Price (₹)
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={finalPrice[request.request_id] || request.scrap_listing?.estimated_price || ''}
                              onChange={(e) => setFinalPrice(prev => ({
                                ...prev,
                                [request.request_id]: parseFloat(e.target.value) || 0
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Enter final price"
                            />
                          </label>
                        </div>
                        <button
                          onClick={() => handleCompleteTransaction(request.request_id)}
                          disabled={
                            actionLoading === request.request_id ||
                            !finalPrice[request.request_id] ||
                            finalPrice[request.request_id] <= 0
                          }
                          className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
                        >
                          {actionLoading === request.request_id ? (
                            <LoadingSpinner />
                          ) : (
                            <>
                              <DollarSign className="w-4 h-4 mr-2" />
                              Complete Transaction
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {request.pickup_status === 'completed' && (
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-green-800 font-medium">
                          Transaction completed successfully
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
        }
      </div >
    </div >
  );
}