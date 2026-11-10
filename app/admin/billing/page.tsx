'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isTodayBusinessDay } from '@/lib/date-utils';
import { formatDate } from '@/lib/utils';

export default function AdminBillingPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRevenue: 0,
        paidOrders: 0,
        pendingPayments: 0,
        todayRevenue: 0,
    });

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }
        fetchData();
    }, []); // Empty dependency - only run on mount

    const fetchData = async () => {
        try {
            const [ordersRes, invoicesRes] = await Promise.all([
                fetch('/api/orders'),
                fetch('/api/invoices'),
            ]);

            const ordersData = await ordersRes.json();
            const invoicesData = await invoicesRes.json();

            if (ordersData.success) {
                const orders = ordersData.data;
                setOrders(orders);

                setStats({
                    totalRevenue: orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_amount), 0),
                    paidOrders: orders.filter((o: any) => o.payment_status === 'paid').length,
                    pendingPayments: orders.filter((o: any) => o.payment_status === 'pending').length,
                    todayRevenue: orders
                        .filter((o: any) => isTodayBusinessDay(o.created_at))
                        .reduce((sum: number, o: any) => sum + parseFloat(o.total_amount), 0),
                });
            }

            if (invoicesData.success) {
                setInvoices(invoicesData.data);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateInvoice = async (orderId: number) => {
        try {
            const response = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: orderId }),
            });

            const data = await response.json();

            if (data.success) {
                alert('Invoice generated successfully!');
                fetchData();
            }
        } catch (error) {
            console.error('Error generating invoice:', error);
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
                    <h1>Billing & Invoices</h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => router.push('/admin/sales')} className="btn btn-primary">
                            📊 Sale Book
                        </button>
                        <button onClick={() => router.push('/admin/cashbook')} className="btn btn-primary">
                            💰 Cash Book
                        </button>
                        <button onClick={() => router.push('/admin/dashboard')} className="btn btn-ghost">
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>

                {/* Revenue Stats */}
                <h2 style={{ marginBottom: '1.5rem' }}>Revenue Statistics</h2>
                <div className="grid grid-4" style={{ marginBottom: '3rem' }}>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Revenue</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success)' }}>
                            ₹{stats.totalRevenue.toFixed(0)}
                        </div>
                    </div>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Paid Orders</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {stats.paidOrders}
                        </div>
                    </div>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Pending Payments</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--warning)' }}>
                            {stats.pendingPayments}
                        </div>
                    </div>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Today's Revenue</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--secondary)' }}>
                            ₹{stats.todayRevenue.toFixed(0)}
                        </div>
                    </div>
                </div>

                {/* Recent Orders - Generate Invoices */}
                <h2 style={{ marginBottom: '1.5rem' }}>Generate Invoices</h2>
                <div className="glass-card" style={{ marginBottom: '3rem' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Order ID</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Customer</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Amount</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Payment</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Date</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.slice(0, 10).map((order) => {
                                    const hasInvoice = invoices.some(inv => inv.order_id === order.id);
                                    return (
                                        <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem' }}>#{order.id}</td>
                                            <td style={{ padding: '1rem' }}>{order.customer_name}</td>
                                            <td style={{ padding: '1rem' }}>₹{parseFloat(order.total_amount).toFixed(2)}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span className={`badge badge-${order.payment_status === 'paid' ? 'success' : 'warning'}`}>
                                                    {order.payment_status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {formatDate(order.created_at)}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {hasInvoice ? (
                                                    <span className="badge badge-success">✓ Generated</span>
                                                ) : (
                                                    <button
                                                        onClick={() => generateInvoice(order.id)}
                                                        className="btn btn-primary"
                                                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                                    >
                                                        Generate Invoice
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Generated Invoices */}
                <h2 style={{ marginBottom: '1.5rem' }}>Generated Invoices</h2>
                <div className="glass-card">
                    {invoices.length === 0 ? (
                        <p className="text-muted text-center">No invoices generated yet</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Invoice #</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Order ID</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Subtotal</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Tax</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Total</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Generated</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((invoice) => (
                                        <tr key={invoice.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem', fontFamily: 'monospace' }}>{invoice.invoice_number}</td>
                                            <td style={{ padding: '1rem' }}>#{invoice.order_id}</td>
                                            <td style={{ padding: '1rem' }}>₹{parseFloat(invoice.subtotal).toFixed(2)}</td>
                                            <td style={{ padding: '1rem' }}>₹{parseFloat(invoice.tax).toFixed(2)}</td>
                                            <td style={{ padding: '1rem', fontWeight: 600 }}>₹{parseFloat(invoice.total).toFixed(2)}</td>
                                            <td style={{ padding: '1rem' }}>
                                                {formatDate(invoice.generated_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
