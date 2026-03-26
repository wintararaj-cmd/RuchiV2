'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, formatDateTime } from '@/lib/utils';

interface SaleEntry {
    id: number;
    invoice_number: string;
    customer_name: string;
    customer_phone: string;
    items: any[];
    payment_method: string;
    payment_status: string;
    order_type: string;
    subtotal: number;
    tax: number;
    discount: number;
    total_amount: number;
    order_status: string;
    created_at: string;
    user_id: number | null; // Added to track source
    table_number: string | null;
}

interface Salesman {
    id: number;
    name: string;
}

export default function SaleBookPage() {
    const router = useRouter();
    const [sales, setSales] = useState<SaleEntry[]>([]);
    const [salesmen, setSalesmen] = useState<Salesman[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState('today');
    const [paymentFilter, setPaymentFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all'); // 'all', 'web', 'admin', or 'salesman_ID'
    const [searchQuery, setSearchQuery] = useState('');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // Fetch Salesmen
            const salesmenRes = await fetch('/api/admin/salesmen');
            const salesmenData = await salesmenRes.json();
            let loadedSalesmen: Salesman[] = [];
            if (salesmenData.success) {
                loadedSalesmen = salesmenData.data;
                setSalesmen(loadedSalesmen);
            }

            // Fetch Orders
            const ordersResponse = await fetch('/api/orders');
            const ordersData = await ordersResponse.json();

            if (ordersData.success) {
                // Fetch invoices
                const invoicesResponse = await fetch('/api/invoices');
                const invoicesData = await invoicesResponse.json();

                if (invoicesData.success) {
                    const salesData = ordersData.data.map((order: any) => {
                        const invoice = invoicesData.data.find((inv: any) => inv.order_id === order.id);
                        return {
                            ...order,
                            invoice_number: invoice?.invoice_number || `ORD-${order.id}`,
                        };
                    });
                    setSales(salesData);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
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
                return { start: new Date(0), end: endOfDay }; // All time, end is effectively open but practically now/future
        }
    };

    const getOrderSource = (sale: SaleEntry) => {
        if (!sale.user_id) return 'Walk-in / Guest'; 

        const salesman = salesmen.find(s => s.id === sale.user_id);
        if (salesman) return `Salesman: ${salesman.name}`;

        return 'Web Customer';
    };

    const filteredSales = sales.filter(sale => {
        // Exclude cancelled orders
        if (sale.order_status === 'cancelled') return false;

        const saleDate = new Date(sale.created_at);
        const { start, end } = getDateRange();

        const matchesDate = saleDate >= start && saleDate <= end;
        const matchesPayment = paymentFilter === 'all' || sale.payment_method === paymentFilter;
        const matchesSearch = searchQuery === '' ||
            sale.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase());

        let matchesSource = true;

        if (sourceFilter !== 'all') {
            if (sourceFilter === 'web') {
                matchesSource = !!sale.user_id && !salesmen.find(s => s.id === sale.user_id);
            } else if (sourceFilter === 'admin') {
                matchesSource = !sale.user_id;
            } else {
                matchesSource = sale.user_id === parseInt(sourceFilter);
            }
        }

        return matchesDate && matchesPayment && matchesSearch && matchesSource;
    });

    const calculateTotals = () => {
        const totals: any = {
            all: 0,
            cash: 0,
            card: 0,
            upi: 0,
            wallet: 0,
        };

        filteredSales.forEach(sale => {
            const amount = parseFloat(sale.total_amount.toString());
            totals.all += amount;
            totals[sale.payment_method] = (totals[sale.payment_method] || 0) + amount;
        });

        return totals;
    };

    const exportToCSV = () => {
        const headers = ['Date', 'Invoice#', 'Source', 'Customer', 'Phone', 'Type', 'Table', 'Payment Method', 'Amount', 'Status'];
        const rows = filteredSales.map(sale => [
            formatDateTime(sale.created_at),
            sale.invoice_number,
            getOrderSource(sale),
            sale.customer_name,
            sale.customer_phone,
            sale.order_type,
            sale.table_number || '-',
            sale.payment_method,
            sale.total_amount,
            sale.payment_status,
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sale-book-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const totals = calculateTotals();

    if (loading) return <div className="text-center p-5">Loading sales data...</div>;

    return (
        <main className="container" style={{ padding: '2rem 1.5rem' }}>
            <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1>📊 Sale Book</h1>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
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
                                Source / Salesman
                            </label>
                            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="input">
                                <option value="all">All Sources</option>
                                <option value="web">Web Customer</option>
                                <option value="admin">Admin / Walk-in</option>
                                <optgroup label="Salesmen">
                                    {salesmen.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                Payment Method
                            </label>
                            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="input">
                                <option value="all">All Methods</option>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="upi">UPI</option>
                                <option value="wallet">Wallet</option>
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
                                placeholder="Invoice# or Customer..."
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

                {/* Summary */}
                <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Sales</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
                            ₹{totals.all.toFixed(2)}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            {filteredSales.length} transactions
                        </div>
                    </div>
                </div>

                {/* Sales Table */}
                <div className="glass-card">
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Date</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Invoice#</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Source</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Customer</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Type</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Payment</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Amount</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ padding: '2rem', textAlign: 'center' }} className="text-muted">
                                            No sales found for the selected filters
                                        </td>
                                    </tr>
                                ) : (
                                    filteredSales.map(sale => (
                                        <tr key={sale.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem' }}>
                                                {formatDate(sale.created_at)}<br />
                                                <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                                                    {new Date(sale.created_at).toLocaleTimeString('en-IN')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', fontWeight: 500 }}>{sale.invoice_number}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span className="badge" style={{ background: 'var(--surface-hover)' }}>
                                                    {getOrderSource(sale)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {sale.customer_name}<br />
                                                <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                                                    {sale.customer_phone}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span className="badge" style={{ textTransform: 'capitalize' }}>
                                                    {sale.order_type || 'delivery'}
                                                </span>
                                                {sale.table_number && <div style={{ fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--primary)' }}>Table: {sale.table_number}</div>}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span className="badge" style={{
                                                    textTransform: 'uppercase',
                                                    background: sale.payment_method === 'cash' ? 'var(--success)' :
                                                        sale.payment_method === 'upi' ? 'var(--info)' :
                                                            sale.payment_method === 'card' ? 'var(--warning)' : 'var(--secondary)',
                                                    color: 'white'
                                                }}>
                                                    {sale.payment_method === 'cash' ? '💵 Cash' :
                                                        sale.payment_method === 'upi' ? '📱 UPI' :
                                                            sale.payment_method === 'card' ? '💳 Card' :
                                                                sale.payment_method === 'online' ? '🌐 Online' :
                                                                    sale.payment_method || 'Cash'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                                                ₹{parseFloat(sale.total_amount.toString()).toFixed(2)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span className={`badge ${sale.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                                    {sale.payment_status}
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
