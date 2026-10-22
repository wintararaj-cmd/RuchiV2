'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { formatDate } from '@/lib/utils';

interface AnalyticsData {
    totalRevenue: number;
    totalOrders: number;
    averageOrderValue: number;
    topSellingItems: { name: string; quantity: number; revenue: number }[];
    revenueByDay: { date: string; revenue: number; orders: number }[];
    ordersByStatus: { status: string; count: number }[];
    paymentMethods: { method: string; count: number; amount: number }[];
    categoryRevenue: { category: string; revenue: number }[];
}

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

export default function AnalyticsPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState<AnalyticsData>({
        totalRevenue: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        topSellingItems: [],
        revenueByDay: [],
        ordersByStatus: [],
        paymentMethods: [],
        categoryRevenue: [],
    });
    const [dateRange, setDateRange] = useState('7days');

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }
        fetchAnalytics();
    }, [dateRange]);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);

            // Fetch orders
            const ordersResponse = await fetch('/api/orders');
            const ordersData = await ordersResponse.json();

            if (!ordersData.success) {
                console.error('Failed to fetch orders');
                return;
            }

            const orders = ordersData.data;

            // Filter by date range
            const now = new Date();
            let startDate = new Date();

            if (dateRange === '7days') {
                startDate.setDate(now.getDate() - 7);
            } else if (dateRange === '30days') {
                startDate.setDate(now.getDate() - 30);
            } else if (dateRange === '90days') {
                startDate.setDate(now.getDate() - 90);
            } else if (dateRange === 'year') {
                startDate.setFullYear(now.getFullYear() - 1);
            }

            const filteredOrders = dateRange === 'all'
                ? orders
                : orders.filter((o: any) => new Date(o.created_at) >= startDate);

            // Calculate metrics
            const totalRevenue = filteredOrders.reduce((sum: number, o: any) =>
                sum + parseFloat(o.total_amount), 0
            );

            const totalOrders = filteredOrders.length;
            const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // Top selling items
            const itemsMap = new Map<string, { quantity: number; revenue: number }>();
            filteredOrders.forEach((order: any) => {
                if (Array.isArray(order.items)) {
                    order.items.forEach((item: any) => {
                        const name = item.menuItem.name;
                        const quantity = parseInt(item.quantity);
                        const revenue = parseFloat(item.menuItem.price) * quantity;

                        if (itemsMap.has(name)) {
                            const current = itemsMap.get(name)!;
                            current.quantity += quantity;
                            current.revenue += revenue;
                        } else {
                            itemsMap.set(name, { quantity, revenue });
                        }
                    });
                }
            });

            const topSellingItems = Array.from(itemsMap.entries())
                .map(([name, data]) => ({ name, ...data }))
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);

            // Revenue by day
            const revenueByDayMap = new Map<string, { revenue: number; orders: number }>();
            filteredOrders.forEach((order: any) => {
                const date = new Date(order.created_at).toISOString().split('T')[0];
                const revenue = parseFloat(order.total_amount);

                if (revenueByDayMap.has(date)) {
                    const current = revenueByDayMap.get(date)!;
                    current.revenue += revenue;
                    current.orders += 1;
                } else {
                    revenueByDayMap.set(date, { revenue, orders: 1 });
                }
            });

            const revenueByDay = Array.from(revenueByDayMap.entries())
                .map(([date, data]) => ({ date, ...data }))
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(item => ({
                    ...item,
                    date: formatDate(item.date)
                }));

            // Orders by status
            const statusMap = new Map<string, number>();
            filteredOrders.forEach((order: any) => {
                const status = order.order_status;
                statusMap.set(status, (statusMap.get(status) || 0) + 1);
            });

            const ordersByStatus = Array.from(statusMap.entries())
                .map(([status, count]) => ({ status, count }));

            // Payment methods
            const paymentMap = new Map<string, { count: number; amount: number }>();
            filteredOrders.forEach((order: any) => {
                const method = order.payment_method;
                const amount = parseFloat(order.total_amount);

                if (paymentMap.has(method)) {
                    const current = paymentMap.get(method)!;
                    current.count += 1;
                    current.amount += amount;
                } else {
                    paymentMap.set(method, { count: 1, amount });
                }
            });

            const paymentMethods = Array.from(paymentMap.entries())
                .map(([method, data]) => ({ method, ...data }));

            // Category revenue
            const categoryMap = new Map<string, number>();
            filteredOrders.forEach((order: any) => {
                if (Array.isArray(order.items)) {
                    order.items.forEach((item: any) => {
                        const category = item.menuItem.category_name || 'Uncategorized';
                        const revenue = parseFloat(item.menuItem.price) * parseInt(item.quantity);
                        categoryMap.set(category, (categoryMap.get(category) || 0) + revenue);
                    });
                }
            });

            const categoryRevenue = Array.from(categoryMap.entries())
                .map(([category, revenue]) => ({ category, revenue }))
                .sort((a, b) => b.revenue - a.revenue);

            setAnalytics({
                totalRevenue,
                totalOrders,
                averageOrderValue,
                topSellingItems,
                revenueByDay,
                ordersByStatus,
                paymentMethods,
                categoryRevenue,
            });
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
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
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1>Analytics Dashboard</h1>
                    <button onClick={() => router.push('/admin/dashboard')} className="btn btn-ghost">
                        ← Back to Dashboard
                    </button>
                </div>

                {/* Date Range Filter */}
                <div className="glass-card" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Time Period</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                        <button
                            onClick={() => setDateRange('7days')}
                            className={dateRange === '7days' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            Last 7 Days
                        </button>
                        <button
                            onClick={() => setDateRange('30days')}
                            className={dateRange === '30days' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            Last 30 Days
                        </button>
                        <button
                            onClick={() => setDateRange('90days')}
                            className={dateRange === '90days' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            Last 90 Days
                        </button>
                        <button
                            onClick={() => setDateRange('year')}
                            className={dateRange === 'year' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            Last Year
                        </button>
                        <button
                            onClick={() => setDateRange('all')}
                            className={dateRange === 'all' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            All Time
                        </button>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
                    <div className="glass-card">
                        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Revenue</p>
                        <h2 style={{ color: 'var(--success)', margin: 0 }}>₹{analytics.totalRevenue.toFixed(2)}</h2>
                    </div>
                    <div className="glass-card">
                        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Orders</p>
                        <h2 style={{ color: 'var(--primary)', margin: 0 }}>{analytics.totalOrders}</h2>
                    </div>
                    <div className="glass-card">
                        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Avg Order Value</p>
                        <h2 style={{ color: 'var(--secondary)', margin: 0 }}>₹{analytics.averageOrderValue.toFixed(2)}</h2>
                    </div>
                </div>

                {/* Revenue Trend Chart */}
                <div className="glass-card" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '1.5rem' }}>Revenue Trend</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analytics.revenueByDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis dataKey="date" stroke="var(--text-muted)" />
                            <YAxis stroke="var(--text-muted)" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue (₹)" />
                            <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} name="Orders" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Charts Grid */}
                <div className="grid grid-2" style={{ marginBottom: '2rem' }}>
                    {/* Top Selling Items */}
                    <div className="glass-card">
                        <h2 style={{ marginBottom: '1.5rem' }}>Top Selling Items</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analytics.topSellingItems.slice(0, 5)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="name" stroke="var(--text-muted)" />
                                <YAxis stroke="var(--text-muted)" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue (₹)" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Category Revenue */}
                    <div className="glass-card">
                        <h2 style={{ marginBottom: '1.5rem' }}>Revenue by Category</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={analytics.categoryRevenue}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(entry: any) => `${entry.category}: ₹${entry.revenue.toFixed(0)}`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="revenue"
                                >
                                    {analytics.categoryRevenue.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Order Status */}
                    <div className="glass-card">
                        <h2 style={{ marginBottom: '1.5rem' }}>Orders by Status</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={analytics.ordersByStatus}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(entry: any) => `${entry.status}: ${entry.count}`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="count"
                                >
                                    {analytics.ordersByStatus.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Payment Methods */}
                    <div className="glass-card">
                        <h2 style={{ marginBottom: '1.5rem' }}>Payment Methods</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analytics.paymentMethods}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                <XAxis dataKey="method" stroke="var(--text-muted)" />
                                <YAxis stroke="var(--text-muted)" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="amount" fill="#ec4899" name="Amount (₹)" />
                                <Bar dataKey="count" fill="#f59e0b" name="Count" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Selling Items Table */}
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1.5rem' }}>Top 10 Selling Items</h2>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Rank</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Item Name</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Quantity Sold</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.topSellingItems.map((item, index) => (
                                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <span className="badge badge-primary">#{index + 1}</span>
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 500 }}>{item.name}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>{item.quantity}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                                            ₹{item.revenue.toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}
