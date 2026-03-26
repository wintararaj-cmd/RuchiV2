'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/utils';

interface ProductSale {
    productId: number;
    productName: string;
    category: string;
    totalQuantity: number;
    totalRevenue: number;
    orderCount: number;
    avgPrice: number;
}

interface OrderItem {
    menuItem: {
        id: number;
        name: string;
        category: string;
        price: number;
    };
    quantity: number;
}

export default function ProductSalesReportPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [productSales, setProductSales] = useState<ProductSale[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'quantity' | 'revenue' | 'name'>('revenue');

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }
        fetchProductSales();
    }, []);

    // Reprocess data when date filter changes
    useEffect(() => {
        if (orders.length > 0) {
            processProductSales(orders);
        }
    }, [dateFilter, customStartDate, customEndDate]);

    const fetchProductSales = async () => {
        try {
            const response = await fetch('/api/orders');
            const data = await response.json();

            if (data.success) {
                setOrders(data.data);
                processProductSales(data.data);
            }
        } catch (error) {
            console.error('Error fetching product sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const processProductSales = (orders: any[]) => {
        const { start, end } = getDateRange();
        const productMap = new Map<number, ProductSale>();

        // Filter orders by date range and status
        const filteredOrders = orders.filter(order => {
            if (order.order_status === 'cancelled') return false;
            const orderDate = new Date(order.created_at);
            return orderDate >= start && orderDate <= end;
        });

        filteredOrders.forEach((order: any) => {
            if (Array.isArray(order.items)) {
                order.items.forEach((item: OrderItem) => {
                    const productId = item.menuItem.id;
                    const price = parseFloat(item.menuItem.price.toString());
                    const quantity = parseInt(item.quantity.toString());
                    const itemRevenue = price * quantity;

                    const existing = productMap.get(productId);

                    if (existing) {
                        existing.totalQuantity += quantity;
                        existing.totalRevenue += itemRevenue;
                        existing.orderCount += 1;
                        // Recalculate average price
                        existing.avgPrice = existing.totalRevenue / existing.totalQuantity;
                    } else {
                        productMap.set(productId, {
                            productId,
                            productName: item.menuItem.name,
                            category: item.menuItem.category || 'Uncategorized',
                            totalQuantity: quantity,
                            totalRevenue: itemRevenue,
                            orderCount: 1,
                            avgPrice: price,
                        });
                    }
                });
            }
        });

        setProductSales(Array.from(productMap.values()));
    };

    const getDateRange = () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        switch (dateFilter) {
            case 'today':
                return { start: today, end: endOfDay };
            case 'week':
                const weekStart = new Date(today);
                weekStart.setDate(today.getDate() - 7);
                return { start: weekStart, end: endOfDay };
            case 'month':
                const monthStart = new Date(today);
                monthStart.setMonth(today.getMonth() - 1);
                return { start: monthStart, end: endOfDay };
            case 'custom':
                const customEnd = customEndDate ? new Date(customEndDate) : new Date();
                if (customEndDate) customEnd.setHours(23, 59, 59, 999);
                return {
                    start: customStartDate ? new Date(customStartDate) : new Date(0),
                    end: customEnd,
                };
            default:
                return { start: new Date(0), end: endOfDay };
        }
    };

    const filteredProducts = productSales
        .filter(product => {
            const matchesSearch = searchQuery === '' ||
                product.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.category.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesSearch;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'quantity':
                    return b.totalQuantity - a.totalQuantity;
                case 'revenue':
                    return b.totalRevenue - a.totalRevenue;
                case 'name':
                    return a.productName.localeCompare(b.productName);
                default:
                    return 0;
            }
        });

    const calculateTotals = () => {
        return filteredProducts.reduce(
            (acc, product) => ({
                totalQuantity: acc.totalQuantity + product.totalQuantity,
                totalRevenue: acc.totalRevenue + product.totalRevenue,
                totalProducts: filteredProducts.length,
            }),
            { totalQuantity: 0, totalRevenue: 0, totalProducts: 0 }
        );
    };

    const exportToCSV = () => {
        const headers = ['Product Name', 'Category', 'Quantity Sold', 'Total Revenue', 'Avg Price', 'Orders'];
        const rows = filteredProducts.map(product => [
            product.productName,
            product.category,
            product.totalQuantity,
            parseFloat(product.totalRevenue.toString()).toFixed(2),
            parseFloat(product.avgPrice.toString()).toFixed(2),
            product.orderCount,
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `product-sales-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const totals = calculateTotals();

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
                    <h1>📊 Product Sales Report</h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={exportToCSV} className="btn btn-primary">
                            📥 Export CSV
                        </button>
                        <button onClick={() => router.push('/admin/dashboard')} className="btn btn-ghost">
                            ← Back
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="glass-card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                Date Range
                            </label>
                            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="input">
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">Last 7 Days</option>
                                <option value="month">Last 30 Days</option>
                                <option value="custom">Custom Range</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                Sort By
                            </label>
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="input">
                                <option value="revenue">Revenue (High to Low)</option>
                                <option value="quantity">Quantity (High to Low)</option>
                                <option value="name">Product Name (A-Z)</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                Search
                            </label>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Product name or category..."
                                className="input"
                            />
                        </div>
                    </div>

                    {dateFilter === 'custom' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Products</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
                            {totals.totalProducts}
                        </div>
                    </div>

                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Quantity Sold</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>
                            {totals.totalQuantity}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            items
                        </div>
                    </div>

                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Revenue</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>
                            ₹{totals.totalRevenue.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Product Sales Table */}
                <div className="glass-card">
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Product Name</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Category</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Qty Sold</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Avg Price</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Total Revenue</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Orders</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }} className="text-muted">
                                            No product sales found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map((product) => (
                                        <tr key={product.productId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem', fontWeight: 500 }}>
                                                {product.productName}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span className="badge" style={{ background: 'var(--surface-hover)', textTransform: 'capitalize' }}>
                                                    {product.category}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                                                {product.totalQuantity}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                ₹{parseFloat(product.avgPrice.toString()).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600, color: 'var(--primary)' }}>
                                                ₹{parseFloat(product.totalRevenue.toString()).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span className="badge badge-info">
                                                    {product.orderCount}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>
    );
}
