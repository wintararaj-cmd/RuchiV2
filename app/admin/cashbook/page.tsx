'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate, formatDateTime } from '@/lib/utils';

interface CashTransaction {
    id: string;
    date: string;
    description: string;
    type: 'in' | 'out';
    amount: number;
    balance: number;
    category: string;
}

export default function CashBookPage() {
    const router = useRouter();
    const [transactions, setTransactions] = useState<CashTransaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [dateFilter, setDateFilter] = useState('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [expenseDescription, setExpenseDescription] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');

    const [expenseCategory, setExpenseCategory] = useState('Expense');

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (!token) {
            router.push('/admin');
            return;
        }

        // Load opening balance from localStorage
        const savedBalance = localStorage.getItem('cashBookOpeningBalance');
        if (savedBalance) {
            setOpeningBalance(parseFloat(savedBalance));
        }

        fetchCashTransactions();
    }, []); // Empty dependency - only run on mount

    const fetchCashTransactions = async () => {
        try {
            // Fetch orders for cash sales
            const ordersResponse = await fetch('/api/orders');
            const ordersData = await ordersResponse.json();

            // Fetch expenses from database
            const expensesResponse = await fetch('/api/expenses');
            const expensesData = await expensesResponse.json();

            if (ordersData.success) {
                // Filter cash transactions
                const cashSales = ordersData.data
                    .filter((order: any) => order.payment_method === 'cash' && order.order_status !== 'cancelled')
                    .map((order: any) => ({
                        id: `sale-${order.id}`,
                        date: order.created_at,
                        description: `Sale - ${order.customer_name} (${order.invoice_number || `Order #${order.id}`})`,
                        type: 'in' as const,
                        amount: parseFloat(order.total_amount),
                        category: 'Sales',
                    }));

                // Map expenses from database
                const expenses = expensesData.success ? expensesData.data.map((expense: any) => ({
                    id: `expense-${expense.id}`,
                    date: expense.date,
                    description: expense.description,
                    type: 'out' as const,
                    amount: parseFloat(expense.amount),
                    category: expense.category,
                })) : [];

                // Combine and sort by date
                const allTransactions = [...cashSales, ...expenses].sort(
                    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                );

                // Calculate running balance
                let balance = openingBalance;
                const transactionsWithBalance = allTransactions.map(txn => {
                    balance += txn.type === 'in' ? txn.amount : -txn.amount;
                    return { ...txn, balance };
                });

                setTransactions(transactionsWithBalance);
            }
        } catch (error) {
            console.error('Error fetching cash transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSetOpeningBalance = () => {
        const balance = prompt('Enter opening balance:', openingBalance.toString());
        if (balance !== null) {
            const newBalance = parseFloat(balance) || 0;
            setOpeningBalance(newBalance);
            localStorage.setItem('cashBookOpeningBalance', newBalance.toString());
            fetchCashTransactions(); // Recalculate balances
        }
    };

    const handleAddExpense = async () => {
        if (!expenseDescription || !expenseAmount) {
            alert('Please fill in all fields');
            return;
        }

        try {
            const response = await fetch('/api/expenses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    description: expenseDescription,
                    amount: parseFloat(expenseAmount),
                    category: expenseCategory,
                    date: new Date().toISOString().split('T')[0], // Format as YYYY-MM-DD
                    payment_method: 'cash',
                    notes: '',
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.details ? `${data.error}: ${data.details}` : (data.error || 'Failed to add expense'));
            }

            // Reset form
            setExpenseDescription('');
            setExpenseAmount('');
            setExpenseCategory('Expense');
            setShowExpenseForm(false);

            // Refresh transactions
            fetchCashTransactions();
        } catch (error: any) {
            console.error('Error adding expense:', error);
            alert(`Failed to add expense: ${error.message || 'Unknown error'}`);
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
                return { start: new Date(0), end: endOfDay };
        }
    };

    const filteredTransactions = transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        const { start, end } = getDateRange();
        return txnDate >= start && txnDate <= end;
    });

    const calculateSummary = () => {
        const cashIn = filteredTransactions
            .filter(t => t.type === 'in')
            .reduce((sum, t) => sum + t.amount, 0);

        const cashOut = filteredTransactions
            .filter(t => t.type === 'out')
            .reduce((sum, t) => sum + t.amount, 0);

        const closingBalance = filteredTransactions.length > 0
            ? filteredTransactions[filteredTransactions.length - 1].balance
            : openingBalance;

        return { cashIn, cashOut, closingBalance };
    };

    const exportToCSV = () => {
        const headers = ['Date', 'Description', 'Type', 'Cash In', 'Cash Out', 'Balance'];
        const rows = filteredTransactions.map(txn => [
            formatDateTime(txn.date),
            txn.description,
            txn.category,
            txn.type === 'in' ? txn.amount : '',
            txn.type === 'out' ? txn.amount : '',
            txn.balance.toFixed(2),
        ]);

        const csvContent = [
            ['Opening Balance', '', '', '', '', openingBalance.toFixed(2)],
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cash-book-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    const summary = calculateSummary();

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
                    <h1>💰 Cash Book</h1>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={() => setShowExpenseForm(!showExpenseForm)} className="btn btn-primary">
                            + Add Entry
                        </button>
                        <button onClick={exportToCSV} className="btn btn-primary">
                            📥 Export CSV
                        </button>
                        <button onClick={() => router.push('/admin/dashboard')} className="btn btn-ghost">
                            ← Back
                        </button>
                    </div>
                </div>

                {/* Expense Form */}
                {showExpenseForm && (
                    <div className="glass-card" style={{ marginBottom: '2rem' }}>
                        <h3 style={{ marginBottom: '1rem' }}>Add Cash Entry (Expense / Purchase)</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }}>
                            <div style={{ flex: '1 1 150px' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                    Category
                                </label>
                                <select
                                    value={expenseCategory}
                                    onChange={(e) => setExpenseCategory(e.target.value)}
                                    className="input"
                                >
                                    <option value="Expense">General Expense</option>
                                    <option value="Purchase Invoice">Purchase Invoice</option>
                                    <option value="Salary">Salary</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div style={{ flex: '2 1 200px' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={expenseDescription}
                                    onChange={(e) => setExpenseDescription(e.target.value)}
                                    placeholder="e.g., Grocery purchase, Utilities..."
                                    className="input"
                                />
                            </div>
                            <div style={{ flex: '1 1 120px' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                                    Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="input"
                                    step="0.01"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                                <button onClick={handleAddExpense} className="btn btn-primary">
                                    Add
                                </button>
                                <button onClick={() => setShowExpenseForm(false)} className="btn btn-ghost">
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="glass-card" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
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

                        {dateFilter === 'custom' && (
                            <>
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
                            </>
                        )}
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-4" style={{ marginBottom: '2rem' }}>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Opening Balance</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--info)' }}>
                            ₹{openingBalance.toFixed(2)}
                        </div>
                        <button onClick={handleSetOpeningBalance} className="btn btn-ghost" style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}>
                            Update
                        </button>
                    </div>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Cash In</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>
                            ₹{summary.cashIn.toFixed(2)}
                        </div>
                    </div>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Cash Out</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--danger)' }}>
                            ₹{summary.cashOut.toFixed(2)}
                        </div>
                    </div>
                    <div className="glass-card">
                        <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Closing Balance</div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary)' }}>
                            ₹{summary.closingBalance.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="glass-card">
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Date</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Description</th>
                                    <th style={{ padding: '1rem', textAlign: 'left' }}>Category</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Cash In</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Cash Out</th>
                                    <th style={{ padding: '1rem', textAlign: 'right' }}>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '2rem', textAlign: 'center' }} className="text-muted">
                                            No cash transactions found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTransactions.map(txn => (
                                        <tr key={txn.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1rem' }}>
                                                {formatDate(txn.date)}<br />
                                                <span className="text-muted" style={{ fontSize: '0.875rem' }}>
                                                    {new Date(txn.date).toLocaleTimeString('en-IN')}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>{txn.description}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span className={`badge ${txn.type === 'in' ? 'badge-success' : 'badge-danger'}`}>
                                                    {txn.category}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                                                {txn.type === 'in' ? `₹${txn.amount.toFixed(2)}` : '-'}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>
                                                {txn.type === 'out' ? `₹${txn.amount.toFixed(2)}` : '-'}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700 }}>
                                                ₹{txn.balance.toFixed(2)}
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
