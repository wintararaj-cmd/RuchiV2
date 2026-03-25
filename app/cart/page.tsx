'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import Link from 'next/link';

export default function CartPage() {
    const router = useRouter();
    const { cart, updateQuantity, removeFromCart, getCartTotal, clearCart } = useCart();
    // Add settings state
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => {
        // Fetch settings
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.success) setSettings(data.data);
            })
            .catch(err => console.error('Error fetching settings:', err));
    }, []);

    const subtotal = getCartTotal();

    const calculateTax = () => {
        if (settings?.gstType !== 'regular') return 0;

        return cart.reduce((sum, item) => {
            const itemPrice = item.menuItem.price;
            const gstRate = (item.menuItem.gst_rate || 5) / 100;
            return sum + (itemPrice * item.quantity * gstRate);
        }, 0);
    };

    const tax = calculateTax();
    const total = subtotal + tax;

    if (cart.length === 0) {
        return (
            <main className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
                <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto', padding: '3rem 2rem' }}>
                    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🛒</div>
                    <h2>Your Cart is Empty</h2>
                    <p className="text-muted" style={{ marginBottom: '2rem' }}>
                        Add some delicious items from our menu to get started!
                    </p>
                    <Link href="/menu" className="btn btn-primary">
                        Browse Menu
                    </Link>
                </div>
            </main>
        );
    }

    return (
        <main className="container" style={{ padding: '2rem 1.5rem' }}>
            <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1>Your Cart</h1>
                    <button onClick={clearCart} className="btn btn-ghost">
                        Clear Cart
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
                    {/* Cart Items */}
                    <div>
                        {cart.map((item, index) => (
                            <div
                                key={item.menuItem.id}
                                className="glass-card slide-up"
                                style={{
                                    marginBottom: '1rem',
                                    animationDelay: `${index * 0.05}s`,
                                }}
                            >
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                    <div style={{
                                        width: '100px',
                                        height: '100px',
                                        background: 'linear-gradient(135deg, rgba(255,100,50,0.2) 0%, rgba(150,50,255,0.2) 100%)',
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '2.5rem',
                                        flexShrink: 0,
                                    }}>
                                        🍽️
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ marginBottom: '0.25rem' }}>{item.menuItem.name}</h3>
                                        <p className="text-muted" style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                                            {item.menuItem.description}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span className="badge badge-primary">₹{item.menuItem.price}</span>
                                            <span className="badge badge-success">{item.menuItem.category_name}</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <button
                                                onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                                                className="btn btn-ghost"
                                                style={{ padding: '0.5rem 0.875rem', minWidth: 'auto' }}
                                            >
                                                −
                                            </button>
                                            <span style={{ fontSize: '1.125rem', fontWeight: 600, minWidth: '2rem', textAlign: 'center' }}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                                                className="btn btn-ghost"
                                                style={{ padding: '0.5rem 0.875rem', minWidth: 'auto' }}
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
                                            ₹{(item.menuItem.price * item.quantity).toFixed(2)}
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.menuItem.id)}
                                            className="btn btn-ghost"
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'var(--error)' }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Order Summary */}
                    <div className="glass-card" style={{ position: 'sticky', top: '100px', height: 'fit-content' }}>
                        <h3 style={{ marginBottom: '1.5rem' }}>Order Summary</h3>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <span className="text-muted">Subtotal</span>
                                <span>₹{subtotal.toFixed(2)}</span>
                            </div>
                            {settings?.gstType === 'regular' && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                    <span className="text-muted">Tax (GST)</span>
                                    <span>₹{tax.toFixed(2)}</span>
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

                        <Link
                            href="/checkout"
                            className="btn btn-primary"
                            style={{ 
                                width: '100%', 
                                fontSize: '1.125rem', 
                                padding: '1rem',
                                textAlign: 'center',
                                textDecoration: 'none',
                                display: 'block'
                            }}
                        >
                            Proceed to Checkout
                        </Link>

                        <Link href="/menu" className="btn btn-outline" style={{ width: '100%', marginTop: '1rem' }}>
                            Continue Shopping
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
