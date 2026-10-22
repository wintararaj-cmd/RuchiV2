'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading, isAdmin, isSalesman } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (loading) return;

        // /admin itself is the login form
        if (pathname === '/admin') {
            // If already logged in as a salesman, strictly block and redirect to Salesman POS
            if (user?.role === 'salesman' || isSalesman) {
                router.replace('/salesman');
                return;
            }
            // If already logged in as admin, redirect to admin dashboard
            if (user?.role === 'admin' || isAdmin) {
                router.replace('/admin/dashboard');
                return;
            }
            setAuthorized(true);
            return;
        }

        // For all other /admin/* pages (Reports, Analytics, Sales, Dashboard, Orders, Settings, etc.):
        // 1. Salesmen are STRICTLY FORBIDDEN from viewing any admin report or panel
        if (user?.role === 'salesman' || isSalesman) {
            router.replace('/salesman');
            return;
        }

        // 2. Check admin token and admin role
        const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
        if (!isAdmin || !adminToken || user?.role !== 'admin') {
            router.replace('/admin');
            return;
        }

        setAuthorized(true);
    }, [user, loading, isAdmin, isSalesman, pathname, router]);

    // Show login page if on /admin
    if (pathname === '/admin') {
        return <>{children}</>;
    }

    // While verifying permissions or if unauthorized/salesman, do NOT render reports or children
    if (loading || !authorized || user?.role === 'salesman' || isSalesman) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '80vh',
                gap: '1rem'
            }}>
                <div className="spinner"></div>
                <p className="text-muted" style={{ fontSize: '0.9rem' }}>Verifying permissions...</p>
            </div>
        );
    }

    return <>{children}</>;
}
