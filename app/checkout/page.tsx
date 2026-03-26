'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';

interface DeliveryLocation {
    id: number;
    location_name: string;
    delivery_charge: number;
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    min_radius_km?: number;
    is_active: boolean;
    min_order_value?: number;
}

export default function CheckoutPage() {
    const router = useRouter();
    const { cart, getCartTotal, clearCart, isLoaded: cartLoaded } = useCart();
    const { user, isAuthenticated, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState<any>(null);
    const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const [detectingLocation, setDetectingLocation] = useState(false);
    const [detectedLocationInfo, setDetectedLocationInfo] = useState<string>('');
    const [customerCoords, setCustomerCoords] = useState<{lat: number, lng: number, distance: number} | null>(null);

    useEffect(() => {
        // Fetch settings and delivery locations in parallel
        Promise.all([
            fetch('/api/settings').then(res => res.json()),
            fetch('/api/admin/delivery-locations?active=true').then(res => res.json())
        ])
            .then(([settingsData, locationsData]) => {
                if (settingsData.success) setSettings(settingsData.data);
                if (locationsData.success) setDeliveryLocations(locationsData.data);
            })
            .catch(err => console.error('Error fetching checkout data:', err));
    }, []);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        paymentMethod: 'cash' as 'cash' | 'card' | 'upi' | 'wallet',
        notes: '',
    });

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        } else if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || '',
                phone: user.phone || '',
                address: user.address || '',
            }));
        }
    }, [user, isAuthenticated, authLoading, router]);

    const subtotal = getCartTotal();

    const calculateTax = () => {
        if (settings?.gstType !== 'regular') return 0;

        return cart.reduce((sum, item) => {
            const itemPrice = item.menuItem.price;
            const gstRate = (item.menuItem.gst_rate || 5) / 100;
            return sum + (itemPrice * item.quantity * gstRate);
        }, 0);
    };

    const getDeliveryCharge = () => {
        if (!selectedLocationId) return 0;
        const location = deliveryLocations.find(loc => loc.id === selectedLocationId);
        return location ? parseFloat(location.delivery_charge.toString()) : 0;
    };

    const tax = calculateTax();
    const deliveryCharge = getDeliveryCharge();
    const total = subtotal + tax + deliveryCharge;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedLocationId) {
            alert('Please select a delivery location');
            return;
        }

        const location = deliveryLocations.find(loc => loc.id === selectedLocationId);
        if (location && location.min_order_value && subtotal < parseFloat(location.min_order_value.toString())) {
            alert(`Minimum order value for ${location.location_name} is ₹${parseFloat(location.min_order_value.toString()).toFixed(2)}. Your current subtotal is ₹${subtotal.toFixed(2)}.`);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const orderData = {
                user_id: user?.id,
                customer_name: formData.name,
                customer_phone: formData.phone,
                customer_address: formData.address,
                order_type: 'delivery',
                items: cart.map(item => ({
                    menuItem: {
                        id: item.menuItem.id,
                        name: item.menuItem.name,
                        price: item.menuItem.price,
                        gst_rate: item.menuItem.gst_rate
                    },
                    quantity: item.quantity
                })),
                subtotal,
                tax,
                discount: 0,
                delivery_location_id: selectedLocationId,
                delivery_charge: deliveryCharge,
                total_amount: total,
                payment_method: formData.paymentMethod,
                notes: formData.notes,
                customer_lat: customerCoords?.lat,
                customer_lng: customerCoords?.lng,
                distance: customerCoords?.distance,
            };

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });

            const data = await response.json();

            if (data.success) {
                clearCart();
                router.push(`/orders?success=true&orderId=${data.data.id}`);
            } else {
                alert('Failed to place order. Please try again.');
            }
        } catch (error) {
            console.error('Error placing order:', error);
            alert('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const detectMyLocation = async (isSilent: boolean = false) => {
        if (!navigator.geolocation) {
            if (!isSilent) alert('GPS is not supported by your browser. Please select your location manually.');
            return;
        }

        setDetectingLocation(true);
        setDetectedLocationInfo('');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    const response = await fetch('/api/delivery-locations/detect', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ latitude, longitude })
                    });

                    const data = await response.json();

                    if (data.success) {
                        // Auto-select the detected location
                        setSelectedLocationId(data.data.location.id);
                        setDetectedLocationInfo(
                            `✓ Detected: ${data.data.location.location_name} (${data.data.distance.toFixed(1)}km away)`
                        );
                        setCustomerCoords({
                            lat: latitude,
                            lng: longitude,
                            distance: data.data.distance
                        });
                    } else if (!isSilent) {
                        // Show nearest location as suggestion only if not silent
                        setDetectedLocationInfo(
                            `⚠️ ${data.error}. Please select manually.`
                        );
                        if (data.data?.nearestLocation) {
                            const confirmUseNearest = confirm(
                                `You're outside delivery zones. Use nearest zone "${data.data.nearestLocation.location_name}" (${data.data.nearestLocation.distance.toFixed(1)}km away)?`
                            );
                            if (confirmUseNearest) {
                                setSelectedLocationId(data.data.nearestLocation.id);
                            }
                        }
                    } else if (data.data?.nearestLocation) {
                        // If silent (auto-load), we can just set the recommendation info without alert
                        setDetectedLocationInfo(
                            `📍 You seem to be near ${data.data.nearestLocation.location_name} (${data.data.nearestLocation.distance.toFixed(1)}km).`
                        );
                    }
                } catch (error) {
                    console.error('Error detecting location:', error);
                    if (!isSilent) alert('Failed to detect location. Please select manually.');
                } finally {
                    setDetectingLocation(false);
                }
            },
            (error) => {
                setDetectingLocation(false);
                if (!isSilent) {
                    let errorMessage = 'Could not get your location. ';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += 'Please allow location access and try again.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage += 'Location request timed out.';
                            break;
                        default:
                            errorMessage += 'An unknown error occurred.';
                    }
                    alert(errorMessage + ' Please select your location manually.');
                }
            },
            {
                enableHighAccuracy: false,
                timeout: 5000,
                maximumAge: 60000
            }
        );
    };

    // Auto-detect location on page load
    useEffect(() => {
        if (cartLoaded && !authLoading && cart.length > 0 && !selectedLocationId) {
            // Wait a moment for everything to settle
            const timer = setTimeout(() => {
                detectMyLocation(true);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [cartLoaded, authLoading, cart.length]);

    if (!cartLoaded || authLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', gap: '1rem' }}>
                <span className="spinner"></span>
                <p>Loading checkout...</p>
            </div>
        );
    }

    if (cart.length === 0) {
        router.push('/cart');
        return null;
    }

    return (
        <main className="container" style={{ padding: '2rem 1.5rem', maxWidth: '900px' }}>
            <div className="fade-in">
                <h1 className="text-center mb-4">Checkout</h1>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gap: '2rem' }}>
                        {/* Customer Details */}
                        <div className="glass-card">
                            <h3 style={{ marginBottom: '1.5rem' }}>Delivery Details</h3>

                            <div style={{ display: 'grid', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="input"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Enter your full name"
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        required
                                        className="input"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="Enter your phone number"
                                    />
                                </div>

                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <label style={{ fontWeight: 500 }}>
                                            Delivery Location *
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => detectMyLocation(false)}
                                            disabled={detectingLocation}
                                            className="btn btn-ghost"
                                            style={{
                                                padding: '0.5rem 1rem',
                                                fontSize: '0.875rem',
                                                background: 'rgba(59, 130, 246, 0.1)',
                                                border: '1px solid rgba(59, 130, 246, 0.3)'
                                            }}
                                        >
                                            {detectingLocation ? (
                                                <>
                                                    <span className="spinner" style={{ width: '14px', height: '14px', marginRight: '0.5rem' }}></span>
                                                    Detecting...
                                                </>
                                            ) : (
                                                <>
                                                    📍 {selectedLocationId ? 'Refresh Location' : 'Detect My Location'}
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {detectedLocationInfo && (
                                        <div style={{
                                            marginBottom: '0.75rem',
                                            padding: '0.75rem',
                                            background: detectedLocationInfo.includes('✓') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(251, 146, 60, 0.1)',
                                            border: `1px solid ${detectedLocationInfo.includes('✓') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 146, 60, 0.3)'}`,
                                            borderRadius: '8px',
                                            fontSize: '0.875rem',
                                            color: detectedLocationInfo.includes('✓') ? 'var(--success)' : 'var(--warning)'
                                        }}>
                                            {detectedLocationInfo}
                                        </div>
                                    )}

                                    <select
                                        required
                                        className="input"
                                        value={selectedLocationId || ''}
                                        onChange={(e) => setSelectedLocationId(e.target.value ? parseInt(e.target.value) : null)}
                                    >
                                        <option value="">Select your delivery location</option>
                                        {deliveryLocations.map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.location_name} - ₹{parseFloat(loc.delivery_charge.toString()).toFixed(2)}
                                                {loc.min_order_value && parseFloat(loc.min_order_value.toString()) > 0 ? ` (Min: ₹${parseFloat(loc.min_order_value.toString()).toFixed(2)})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedLocationId && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            📍 Delivery charge: ₹{deliveryCharge.toFixed(2)}
                                        </div>
                                    )}

                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        💡 Tip: We detect your location automatically. Use the button to refresh if needed.
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Delivery Address *
                                    </label>
                                    <textarea
                                        required
                                        className="input"
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        placeholder="Enter your complete delivery address"
                                        rows={3}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Special Instructions (Optional)
                                    </label>
                                    <textarea
                                        className="input"
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        placeholder="Any special requests or instructions"
                                        rows={2}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="glass-card">
                            <h3 style={{ marginBottom: '1.5rem' }}>Payment Method</h3>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                {[
                                    { value: 'cash', label: 'Cash on Delivery', icon: '💵' },
                                ].map((method) => (
                                    <button
                                        key={method.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, paymentMethod: method.value as any })}
                                        className={formData.paymentMethod === method.value ? 'btn btn-primary' : 'btn btn-ghost'}
                                        style={{
                                            padding: '1rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                        }}
                                    >
                                        <span style={{ fontSize: '2rem' }}>{method.icon}</span>
                                        <span style={{ fontSize: '0.875rem' }}>{method.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div className="glass-card">
                            <h3 style={{ marginBottom: '1.5rem' }}>Order Summary</h3>

                            <div style={{ marginBottom: '1.5rem' }}>
                                {cart.map((item) => (
                                    <div
                                        key={item.menuItem.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: '0.75rem',
                                            paddingBottom: '0.75rem',
                                            borderBottom: '1px solid var(--border-color)',
                                        }}
                                    >
                                        <span>
                                            {item.menuItem.name} × {item.quantity}
                                        </span>
                                        <span>₹{(item.menuItem.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span className="text-muted">Subtotal</span>
                                    <span>₹{subtotal.toFixed(2)}</span>
                                </div>
                                {settings?.gstType === 'regular' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span className="text-muted">Tax (GST)</span>
                                        <span>₹{tax.toFixed(2)}</span>
                                    </div>
                                )}
                                {deliveryCharge > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <span className="text-muted">Delivery Charge</span>
                                        <span>₹{deliveryCharge.toFixed(2)}</span>
                                    </div>
                                )}
                                <div style={{
                                    borderTop: '1px solid var(--border-color)',
                                    paddingTop: '0.75rem',
                                    marginTop: '0.75rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: '1.25rem',
                                    fontWeight: 700,
                                }}>
                                    <span>Total</span>
                                    <span style={{ color: 'var(--primary)' }}>₹{total.toFixed(2)}</span>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn btn-primary"
                                style={{ width: '100%', fontSize: '1.125rem', padding: '1rem' }}
                            >
                                {loading ? 'Placing Order...' : 'Place Order'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </main>
    );
}
