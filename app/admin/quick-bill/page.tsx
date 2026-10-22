'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import { ReceiptPrinter } from '@/lib/receipt-printer';
import { formatDate } from '@/lib/utils';

interface MenuItem {
    id: number;
    name: string;
    description: string;
    category_name: string;
    price: number;
    available: boolean;
    gst_rate: number;
}

interface CartItem {
    menuItem: MenuItem;
    quantity: number;
}

export default function QuickBillPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Data
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [categories, setCategories] = useState<string[]>([]);

    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [submitting, setSubmitting] = useState(false);

    // Customer Details (Optional for Quick Bill)
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [discount, setDiscount] = useState(0);
    const [manualDeliveryCharge, setManualDeliveryCharge] = useState(0);

    // Receipt Data for Printing
    const [receiptData, setReceiptData] = useState<any>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // State
    const [settings, setSettings] = useState<any>(null);
    const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);

    useEffect(() => {
        fetchMenuItems();
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
                const cats = Array.from(new Set(data.data.map((i: MenuItem) => i.category_name).filter(Boolean))) as string[];
                setCategories(['all', ...cats]);
            }
        } catch (error) {
            console.error('Error fetching menu:', error);
        } finally {
            setLoading(false);
        }
    };

    // Filter Logic
    const filteredItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category_name === selectedCategory;
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


    const grandTotal = calculateTotal() + calculateTax() + manualDeliveryCharge - discount;

    // PRINTING LOGIC
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
                <td style="padding: 4px 0;">${item.menuItem.name}</td>
                <td style="text-align: center; padding: 4px 0;">${item.quantity}</td>
                <td style="text-align: right; padding: 4px 0;">${total}</td>
            </tr>`;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt #${order.id}</title>
                <style>
                    @page { margin: 0; size: 80mm auto; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        width: 72mm;
                        margin: 0 auto;
                        padding: 10px;
                        font-size: 16px; 
                        font-weight: bold;
                        color: black;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: 900; }
                    .header-large { font-size: 24px; font-weight: 900; }
                    .header-medium { font-size: 18px; font-weight: 900; }
                    .divider { border-top: 2px dashed black; margin: 8px 0; }
                    table { width: 100%; border-collapse: collapse; font-size: 16px; }
                    th { border-bottom: 2px dashed black; padding-bottom: 4px; }
                </style>
            </head>
            <body>
                <div class="text-center header-large">${settings?.restaurantName || 'Ruchi Restaurant'}</div>
                <div class="text-center" style="font-size: 14px;">${settings?.restaurantAddress || ''}</div>
                <div class="text-center" style="font-size: 14px;">Ph: ${settings?.restaurantPhone || ''}</div>
                ${(settings?.gstType === 'regular' && settings?.gstNumber) ? `<div class="text-center" style="font-size: 14px;">GST: ${settings.gstNumber}</div>` : ''}
                
                <div class="divider"></div>
                
                <div class="text-center bold header-medium">${settings?.gstType === 'regular' ? 'TAX INVOICE' : 'BILL OF SUPPLY'}</div>
                <div>No: ${order.id}</div> 
                <div>Date: ${formatDate(new Date())}</div>
                
                <div class="divider"></div>
                
                <div>Name: ${order.customer_name}</div>
                <div>Phone: ${order.customer_phone}</div>
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
                
                <div class="text-right">Subtotal: ${Number(order.subtotal).toFixed(2)}</div>
                ${(settings?.gstType === 'regular' && Number(order.tax_amount || 0) > 0) ? `<div class="text-right">Tax: ${Number(order.tax_amount).toFixed(2)}</div>` : ''}
                ${Number(order.delivery_charge || 0) > 0 ? `<div class="text-right">Delivery Charge: ${Number(order.delivery_charge).toFixed(2)}</div>` : ''}
                ${Number(order.discount_amount || 0) > 0 ? `<div class="text-right">Discount: -${Number(order.discount_amount).toFixed(2)}</div>` : ''}
                <div class="text-right header-medium" style="margin-top: 5px;">TOTAL: ${Number(order.total_amount).toFixed(2)}</div>
                
                <div class="divider"></div>
                <div class="text-center">${settings?.footerText || 'Thank You!'}</div>
                <div class="text-center" style="margin-top: 10px;">
                    <img src="/qr/ruchi_review_qr.svg" alt="Review QR" style="width: 120px; height: 120px; margin: 0 auto; display: block; object-fit: contain;" />
                    <div style="font-size: 13px; font-weight: 900; margin-top: 5px; text-transform: uppercase; letter-spacing: 0.5px;">Please scan and review us</div>
                </div>
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
            printer.setSize(1, 1); // Normal

            printer.textLine(settings?.restaurantAddress || '');
            printer.textLine(`Ph: ${settings?.restaurantPhone || ''}`);
            if (settings?.gstType === 'regular' && settings?.gstNumber) printer.textLine(`GST: ${settings.gstNumber}`);
            printer.feed(1);

            // Title and Meta
            printer.setSize(1, 2); // Double Height
            printer.bold(true).textLine(settings?.gstType === 'regular' ? 'TAX INVOICE' : 'BILL OF SUPPLY');
            printer.bold(false);
            printer.setSize(1, 1); // Normal

            printer.textLine(`No: ${order.id}`);
            printer.textLine(`Date: ${formatDate(new Date())}`);
            printer.line('-');

            // Customer
            printer.alignLeft();
            printer.textLine(`Name: ${order.customer_name}`);
            printer.textLine(`Phone: ${order.customer_phone}`);
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
            printer.setSize(1, 1);
            printer.line('-');

            // Totals
            printer.alignRight();
            printer.textLine(`Subtotal: ${Number(order.subtotal).toFixed(2)}`);
            if (settings?.gstType === 'regular' && Number(order.tax_amount || 0) > 0) printer.textLine(`Tax: ${Number(order.tax_amount).toFixed(2)}`);
            if (Number(order.delivery_charge || 0) > 0) printer.textLine(`Delivery Charge: ${Number(order.delivery_charge).toFixed(2)}`);
            if (Number(order.discount_amount || 0) > 0) printer.textLine(`Discount: -${Number(order.discount_amount).toFixed(2)}`);

            printer.setSize(2, 2); // Large Total
            printer.bold(true).textLine(`TOTAL: ${Number(order.total_amount).toFixed(2)}`).bold(false);
            printer.setSize(1, 1);
            printer.feed(1);

            // Footer
            printer.alignCenter();
            printer.textLine(settings?.footerText || 'Thank You!');
            printer.feed(1);
            printer.bold(true).textLine('Please scan and review us').bold(false);
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


    // Handlers
    const handleBillAction = async (action: 'print' | 'whatsapp' | 'save') => {
        if (cart.length === 0) return alert('Cart is empty!');

        setSubmitting(true);

        try {
            // Create completed order
            const orderPayload = {
                customer_name: customerName || 'Walk-in Customer',
                customer_phone: customerPhone || 'N/A',
                items: cart,
                subtotal: calculateTotal(),
                tax: calculateTax(),
                total_amount: grandTotal,
                payment_method: paymentMethod,
                order_type: 'takeaway', // Default for Quick Bill
                order_status: 'delivered', // Immediate complete
                payment_status: 'paid',   // Immediate paid
                discount: discount,
                delivery_charge: manualDeliveryCharge
            };

            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });

            const data = await res.json();

            if (data.success) {
                const order = data.data;

                if (action === 'print') {
                    // Compose printing object
                    const printableOrder = {
                        ...order,
                        items: cart,
                        customer_name: customerName || 'Walk-in Customer',
                        customer_phone: customerPhone || 'N/A',
                        order_type: 'takeaway',
                        total_amount: grandTotal,
                        subtotal: calculateTotal(),
                        tax_amount: calculateTax(),
                        discount_amount: discount,
                        delivery_charge: manualDeliveryCharge
                    };
                    await handlePrintBill(printableOrder);
                } else if (action === 'whatsapp') {
                    sendWhatsApp(order);
                } else {
                    alert('Bill Saved Successfully!');
                }

                // Clear cart after success
                setCart([]);
                setCustomerName('');
                setCustomerPhone('');
                setDiscount(0);
                setManualDeliveryCharge(0);
            } else {
                alert('Failed to create bill: ' + data.error);
            }
        } catch (error) {
            console.error('Billing error:', error);
            alert('Error creating bill');
        } finally {
            setSubmitting(false);
        }
    };

    const sendWhatsApp = (order: any) => {
        if (!customerPhone || customerPhone.length < 10) {
            alert('Please enter a valid phone number for WhatsApp');
            return;
        }

        const itemsList = cart.map(i => `${i.menuItem.name} x${i.quantity} = ₹${(Number(i.menuItem.price) * i.quantity).toFixed(0)}`).join('%0A');

        const message = `*Ruchi Restaurant - Bill Receipt*%0A` +
            `Invoice: ${order.invoice_number}%0A` +
            `Date: ${formatDate(new Date())}%0A%0A` +
            `*Items:*%0A${itemsList}%0A` +
            `------------------------%0A` +
            `*Total Amount: ₹${grandTotal.toFixed(2)}*%0A` +
            `Thank you for dining with us!`;

        window.open(`https://wa.me/91${customerPhone}?text=${message}`, '_blank');
    };

    return (
        <main className="container" style={{ padding: '2rem 1.5rem', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* NO-PRINT HEADER */}
            <div className="no-print">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1>Quick Bill</h1>
                    <button onClick={() => router.push('/admin/dashboard')} className="btn btn-ghost">
                        Dashboard
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '2rem' }}>
                    {/* LEFT COLUMN: MENU */}
                    <div>
                        {/* Search & Filters */}
                        <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
                            <input
                                className="input"
                                placeholder="Search items..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ marginBottom: '1rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', textTransform: 'capitalize' }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Menu Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                            {loading ? <p>Loading menu...</p> : filteredItems.map(item => (
                                <div key={item.id} className="glass-card" style={{ padding: '1rem', cursor: 'pointer', transition: '0.2s' }} onClick={() => addToCart(item)}>
                                    <h4 style={{ margin: 0 }}>{item.name}</h4>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', alignItems: 'center' }}>
                                        <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>₹{Number(item.price).toFixed(0)}</span>
                                        <div style={{ width: '24px', height: '24px', background: 'var(--primary)', borderRadius: '50%', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>+</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: BILLING */}
                    <div style={{ position: 'sticky', top: '1rem' }}>
                        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 4rem)' }}>
                            <h2 style={{ marginBottom: '1rem', textAlign: 'center' }}>Current Bill</h2>

                            {/* Scrollable Cart Interface */}
                            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem' }}>
                                {cart.length === 0 ? (
                                    <p className="text-muted text-center">No items added</p>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.menuItem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 500 }}>{item.menuItem.name}</div>
                                                <div className="text-muted" style={{ fontSize: '0.85rem' }}>₹{Number(item.menuItem.price).toFixed(0)} x {item.quantity}</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={(e) => { e.stopPropagation(); updateQuantity(item.menuItem.id, -1); }}>-</button>
                                                <b>{item.quantity}</b>
                                                <button className="btn btn-ghost" style={{ padding: '2px 8px' }} onClick={(e) => { e.stopPropagation(); addToCart(item.menuItem); }}>+</button>
                                            </div>
                                            <div style={{ fontWeight: 'bold', minWidth: '60px', textAlign: 'right' }}>
                                                ₹{(Number(item.menuItem.price) * item.quantity).toFixed(0)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Totals & Inputs */}
                            <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <input
                                        className="input"
                                        placeholder="Customer Name (Optional)"
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        style={{ fontSize: '0.9rem' }}
                                    />
                                    <input
                                        className="input"
                                        placeholder="Mobile (For WhatsApp)"
                                        value={customerPhone}
                                        onChange={e => setCustomerPhone(e.target.value)}
                                        style={{ fontSize: '0.9rem' }}
                                        type="tel"
                                    />
                                </div>
                                <select
                                    className="input"
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value)}
                                    style={{ marginBottom: '1rem' }}
                                >
                                    <option value="cash">Cash Payment</option>
                                    <option value="upi">UPI / Scan</option>
                                    <option value="card">Card</option>
                                </select>

                                {/* Subtotal and Discount */}
                                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                        <span>Subtotal:</span>
                                        <span>₹{calculateTotal().toFixed(2)}</span>
                                    </div>
                                    {calculateTax() > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            <span>Tax:</span>
                                            <span>₹{calculateTax().toFixed(2)}</span>
                                        </div>
                                    )}
                                    {manualDeliveryCharge > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            <span>Delivery Charge:</span>
                                            <span>₹{manualDeliveryCharge.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {discount > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            <span>Discount:</span>
                                            <span>-₹{discount.toFixed(2)}</span>
                                        </div>
                                    )}

                                    {/* Discount Input */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', marginTop: '0.5rem' }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Discount:</label>
                                        <input
                                            type="number"
                                            className="input"
                                            placeholder="0"
                                            value={discount || ''}
                                            onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                                            style={{ width: '120px', textAlign: 'right', padding: '0.25rem 0.5rem' }}
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>

                                    {/* Delivery Charge Input */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '0.75rem',
                                        padding: '0.5rem',
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        borderRadius: '4px'
                                    }}>
                                        <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Delivery Charge (₹):</label>
                                        <input
                                            type="number"
                                            className="input"
                                            placeholder="0"
                                            value={manualDeliveryCharge || ''}
                                            onChange={e => setManualDeliveryCharge(Math.max(0, Number(e.target.value)))}
                                            style={{ width: '120px', textAlign: 'right', padding: '0.25rem 0.5rem' }}
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', paddingTop: '0.5rem', borderTop: '2px solid var(--border-color)' }}>
                                    <span>Total Pay:</span>
                                    <span>₹{grandTotal.toFixed(2)}</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleBillAction('print')}
                                        className="btn btn-primary"
                                        disabled={submitting}
                                    >
                                        🖨️ Save & Print
                                    </button>
                                    <button
                                        onClick={() => handleBillAction('whatsapp')}
                                        className="btn btn-success"
                                        style={{ background: '#25D366', color: 'white', borderColor: '#25D366' }}
                                        disabled={submitting}
                                    >
                                        📱 WhatsApp
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
