'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { ReceiptPrinter } from '@/lib/receipt-printer';
import { formatDate, formatDateTime } from '@/lib/utils';

export default function AdminOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('today');
    const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);

    const [deliveryBoys, setDeliveryBoys] = useState<any[]>([]);
    const [salesmen, setSalesmen] = useState<any[]>([]);
    const [editingDiscount, setEditingDiscount] = useState<{ [key: number]: string }>({});

    const [settings, setSettings] = useState<any>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [audioUnlocked, setAudioUnlocked] = useState(false);
    
    // Track previous order IDs to detect new orders
    const prevOrderIdsRef = useRef<Set<number>>(new Set());
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Initialize audio (using a clean bell sound from a different source)
        audioRef.current = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-back-2574.mp3');
        audioRef.current.volume = 0.5;
        
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }
        fetchSettings();
        fetchSalesmen();
        fetchOrders();
        fetchDeliveryBoys();

        // Set up polling every 30 seconds for new orders
        const interval = setInterval(() => {
            fetchOrders(true);
        }, 30000);

        return () => clearInterval(interval);
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

    const fetchSalesmen = async () => {
        try {
            const response = await fetch('/api/admin/salesmen');
            const data = await response.json();
            if (data.success) {
                setSalesmen(data.data);
            }
        } catch (error) {
            console.error('Error fetching salesmen:', error);
        }
    };

    const playNotificationSound = () => {
        if (soundEnabled && audioRef.current) {
            audioRef.current.play().catch(e => console.warn('Sound play blocked:', e));
        }
    };

    const fetchOrders = async (isPolling = false) => {
        try {
            const response = await fetch('/api/orders', { cache: 'no-store' });
            const data = await response.json();
            if (data.success) {
                const newOrders = data.data;
                
                // If polling, check for new IDs that weren't in our set
                if (isPolling && prevOrderIdsRef.current.size > 0) {
                    const hasNewOrder = newOrders.some((order: any) => {
                        const isNew = !prevOrderIdsRef.current.has(order.id);
                        if (!isNew) return false;

                        // Skip sound if the order was created by a salesman
                        const isFromSalesman = salesmen.some(s => s.id === order.user_id);
                        return !isFromSalesman;
                    });

                    if (hasNewOrder) {
                        playNotificationSound();
                    }
                }

                // Update the set of seen IDs
                const currentIds = new Set(newOrders.map((o: any) => o.id));
                prevOrderIdsRef.current = currentIds;

                setOrders(newOrders);
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    const fetchDeliveryBoys = async () => {
        try {
            const response = await fetch('/api/admin/delivery-boys');
            const data = await response.json();
            if (data.success) {
                setDeliveryBoys(data.data);
            }
        } catch (error) {
            console.error('Error fetching delivery boys:', error);
        }
    };

    const updateDeliveryBoy = async (orderId: number, deliveryBoyId: string) => {
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delivery_boy_id: deliveryBoyId ? parseInt(deliveryBoyId) : null }),
            });

            if (response.ok) {
                fetchOrders();
                alert('Delivery Boy Assigned Updated');
            } else {
                alert('Failed to update assignment');
            }
        } catch (error) {
            console.error('Error updating delivery boy:', error);
        }
    };

    const updateOrderStatus = async (orderId: number, status: string) => {
        try {
            console.log('Updating order status:', orderId, status);
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_status: status }),
            });

            const data = await response.json();
            console.log('Update response:', data);

            if (data.success) {
                fetchOrders();
                alert(`Order status updated to: ${status}`);
            } else {
                alert(`Failed to update order: ${data.error}`);
            }
        } catch (error) {
            console.error('Error updating order:', error);
            alert('An error occurred while updating the order. Check console for details.');
        }
    };

    const updatePaymentStatus = async (orderId: number, status: string) => {
        try {
            console.log('Updating payment status:', orderId, status);
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_status: status }),
            });

            const data = await response.json();
            console.log('Update response:', data);

            if (data.success) {
                fetchOrders();
                alert(`Payment status updated to: ${status}`);
            } else {
                alert(`Failed to update payment: ${data.error}`);
            }
        } catch (error) {
            console.error('Error updating payment:', error);
            alert('An error occurred while updating payment. Check console for details.');
        }
    };

    const updatePaymentMethod = async (orderId: number, method: string) => {
        try {
            console.log('Updating payment method:', orderId, method);
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payment_method: method }),
            });

            const data = await response.json();
            console.log('Update response:', data);

            if (data.success) {
                fetchOrders();
                alert(`Payment method updated to: ${method}`);
            } else {
                alert(`Failed to update payment method: ${data.error}`);
            }
        } catch (error) {
            console.error('Error updating payment method:', error);
            alert('An error occurred while updating payment method. Check console for details.');
        }
    };

    const updateDiscount = async (orderId: number, discount: number) => {
        try {
            const order = orders.find(o => o.id === orderId);
            if (!order) return;

            // Recalculate total with new discount
            const subtotal = parseFloat(order.subtotal || 0);
            const tax = parseFloat(order.tax || 0);
            const deliveryCharge = parseFloat(order.delivery_charge || 0);
            const newTotal = subtotal + tax + deliveryCharge - discount;

            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    discount: discount,
                    total_amount: newTotal
                }),
            });

            const data = await response.json();

            if (data.success) {
                fetchOrders();
                alert('Discount Updated Successfully');
            } else {
                alert(`Failed to update discount: ${data.error}`);
            }
        } catch (error) {
            console.error('Error updating discount:', error);
            alert('An error occurred while updating discount.');
        }
    };



    const printReceiptFallback = (order: any, settings: any) => {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) {
            alert('Please allow popups to print the receipt.');
            return;
        }

        const itemsHtml = (Array.isArray(order.items) ? order.items : []).map((item: any) => {
            const total = (Number(item.menuItem.price) * item.quantity).toFixed(2);
            return `
            <tr>
                <td style="padding: 4px 0;">${item.menuItem.name.toUpperCase()}</td>
                <td style="text-align: center; padding: 4px 0;">${item.quantity}</td>
                <td style="text-align: right; padding: 4px 0;">${total}</td>
            </tr>`;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt #${order.order_number || order.id}</title>
            <style>
                @page { margin: 0; size: 80mm auto; }
                body {
                    font-family: 'Courier New', Courier, monospace;
                    width: 78mm;
                    margin: 0 auto;
                    padding: 2mm;
                    font-size: 20px; 
                    font-weight: bold;
                    color: black;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .bold { font-weight: 900; }
                .header-large { font-size: 32px; font-weight: 900; }
                .header-medium { font-size: 24px; font-weight: 900; }
                .divider { border-top: 2px dashed black; margin: 6px 0; }
                table { width: 100%; border-collapse: collapse; font-size: 20px; }
                th { border-bottom: 2px dashed black; padding-bottom: 4px; }
            </style>
            </head>
            <body>
                <div class="text-center header-large">${settings?.restaurantName || 'Ruchi Restaurant'}</div>
                <div class="text-center" style="font-size: 16px;">${settings?.restaurantAddress || ''}</div>
                <div class="text-center" style="font-size: 16px;">Ph: ${settings?.restaurantPhone || ''}</div>
                ${settings?.gstNumber ? `<div class="text-center" style="font-size: 16px;">GST: ${settings.gstNumber}</div>` : ''}
                <div class="divider"></div>
                
                <div class="text-center bold header-medium">${settings?.gstType === 'regular' ? 'TAX INVOICE' : 'BILL OF SUPPLY'}</div>
                <div>Order #: ${order.order_number || order.id}</div>
                <div>Date: ${formatDateTime(order.created_at)}</div>
                ${order.table_number ? `<div class="bold" style="font-size: 22px;">Table No: ${order.table_number}</div>` : ''}
                
                <div class="divider"></div>
                
                <div>Name: ${order.customer_name}</div>
                <div>Phone: ${order.customer_phone}</div>
                ${order.customer_address ? `<div>Addr: ${order.customer_address}</div>` : ''}
                <div>Type: ${order.order_type.toUpperCase()}</div>
                
                <div class="divider"></div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="text-align: left;">ITEM</th>
                            <th style="text-align: center;">QTY</th>
                            <th style="text-align: right;">AMT</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div class="divider"></div>
                
                <div class="text-right" style="font-size: 20px;">Subtotal: ${Number(order.subtotal || order.total_amount).toFixed(2)}</div>
                ${Number(order.tax || 0) > 0 ? `<div class="text-right" style="font-size: 20px;">Tax: ${Number(order.tax).toFixed(2)}</div>` : ''}
                ${(Number(order.discount || 0) > 0 || Number(order.discount_amount || 0) > 0) ? `<div class="text-right" style="font-size: 20px;">Discount: -${Number(order.discount || order.discount_amount || 0).toFixed(2)}</div>` : ''}
                <div class="text-right header-medium" style="margin-top: 5px;">TOTAL: ${Number(order.total_amount).toFixed(2)}</div>
                
                <div class="divider"></div>
                <div class="text-center">${settings?.footerText || 'Thank you for visiting'}</div>
                <br />
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            printWindow.onafterprint = () => {
                printWindow.close();
            };
        }, 500);
    };

    const handlePrintBill = async (order: any) => {
        setPrintingOrderId(order.id);

        try {
            // @ts-ignore
            if (!navigator.usb) {
                // If WebUSB is not supported, fallback immediately
                printReceiptFallback(order, settings);
                return;
            }

            // @ts-ignore
            const device = await navigator.usb.requestDevice({ filters: [] });
            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(0);

            const printer = new ReceiptPrinter();

            // Header
            printer.alignCenter();
            printer.setSize(2, 2); // Double Width, Double Height
            printer.bold(true).textLine(settings?.restaurantName || 'Ruchi Restaurant');
            printer.bold(false);
            printer.setSize(1, 2); // Taller for better readability

            printer.textLine(settings?.restaurantAddress || '');
            printer.textLine(`Ph: ${settings?.restaurantPhone || ''}`);
            if (settings?.gstNumber) printer.textLine(`GST: ${settings.gstNumber}`);
            printer.feed(1);

            // Title and Meta
            printer.setSize(2, 2); // Larger title
            printer.bold(true).textLine(settings?.gstType === 'regular' ? 'TAX INVOICE' : 'BILL OF SUPPLY');
            printer.bold(false);
            printer.setSize(1, 2); // Taller

            printer.textLine(`No: ${order.order_number || order.id}`);
            printer.textLine(`Date: ${formatDateTime(order.created_at)}`);
            if (order.table_number) {
                printer.setSize(2, 2);
                printer.bold(true).textLine(`Table No: ${order.table_number}`).bold(false);
                printer.setSize(1, 2);
            }
            printer.line('-');

            // Customer
            printer.alignLeft();
            printer.textLine(`Name: ${order.customer_name}`);
            printer.textLine(`Phone: ${order.customer_phone}`);
            if (order.customer_address) printer.textLine(`Addr: ${order.customer_address}`);
            printer.textLine(`Type: ${order.order_type.toUpperCase()}`);
            printer.line('-');

            // Items
            printer.textLine('ITEM             QTY      AMT');
            printer.line('-');

            if (Array.isArray(order.items)) {
                order.items.forEach((item: any) => {
                    const name = item.menuItem.name.substring(0, 16).padEnd(16, ' ');
                    const qty = item.quantity.toString().padStart(3, ' ');
                    const total = (Number(item.menuItem.price) * item.quantity).toFixed(2).padStart(10, ' ');
                    printer.setSize(1, 2); // Taller font for items
                    printer.bold(true);    // Bold on
                    printer.textLine(`${name} ${qty} ${total}`);
                    printer.bold(false);   // Bold off
                });
            }
            printer.setSize(1, 2);
            printer.line('-');

            // Totals
            printer.alignRight();
            printer.textLine(`Subtotal: ${Number(order.subtotal || order.total_amount).toFixed(2)}`);
            if (Number(order.tax || 0) > 0) printer.textLine(`Tax: ${Number(order.tax).toFixed(2)}`);
            if (Number(order.discount || 0) > 0 || Number(order.discount_amount || 0) > 0) printer.textLine(`Discount: -${Number(order.discount || order.discount_amount || 0).toFixed(2)}`);

            printer.setSize(2, 3); // Extra large Total
            printer.bold(true).textLine(`TOTAL: ${Number(order.total_amount).toFixed(2)}`).bold(false);
            printer.setSize(1, 2);
            printer.feed(1);

            // Footer
            printer.alignCenter();
            printer.textLine(settings?.footerText || 'Thank You!');
            printer.feed(3);
            printer.cut();

            const data = printer.getData();
            // @ts-ignore
            await device.transferOut(1, data);
            // @ts-ignore
            await device.close();

        } catch (error: any) {
            console.warn('USB Bill Print failed, falling back:', error);
            printReceiptFallback(order, settings);
        } finally {
            setPrintingOrderId(null);
        }
    };

    const filteredOrders = orders.filter(o => {
        const matchesStatus = filter === 'all' || o.order_status === filter;

        let matchesDate = true;
        if (dateFilter === 'today') {
            const today = new Date().toDateString();
            const orderDate = new Date(o.created_at).toDateString();
            matchesDate = orderDate === today;
        }

        return matchesStatus && matchesDate;
    });

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ marginBottom: '0.5rem' }}>Order Management</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button 
                                onClick={() => {
                                    setSoundEnabled(!soundEnabled);
                                    // Unlock audio on first interaction
                                    if (!audioUnlocked && !soundEnabled && audioRef.current) {
                                        audioRef.current.play().then(() => {
                                            audioRef.current?.pause();
                                            if (audioRef.current) audioRef.current.currentTime = 0;
                                            setAudioUnlocked(true);
                                        }).catch(console.error);
                                    } else if (!soundEnabled) {
                                        playNotificationSound();
                                    }
                                }}
                                className={`btn ${soundEnabled ? 'btn-primary' : 'btn-danger'}`}
                                style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                            >
                                {soundEnabled ? '🔔 Sound On' : '🔕 Sound Off'}
                            </button>
                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                (Auto-checks for new orders)
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => router.push('/admin/orders/create')} className="btn btn-primary">
                            + Create New Order
                        </button>
                        <button onClick={() => router.push('/admin/dashboard')} className="btn btn-ghost">
                            ← Back to Dashboard
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <strong>Date Range:</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                        <button
                            onClick={() => setDateFilter('today')}
                            className={dateFilter === 'today' ? 'btn btn-primary' : 'btn btn-ghost'}
                            style={{ padding: '0.625rem 1.25rem' }}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setDateFilter('all')}
                            className={dateFilter === 'all' ? 'btn btn-primary' : 'btn btn-ghost'}
                            style={{ padding: '0.625rem 1.25rem' }}
                        >
                            All Time
                        </button>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                        <strong>Order Status:</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {['all', 'pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={filter === status ? 'btn btn-primary' : 'btn btn-ghost'}
                                style={{ padding: '0.625rem 1.25rem', textTransform: 'capitalize' }}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Orders */}
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {filteredOrders.map((order) => (
                        <div key={order.id} className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
                            {order.order_status === 'cancelled' && (
                                <div className="cancelled-stamp-container">
                                    <div className="cancelled-stamp">Cancelled</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                <div>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <h3 style={{ margin: 0 }}>Order #{order.order_number || order.id}</h3>
                                        <span className="badge" style={{
                                            background: order.order_type === 'takeaway' ? 'var(--success)' : 'var(--info)',
                                            color: 'white',
                                            textTransform: 'capitalize'
                                        }}>
                                            {order.order_type || 'delivery'}
                                            {order.table_number && ` (Table: ${order.table_number})`}
                                        </span>
                                    </div>
                                    <p className="text-muted" style={{ fontSize: '0.9375rem', marginBottom: '0.5rem' }}>
                                        {formatDateTime(order.created_at)}
                                    </p>
                                    <p style={{ marginBottom: 0 }}>
                                        <strong>{order.customer_name}</strong> • {order.customer_phone}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                        ₹{parseFloat(order.total_amount).toFixed(2)}
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handlePrintBill(order)}
                                            className="btn btn-warning"
                                            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                                            disabled={printingOrderId === order.id}
                                        >
                                            {printingOrderId === order.id ? '🖨️...' : '🖨️ Print Invoice'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                const phoneNumber = order.customer_phone.replace(/\D/g, '');
                                                const message = `Hello ${order.customer_name}! 👋\n\nYour order #${order.order_number || order.id} is being processed.\n\nTotal Amount: ₹${parseFloat(order.total_amount).toFixed(2)}\n\nView your invoice: ${window.location.origin}/admin/invoices/${order.id}\n\nThank you for ordering from us! 🙏`;
                                                const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
                                                window.open(whatsappUrl, '_blank');
                                            }}
                                            className="btn btn-ghost"
                                            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem', color: '#25D366' }}
                                            title="Send via WhatsApp"
                                        >
                                            📱 WhatsApp
                                        </button>
                                        <button
                                            onClick={() => router.push(`/admin/invoices/${order.id}`)}
                                            className="btn btn-ghost"
                                            style={{ padding: '0.375rem 0.75rem', fontSize: '0.875rem' }}
                                        >
                                            📄 View Invoice
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                borderTop: '1px solid var(--border-color)',
                                borderBottom: '1px solid var(--border-color)',
                                padding: '1rem 0',
                                margin: '1rem 0',
                            }}>
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <strong>Items:</strong>
                                </div>
                                {(Array.isArray(order.items) ? order.items : []).map((item: any, idx: number) => (
                                    <div
                                        key={idx}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginBottom: '0.5rem',
                                            paddingLeft: '1rem',
                                        }}
                                    >
                                        <span className="text-muted">
                                            {item.menuItem.name} × {item.quantity}
                                        </span>
                                        <span>₹{(item.menuItem.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}

                                {/* Order Summary */}
                                <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                        <span className="text-muted">Subtotal:</span>
                                        <span>₹{parseFloat(order.subtotal || order.total_amount).toFixed(2)}</span>
                                    </div>
                                    {parseFloat(order.tax || 0) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                            <span className="text-muted">Tax:</span>
                                            <span>₹{parseFloat(order.tax).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {parseFloat(order.delivery_charge || 0) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                            <span className="text-muted">Delivery Charge:</span>
                                            <span>₹{parseFloat(order.delivery_charge).toFixed(2)}</span>
                                        </div>
                                    )}
                                    {parseFloat(order.discount || 0) > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem', color: 'var(--success)' }}>
                                            <span>Discount:</span>
                                            <span>-₹{parseFloat(order.discount).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 600, marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                                        <span>Total:</span>
                                        <span style={{ color: 'var(--primary)' }}>₹{parseFloat(order.total_amount).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {order.customer_address && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                        Delivery Address
                                    </div>
                                    <div>{order.customer_address}</div>
                                    {order.delivery_location_name && (
                                        <div style={{ marginTop: '0.5rem' }}>
                                            <span className="badge" style={{ background: 'var(--info)', color: 'white' }}>
                                                📍 {order.delivery_location_name}
                                                {order.distance && ` (${parseFloat(order.distance).toFixed(1)} km)`}
                                            </span>
                                            {order.delivery_charge > 0 && (
                                                <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                    Delivery Charge: ₹{parseFloat(order.delivery_charge).toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {order.notes && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                        Special Instructions
                                    </div>
                                    <div>{order.notes}</div>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                        Order Status
                                    </label>
                                    <select
                                        value={order.order_status}
                                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                        className="input"
                                        style={{ textTransform: 'capitalize' }}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="confirmed">Confirmed</option>
                                        <option value="preparing">Preparing</option>
                                        <option value="ready">Ready</option>
                                        <option value="out_for_delivery">Out for Delivery</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                        Payment Status
                                    </label>
                                    <select
                                        value={order.payment_status}
                                        onChange={(e) => updatePaymentStatus(order.id, e.target.value)}
                                        className="input"
                                        style={{ textTransform: 'capitalize' }}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="paid">Paid</option>
                                        <option value="failed">Failed</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                        Payment Method
                                    </label>
                                    <select
                                        value={order.payment_method || 'cash'}
                                        onChange={(e) => updatePaymentMethod(order.id, e.target.value)}
                                        className="input"
                                        style={{ textTransform: 'capitalize' }}
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="upi">UPI</option>
                                        <option value="card">Card</option>
                                        <option value="online">Online</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                        Delivery Boy
                                    </label>
                                    {order.order_type === 'delivery' ? (
                                        <select
                                            value={order.delivery_boy_id || ''}
                                            onChange={(e) => updateDeliveryBoy(order.id, e.target.value)}
                                            className="input"
                                        >
                                            <option value="">Unassigned</option>
                                            {deliveryBoys.map(db => (
                                                <option key={db.id} value={db.id}>{db.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <div className="input" style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                                            N/A ({order.order_type === 'takeaway' ? 'Takeaway' : 'Dine-in'})
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                        Discount (₹)
                                    </label>
                                    <input
                                        type="number"
                                        value={editingDiscount[order.id] !== undefined ? editingDiscount[order.id] : (order.discount || 0)}
                                        onChange={(e) => {
                                            setEditingDiscount({
                                                ...editingDiscount,
                                                [order.id]: e.target.value
                                            });
                                        }}
                                        onBlur={(e) => {
                                            const newDiscount = Math.max(0, parseFloat(e.target.value) || 0);
                                            updateDiscount(order.id, newDiscount);
                                            // Clear editing state after save
                                            const newEditing = { ...editingDiscount };
                                            delete newEditing[order.id];
                                            setEditingDiscount(newEditing);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur(); // Trigger onBlur
                                            }
                                        }}
                                        className="input"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        style={{ textAlign: 'right' }}
                                    />
                                    {order.discount > 0 && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem' }}>
                                            Discount Applied: ₹{parseFloat(order.discount).toFixed(2)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredOrders.length === 0 && (
                        <div className="glass-card text-center" style={{ padding: '3rem 2rem' }}>
                            <p className="text-muted">No orders found for this filter.</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
