'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBusinessDateRange } from '@/lib/date-utils';
import { formatDate, formatDateTime } from '@/lib/utils';

interface GSTReportData {
    gst_rate: number;
    total_sales: number;
    total_gst: number;
    order_count: number;
}

interface OrderDetail {
    id: number;
    invoice_number: string;
    customer_name: string;
    order_date: string;
    subtotal: number;
    tax: number;
    total: number;
    payment_status: string;
}

export default function GSTReportPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [gstData, setGstData] = useState<GSTReportData[]>([]);
    const [orders, setOrders] = useState<OrderDetail[]>([]);
    const [dateFilter, setDateFilter] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }
        fetchGSTReport();
    }, [dateFilter, startDate, endDate]);

    const fetchGSTReport = async () => {
        try {
            setLoading(true);

            // Fetch orders with invoices
            const ordersResponse = await fetch('/api/orders');
            const ordersData = await ordersResponse.json();

            if (!ordersData.success) {
                console.error('Failed to fetch orders');
                return;
            }

            // Fetch invoices
            const invoicesResponse = await fetch('/api/invoices');
            const invoicesData = await invoicesResponse.json();

            if (!invoicesData.success) {
                console.error('Failed to fetch invoices');
                return;
            }

            // Filter orders by business day date range
            const { start, end } = getBusinessDateRange(dateFilter, startDate, endDate);
            const filteredOrders = ordersData.data.filter((o: any) => {
                const orderDate = new Date(o.created_at);
                return orderDate >= start && orderDate <= end;
            });

            // Calculate GST breakdown by rate
            const gstBreakdown = new Map<number, { sales: number; gst: number; count: number }>();

            filteredOrders.forEach((order: any) => {
                if (Array.isArray(order.items)) {
                    order.items.forEach((item: any) => {
                        const gstRate = item.menuItem.gst_rate || 5;
                        const itemPrice = parseFloat(item.menuItem.price);
                        const quantity = parseInt(item.quantity);
                        const itemTotal = itemPrice * quantity;
                        const itemGst = itemTotal * (gstRate / 100);

                        if (!gstBreakdown.has(gstRate)) {
                            gstBreakdown.set(gstRate, { sales: 0, gst: 0, count: 0 });
                        }

                        const current = gstBreakdown.get(gstRate)!;
                        current.sales += itemTotal;
                        current.gst += itemGst;
                        current.count += 1;
                    });
                }
            });

            // Convert to array and sort by GST rate
            const gstArray: GSTReportData[] = Array.from(gstBreakdown.entries())
                .map(([rate, data]) => ({
                    gst_rate: rate,
                    total_sales: data.sales,
                    total_gst: data.gst,
                    order_count: data.count,
                }))
                .sort((a, b) => a.gst_rate - b.gst_rate);

            setGstData(gstArray);

            // Prepare order details with invoice numbers
            const orderDetails: OrderDetail[] = filteredOrders.map((order: any) => {
                const invoice = invoicesData.data.find((inv: any) => inv.order_id === order.id);
                return {
                    id: order.id,
                    invoice_number: invoice?.invoice_number || `ORD-${order.id}`,
                    customer_name: order.customer_name,
                    order_date: order.created_at,
                    subtotal: parseFloat(order.subtotal),
                    tax: parseFloat(order.tax),
                    total: parseFloat(order.total_amount),
                    payment_status: order.payment_status,
                };
            });

            setOrders(orderDetails);
        } catch (error) {
            console.error('Error fetching GST report:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTotalGST = () => {
        return gstData.reduce((sum, item) => sum + item.total_gst, 0);
    };

    const getTotalSales = () => {
        return gstData.reduce((sum, item) => sum + item.total_sales, 0);
    };

    const exportToCSV = () => {
        // Get current date range for report header
        let dateRange = 'All Time';
        if (dateFilter === 'today') dateRange = 'Today';
        else if (dateFilter === 'week') dateRange = 'Last 7 Days';
        else if (dateFilter === 'month') dateRange = 'Last 30 Days';
        else if (dateFilter === 'custom' && startDate && endDate) {
            dateRange = `${startDate} to ${endDate}`;
        }

        // Build comprehensive CSV content
        const csvLines = [
            // Report Header
            'GST REPORT - RUCHI RESTAURANT',
            `Generated: ${formatDateTime(new Date())}`,
            `Period: ${dateRange}`,
            '',

            // Summary Section
            'SUMMARY',
            `Total Orders,${orders.length}`,
            `Total Sales (Excl. GST),₹${getTotalSales().toFixed(2)}`,
            `Total GST Collected,₹${getTotalGST().toFixed(2)}`,
            `Grand Total (Incl. GST),₹${(getTotalSales() + getTotalGST()).toFixed(2)}`,
            '',

            // GST Breakdown by Rate
            'GST BREAKDOWN BY RATE',
            'GST Rate (%),Total Sales (₹),GST Amount (₹),Item Count,% of Total GST',
        ];

        // Add GST rate data
        gstData.forEach(item => {
            csvLines.push(
                `${item.gst_rate}%,${item.total_sales.toFixed(2)},${item.total_gst.toFixed(2)},${item.order_count},${((item.total_gst / getTotalGST()) * 100).toFixed(1)}%`
            );
        });

        // Add totals row
        csvLines.push(
            `TOTAL,${getTotalSales().toFixed(2)},${getTotalGST().toFixed(2)},${gstData.reduce((sum, item) => sum + item.order_count, 0)},100%`
        );

        csvLines.push('');

        // Order Details Section
        csvLines.push('ORDER DETAILS');
        csvLines.push('Invoice#,Customer,Date,Subtotal (₹),GST (₹),Total (₹),Payment Status');

        // Add order data
        orders.forEach(order => {
            csvLines.push(
                `${order.invoice_number},${order.customer_name},${formatDate(order.order_date)},${order.subtotal.toFixed(2)},${order.tax.toFixed(2)},${order.total.toFixed(2)},${order.payment_status}`
            );
        });

        csvLines.push('');
        csvLines.push('--- END OF REPORT ---');

        // Create and download CSV
        const csvContent = csvLines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gst-report-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
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
                    <h1>GST Report</h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={exportToCSV} className="btn btn-secondary">
                            📊 Export CSV
                        </button>
                        <button onClick={() => router.push('/admin/dashboard')} className="btn btn-ghost">
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="glass-card" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Filter by Date</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                        <button
                            onClick={() => setDateFilter('all')}
                            className={dateFilter === 'all' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            All Time
                        </button>
                        <button
                            onClick={() => setDateFilter('today')}
                            className={dateFilter === 'today' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setDateFilter('yesterday')}
                            className={dateFilter === 'yesterday' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            Yesterday
                        </button>
                        <button
                            onClick={() => setDateFilter('week')}
                            className={dateFilter === 'week' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            Last 7 Days
                        </button>
                        <button
                            onClick={() => setDateFilter('month')}
                            className={dateFilter === 'month' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            Last 30 Days
                        </button>
                        <button
                            onClick={() => setDateFilter('custom')}
                            className={dateFilter === 'custom' ? 'btn btn-primary' : 'btn btn-ghost'}
                        >
                            Custom Range
                        </button>
                    </div>

                    {dateFilter === 'custom' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Start Date</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>End Date</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Summary Cards */}
                <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
                    <div className="glass-card">
                        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Sales (Excl. GST)</p>
                        <h2 style={{ color: 'var(--primary)', margin: 0 }}>₹{getTotalSales().toFixed(2)}</h2>
                    </div>
                    <div className="glass-card">
                        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total GST Collected</p>
                        <h2 style={{ color: 'var(--success)', margin: 0 }}>₹{getTotalGST().toFixed(2)}</h2>
                    </div>
                    <div className="glass-card">
                        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Orders</p>
                        <h2 style={{ color: 'var(--secondary)', margin: 0 }}>{orders.length}</h2>
                    </div>
                </div>

                {/* GST Breakdown by Rate */}
                <div className="glass-card" style={{ marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '1.5rem' }}>GST Breakdown by Rate</h2>
                    {gstData.length === 0 ? (
                        <p className="text-muted text-center" style={{ padding: '2rem 0' }}>
                            No GST data available for the selected period
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>GST Rate</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Total Sales (₹)</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>GST Amount (₹)</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Item Count</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>% of Total GST</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gstData.map((item) => (
                                        <tr key={item.gst_rate} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem', fontWeight: 600 }}>
                                                <span className="badge badge-primary">{item.gst_rate}%</span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                ₹{item.total_sales.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                                                ₹{item.total_gst.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                {item.order_count}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                {((item.total_gst / getTotalGST()) * 100).toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                    <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 700 }}>
                                        <td style={{ padding: '1rem' }}>TOTAL</td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>₹{getTotalSales().toFixed(2)}</td>
                                        <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)' }}>
                                            ₹{getTotalGST().toFixed(2)}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            {gstData.reduce((sum, item) => sum + item.order_count, 0)}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>100%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Order Details */}
                <div className="glass-card">
                    <h2 style={{ marginBottom: '1.5rem' }}>Order Details</h2>
                    {orders.length === 0 ? (
                        <p className="text-muted text-center" style={{ padding: '2rem 0' }}>
                            No orders found for the selected period
                        </p>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Invoice#</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Customer</th>
                                        <th style={{ padding: '1rem', textAlign: 'left' }}>Date</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Subtotal</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>GST</th>
                                        <th style={{ padding: '1rem', textAlign: 'right' }}>Total</th>
                                        <th style={{ padding: '1rem', textAlign: 'center' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order) => (
                                        <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem', fontWeight: 500 }}>{order.invoice_number}</td>
                                            <td style={{ padding: '1rem' }}>{order.customer_name}</td>
                                            <td style={{ padding: '1rem', fontSize: '0.875rem' }}>
                                                {formatDate(order.order_date)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>₹{order.subtotal.toFixed(2)}</td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)' }}>
                                                ₹{order.tax.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 600 }}>
                                                ₹{order.total.toFixed(2)}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <span className={`badge ${order.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                                                    {order.payment_status}
                                                </span>
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
