'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export default function AdminDashboard() {
    const router = useRouter();
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingOrders: 0,
        totalRevenue: 0,
        todayRevenue: 0,
    });
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }
        fetchDashboardData();
    }, []); // Empty dependency - only run on mount

    const fetchDashboardData = async () => {
        try {
            const response = await fetch('/api/orders', { cache: 'no-store' });
            const data = await response.json();

            if (data.success) {
                const orders = data.data;
                const today = new Date().toDateString();

                setStats({
                    totalOrders: orders.length,
                    pendingOrders: orders.filter((o: any) => o.order_status === 'pending').length,
                    totalRevenue: orders.reduce((sum: number, o: any) => sum + parseFloat(o.total_amount), 0),
                    todayRevenue: orders
                        .filter((o: any) => new Date(o.created_at).toDateString() === today)
                        .reduce((sum: number, o: any) => sum + parseFloat(o.total_amount), 0),
                });

                setRecentOrders(orders.slice(0, 5));
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        router.push('/admin');
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
            {/* Removed fade-in class to prevent potential pointer-event issues */}
            <div style={{ position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1>Admin Dashboard</h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={handleLogout} className="btn btn-ghost" style={{ cursor: 'pointer', position: 'relative', zIndex: 20 }}>
                            Logout
                        </button>
                    </div>
                </div>

                {/* Quick Links */}
                <div className="grid grid-4" style={{ marginBottom: '3rem', position: 'relative', zIndex: 10 }}>
                    <Link href="/admin/menu" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🍽️</div>
                        <h3>Menu Management</h3>
                        <p className="text-muted">Add, edit, delete items</p>
                    </Link>
                    <Link href="/admin/categories" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🏷️</div>
                        <h3>Categories</h3>
                        <p className="text-muted">Manage menu categories</p>
                    </Link>
                    <Link href="/admin/orders" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📦</div>
                        <h3>Orders</h3>
                        <p className="text-muted">Manage all orders</p>
                    </Link>
                    <Link href="/admin/analytics" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
                        <h3>Analytics</h3>
                        <p className="text-muted">Charts & insights</p>
                    </Link>
                    <Link href="/admin/billing" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💰</div>
                        <h3>Billing</h3>
                        <p className="text-muted">Invoices & reports</p>
                    </Link>
                    <Link href="/admin/settings" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚙️</div>
                        <h3>Settings</h3>
                        <p className="text-muted">Printer & restaurant info</p>
                    </Link>
                    <Link href="/admin/salesmen" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👨‍💼</div>
                        <h3>Salesmen</h3>
                        <p className="text-muted">Manage sales staff</p>
                    </Link>
                    <Link href="/admin/delivery-boys" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🛵</div>
                        <h3>Delivery Boys</h3>
                        <p className="text-muted">Manage delivery staff</p>
                    </Link>
                    <Link href="/admin/delivery-locations" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📍</div>
                        <h3>Delivery Locations</h3>
                        <p className="text-muted">Manage delivery zones</p>
                    </Link>
                    <Link href="/admin/payouts" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💸</div>
                        <h3>Commissions</h3>
                        <p className="text-muted">Payouts & Reports</p>
                    </Link>
                    <Link href="/admin/quick-bill" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1, borderColor: 'var(--primary)', borderWidth: '2px' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🧾</div>
                        <h3 style={{ color: 'var(--primary)' }}>Quick Bill</h3>
                        <p className="text-muted">Create Invoice & Print</p>
                    </Link>
                    <Link href="/admin/data-management" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
                        <h3>Data Import/Export</h3>
                        <p className="text-muted">Backup & restore data</p>
                    </Link>
                </div>

                {/* Accounting Links */}
                <h2 style={{ marginBottom: '1.5rem' }}>Accounting</h2>
                <div className="grid grid-4" style={{ marginBottom: '3rem' }}>
                    <Link href="/admin/sales" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
                        <h3>Sale Book</h3>
                        <p className="text-muted">View all sales transactions</p>
                    </Link>
                    <Link href="/admin/product-sales" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📦</div>
                        <h3>Product Sales</h3>
                        <p className="text-muted">Product-wise sales report</p>
                    </Link>
                    <Link href="/admin/cashbook" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💵</div>
                        <h3>Cash Book</h3>
                        <p className="text-muted">Track cash flow</p>
                    </Link>
                    <Link href="/admin/gst-report" className="glass-card text-center" style={{ textDecoration: 'none', cursor: 'pointer', position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📈</div>
                        <h3>GST Report</h3>
                        <p className="text-muted">Tax breakdown & compliance</p>
                    </Link>
                </div>

                {/* Stats */}
                <h2 style={{ marginBottom: '1.5rem' }}>Statistics</h2>
                <div className="grid grid-4" style={{ marginBottom: '3rem' }}>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Orders</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {stats.totalOrders}
                        </div>
                    </div>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Pending Orders</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--warning)' }}>
                            {stats.pendingOrders}
                        </div>
                    </div>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Revenue</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--success)' }}>
                            ₹{stats.totalRevenue.toFixed(0)}
                        </div>
                    </div>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Today's Revenue</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--secondary)' }}>
                            ₹{stats.todayRevenue.toFixed(0)}
                        </div>
                    </div>
                </div>

                {/* Recent Orders */}
                <h2 style={{ marginBottom: '1.5rem' }}>Recent Orders</h2>
                <div className="glass-card">
                    {recentOrders.length === 0 ? (
                        <p className="text-muted text-center">No orders yet</p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Order ID</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Customer</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Amount</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Status</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentOrders.map((order) => (
                                        <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem' }}>#{order.id}</td>
                                            <td style={{ padding: '1rem' }}>{order.customer_name}</td>
                                            <td style={{ padding: '1rem' }}>₹{parseFloat(order.total_amount).toFixed(2)}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span className={`badge badge-${order.order_status === 'delivered' ? 'success' : 'warning'}`}>
                                                    {order.order_status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {formatDate(order.created_at)}
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
