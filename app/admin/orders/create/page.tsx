'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface MenuItem {
    id: number;
    name: string;
    description: string;
    category_name: string;
    price: number;
    gst_rate?: number;
    image_type: string;
    available: boolean;
}

interface CartItem {
    menuItem: MenuItem;
    quantity: number;
}

interface DeliveryLocation {
    id: number;
    location_name: string;
    delivery_charge: number;
    is_active: boolean;
}

import { ReceiptPrinter } from '@/lib/receipt-printer';
import { formatDate } from '@/lib/utils';

export default function CreateOrderPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Data
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<any>(null); // Settings State

    // Filter UI
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Order State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [printingOrderId, setPrintingOrderId] = useState<number | null>(null);

    const [orderType, setOrderType] = useState<'takeaway' | 'delivery' | 'dine-in'>('takeaway');
    const [tableNumber, setTableNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerAddress, setCustomerAddress] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [discount, setDiscount] = useState(0);
    const [manualDeliveryCharge, setManualDeliveryCharge] = useState(0);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch Settings
                await fetchSettings();

                // Fetch Menu
                const menuRes = await fetch('/api/menu?available=true');
                const menuData = await menuRes.json();
                if (menuData.success) {
                    setMenuItems(menuData.data);
                    const cats = Array.from(new Set(menuData.data.map((i: MenuItem) => i.category_name).filter(Boolean))) as string[];
                    setCategories(['all', ...cats]);
                }

                // Fetch Locations
                const locRes = await fetch('/api/admin/delivery-locations?active=true');
                const locData = await locRes.json();
                if (locData.success) {
                    setDeliveryLocations(locData.data);
                }
            } catch (error) {
                console.error("Error loading data", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            if (data.success) {
                setSettings(data.data);
                return data.data;
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
        return null;
    };




    const filteredItems = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || item.category_name === selectedCategory;
        return matchesSearch && matchesCategory;
    });

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
    const calculateSubtotal = () => cart.reduce((sum, item) => sum + (Number(item.menuItem.price) * item.quantity), 0);

    const calculateTax = () => {
        // If settings are not loaded yet or GST type is unregistered/composite (Bill of Supply), no tax is applicable
        if (!settings || settings.gstType !== 'regular') {
            return 0;
        }

        return cart.reduce((sum, item) => {
            const taxRate = (item.menuItem.gst_rate || 5) / 100;
            return sum + (Number(item.menuItem.price) * item.quantity * taxRate);
        }, 0);
    };

    const getDeliveryCharge = () => {
        // If manual delivery charge is set, use it
        if (manualDeliveryCharge > 0) return manualDeliveryCharge;

        // Otherwise, for delivery orders, use location-based charge
        if (orderType !== 'delivery' || !selectedLocationId) return 0;
        const location = deliveryLocations.find(loc => loc.id === selectedLocationId);
        return location ? Number(location.delivery_charge) : 0;
    };

    const grandTotal = calculateSubtotal() + calculateTax() + getDeliveryCharge() - discount;

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
                <div>Date: ${formatDate(order.created_at)}</div>
                ${order.table_number ? `<div class="bold" style="font-size: 18px;">Table No: ${order.table_number}</div>` : ''}
                
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
                
                <div class="text-right">Subtotal: ${Number(order.total_amount - (Number(order.tax_amount) || 0) - (Number(order.delivery_charge) || 0) + (Number(order.discount_amount) || 0)).toFixed(2)}</div>
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
            printer.textLine(`Date: ${formatDate(order.created_at)}`);
            if (order.table_number) {
                printer.setSize(2, 2);
                printer.bold(true).textLine(`Table No: ${order.table_number}`).bold(false);
                printer.setSize(1, 1);
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
            printer.setSize(1, 1);
            printer.line('-');

            // Totals
            printer.alignRight();
            printer.textLine(`Subtotal: ${Number(order.total_amount - (Number(order.tax_amount) || 0) - (Number(order.delivery_charge) || 0) + (Number(order.discount_amount) || 0)).toFixed(2)}`);
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


    const handleSubmitOrder = async (status: string = 'pending', shouldPrint: boolean = false) => {
        // Validation
        if (orderType === 'dine-in' && !tableNumber) return alert('Please provide Table Number for Dine-in');
        if (orderType === 'delivery') {
            if (!customerName || !customerPhone) return alert('Customer Name and Phone required for Delivery');
            if (!customerAddress) return alert('Delivery Address required');
            if (!selectedLocationId) return alert('Delivery Location required');
        }
        if (cart.length === 0) return alert('Cart is empty');

        setSubmitting(true);
        try {
            const orderData = {
                customer_name: customerName,
                customer_phone: customerPhone,
                customer_address: orderType === 'delivery' ? customerAddress : null,
                order_type: orderType,
                items: cart,
                subtotal: calculateSubtotal(),
                tax: calculateTax(),
                discount: discount,
                delivery_location_id: orderType === 'delivery' ? selectedLocationId : null,
                delivery_charge: getDeliveryCharge(),
                total_amount: grandTotal,
                payment_method: paymentMethod,
                notes: notes || null,
                table_number: orderType === 'dine-in' ? tableNumber : null,
                order_status: status,
            };

            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData),
            });
            const data = await res.json();

            if (data.success) {
                if (shouldPrint) {
                    // Compose printing object
                    const createdOrder = data.data; // usually returns DB row
                    // We need to merge with cart items to have MenuItem details for printing
                    const printableOrder = {
                        ...createdOrder,
                        items: cart, // use local cart which has menuItem details
                        customer_name: customerName,
                        customer_phone: customerPhone,
                        customer_address: customerAddress,
                        table_number: tableNumber,
                        order_type: orderType,
                        total_amount: grandTotal,
                        tax_amount: calculateTax(),
                        delivery_charge: getDeliveryCharge(),
                        discount_amount: discount
                    };
                    await handlePrintBill(printableOrder);
                }

                alert(`Order Created! Invoice: ${data.data.invoice_number}`);
                router.push('/admin/orders');
            } else {
                alert(`Failed: ${data.error}`);
            }
        } catch (error) {
            console.error(error);
            alert('Error creating order');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="text-center p-5">Loading...</div>;

    return (
        <main className="container" style={{ padding: '2rem 1.5rem', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Create Order</h1>
                <button onClick={() => router.push('/admin/orders')} className="btn btn-ghost">← Back to Orders</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: '2rem' }}>
                {/* LEFT: Menu */}
                <div>
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                        {filteredItems.map(item => (
                            <div key={item.id} className="glass-card" style={{ padding: '1rem', cursor: 'pointer', transition: '0.2s', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} onClick={() => addToCart(item)}>
                                <h4 style={{ margin: 0 }}>{item.name}</h4>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>₹{Number(item.price).toFixed(0)}</span>
                                    <div style={{ width: '24px', height: '24px', background: 'var(--primary)', borderRadius: '50%', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>+</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: Invoice Form */}
                <div style={{ position: 'sticky', top: '1rem' }}>
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'fit-content', maxHeight: 'calc(100vh - 4rem)' }}>
                        <h2 style={{ marginBottom: '1rem', textAlign: 'center', fontFamily: 'serif' }}>Current Order</h2>

                        {/* Order Type Selector */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem', marginBottom: '1rem' }}>
                            {(['dine-in', 'takeaway', 'delivery'] as const).map(type => (
                                <button
                                    key={type}
                                    onClick={() => setOrderType(type)}
                                    className={`btn ${orderType === type ? 'btn-primary' : 'btn-ghost'}`}
                                    style={{ padding: '0.5rem', fontSize: '0.8rem', textTransform: 'capitalize' }}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        {/* Contextual Inputs */}
                        {orderType === 'dine-in' && (
                            <div style={{ marginBottom: '1rem' }}>
                                <input className="input" placeholder="Table Number (e.g. T-5)" value={tableNumber} onChange={e => setTableNumber(e.target.value)} />
                            </div>
                        )}
                        {orderType === 'delivery' && (
                            <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
                                <select className="input" value={selectedLocationId || ''} onChange={e => setSelectedLocationId(Number(e.target.value))}>
                                    <option value="">Select Location</option>
                                    {deliveryLocations.map(l => (
                                        <option key={l.id} value={l.id}>{l.location_name} (+₹{l.delivery_charge})</option>
                                    ))}
                                </select>
                                <textarea className="input" placeholder="Delivery Address" rows={2} value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
                            </div>
                        )}

                        {/* Cart List */}
                        <div style={{ flex: 1, overflowY: 'auto', minHeight: '150px', marginBottom: '1rem', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '0.5rem 0' }}>
                            {cart.length === 0 ? <p className="text-muted text-center py-5">Empty Cart</p> : cart.map(item => (
                                <div key={item.menuItem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <div style={{ flex: 1 }}>{item.menuItem.name} <br /><span className="text-muted text-sm">₹{item.menuItem.price} x {item.quantity}</span></div>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                        <button className="btn btn-ghost px-2" onClick={(e) => { e.stopPropagation(); updateQuantity(item.menuItem.id, -1) }}>-</button>
                                        <span>{item.quantity}</span>
                                        <button className="btn btn-ghost px-2" onClick={(e) => { e.stopPropagation(); addToCart(item.menuItem) }}>+</button>
                                    </div>
                                    <div style={{ minWidth: '50px', textAlign: 'right', fontWeight: 'bold' }}>₹{(item.menuItem.price * item.quantity).toFixed(0)}</div>
                                </div>
                            ))}
                        </div>

                        {/* Totals & Footer */}
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input className="input" placeholder="Cust. Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                                <input className="input" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} type="tel" />
                            </div>

                            <select className="input mb-3" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="upi">UPI</option>
                            </select>

                            {/* Subtotal and Discount */}
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                                {/* Discount Input */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Discount (₹):</label>
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


                                {/* Manual Delivery Charge Input - SIMPLIFIED */}
                                <div style={{
                                    background: '#e0f2fe',
                                    padding: '10px',
                                    marginBottom: '10px',
                                    border: '2px solid #0369a1',
                                    borderRadius: '4px'
                                }}>
                                    <div style={{ marginBottom: '5px', fontWeight: 'bold', color: '#0369a1' }}>
                                        🚚 Delivery Charge (₹):
                                    </div>
                                    <input
                                        type="number"
                                        className="input"
                                        placeholder="Enter delivery charge"
                                        value={manualDeliveryCharge || ''}
                                        onChange={e => setManualDeliveryCharge(Math.max(0, Number(e.target.value)))}
                                        style={{
                                            width: '100%',
                                            padding: '8px',
                                            fontSize: '16px',
                                            border: '1px solid #0369a1'
                                        }}
                                        min="0"
                                        step="0.01"
                                    />
                                </div>

                                {/* Totals Breakdown */}
                                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                        <span>Subtotal:</span>
                                        <span>₹{calculateSubtotal().toFixed(2)}</span>
                                    </div>
                                    {calculateTax() > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                            <span>Tax:</span>
                                            <span>₹{calculateTax().toFixed(2)}</span>
                                        </div>
                                    )}
                                    {getDeliveryCharge() > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--info)' }}>
                                            <span>Delivery Charge:</span>
                                            <span>₹{getDeliveryCharge().toFixed(2)}</span>
                                        </div>
                                    )}
                                    {discount > 0 && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--success)' }}>
                                            <span>Discount:</span>
                                            <span>-₹{discount.toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', paddingTop: '0.5rem', borderTop: '2px solid var(--border-color)' }}>
                                <span>Total:</span>
                                <span>₹{grandTotal.toFixed(2)}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                                <button
                                    onClick={() => handleSubmitOrder('pending', false)}
                                    className="btn btn-ghost"
                                    style={{ border: '1px solid var(--border-color)', width: '100%' }}
                                    disabled={submitting}
                                >
                                    {submitting ? '...' : 'Save'}
                                </button>
                                <button
                                    onClick={() => handleSubmitOrder('pending', true)}
                                    className="btn btn-warning"
                                    style={{ width: '100%', fontSize: '0.9rem', padding: '0 0.25rem' }}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Printing...' : 'Save & Print'}
                                </button>
                                <button
                                    onClick={() => handleSubmitOrder('confirmed', false)}
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                    disabled={submitting}
                                >
                                    {submitting ? '...' : 'Place Order'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
