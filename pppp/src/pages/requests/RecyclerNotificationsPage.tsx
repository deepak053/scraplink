import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Package, Clock, CheckCircle, Calendar, User, Mail } from 'lucide-react';
import { LoadingSpinner } from '../../components/UI/LoadingSpinner';
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
        seller?: {
            name: string;
            email: string;
            phone: string;
        };
    };
}

export default function RecyclerNotificationsPage() {
    const { profile } = useAuth();
    const [requests, setRequests] = useState<PickupRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'completed'>('all');

    useEffect(() => {
        if (profile) {
            fetchMyRequests();
        }
    }, [profile]);

    const fetchMyRequests = async () => {
        try {
            setLoading(true);
            console.log('🔄 Fetching requests for recycler:', profile?.user_id);

            const { data: pickupRequests, error } = await supabase
                .from('pickup_requests')
                .select(`
          request_id,
          scrap_id,
          recycler_id,
          pickup_status,
          request_date,
          pickup_slot,
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
                .eq('recycler_id', profile?.user_id)
                .order('request_date', { ascending: false });

            if (error) throw error;

            // Fetch seller details for each request
            const requestsWithSellers = await Promise.all(
                (pickupRequests || []).map(async (request: any) => {
                    const listing = request.scrap_listing;
                    if (listing?.user_id) {
                        const { data: seller } = await supabase
                            .from('users')
                            .select('name, email, phone')
                            .eq('user_id', listing.user_id)
                            .single();

                        return {
                            ...request,
                            scrap_listing: {
                                ...listing,
                                seller
                            }
                        };
                    }
                    return request;
                })
            );

            setRequests(requestsWithSellers as PickupRequest[]);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="w-4 h-4 mr-1" />
                        Pending
                    </span>
                );
            case 'accepted':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Accepted
                    </span>
                );
            case 'completed':
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        <Package className="w-4 h-4 mr-1" />
                        Completed
                    </span>
                );
            default:
                return null;
        }
    };

    const filteredRequests = requests.filter(req =>
        filter === 'all' || req.pickup_status === filter
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">My Pickup Requests</h1>
                    <p className="mt-2 text-gray-600">Track your scrap pickup requests and notifications</p>
                </div>

                {/* Filter Tabs */}
                <div className="mb-6 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        {(['all', 'pending', 'accepted', 'completed'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setFilter(tab)}
                                className={`${filter === tab
                                    ? 'border-green-500 text-green-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize`}
                            >
                                {tab} ({requests.filter(r => tab === 'all' || r.pickup_status === tab).length})
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Requests List */}
                {filteredRequests.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <Package className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900">No requests found</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {filter === 'all'
                                ? "You haven't made any pickup requests yet."
                                : `No ${filter} requests at the moment.`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredRequests.map((request) => (
                            <div
                                key={request.request_id}
                                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <h3 className="text-xl font-semibold text-gray-900">
                                                {request.scrap_listing?.scrap_type || 'Unknown'} Scrap
                                            </h3>
                                            {getStatusBadge(request.pickup_status)}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <p className="text-sm text-gray-600">Weight</p>
                                                <p className="font-medium">{request.scrap_listing?.weight || 0} kg</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Estimated Price</p>
                                                <p className="font-medium">₹{request.scrap_listing?.estimated_price || 0}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-600">Request Date</p>
                                                <p className="font-medium">
                                                    {format(new Date(request.request_date), 'MMM dd, yyyy - hh:mm a')}
                                                </p>
                                            </div>
                                            {request.pickup_slot && request.pickup_status !== 'pending' && (
                                                <div>
                                                    <p className="text-sm text-gray-600">Scheduled Pickup</p>
                                                    <p className="font-medium text-green-600 flex items-center">
                                                        <Calendar className="w-4 h-4 mr-1" />
                                                        {request.pickup_slot}
                                                    </p>
                                                </div>
                                            )}
                                            {request.pickup_status === 'pending' && request.proposed_slots && (
                                                <div className="col-span-1 md:col-span-2">
                                                    <p className="text-sm text-gray-600 mb-1">Proposed Slots (Waiting for seller selection):</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(() => {
                                                            try {
                                                                const slots = JSON.parse(request.proposed_slots);
                                                                return Array.isArray(slots) ? slots.map((s, i) => {
                                                                    const dateObj = new Date(s);
                                                                    const formattedDate = isNaN(dateObj.getTime())
                                                                        ? s
                                                                        : format(dateObj, 'MMM dd, yyyy - hh:mm a');
                                                                    return (
                                                                        <span key={i} className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-medium border border-yellow-200 flex items-center gap-1">
                                                                            <Calendar className="w-3 h-3" />
                                                                            {formattedDate}
                                                                        </span>
                                                                    );
                                                                }) : <span className="text-sm italic">{request.proposed_slots}</span>;
                                                            } catch (e) {
                                                                return <span className="text-sm italic">{request.proposed_slots}</span>;
                                                            }
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Seller Information */}
                                        {request.scrap_listing?.seller && (
                                            <div className="mt-4 pt-4 border-t border-gray-200">
                                                <p className="text-sm font-medium text-gray-700 mb-2">Seller Information</p>
                                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                                    <div className="flex items-center">
                                                        <User className="w-4 h-4 mr-1" />
                                                        {request.scrap_listing.seller.name}
                                                    </div>
                                                    <div className="flex items-center">
                                                        <Mail className="w-4 h-4 mr-1" />
                                                        {request.scrap_listing.seller.email}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Status Messages */}
                                        {request.pickup_status === 'accepted' && request.slot_notified && (
                                            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                                                <p className="text-sm text-green-800">
                                                    ✅ Your request has been accepted! Check your email for pickup details.
                                                </p>
                                            </div>
                                        )}

                                        {request.pickup_status === 'pending' && (
                                            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                <p className="text-sm text-yellow-800">
                                                    ⏳ Waiting for seller to accept your request...
                                                </p>
                                            </div>
                                        )}

                                        {request.pickup_status === 'completed' && (
                                            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <p className="text-sm text-blue-800">
                                                    🎉 Transaction completed successfully!
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
