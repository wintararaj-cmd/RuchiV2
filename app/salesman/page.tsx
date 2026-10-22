'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/lib/utils';

interface MenuItem {
    id: number;
    name: string;
    description: string;
    category: string;
    price: number;
    gst_rate?: number;
    image_type: string;
    available: boolean;
}

interface CartItem {
    menuItem: MenuItem;
    quantity: number;
}

export default function SalesmanDashboard() {
    const router = useRouter();
    const { user, logout } = useAuth();

    // Data
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingOrders, setPendingOrders] = useState<any[]>([]);

    // UI State
    const [viewMode, setViewMode] = useState<'create' | 'list'>('create');
    const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [showCartMobile, setShowCartMobile] = useState(false);
    const [settings, setSettings] = useState<any>(null);

    // Order Details
    const [orderType, setOrderType] = useState<'dine-in' | 'takeaway'>('dine-in');
    const [tableNumber, setTableNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');

    useEffect(() => {
        if (user && user.role !== 'salesman' && user.role !== 'admin') {
            router.push('/');
            return;
        }
        fetchMenuItems();
        if (user) {
            fetchPendingOrders();
        }
    }, [user]);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            if (data.success) {
                setSettings(data.data);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const fetchMenuItems = async () => {
        try {
            const res = await fetch('/api/menu?available=true');
            const data = await res.json();
            if (data.success) {
                setMenuItems(data.data);
                const cats = Array.from(new Set(data.data.map((i: MenuItem) => i.category).filter(Boolean))) as string[];
                setCategories(['all', ...cats]);
            }
        } catch (error) {
            console.error('Error fetching menu:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingOrders = async () => {
        if (!user) return;
        try {
            const res = await fetch(`/api/orders?userId=${user.id}&status=pending`);
            const data = await res.json();
            if (data.success) {
                setPendingOrders(data.data);
            }
        } catch (error) {
            console.error('Error fetching pending orders:', error);
        }
    };

    const handleEditOrder = (order: any) => {
        setEditingOrderId(order.id);
        setCustomerName(order.customer_name || '');
        setCustomerPhone(order.customer_phone || '');
        setOrderType(order.order_type || 'dine-in');
        setTableNumber(order.table_number || '');
        setPaymentMethod(order.payment_method || 'cash');

        // Parse items if they are stored as JSON string or object
        let parsedItems: CartItem[] = [];
        if (typeof order.items === 'string') {
            try {
                parsedItems = JSON.parse(order.items);
            } catch (e) { console.error('Error parsing items', e); }
        } else if (Array.isArray(order.items)) {
            parsedItems = order.items;
        }
        setCart(parsedItems);

        setViewMode('create'); // Switch to editor view
    };

    const resetForm = () => {
        setEditingOrderId(null);
        setCart([]);
        setTableNumber('');
        setCustomerName('');
        setCustomerPhone('');
        setOrderType('dine-in');
        setShowCartMobile(false);
    };

    // Filter Logic
    const filteredItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    // Cart Logic
    const addToCart = (item: MenuItem) => {
        const existing = cart.find(ci => ci.menuItem.id === item.id);
        if (existing) {
            setCart(cart.map(ci => ci.menuItem.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci));
        } else {
            setCart([...cart, { menuItem: item, quantity: 1 }]);
        }
    };

    const updateQuantity = (itemId: number, delta: number) => {
        const existing = cart.find(ci => ci.menuItem.id === itemId);
        if (!existing) return;

        const newQty = existing.quantity + delta;
        if (newQty <= 0) {
            setCart(cart.filter(ci => ci.menuItem.id !== itemId));
        } else {
            setCart(cart.map(ci => ci.menuItem.id === itemId ? { ...ci, quantity: newQty } : ci));
        }
    };

    // Calculations
    const calculateTotal = () => {
        return cart.reduce((sum, item) => sum + (Number(item.menuItem.price) * item.quantity), 0);
    };

    const calculateTax = () => {
        if (!settings || settings.gstType !== 'regular') {
            return 0;
        }
        return cart.reduce((sum, item) => {
            const taxRate = (item.menuItem.gst_rate || 5) / 100;
            return sum + (Number(item.menuItem.price) * item.quantity * taxRate);
        }, 0);
    };

    const grandTotal = calculateTotal() + calculateTax();
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

    const handleSubmitOrder = async (status: string = 'pending') => {
        if (orderType === 'dine-in' && !tableNumber) {
            alert('Please provide Table Number for Dine-in');
            return;
        }
        if (cart.length === 0) {
            alert('Please add items to the order');
            return;
        }

        setSubmitting(true);
        try {
            const orderData = {
                user_id: user?.id,
                customer_name: customerName,
                customer_phone: customerPhone,
                order_type: orderType,
                items: cart,
                subtotal: calculateTotal(),
                tax: calculateTax(),
                total_amount: grandTotal,
                payment_method: paymentMethod,
                discount: 0,
                table_number: tableNumber || null,
                order_status: status,
            };

            let res;
            if (editingOrderId) {
                // Update existing order
                res = await fetch(`/api/orders/${editingOrderId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData),
                });
            } else {
                // Create new order
                res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderData),
                });
            }

            const data = await res.json();

            if (data.success) {
                alert(editingOrderId ? 'Order Updated Successfully!' : `Order Placed Successfully! \nInvoice: ${data.data.invoice_number}`);
                resetForm();
                fetchPendingOrders(); // Refresh list
            } else {
                alert(`Failed to save order: ${data.error}`);
            }
        } catch (error) {
            console.error('Error saving order:', error);
            alert('Order operation failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="container" style={{ padding: '2rem 1.5rem', minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '90px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1>Salesman Dashboard</h1>
                    <p className="text-muted">Welcome, {user?.name}</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', background: 'var(--glass-bg)', borderRadius: '8px', padding: '4px' }}>
                        <button
                            className={`btn ${viewMode === 'create' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => { setViewMode('create'); resetForm(); }}
                        >
                            Create Order
                        </button>
                        <button
                            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => { setViewMode('list'); fetchPendingOrders(); }}
                        >
                            Saved Orders ({pendingOrders.length})
                        </button>
                    </div>
                    <button onClick={logout} className="btn btn-ghost" style={{ color: 'var(--error)' }}>
                        Logout
                    </button>
                </div>
            </div>

            {viewMode === 'list' ? (
                // PENDING ORDERS LIST VIEW
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {pendingOrders.length === 0 ? (
                        <div className="glass-card" style={{ padding: '2rem', gridColumn: '1/-1', textAlign: 'center' }}>
                            <p className="text-muted">No saved orders found.</p>
                            <button className="btn btn-primary" onClick={() => setViewMode('create')} style={{ marginTop: '1rem' }}>
                                Create New Order
                            </button>
                        </div>
                    ) : (
                        pendingOrders.map(order => (
                            <div key={order.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                    <div>
                                        <h3 style={{ margin: 0 }}>Order #{order.order_number || order.id}</h3>
                                        <p className="text-muted" style={{ fontSize: '0.9rem' }}>{formatDateTime(order.created_at)}</p>
                                    </div>
                                    <span className="badge" style={{ background: 'var(--info)', color: 'white' }}>Pending</span>
                                </div>

                                <div>
                                    <p style={{ margin: '0 0 0.5rem 0' }}><strong>{order.customer_name || 'Walk-in'}</strong></p>
                                    <p style={{ margin: 0 }} className="text-muted">{order.order_type} • {order.table_number ? `Table ${order.table_number}` : 'No Table'}</p>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>₹{Number(order.total_amount).toFixed(2)}</span>
                                    <button className="btn btn-primary" onClick={() => handleEditOrder(order)}>
                                        Edit / Place
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                // CREATE / EDIT ORDER VIEW
                <>
                    {/* Mobile "View Bill" Sticky Button */}
                    {!showCartMobile && (
                        <div className="mobile-only" style={{
                            position: 'fixed', bottom: '1rem', left: '1rem', right: '1rem', zIndex: 100,
                            display: 'none' // Hidden by default, shown via CSS
                        }}>
                            <button
                                onClick={() => setShowCartMobile(true)}
                                className="btn btn-primary"
                                style={{
                                    width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    boxShadow: '0 4px 15px rgba(0,0,0,0.3)', borderRadius: '12px', fontSize: '1.1rem'
                                }}
                            >
                                <span>{totalItems} Items</span>
                                <span style={{ fontWeight: 'bold' }}>View Bill ₹{grandTotal.toFixed(0)}</span>
                            </button>
                        </div>
                    )}

                    {/* Styles for Mobile Responsive Layering */}
                    <style jsx global>{`
                    @media (max-width: 768px) {
                        .desktop-bill-panel { display: none !important; }
                        .mobile-only { display: block !important; }
                        
                        /* Fix Main Grid to be single column on mobile */
                        .responsive-grid {
                            display: block !important;
                        }

                        /* Menu Grid Adjustments for Mobile */
                        .menu-grid {
                            grid-template-columns: 1fr !important; /* Single column */
                            gap: 0.75rem !important;
                        }
                        
                        /* The Overlay */
                        .mobile-bill-overlay {
                            position: fixed !important;
                            top: 0; left: 0; right: 0; bottom: 0;
                            background-color: var(--bg-primary); /* solid background */
                            z-index: 200;
                            overflow-y: auto;
                            padding: 1rem;
                            animation: slideUp 0.25s ease-out;
                            display: flex;
                            flex-direction: column;
                        }
                        
                        @keyframes slideUp {
                            from { transform: translateY(100%); }
                            to { transform: translateY(0); }
                        }
                    }
                `}</style>

                    {editingOrderId && (
                        <div style={{ background: 'var(--info-light)', color: 'var(--info)', padding: '0.5rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Editing Order #{pendingOrders.find(o => o.id === editingOrderId)?.order_number || editingOrderId}</span>
                            <button className="btn btn-ghost btn-sm" onClick={resetForm}>Cancel Edit</button>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '2rem' }} className="responsive-grid">
                        {/* LEFT: MENU SECTION */}
                        <div style={{ paddingBottom: '2rem' }}>
                            {/* Search & Categories */}
                            <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                                <input
                                    className="input"
                                    placeholder="Search items..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{ marginBottom: '1rem', width: '100%' }}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setSelectedCategory(cat)}
                                            className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Menu Items Grid */}
                            <div className="menu-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                                {loading ? <p>Loading menu...</p> : filteredItems.map(item => (
                                    <div key={item.id} className="glass-card" style={{ padding: '1rem', cursor: 'pointer', transition: '0.2s', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} onClick={() => addToCart(item)}>
                                        <h4 style={{ margin: 0, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h4>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>₹{Number(item.price).toFixed(0)}</span>
                                            <div style={{ width: '28px', height: '28px', background: 'var(--primary)', borderRadius: '50%', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem' }}>+</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: BILLING SECTION (Responsive Wrapper) */}
                        <div
                            className={`${showCartMobile ? 'mobile-bill-overlay' : 'desktop-bill-panel'}`}
                            style={{ position: showCartMobile ? 'fixed' : 'sticky', top: '1rem' }}
                        >
                            {/* Mobile Close Header */}
                            {showCartMobile && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                    <h2 style={{ margin: 0 }}>Your Order</h2>
                                    <button
                                        onClick={() => setShowCartMobile(false)}
                                        className="btn btn-ghost"
                                        style={{ fontSize: '2rem', lineHeight: '1rem', height: 'auto', padding: '0.5rem' }}
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}

                            <div className={showCartMobile ? '' : 'glass-card'} style={{ display: 'flex', flexDirection: 'column', height: showCartMobile ? 'auto' : 'calc(100vh - 8rem)', flex: 1 }}>
                                {!showCartMobile && <h2 style={{ marginBottom: '1rem', textAlign: 'center', fontFamily: 'serif' }}>Current Bill</h2>}

                                {/* Order Controls */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <select
                                        value={orderType}
                                        onChange={(e: any) => setOrderType(e.target.value)}
                                        className="input"
                                        style={{ padding: '0.8rem' }}
                                    >
                                        <option value="dine-in">Dine-in</option>
                                        <option value="takeaway">Takeaway</option>
                                    </select>
                                    {orderType === 'dine-in' && (
                                        <input
                                            className="input"
                                            placeholder="Table No."
                                            value={tableNumber}
                                            onChange={e => setTableNumber(e.target.value)}
                                            style={{ padding: '0.8rem' }}
                                        />
                                    )}
                                </div>

                                {/* Cart List */}
                                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', minHeight: '200px' }}>
                                    {cart.length === 0 ? (
                                        <p className="text-muted text-center" style={{ marginTop: '2rem' }}>No items added to cart</p>
                                    ) : (
                                        cart.map(item => (
                                            <div key={item.menuItem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 500 }}>{item.menuItem.name}</div>
                                                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>₹{Number(item.menuItem.price).toFixed(0)} x {item.quantity}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <button className="btn btn-ghost" style={{ padding: '4px 10px', background: 'var(--glass-border)' }} onClick={(e) => { e.stopPropagation(); updateQuantity(item.menuItem.id, -1); }}>-</button>
                                                    <b style={{ fontSize: '1.1rem' }}>{item.quantity}</b>
                                                    <button className="btn btn-ghost" style={{ padding: '4px 10px', background: 'var(--glass-border)' }} onClick={(e) => { e.stopPropagation(); addToCart(item.menuItem); }}>+</button>
                                                </div>
                                                <div style={{ fontWeight: 'bold', minWidth: '60px', textAlign: 'right' }}>
                                                    ₹{(Number(item.menuItem.price) * item.quantity).toFixed(0)}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Footer Section */}
                                <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '1rem', paddingBottom: showCartMobile ? '2rem' : 0 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                                        <input
                                            className="input"
                                            placeholder="Customer Name"
                                            value={customerName}
                                            onChange={e => setCustomerName(e.target.value)}
                                            style={{ fontSize: '0.9rem', padding: '0.8rem' }}
                                        />
                                        <input
                                            className="input"
                                            placeholder="Phone"
                                            value={customerPhone}
                                            onChange={e => setCustomerPhone(e.target.value)}
                                            style={{ fontSize: '0.9rem', padding: '0.8rem' }}
                                            type="tel"
                                        />
                                    </div>

                                    <select
                                        className="input"
                                        value={paymentMethod}
                                        onChange={e => setPaymentMethod(e.target.value)}
                                        style={{ marginBottom: '1rem', padding: '0.8rem' }}
                                    >
                                        <option value="cash">Cash Payment</option>
                                        <option value="card">Card Payment</option>
                                        <option value="upi">UPI / Scan</option>
                                    </select>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                                        <span>Total Pay:</span>
                                        <span>₹{grandTotal.toFixed(2)}</span>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <button
                                            onClick={() => handleSubmitOrder('pending')}
                                            className="btn btn-ghost"
                                            style={{ width: '100%', fontSize: '1.1rem', padding: '1rem', fontWeight: 'bold', border: '1px solid var(--border-color)', background: 'transparent' }}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Saving...' : 'Save Order'}
                                        </button>
                                        <button
                                            onClick={() => handleSubmitOrder('confirmed')}
                                            className="btn btn-primary"
                                            style={{ width: '100%', fontSize: '1.2rem', padding: '1rem', fontWeight: 'bold' }}
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Placing...' : 'Place Order'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </main>
    );
}
