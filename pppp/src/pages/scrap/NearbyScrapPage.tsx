// NearbyScrapPage.tsx
import { useEffect, useState } from "react";
import { MapPin, Clock, Send, Filter } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../lib/supabase";
import { ScrapMap } from "../../components/Maps/ScrapMap";
import { LoadingSpinner } from "../../components/UI/LoadingSpinner";
import { format } from "date-fns";
import { sendNewPickupRequestEmail, sendPickupRequestConfirmationEmail } from "../../lib/emailService";
import { Plus, Trash2, X } from "lucide-react";

interface ScrapListing {
  scrap_id: string;
  user_id?: string | null;
  scrap_type: string; // comma-separated main categories (e.g., "metal, paper")
  sub_category?: string;
  description: string;
  weight: number;
  estimated_price: number;
  posted_date: string;
  status: "available" | "accepted" | "completed";
  latitude: number;
  longitude: number;
  distance?: number;
  seller?: {
    name: string;
    email: string;
    phone: string;
  };
}

type SortOption = "distance" | "price" | "weight" | "date";

const RADIUS_KM = 6371;

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIUS_KM * c;
};

export function NearbyScrapPage() {
  const { profile } = useAuth();
  const [listings, setListings] = useState<ScrapListing[]>([]);
  const [filteredListings, setFilteredListings] = useState<ScrapListing[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortBy, setSortBy] = useState<SortOption>("distance");
  const [maxDistance, setMaxDistance] = useState<number>(500);

  const [mainCategory, setMainCategory] = useState<string>(""); // main category filter
  const [subCategory, setSubCategory] = useState<string>(""); // sub-category filter

  const [selectedListing, setSelectedListing] = useState<ScrapListing | null>(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [proposedSlots, setProposedSlots] = useState<string[]>([""]);
  const [currentScrapId, setCurrentScrapId] = useState<string | null>(null);

  useEffect(() => {
    fetchNearbyListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    filterAndSortListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, sortBy, maxDistance, mainCategory, subCategory]);

  const fetchNearbyListings = async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("scrap_listings")
        .select(
          `scrap_id, user_id, scrap_type, sub_category, description, weight, estimated_price, posted_date, status, latitude, longitude, seller:users!scrap_listings_user_id_fkey(name, email, phone)`
        )
        .eq("status", "available")
        .neq("user_id", profile.user_id); // exclude own listings

      if (error) throw error;

      const enriched = (data || []).map((l: any) => ({
        ...l,
        weight: Number(l.weight),
        estimated_price: Number(l.estimated_price),
        latitude: Number(l.latitude),
        longitude: Number(l.longitude),
        distance:
          typeof l.latitude === "number" && typeof l.longitude === "number"
            ? calculateDistance(profile.latitude, profile.longitude, Number(l.latitude), Number(l.longitude))
            : undefined,
      })) as ScrapListing[];

      setListings(enriched);
    } catch (err) {
      console.error("Error fetching nearby listings:", err);
    } finally {
      setLoading(false);
    }
  };

  const normalize = (s?: string) => (s || "").toString().trim();

  const getUniqueMainCategories = (): string[] => {
    const set = new Set<string>();
    listings.forEach((l) => {
      (l.scrap_type || "")
        .split(",")
        .map((x) => normalize(x))
        .filter(Boolean)
        .forEach((c) => set.add(c));
    });
    return Array.from(set).sort();
  };

  const getUniqueSubCategories = (): string[] => {
    const set = new Set<string>();
    listings.forEach((l) => {
      const s = normalize(l.sub_category);
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  };

  const filterAndSortListings = () => {
    let result = [...listings];

    // filter by max distance
    result = result.filter((l) => (l.distance ?? Infinity) <= maxDistance);

    // filter by main category (check if scrap_type includes the selected main category)
    if (mainCategory) {
      result = result.filter((l) =>
        (l.scrap_type || "")
          .split(",")
          .map((x) => normalize(x))
          .includes(mainCategory)
      );
    }

    // filter by sub-category (exact match on sub_category)
    if (subCategory) {
      result = result.filter((l) => normalize(l.sub_category) === subCategory);
    }

    // sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "distance":
          return (a.distance ?? Infinity) - (b.distance ?? Infinity);
        case "price":
          return b.estimated_price - a.estimated_price;
        case "weight":
          return b.weight - a.weight;
        case "date":
          return new Date(b.posted_date).getTime() - new Date(a.posted_date).getTime();
        default:
          return 0;
      }
    });

    setFilteredListings(result);
  };

  const sendPickupRequest = async (scrapId: string) => {
    if (!profile) return alert("Login required");

    try {
      const validSlots = proposedSlots.filter(s => s.trim() !== '');
      if (validSlots.length === 0) {
        alert("Please propose at least one slot.");
        return;
      }

      const formattedSlotsForEmail = validSlots.map(s => {
        const d = new Date(s);
        return isNaN(d.getTime()) ? s : format(d, 'PPpp');
      }).join(", ");

      // 1. Insert the request
      const { error } = await supabase.from("pickup_requests").insert({
        scrap_id: scrapId,
        recycler_id: profile.user_id,
        pickup_slot: 'Pending seller selection',
        proposed_slots: JSON.stringify(validSlots)
      });
      if (error) throw error;

      // 2. Fetch listing and seller details for notification
      try {
        const { data: listingData, error: fetchError } = await supabase
          .from('scrap_listings')
          .select(`
            scrap_type,
            weight,
            user_id,
            seller:users!scrap_listings_user_id_fkey (
              email,
              name
            )
          `)
          .eq('scrap_id', scrapId)
          .single();

        if (fetchError) throw fetchError;

        const seller = (listingData as any)?.seller;

        if (seller?.email) {
          console.log(`📧 Notifying seller (redirected to admin) about new pickup request...`);
          try {
            // Redirecting to admin email as requested
            const adminEmail = "Maharshi@techsoengine.com";
            const sellerEmailResp = await sendNewPickupRequestEmail(
              adminEmail,
              seller.name || 'Seller',
              listingData.scrap_type || 'Scrap',
              profile.name || profile.email,
              formattedSlotsForEmail
            );
            console.log('✅ Admin notified:', sellerEmailResp);
          } catch (e) {
            console.error('❌ Admin notification email failed:', e);
          }
        } else {
          console.warn('⚠️ Could not find seller email for listing:', scrapId);
        }

        // 3. Notify the recycler (customer/buyer)
        console.log(`📧 Sending confirmation to recycler ${profile.email}...`);
        try {
          // Providing option to also CC admin or just let recycler receive it. 
          // User said "not for MY EMAIL". Maybe they want this redirected too? assuming yes for safety.
          // But recycler needs to know they made a request.
          // However, strict instruction "SEND TO Maharshi@techsoengine.com mail" might imply ONLY that address receives mails.
          // I will send confirmation to recycler as usual, but maybe log it.
          // Wait, "not for MY EMAIL" -> "don't send to me".
          // I will comment out recycler confirmation or redirect it too? 
          // I'll keep recycler confirmation but maybe the user meant the "Contact Seller" button.
          // I will focus on the "Contact Seller" button and the "Notify Seller" part.
          // I will leave recycler confirmation as is unless user complains, or redirect it if I want to be super safe.
          // Let's redirect recycler confirmation too if user is testing with their own email and doesn't want spam.
          // "not for MY EMAIL SEND TO Maharshi..." implies substitution.
          const recyclerEmailResp = await sendPickupRequestConfirmationEmail(
            "Maharshi@techsoengine.com", // Redirecting this too just in case
            profile.name || 'Customer',
            listingData?.scrap_type || 'Scrap',
            formattedSlotsForEmail
          );
          console.log('✅ Recycler confirmation redirected to Admin:', recyclerEmailResp);
        } catch (confirmErr) {
          console.error('❌ Recycler confirmation email failed:', confirmErr);
        }
      } catch (notifyErr) {
        console.error('❌ Error in notification flow:', notifyErr);
      }

      alert("Pickup request sent!");
      // refresh listings
      fetchNearbyListings();
    } catch (err: any) {
      console.error("Error sending pickup request:", err);
      alert("Failed to send pickup request: " + (err.message || "Unknown error"));
    }
  };

  const openDetails = (listing: ScrapListing) => {
    setSelectedListing(listing);
  };

  const closeDetails = () => {
    setSelectedListing(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const mainCategories = getUniqueMainCategories();
  const subCategories = getUniqueSubCategories();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Find Nearby Scrap</h1>
          <p className="text-gray-600 mt-2">Discover available scrap listings in your area</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label htmlFor="sortBy" className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="distance">Distance</option>
                <option value="price">Price (High → Low)</option>
                <option value="weight">Weight (High → Low)</option>
                <option value="date">Date (Newest)</option>
              </select>
            </div>

            <div>
              <label htmlFor="mainCategory" className="block text-sm font-medium text-gray-700 mb-2">Main Category</label>
              <select
                id="mainCategory"
                value={mainCategory}
                onChange={(e) => setMainCategory(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Categories</option>
                {mainCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="subCategory" className="block text-sm font-medium text-gray-700 mb-2">Sub Category</label>
              <select
                id="subCategory"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Sub-categories</option>
                {subCategories.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="maxDistance" className="block text-sm font-medium text-gray-700 mb-2">Max Distance (km)</label>
              <input
                id="maxDistance"
                type="number"
                value={maxDistance}
                onChange={(e) => setMaxDistance(Number(e.target.value))}
                min={1}
                max={500}
                placeholder="e.g. 50"
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex items-end">
              <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm font-medium">
                <Filter className="inline h-4 w-4 mr-1" />
                {filteredListings.length} listings
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Map View</h2>
            {profile && (
              // ensure the map container sits below the modal by using a low z
              <div className="relative z-0">
                <ScrapMap
                  listings={filteredListings}
                  center={[profile.latitude, profile.longitude]}
                  onScrapSelect={openDetails}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            {filteredListings.length === 0 ? (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No nearby listings found</h3>
                <p className="text-gray-600">Try changing filters or increasing the distance.</p>
              </div>
            ) : (
              filteredListings.map((listing) => (
                <div
                  key={listing.scrap_id}
                  className="bg-white rounded-lg shadow-md p-6 border-2 border-transparent hover:shadow-lg transition cursor-pointer"
                  onClick={() => openDetails(listing)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 capitalize">{listing.scrap_type}</h3>
                      <p className="text-sm text-gray-600 flex items-center mt-1">
                        <MapPin className="h-4 w-4 mr-1" />
                        {(listing.distance ?? 0).toFixed(1)} km away
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Sub: {listing.sub_category}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">₹{listing.estimated_price.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">{listing.weight} kg</p>
                    </div>
                  </div>

                  <p className="text-gray-600 mb-4 line-clamp-2">{listing.description}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="h-4 w-4 mr-1" />
                      {format(new Date(listing.posted_date), "MMM dd")}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetails(listing);
                        }}
                        className="bg-white border border-gray-300 px-3 py-1 rounded-lg text-sm hover:bg-gray-50"
                      >
                        View Details
                      </button>

                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setCurrentScrapId(listing.scrap_id);
                          setProposedSlots([""]);
                          setShowSlotModal(true);
                        }}
                        className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm flex items-center"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Request Pickup
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Details / Summary Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 relative z-[100000]">
            <button
              onClick={closeDetails}
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-900"
            >
              ✕
            </button>

            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-gray-900">{selectedListing.scrap_type}</h2>
              <p className="text-sm text-gray-500">Sub-category: {selectedListing.sub_category}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-700 mb-2">{selectedListing.description}</p>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    Weight: <strong>{selectedListing.weight} kg</strong>
                  </div>
                  <div>
                    Estimated Price: <strong>₹{selectedListing.estimated_price.toFixed(2)}</strong>
                  </div>
                  <div>
                    Posted: <strong>{format(new Date(selectedListing.posted_date), "PPP p")}</strong>
                  </div>
                  <div>
                    Distance: <strong>{(selectedListing.distance ?? 0).toFixed(2)} km</strong>
                  </div>
                </div>

                {selectedListing.seller && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100 mt-4">
                    <h3 className="text-sm font-semibold text-green-800 mb-2">Seller Details</h3>
                    <p className="text-sm text-gray-700"><strong>Name:</strong> {selectedListing.seller.name}</p>
                    <p className="text-sm text-gray-700"><strong>Email:</strong> {selectedListing.seller.email}</p>
                    {selectedListing.seller.phone && <p className="text-sm text-gray-700"><strong>Phone:</strong> {selectedListing.seller.phone}</p>}

                    <a
                      href={`mailto:Maharshi@techsoengine.com?subject=Inquiry about ${selectedListing.scrap_type} Scrap (Original Seller: ${selectedListing.seller.email})`}
                      className="mt-2 block w-full text-center bg-white border border-green-600 text-green-700 py-2 rounded-lg hover:bg-green-50 transition text-sm font-medium"
                    >
                      Send Email to Admin
                    </a>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-600">Location</div>
                  <div className="text-sm text-gray-800 font-medium">
                    {selectedListing.latitude.toFixed(4)}, {selectedListing.longitude.toFixed(4)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      sendPickupRequest(selectedListing.scrap_id);
                      closeDetails();
                    }}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg"
                  >
                    Request Pickup
                  </button>

                  <button
                    onClick={() => {
                      closeDetails();
                    }}
                    className="w-full bg-white border border-gray-300 py-2 rounded-lg"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Slot Selection Modal */}
      {showSlotModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative z-[100000]">
            <button
              onClick={() => setShowSlotModal(false)}
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-900"
            >
              <X className="h-6 w-6" />
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">Propose Pickup Slots</h2>
            <p className="text-gray-600 mb-6 text-sm">
              Please propose multiple date and time slots. The seller will select one.
            </p>

            <div className="space-y-4 max-h-60 overflow-y-auto mb-6 px-1">
              {proposedSlots.map((slot, index) => (
                <div key={index} className="flex flex-col gap-1 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Slot #{index + 1}
                    </label>
                    {proposedSlots.length > 1 && (
                      <button
                        onClick={() => {
                          setProposedSlots(proposedSlots.filter((_, i) => i !== index));
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove slot"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <input
                    type="datetime-local"
                    value={slot}
                    onChange={(e) => {
                      const newSlots = [...proposedSlots];
                      newSlots[index] = e.target.value;
                      setProposedSlots(newSlots);
                    }}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => setProposedSlots([...proposedSlots, ""])}
              className="w-full border-2 border-dashed border-gray-300 text-gray-500 py-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 mb-6"
            >
              <Plus className="h-4 w-4" /> Add Another Slot
            </button>

            <div className="flex gap-3">
              <button
                onClick={() => setShowSlotModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (proposedSlots.some(s => s.trim() !== "") && currentScrapId) {
                    await sendPickupRequest(currentScrapId);
                    setShowSlotModal(false);
                  } else {
                    alert("Please enter at least one slot.");
                  }
                }}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NearbyScrapPage;
