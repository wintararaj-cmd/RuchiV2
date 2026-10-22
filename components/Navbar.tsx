'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const { getCartCount } = useCart();
    const { theme, toggleTheme } = useTheme();
    const { user, logout, isAuthenticated, isAdmin, isSalesman } = useAuth();
    const cartCount = getCartCount();

    const isActive = (path: string) => pathname === path;

    const handleAdminClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (isAdmin) {
            router.push('/admin/dashboard');
        } else {
            router.push('/admin');
        }
    };

    // Hide Navbar on specific POS-like pages
    if (pathname?.startsWith('/salesman') || pathname?.startsWith('/admin/quick-bill')) {
        return null;
    }

    return (
        <nav className="navbar">
            <div className="container navbar-content">
                <Link href="/" className="navbar-logo">
                    Ruchi
                </Link>

                <div className="navbar-links">
                    <Link
                        href="/menu"
                        className={`navbar-link ${isActive('/menu') ? 'active' : ''}`}
                    >
                        Menu
                    </Link>

                    {isAuthenticated && user?.role === 'customer' && (
                        <Link
                            href="/orders"
                            className={`navbar-link ${isActive('/orders') ? 'active' : ''}`}
                        >
                            Orders
                        </Link>
                    )}

                    <Link
                        href="/cart"
                        className={`navbar-link cart-badge ${isActive('/cart') ? 'active' : ''}`}
                    >
                        Cart
                        {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
                    </Link>

                    {/* Help Button - Icon Only for Space Efficiency */}
                    <Link
                        href="/help"
                        className="theme-toggle"
                        title="Help & Documentation"
                        style={{
                            textDecoration: 'none',
                            fontSize: '1.25rem'
                        }}
                    >
                        📚
                    </Link>

                    {/* Theme Toggle Button */}
                    <button
                        onClick={toggleTheme}
                        className="theme-toggle"
                        aria-label="Toggle theme"
                        title={`Current: ${theme}. Click to switch.`}
                    >
                        {theme === 'dark' ? (
                            // Show Sun (Switch to Light)
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                            </svg>
                        ) : theme === 'light' ? (
                            // Show Leaf/Sparkles (Switch to Nature)
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                            </svg>
                        ) : (
                            // Show Moon (Switch to Dark)
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                            </svg>
                        )}
                    </button>

                    {isAuthenticated ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                                {user?.name}
                            </span>

                            {isAdmin && (
                                <button
                                    onClick={handleAdminClick}
                                    className="btn btn-primary"
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                >
                                    Dashboard
                                </button>
                            )}

                            {(isAdmin || isSalesman) && (
                                <Link
                                    href="/salesman"
                                    className="btn btn-secondary"
                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                >
                                    Salesman POS
                                </Link>
                            )}

                            <button
                                onClick={logout}
                                className="btn btn-outline"
                                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Link href="/login" className="btn btn-ghost" style={{ padding: '0.5rem 1rem' }}>
                                Login
                            </Link>
                            <Link href="/signup" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                                Sign Up
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
}
