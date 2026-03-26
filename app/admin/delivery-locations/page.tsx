'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    created_at: string;
    updated_at: string;
}

export default function DeliveryLocationsPage() {
    const router = useRouter();
    const [locations, setLocations] = useState<DeliveryLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingLocation, setEditingLocation] = useState<DeliveryLocation | null>(null);

    // Form state
    const [locationName, setLocationName] = useState('');
    const [deliveryCharge, setDeliveryCharge] = useState('');
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [radiusKm, setRadiusKm] = useState('5.0');
    const [minRadiusKm, setMinRadiusKm] = useState('0.0');
    const [minOrderValue, setMinOrderValue] = useState('0.00');
    const [isActive, setIsActive] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showMapPicker, setShowMapPicker] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }
        fetchLocations();
    }, []);

    const fetchLocations = async () => {
        try {
            const response = await fetch('/api/admin/delivery-locations');
            const data = await response.json();
            if (data.success) {
                setLocations(data.data);
            }
        } catch (error) {
            console.error('Error fetching delivery locations:', error);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingLocation(null);
        setLocationName('');
        setDeliveryCharge('');
        setLatitude('');
        setLongitude('');
        setRadiusKm('5.0');
        setMinRadiusKm('0.0');
        setMinOrderValue('0.00');
        setIsActive(true);
        setShowModal(true);
    };

    const openEditModal = (location: DeliveryLocation) => {
        setEditingLocation(location);
        setLocationName(location.location_name);
        setDeliveryCharge(location.delivery_charge.toString());
        setLatitude(location.latitude?.toString() || '');
        setLongitude(location.longitude?.toString() || '');
        setRadiusKm(location.radius_km?.toString() || '5.0');
        setMinRadiusKm(location.min_radius_km?.toString() || '0.0');
        setMinOrderValue(location.min_order_value?.toString() || '0.00');
        setIsActive(location.is_active);
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!locationName.trim()) {
            alert('Please enter a location name');
            return;
        }

        if (!deliveryCharge || parseFloat(deliveryCharge) < 0) {
            alert('Please enter a valid delivery charge');
            return;
        }

        setSubmitting(true);

        try {
            const url = editingLocation
                ? `/api/admin/delivery-locations/${editingLocation.id}`
                : '/api/admin/delivery-locations';

            const method = editingLocation ? 'PUT' : 'POST';

            const payload: any = {
                location_name: locationName.trim(),
                delivery_charge: parseFloat(deliveryCharge),
                is_active: isActive,
            };

            // Add GPS coordinates and range info
            if (latitude && longitude) {
                payload.latitude = parseFloat(latitude);
                payload.longitude = parseFloat(longitude);
            }
            
            // Always include radii if we have some value (default to database defaults if not provided)
            payload.radius_km = parseFloat(radiusKm) || 5.0;
            payload.min_radius_km = parseFloat(minRadiusKm) || 0.0;
            payload.min_order_value = parseFloat(minOrderValue) || 0.0;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message || 'Location saved successfully');
                setShowModal(false);
                fetchLocations();
            } else {
                alert(data.error || 'Failed to save location');
            }
        } catch (error) {
            console.error('Error saving location:', error);
            alert('An error occurred while saving');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDuplicate = (location: DeliveryLocation) => {
        setEditingLocation(null); // Create new
        setLocationName(`${location.location_name} (Copy)`);
        setDeliveryCharge(location.delivery_charge.toString());
        setLatitude(location.latitude?.toString() || '');
        setLongitude(location.longitude?.toString() || '');
        setRadiusKm(location.radius_km?.toString() || '5.0');
        setMinRadiusKm(location.radius_km?.toString() || '2.0'); // Default next tier start to previous tier end
        setMinOrderValue(location.min_order_value?.toString() || '0.00');
        setIsActive(true);
        setShowModal(true);
    };

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/delivery-locations/${id}`, {
                method: 'DELETE',
            });

            const data = await response.json();

            if (data.success) {
                alert('Location deleted successfully');
                fetchLocations();
            } else {
                alert(data.error || 'Failed to delete location');
            }
        } catch (error) {
            console.error('Error deleting location:', error);
            alert('An error occurred while deleting');
        }
    };

    const toggleActive = async (location: DeliveryLocation) => {
        try {
            const response = await fetch(`/api/admin/delivery-locations/${location.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    is_active: !location.is_active,
                }),
            });

            const data = await response.json();

            if (data.success) {
                fetchLocations();
            } else {
                alert(data.error || 'Failed to update location');
            }
        } catch (error) {
            console.error('Error updating location:', error);
            alert('An error occurred while updating');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <main className="container" style={{ padding: '2rem 1.5rem' }}>
            <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1>Delivery Locations</h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={openAddModal} className="btn btn-primary">
                            + Add Location
                        </button>
                        <button onClick={() => router.push('/admin/dashboard')} className="btn btn-ghost">
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>

                {/* Locations Table */}
                <div className="glass-card">
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Location Name</th>
                                    <th style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>Delivery Charge</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Status</th>
                                    <th style={{ padding: '1rem', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {locations.map((location) => (
                                    <tr key={location.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 500 }}>{location.location_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: location.latitude ? 'var(--text-muted)' : 'var(--danger)', fontWeight: location.latitude ? 400 : 600 }}>
                                                {location.latitude ? (
                                                    `Range: ${location.min_radius_km || 0}km - ${location.radius_km}km`
                                                ) : (
                                                    '⚠️ Missing GPS Coordinates (Auto-detection disabled)'
                                                )}
                                            </div>
                                            {location.min_order_value > 0 && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600, marginTop: '0.25rem' }}>
                                                    🛒 Min Order: ₹{parseFloat(location.min_order_value.toString()).toFixed(2)}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--primary)' }}>
                                                ₹{parseFloat(location.delivery_charge.toString()).toFixed(2)}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <button
                                                onClick={() => toggleActive(location)}
                                                className="badge"
                                                style={{
                                                    background: location.is_active ? 'var(--success)' : 'var(--danger)',
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    border: 'none',
                                                    padding: '0.375rem 0.75rem',
                                                }}
                                            >
                                                {location.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handleDuplicate(location)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                >
                                                    📋 Duplicate
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(location)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                >
                                                    ✏️ Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(location.id, location.location_name)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'var(--danger)' }}
                                                >
                                                    🗑️ Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {locations.length === 0 && (
                            <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                                <p className="text-muted">No delivery locations found. Add one to get started!</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setShowModal(false)}
                >
                    <div
                        className="glass-card"
                        style={{ maxWidth: '500px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ marginBottom: '1.5rem' }}>
                            {editingLocation ? 'Edit Location' : 'Add New Location'}
                        </h2>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                Location Name *
                            </label>
                            <input
                                type="text"
                                value={locationName}
                                onChange={(e) => setLocationName(e.target.value)}
                                className="input"
                                placeholder="e.g., City Center, North Zone"
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                Delivery Charge (₹) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={deliveryCharge}
                                onChange={(e) => setDeliveryCharge(e.target.value)}
                                className="input"
                                placeholder="0.00"
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                Minimum Order Value (₹)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={minOrderValue}
                                onChange={(e) => setMinOrderValue(e.target.value)}
                                className="input"
                                placeholder="0.00 (Set to 0 if no minimum)"
                            />
                        </div>

                        {/* GPS Coordinates Section */}
                        <div style={{
                            marginBottom: '1rem',
                            padding: '1rem',
                            background: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: '8px',
                            border: '1px dashed rgba(59, 130, 246, 0.3)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', margin: 0 }}>
                                    📍 GPS Coordinates (Optional - for Auto-Detection)
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setShowMapPicker(true)}
                                    className="btn btn-primary"
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.75rem' }}
                                >
                                    🗺️ Pick from Map
                                </button>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                Click "Pick from Map" to select location on map, or enter coordinates manually.
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 500 }}>
                                        Latitude
                                    </label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={latitude}
                                        onChange={(e) => setLatitude(e.target.value)}
                                        className="input"
                                        placeholder="28.6139"
                                        style={{ fontSize: '0.875rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 500 }}>
                                        Longitude
                                    </label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={longitude}
                                        onChange={(e) => setLongitude(e.target.value)}
                                        className="input"
                                        placeholder="77.2090"
                                        style={{ fontSize: '0.875rem' }}
                                    />
                                </div>
                                           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 500 }}>
                                        Min Radius (km) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={minRadiusKm}
                                        onChange={(e) => setMinRadiusKm(e.target.value)}
                                        className="input"
                                        placeholder="0.0"
                                        style={{ fontSize: '0.875rem' }}
                                    />
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                        Starting distance
                                    </p>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 500 }}>
                                        Max Radius (km) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                        value={radiusKm}
                                        onChange={(e) => setRadiusKm(e.target.value)}
                                        className="input"
                                        placeholder="5.0"
                                        style={{ fontSize: '0.875rem' }}
                                    />
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                        Ending distance
                                    </p>
                                </div>
                            </div>
                            {(!latitude || !longitude) && (
                                <p style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '0.75rem', fontWeight: 600 }}>
                                    ⚠️ Warning: Radius range is saved, but auto-detection will NOT work until you pick a location from the map.
                                </p>
                            )}
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                                Customers between {minRadiusKm}km and {radiusKm}km will be matched to this zone
                            </p>
                        </div>
               </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={(e) => setIsActive(e.target.checked)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Active</span>
                            </label>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn btn-ghost"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="btn btn-primary"
                                disabled={submitting}
                                style={{ minWidth: '120px' }}
                            >
                                {submitting ? 'Saving...' : editingLocation ? 'Update' : 'Add Location'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Map Picker Modal */}
            {showMapPicker && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.8)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1001,
                        padding: '1rem'
                    }}
                    onClick={() => setShowMapPicker(false)}
                >
                    <div
                        className="glass-card"
                        style={{
                            width: '90%',
                            maxWidth: '600px',
                            maxHeight: '90vh',
                            overflow: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h2 style={{ margin: 0, marginBottom: '0.5rem' }}>📍 Set GPS Coordinates</h2>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                Get coordinates from Google Maps and enter them below
                            </p>
                        </div>

                        <div style={{ padding: '1.5rem' }}>
                            {/* Step-by-step instructions */}
                            <div style={{
                                marginBottom: '1.5rem',
                                padding: '1.25rem',
                                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
                                borderRadius: '12px',
                                border: '2px solid rgba(59, 130, 246, 0.3)'
                            }}>
                                <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    📋 How to Get Coordinates:
                                </h3>
                                <ol style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', lineHeight: '2' }}>
                                    <li>
                                        <strong>Open Google Maps:</strong>{' '}
                                        <a
                                            href="https://www.google.com/maps"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                color: 'var(--primary)',
                                                textDecoration: 'underline',
                                                fontWeight: 600
                                            }}
                                        >
                                            Click here to open →
                                        </a>
                                    </li>
                                    <li><strong>Search</strong> for your delivery zone location</li>
                                    <li><strong>Right-click</strong> on the exact center of the zone</li>
                                    <li>Click on the <strong>coordinates</strong> at the top of the menu</li>
                                    <li>Coordinates are <strong>automatically copied!</strong></li>
                                    <li><strong>Paste</strong> them in the fields below</li>
                                </ol>
                            </div>

                            {/* Coordinate inputs */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                            Latitude *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={latitude}
                                            onChange={(e) => setLatitude(e.target.value)}
                                            className="input"
                                            placeholder="28.6139"
                                            style={{ fontSize: '1.1rem', padding: '0.75rem' }}
                                            autoFocus
                                        />
                                        <p style={{ margin: 0, marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            Example: 28.6139
                                        </p>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
                                            Longitude *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            value={longitude}
                                            onChange={(e) => setLongitude(e.target.value)}
                                            className="input"
                                            placeholder="77.2090"
                                            style={{ fontSize: '1.1rem', padding: '0.75rem' }}
                                        />
                                        <p style={{ margin: 0, marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            Example: 77.2090
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Success indicator */}
                            {latitude && longitude && (
                                <div style={{
                                    marginBottom: '1rem',
                                    padding: '1rem',
                                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
                                    border: '2px solid rgba(34, 197, 94, 0.4)',
                                    borderRadius: '12px',
                                    animation: 'fadeIn 0.3s ease-in'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '1.5rem' }}>✓</span>
                                        <strong style={{ fontSize: '1rem', color: 'var(--success)' }}>Coordinates Set!</strong>
                                    </div>
                                    <div style={{
                                        fontSize: '1.1rem',
                                        fontFamily: 'monospace',
                                        padding: '0.5rem',
                                        background: 'rgba(255, 255, 255, 0.5)',
                                        borderRadius: '6px',
                                        marginTop: '0.5rem'
                                    }}>
                                        {latitude}, {longitude}
                                    </div>
                                    <a
                                        href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-block',
                                            marginTop: '0.75rem',
                                            color: 'var(--primary)',
                                            textDecoration: 'underline',
                                            fontSize: '0.875rem',
                                            fontWeight: 600
                                        }}
                                    >
                                        🗺️ Verify on Google Maps →
                                    </a>
                                </div>
                            )}

                            {/* Quick tips */}
                            <div style={{
                                padding: '1rem',
                                background: 'rgba(251, 146, 60, 0.1)',
                                border: '1px solid rgba(251, 146, 60, 0.3)',
                                borderRadius: '8px',
                                fontSize: '0.8rem'
                            }}>
                                <strong style={{ display: 'block', marginBottom: '0.5rem' }}>💡 Pro Tips:</strong>
                                <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.8' }}>
                                    <li>You can paste the full string "28.6139, 77.2090" in latitude field</li>
                                    <li>Make sure to right-click on the <strong>center</strong> of your delivery zone</li>
                                    <li>Use the "Verify on Google Maps" link above to double-check</li>
                                </ul>
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowMapPicker(false)}
                                className="btn btn-ghost"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (latitude && longitude) {
                                        setShowMapPicker(false);
                                    } else {
                                        alert('Please enter both latitude and longitude');
                                    }
                                }}
                                className="btn btn-primary"
                                disabled={!latitude || !longitude}
                                style={{ minWidth: '180px' }}
                            >
                                ✓ Use These Coordinates
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
