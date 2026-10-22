'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface InvoiceData {
    id: number;
    order_id: number;
    invoice_number: string;
    subtotal: number;
    tax: number;
    discount: number;
    delivery_charge?: number;
    total: number;
    generated_at: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    items: any[];
    payment_method: string;
    payment_status: string;
    order_type: string;
    order_date: string;

    table_number?: string;
    order_number?: string;
}


import { ReceiptPrinter } from '@/lib/receipt-printer';
import { formatDate, formatDateTime } from '@/lib/utils';

export default function InvoicePage() {
    const router = useRouter();
    const params = useParams();
    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<any>(null);
    const [isPrinting, setIsPrinting] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }

        // Fetch settings from API
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setSettings(data.data);
                } else {
                    // Fallback to defaults if API fails
                    setSettings(defaultSettings);
                }
            })
            .catch(err => {
                console.error('Error fetching settings:', err);
                setSettings(defaultSettings);
            });

        if (params.id) {
            fetchInvoice(params.id as string);
        }
    }, [params.id]);

    const defaultSettings = {
        restaurantName: 'Ruchi Restaurant',
        restaurantAddress: '123 Main Street, City, State 12345',
        restaurantPhone: '+91 1234567890',
        restaurantEmail: 'info@ruchi.com',
        gstNumber: '',
        gstType: 'regular',
        printerType: 'thermal',
        paperWidth: '80mm',
        footerText: 'Thank you for your business!',
        showLogo: true,
    };

    const fetchInvoice = async (id: string) => {
        try {
            // Fetch invoice by order_id
            const response = await fetch(`/api/invoices?orderId=${id}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                setInvoice(data.data[0]);
            } else {
                alert('Invoice not found for this order');
                router.push('/admin/orders');
            }
        } catch (error) {
            console.error('Error fetching invoice:', error);
            alert('Failed to load invoice');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const printReceiptFallback = (invoice: InvoiceData, settings: any) => {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) {
            alert('Please allow popups to print the receipt.');
            return;
        }

        const itemsHtml = invoice.items.map((item: any) => {
            const total = (Number(item.menuItem.price) * item.quantity).toFixed(2);
            return `
            <tr>
                <td style="padding: 2px 0;">${item.menuItem.name}</td>
                <td style="text-align: center; padding: 2px 0;">${item.quantity}</td>
                <td style="text-align: right; padding: 2px 0;">${total}</td>
            </tr>`;
        }).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Receipt #${invoice.invoice_number}</title>
                <style>
                    @page { margin: 0; size: 80mm auto; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        width: 72mm;
                        margin: 0 auto;
                        padding: 10px;
                        font-size: 16px;
                        font-weight: 900;
                        color: black;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: 900; }
                    .divider { border-top: 2px dashed black; margin: 5px 0; }
                    table { width: 100%; border-collapse: collapse; }
                </style>
            </head>
            <body>
                <div class="text-center bold" style="font-size: 20px;">${settings?.restaurantName || 'Ruchi Restaurant'}</div>
                <div class="text-center" style="font-size: 14px;">${settings?.restaurantAddress || ''}</div>
                <div class="text-center" style="font-size: 14px;">Ph: ${settings?.restaurantPhone || ''}</div>
                ${(settings?.gstType === 'regular' && settings?.gstNumber) ? `<div class="text-center" style="font-size: 14px;">GST: ${settings.gstNumber}</div>` : ''}
                
                <div class="divider"></div>
                
                <div class="text-center bold">${settings?.gstType === 'regular' ? 'TAX INVOICE' : 'BILL OF SUPPLY'}</div>
                <div>No: ${invoice.invoice_number}</div>
                <div>Date: ${formatDateTime(invoice.order_date)}</div>
                ${invoice.table_number ? `<div class="bold">Table No: ${invoice.table_number}</div>` : ''}
                
                <div class="divider"></div>
                
                <div>Name: ${invoice.customer_name}</div>
                <div>Phone: ${invoice.customer_phone}</div>
                ${invoice.customer_address ? `<div>Addr: ${invoice.customer_address}</div>` : ''}
                <div>Type: ${invoice.order_type.toUpperCase()}</div>
                
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
                
                <div class="text-right">Subtotal: ${Number(invoice.subtotal).toFixed(2)}</div>
                ${(settings?.gstType === 'regular' && Number(invoice.tax) > 0) ? `<div class="text-right">Tax: ${Number(invoice.tax).toFixed(2)}</div>` : ''}
                ${(invoice.delivery_charge && Number(invoice.delivery_charge) > 0) ? `<div class="text-right">Delivery Charge: ${Number(invoice.delivery_charge).toFixed(2)}</div>` : ''}
                ${parseFloat(invoice.discount?.toString() || '0') > 0 ? `<div class="text-right">Discount: -${parseFloat(invoice.discount.toString()).toFixed(2)}</div>` : ''}
                <div class="text-right bold" style="font-size: 20px; margin-top: 5px;">TOTAL: ${Number(invoice.total).toFixed(2)}</div>
                
                <div class="divider"></div>
                <div class="text-center">${settings?.footerText || 'Thank You!'}</div>
                <div class="text-center" style="margin-top: 10px;">
                    <img src="/qr/ruchi_review_qr.png" alt="Review QR" style="width: 120px; height: 120px; margin: 0 auto; display: block; object-fit: contain;" />
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

    const printKOTFallback = (invoice: InvoiceData) => {
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) {
            alert('Please allow popups to print the KOT.');
            return;
        }

        const itemsHtml = invoice.items.map((item: any) => `
            <tr>
                <td>${item.menuItem.name}</td>
                <td style="text-align: right;">${item.quantity}</td>
            </tr>
        `).join('');

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>KOT #${invoice.order_id}</title>
                <style>
                    @page { margin: 0; size: auto; }
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        width: 100%;
                        margin: 0;
                        padding: 5px;
                        box-sizing: border-box;
                        font-size: 16px;
                        font-weight: bold;
                        color: black;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: 900; }
                    .divider { border-top: 2px dashed black; margin: 5px 0; }
                    table { width: 100%; border-collapse: collapse; }
                    td { padding: 1px 0; font-weight: 900; font-size: 18px; line-height: 1.0; }
                </style>
            </head>
            <body>
                <div class="text-center bold" style="font-size: 20px;">KITCHEN ORDER TICKET</div>
                <div class="divider"></div>
                
                <div style="font-size: 18px;">Order #: ${invoice.order_number || invoice.order_id}</div>
                <div style="font-weight: 900; font-size: 18px;">Type: ${invoice.order_type.toUpperCase()}</div>
                ${invoice.table_number ? `<div style="font-weight: 900; font-size: 20px;">Table No: ${invoice.table_number}</div>` : ''}
                <div>Date: ${formatDateTime(invoice.order_date)}</div>
                
                <div class="divider"></div>
                
                <table style="width: 100%;">
                    <thead>
                        <tr>
                            <th style="text-align: left; font-size: 18px;">ITEM</th>
                            <th style="text-align: right; font-size: 18px; width: 40px;">QTY</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                <div class="divider"></div>
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

    const handlePrintKOT = async () => {
        if (!invoice) return;

        try {
            // @ts-ignore
            if (!navigator.usb) {
                printKOTFallback(invoice);
                return;
            }

            // @ts-ignore
            const device = await navigator.usb.requestDevice({ filters: [] });
            await device.open();
            await device.selectConfiguration(1);
            await device.claimInterface(0);

            const printer = new ReceiptPrinter();
            printer.alignCenter();
            printer.bold(true).textLine('KITCHEN ORDER TICKET').bold(false);
            printer.feed(1);

            printer.alignLeft();
            printer.textLine(`Order #: ${invoice.order_number || invoice.order_id}`);
            printer.textLine(`Type: ${invoice.order_type.toUpperCase()}`);
            if (invoice.table_number) printer.textLine(`Table No: ${invoice.table_number}`);
            printer.textLine(`Date: ${formatDateTime(invoice.order_date)}`);
            printer.line('-');

            printer.textLine('ITEM                     QTY');
            printer.line('-');

            invoice.items.forEach((item: any) => {
                const name = item.menuItem.name.substring(0, 24).padEnd(24, ' ');
                const qty = item.quantity.toString().padStart(3, ' ');

                printer.setSize(1, 2); // Double Height for visibility
                printer.bold(true);    // Bold on
                printer.textLine(`${name} ${qty}`);
                printer.bold(false);   // Bold off
                printer.setSize(1, 1); // Reset
            });

            printer.feed(3);
            printer.cut();

            const data = printer.getData();
            // @ts-ignore
            await device.transferOut(1, data);
            // @ts-ignore
            await device.close();

        } catch (error: any) {
            console.warn('USB KOT Print failed, falling back:', error);
            printKOTFallback(invoice);
        }
    };

    const handleRawPrint = async () => {
        if (!invoice) return;
        setIsPrinting(true);

        try {
            // @ts-ignore - Navigator.usb is experimental and may not be in TS definitions
            if (!navigator.usb) {
                // Fallback immediately if WebUSB not supported
                printReceiptFallback(invoice, settings);
                return;
            }

            // Request device - filtered for common thermal printers if possible, or accept all
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

            printer.textLine(`No: ${invoice.invoice_number}`);
            printer.textLine(`Date: ${formatDateTime(invoice.order_date)}`);
            if (invoice.table_number) {
                printer.setSize(2, 2);
                printer.bold(true).textLine(`Table No: ${invoice.table_number}`).bold(false);
                printer.setSize(1, 1);
            }
            printer.line('-');

            // Customer
            printer.alignLeft();
            printer.textLine(`Name: ${invoice.customer_name}`);
            printer.textLine(`Phone: ${invoice.customer_phone}`);
            if (invoice.customer_address) printer.textLine(`Addr: ${invoice.customer_address}`);
            printer.textLine(`Type: ${invoice.order_type.toUpperCase()}`);
            printer.line('-');

            // Items
            // Assuming 32 chars width for 58mm or 48 for 80mm. Let's aim for a responsive-ish layout or standard 48 column.
            // Simple Item | Qty | Amt layout
            printer.textLine('ITEM             QTY      AMT');
            printer.line('-');

            invoice.items.forEach((item: any) => {
                const name = item.menuItem.name.substring(0, 16).padEnd(16, ' ');
                const qty = item.quantity.toString().padStart(3, ' ');
                const total = (Number(item.menuItem.price) * item.quantity).toFixed(2).padStart(10, ' ');
                printer.setSize(1, 2); // Taller font for items
                printer.bold(true);    // Bold on
                printer.textLine(`${name} ${qty} ${total}`);
                printer.bold(false);   // Bold off
            });
            printer.setSize(1, 1); // Reset
            printer.line('-');

            // Totals
            printer.alignRight();
            printer.textLine(`Subtotal: ${Number(invoice.subtotal).toFixed(2)}`);
            if (settings?.gstType === 'regular' && Number(invoice.tax) > 0) printer.textLine(`Tax: ${Number(invoice.tax).toFixed(2)}`);
            if (invoice.delivery_charge && Number(invoice.delivery_charge) > 0) printer.textLine(`Delivery Charge: ${Number(invoice.delivery_charge).toFixed(2)}`);
            if (parseFloat(invoice.discount?.toString() || '0') > 0) printer.textLine(`Discount: -${parseFloat(invoice.discount.toString()).toFixed(2)}`);

            printer.setSize(2, 2); // Large Total
            printer.bold(true).textLine(`TOTAL: ${Number(invoice.total).toFixed(2)}`).bold(false);
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

            // Transfer to endpoint 1 (usually OUT endpoint)
            // We might need to find the correct endpoint, but 1 is standard for many
            // @ts-ignore
            await device.transferOut(1, data);

            // @ts-ignore
            await device.close();

        } catch (error: any) {
            console.warn('USB Printing failed, falling back to browser print:', error);
            printReceiptFallback(invoice, settings);
        } finally {
            setIsPrinting(false);
        }
    };

    const handleWhatsAppShare = () => {
        if (!invoice) return;

        // Format items list
        const itemsList = invoice.items.map((item: any, idx: number) => {
            const price = parseFloat(item.menuItem.price);
            const quantity = parseInt(item.quantity);
            const total = price * quantity;
            return `${idx + 1}. ${item.menuItem.name} x${quantity} - ₹${total.toFixed(2)}`;
        }).join('\n');

        // Title
        const invoiceTitle = settings?.gstType === 'regular' ? 'TAX INVOICE' : 'BILL OF SUPPLY';

        // Create formatted message
        const message = `🧾 *${invoiceTitle} - ${invoice.invoice_number}*\n\n` +
            `📅 *Date:* ${formatDate(invoice.order_date)}\n` +
            `👤 *Customer:* ${invoice.customer_name}\n` +
            `📞 *Phone:* ${invoice.customer_phone}\n` +
            `${invoice.customer_address ? `📍 *Address:* ${invoice.customer_address}\n` : ''}` +
            `🛵 *Order Type:* ${invoice.order_type.charAt(0).toUpperCase() + invoice.order_type.slice(1)}\n` +
            (invoice.table_number ? `🪑 *Table:* ${invoice.table_number}\n\n` : `\n`) +
            `*━━━━━━━━━━━━━━━━*\n` +
            `*ITEMS:*\n${itemsList}\n` +
            `*━━━━━━━━━━━━━━━━*\n\n` +
            `💰 *Subtotal:* ₹${parseFloat(invoice.subtotal.toString()).toFixed(2)}\n` +
            ((settings?.gstType === 'regular' && invoice.tax > 0) ? `📊 *Tax:* ₹${parseFloat(invoice.tax.toString()).toFixed(2)}\n` : '') +
            ((invoice.delivery_charge && invoice.delivery_charge > 0) ? `🚚 *Delivery Charge:* ₹${parseFloat(invoice.delivery_charge.toString()).toFixed(2)}\n` : '') +
            `${parseFloat(invoice.discount?.toString() || '0') > 0 ? `🎁 *Discount:* -₹${parseFloat(invoice.discount.toString()).toFixed(2)}\n` : ''}` +
            `*━━━━━━━━━━━━━━━━*\n` +
            `💳 *TOTAL:* ₹${parseFloat(invoice.total.toString()).toFixed(2)}\n\n` +
            `💳 *Payment Method:* ${invoice.payment_method.charAt(0).toUpperCase() + invoice.payment_method.slice(1)}\n` +
            `✅ *Payment Status:* ${invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}\n\n` +
            `🏪 *${settings?.restaurantName || 'Ruchi Restaurant'}*\n` +
            `${settings?.restaurantPhone || '+91 1234567890'}\n\n` +
            `_Thank you for your order!_ 🙏`;

        // Encode message for URL
        const encodedMessage = encodeURIComponent(message);

        // Open WhatsApp with pre-filled message
        // Use customer's phone number if available
        const phoneNumber = invoice.customer_phone.replace(/\D/g, ''); // Remove non-digits
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <main className="container" style={{ padding: '2rem 1.5rem' }}>
                <div className="glass-card text-center" style={{ padding: '3rem 2rem' }}>
                    <p className="text-muted">Invoice not found</p>
                    <button onClick={() => router.push('/admin/orders')} className="btn btn-primary" style={{ marginTop: '1rem' }}>
                        Back to Orders
                    </button>
                </div>
            </main>
        );
    }

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page {
                        margin: 0;
                        size: auto;
                    }
                    
                    /* Hide unnecessary elements globally in print */
                    .no-print {
                        display: none !important;
                    }

                    /* Global resets to ensure pure white background and pure black text */
                    body {
                        background: white !important;
                        color: black !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-font-smoothing: none !important;
                        -moz-osx-font-smoothing: none !important;
                        text-rendering: optimizeSpeed !important;
                    }

                    /* Increase contrast for thermal printers */
                    body * {
                         filter: contrast(200%) grayscale(100%);
                    }
                    
                    /* Hide the background pattern pseudo-element */
                    body::before {
                        display: none !important;
                    }

                    /* Remove all card/glass effects */
                    .invoice-container, .glass-card {
                        box-shadow: none !important;
                        background: white !important;
                        backdrop-filter: none !important;
                        border: none !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Specific rules for Thermal Printer */
                    ${settings?.printerType === 'thermal' ? `
                        /* Hide navigation for thermal prints */
                        .navbar {
                            display: none !important;
                        }

                        /* Thermal Receipt Container */
                        .thermal-receipt {
                            width: ${settings?.paperWidth === '58mm' ? '58mm' : '80mm'} !important;
                            font-family: 'Courier New', Courier, monospace !important; 
                            font-size: 16px !important; /* Larger for better clarity */
                            font-weight: 900 !important; /* Extra bold */
                            line-height: 1.2 !important;
                            padding: 2mm !important;
                            margin: 0 auto !important;
                            color: black !important;
                        }

                        /* Ensure everything in the receipt is black */
                        .thermal-receipt * {
                            color: black !important;
                            text-shadow: none !important;
                            visibility: visible !important;
                        }

                        /* Header styling for thermal */
                        .thermal-receipt h1 {
                            font-size: 22px !important;
                            font-weight: 900 !important; /* Extra bold */
                            margin: 0 0 5px 0 !important;
                            text-transform: uppercase;
                        }
                        
                        .thermal-receipt h2, .thermal-receipt h3 {
                            font-size: 18px !important;
                            font-weight: 900 !important;
                            margin: 5px 0 !important;
                        }

                        /* Table styling */
                        .thermal-receipt table {
                            width: 100% !important;
                            font-size: 18px !important;
                            border-collapse: collapse !important;
                        }
                        
                        .thermal-receipt th {
                            text-align: left;
                            border-bottom: 2px dashed black !important;
                            padding: 2px 0 !important;
                            font-weight: 900 !important;
                            font-size: 18px !important;
                        }
                        
                        .thermal-receipt td {
                            padding: 2px 0 !important;
                            font-weight: 900 !important;
                            font-size: 18px !important;
                        }


                        /* Dividers */
                        .thermal-receipt .divider {
                            border-top: 2px dashed black !important;
                            margin: 5px 0 !important;
                            opacity: 1 !important;
                        }
                        
                        /* Force visibility of the invoice container and its parents */
                        .invoice-container {
                            display: block !important;
                            visibility: visible !important;
                        }
                     ` : ''}
                }
            `}</style>

            <main className="container" style={{ padding: '2rem 1.5rem' }}>
                <div className="fade-in">
                    <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <h1>Invoice Details</h1>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <button onClick={handlePrintKOT} className="btn btn-warning">
                                🖨️ Print KOT (Order)
                            </button>
                            <button onClick={handleRawPrint} className="btn btn-primary" disabled={isPrinting}>
                                {isPrinting ? 'Printing...' : '🔌 USB Raw Invoice'}
                            </button>

                            <button onClick={handleWhatsAppShare} className="btn btn-secondary">
                                📱 Send via WhatsApp
                            </button>
                            <button onClick={handlePrint} className="btn btn-ghost" style={{ border: '1px solid var(--border-color)' }}>
                                🖨️ Browser Print
                            </button>
                            <button onClick={() => router.push('/admin/orders')} className="btn btn-ghost">
                                ← Back to Orders
                            </button>
                        </div>
                    </div>

                    <div className={`glass-card invoice-container ${settings?.printerType === 'thermal' ? 'thermal-receipt' : ''}`} style={settings?.printerType === 'thermal' ? { maxWidth: settings.paperWidth, margin: '0 auto', padding: '1rem', fontSize: '0.875rem' } : { maxWidth: '800px', margin: '0 auto', padding: '3rem' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: settings?.printerType === 'thermal' ? '0.5rem' : '2rem', paddingBottom: settings?.printerType === 'thermal' ? '0.5rem' : '1.5rem', borderBottom: settings?.printerType === 'thermal' ? '1px dashed #000' : '2px solid var(--border-color)' }}>
                            <h1 style={{ fontSize: settings?.printerType === 'thermal' ? '1.25rem' : '2rem', marginBottom: '0.25rem' }}>{settings?.restaurantName || 'Ruchi Restaurant'}</h1>
                            <p style={{ fontWeight: 700, margin: '0.25rem 0', textTransform: 'uppercase', fontSize: settings?.printerType === 'thermal' ? '0.875rem' : '1rem' }}>
                                {settings?.gstType === 'regular' ? 'TAX INVOICE' : 'BILL OF SUPPLY'}
                            </p>
                            {settings?.printerType === 'thermal' && (
                                <>
                                    <p style={{ fontSize: '0.75rem', margin: '0.25rem 0' }}>{settings?.restaurantAddress}</p>
                                    <p style={{ fontSize: '0.75rem', margin: '0.25rem 0' }}>Ph: {settings?.restaurantPhone}</p>
                                    {(settings?.gstType === 'regular' && settings?.gstNumber) && <p style={{ fontSize: '0.75rem', margin: '0.25rem 0' }}>GST: {settings?.gstNumber}</p>}
                                </>
                            )}
                            <p style={{ fontSize: settings?.printerType === 'thermal' ? '0.875rem' : '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>
                                {invoice.invoice_number}
                            </p>
                        </div>

                        {settings?.printerType !== 'thermal' && (
                            <>
                                {/* Restaurant & Customer Info - A4 Layout */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                    <div>
                                        <h3 style={{ marginBottom: '0.75rem', fontSize: '1.125rem' }}>From:</h3>
                                        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{settings?.restaurantName || 'Ruchi Restaurant'}</p>
                                        <p className="text-muted" style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
                                            {settings?.restaurantAddress || '123 Main Street, City, State 12345'}<br />
                                            Phone: {settings?.restaurantPhone || '+91 1234567890'}<br />
                                            Email: {settings?.restaurantEmail || 'info@ruchi.com'}
                                            {(settings?.gstType === 'regular' && settings?.gstNumber) && <><br />GST: {settings.gstNumber}</>}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 style={{ marginBottom: '0.75rem', fontSize: '1.125rem' }}>To:</h3>
                                        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{invoice.customer_name}</p>
                                        <p className="text-muted" style={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
                                            Phone: {invoice.customer_phone}<br />
                                            {invoice.customer_address && (
                                                <>Address: {invoice.customer_address}<br /></>
                                            )}
                                            Order Type: <span style={{ textTransform: 'capitalize' }}>{invoice.order_type}</span>
                                            {invoice.table_number && <><br />Table No: <strong>{invoice.table_number}</strong></>}
                                        </p>
                                    </div>
                                </div>

                                {/* Invoice Details - A4 Layout */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem', padding: '1rem', background: 'var(--glass-bg)', borderRadius: '8px' }}>
                                    <div>
                                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Invoice Date</p>
                                        <p style={{ fontWeight: 500 }}>{formatDate(invoice.generated_at)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Order Date</p>
                                        <p style={{ fontWeight: 500 }}>{formatDate(invoice.order_date)}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Payment Method</p>
                                        <p style={{ fontWeight: 500, textTransform: 'capitalize' }}>{invoice.payment_method}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Payment Status</p>
                                        <p style={{ fontWeight: 500, textTransform: 'capitalize', color: invoice.payment_status === 'paid' ? 'var(--success)' : 'var(--warning)' }}>
                                            {invoice.payment_status}
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}

                        {settings?.printerType === 'thermal' && (
                            <>
                                {/* Customer Info - Thermal Layout */}
                                <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                                    <div className="divider" style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>
                                    <p style={{ margin: '0.125rem 0' }}><strong>Customer:</strong> {invoice.customer_name}</p>
                                    <p style={{ margin: '0.125rem 0' }}><strong>Phone:</strong> {invoice.customer_phone}</p>
                                    {invoice.customer_address && <p style={{ margin: '0.125rem 0' }}><strong>Address:</strong> {invoice.customer_address}</p>}
                                    <p style={{ margin: '0.125rem 0' }}><strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{invoice.order_type}</span></p>
                                    {invoice.table_number && <p style={{ margin: '0.125rem 0' }}><strong>Table:</strong> {invoice.table_number}</p>}
                                    <p style={{ margin: '0.125rem 0' }}><strong>Date:</strong> {formatDateTime(invoice.order_date)}</p>
                                    <p style={{ margin: '0.125rem 0' }}><strong>Payment:</strong> <span style={{ textTransform: 'capitalize' }}>{invoice.payment_method}</span></p>
                                    <div className="divider" style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>
                                </div>
                            </>
                        )}

                        {/* Items Table */}
                        <div style={{ marginBottom: settings?.printerType === 'thermal' ? '0.5rem' : '2rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: settings?.printerType === 'thermal' ? '0.75rem' : 'inherit' }}>
                                <thead>
                                    <tr style={{ borderBottom: settings?.printerType === 'thermal' ? '1px dashed #000' : '2px solid var(--border-color)' }}>
                                        <th style={{ textAlign: 'left', padding: settings?.printerType === 'thermal' ? '0.25rem 0' : '0.75rem 0', fontWeight: 600 }}>Item</th>
                                        <th style={{ textAlign: 'center', padding: settings?.printerType === 'thermal' ? '0.25rem 0' : '0.75rem 0', fontWeight: 600 }}>Qty</th>
                                        {settings?.printerType !== 'thermal' && <th style={{ textAlign: 'right', padding: '0.75rem 0', fontWeight: 600 }}>Price</th>}
                                        <th style={{ textAlign: 'right', padding: settings?.printerType === 'thermal' ? '0.25rem 0' : '0.75rem 0', fontWeight: 600 }}>Amt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Array.isArray(invoice.items) ? invoice.items : []).map((item: any, idx: number) => {
                                        const price = parseFloat(item.menuItem.price);
                                        const quantity = parseInt(item.quantity);
                                        return (
                                            <tr key={idx} style={{ borderBottom: settings?.printerType === 'thermal' ? 'none' : '1px solid var(--border-color)' }}>
                                                <td style={{ padding: settings?.printerType === 'thermal' ? '0.25rem 0' : '0.75rem 0' }}>
                                                    <div style={{ fontWeight: 500 }}>{item.menuItem.name}</div>
                                                    {settings?.printerType === 'thermal' && (
                                                        <div style={{ fontSize: '0.7rem', color: '#666' }}>@₹{price.toFixed(2)}</div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: settings?.printerType === 'thermal' ? '0.25rem 0' : '0.75rem 0' }}>{quantity}</td>
                                                {settings?.printerType !== 'thermal' && <td style={{ textAlign: 'right', padding: '0.75rem 0' }}>₹{price.toFixed(2)}</td>}
                                                <td style={{ textAlign: 'right', padding: settings?.printerType === 'thermal' ? '0.25rem 0' : '0.75rem 0' }}>₹{(price * quantity).toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        <div style={{ marginLeft: settings?.printerType === 'thermal' ? '0' : 'auto', maxWidth: settings?.printerType === 'thermal' ? '100%' : '300px' }}>
                            {settings?.printerType === 'thermal' && <div className="divider" style={{ borderTop: '1px dashed #000', margin: '0.5rem 0' }}></div>}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', padding: settings?.printerType === 'thermal' ? '0.125rem 0' : '0.5rem 0', fontSize: settings?.printerType === 'thermal' ? '0.75rem' : 'inherit' }}>
                                <span>Subtotal:</span>
                                <span>₹{parseFloat(invoice.subtotal.toString()).toFixed(2)}</span>
                            </div>
                            {(settings?.gstType === 'regular' && parseFloat(invoice.tax.toString()) > 0) && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', padding: settings?.printerType === 'thermal' ? '0.125rem 0' : '0.5rem 0', fontSize: settings?.printerType === 'thermal' ? '0.75rem' : 'inherit' }}>
                                    <span>Tax:</span>
                                    <span>₹{parseFloat(invoice.tax.toString()).toFixed(2)}</span>
                                </div>
                            )}
                            {invoice.delivery_charge && parseFloat(invoice.delivery_charge.toString()) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', padding: settings?.printerType === 'thermal' ? '0.125rem 0' : '0.5rem 0', fontSize: settings?.printerType === 'thermal' ? '0.75rem' : 'inherit' }}>
                                    <span>Delivery Charge:</span>
                                    <span>₹{parseFloat(invoice.delivery_charge.toString()).toFixed(2)}</span>
                                </div>
                            )}
                            {parseFloat(invoice.discount?.toString() || '0') > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', padding: settings?.printerType === 'thermal' ? '0.125rem 0' : '0.5rem 0', color: 'var(--success)', fontSize: settings?.printerType === 'thermal' ? '0.75rem' : 'inherit' }}>
                                    <span>Discount:</span>
                                    <span>-₹{parseFloat(invoice.discount.toString()).toFixed(2)}</span>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: settings?.printerType === 'thermal' ? '0.25rem 0' : '1rem 0', borderTop: settings?.printerType === 'thermal' ? '1px dashed #000' : '2px solid var(--border-color)', fontSize: settings?.printerType === 'thermal' ? '0.875rem' : '1.25rem', fontWeight: 700 }}>
                                <span>Total:</span>
                                <span>₹{parseFloat(invoice.total.toString()).toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ marginTop: settings?.printerType === 'thermal' ? '0.5rem' : '3rem', paddingTop: settings?.printerType === 'thermal' ? '0.5rem' : '1.5rem', borderTop: settings?.printerType === 'thermal' ? '1px dashed #000' : '1px solid var(--border-color)', textAlign: 'center' }}>
                            <p style={{ fontSize: settings?.printerType === 'thermal' ? '0.75rem' : '0.875rem', margin: '0.25rem 0' }}>
                                {settings?.footerText || 'Thank you for your business!'}
                            </p>
                            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <img 
                                    src="/qr/ruchi_review_qr.png" 
                                    alt="Scan to Review Us" 
                                    style={{ 
                                        width: settings?.printerType === 'thermal' ? '110px' : '130px', 
                                        height: settings?.printerType === 'thermal' ? '110px' : '130px', 
                                        objectFit: 'contain',
                                        margin: '0 auto',
                                        display: 'block'
                                    }} 
                                />
                                <p style={{ 
                                    fontSize: settings?.printerType === 'thermal' ? '0.75rem' : '0.875rem', 
                                    fontWeight: 800, 
                                    margin: '0.35rem 0 0 0',
                                    letterSpacing: '0.3px',
                                    textTransform: 'uppercase'
                                }}>
                                    Please scan and review us
                                </p>
                            </div>
                            {settings?.printerType !== 'thermal' && (
                                <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                                    This is a computer-generated invoice and does not require a signature.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </>
    );
}
