'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
    id: number;
    name: string;
    email: string;
    role: 'customer' | 'admin' | 'salesman' | 'delivery_boy';
    phone?: string;
    address?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
    isSalesman: boolean;
    isDeliveryBoy: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Check for stored auth data on mount
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('authUser');

        if (storedToken && storedUser) {
            try {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            } catch (error) {
                console.error('Error parsing stored user data:', error);
                localStorage.removeItem('authToken');
                localStorage.removeItem('authUser');
            }
        }
        setLoading(false);
    }, []);

    const login = (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('authToken', newToken);
        localStorage.setItem('authUser', JSON.stringify(newUser));

        if (newUser.role === 'admin') {
            localStorage.setItem('adminToken', newToken);
            localStorage.setItem('adminUser', JSON.stringify(newUser));
        } else if (newUser.role === 'salesman') {
            localStorage.setItem('salesmanToken', newToken);
        } else if (newUser.role === 'delivery_boy') {
            localStorage.setItem('deliveryToken', newToken);
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
        // Also remove specific role keys
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        localStorage.removeItem('salesmanToken');
        localStorage.removeItem('deliveryToken');

        router.push('/login');
    };

    // Protect routes
    useEffect(() => {
        if (loading) return;

        const publicRoutes = ['/', '/menu', '/login', '/signup', '/cart'];
        const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/menu/');
        const isAdminRoute = pathname.startsWith('/admin');
        const isSalesmanRoute = pathname.startsWith('/salesman');
        const isDeliveryRoute = pathname.startsWith('/delivery');

        // Allow login/admin pages to process without partial redirect loop
        if (pathname === '/admin' || pathname === '/login') return;

        if (!user && !isPublicRoute) {
            // Not logged in
            if (isAdminRoute || isSalesmanRoute || isDeliveryRoute) {
                // Staff login via admin portal
                router.push('/admin');
            } else {
                router.push('/login');
            }
        } else if (user) {
            // Logged in role enforcement
            if (user.role === 'salesman') {
                // Salesman must ONLY take orders, strictly no reports or admin/orders/delivery access
                if (isAdminRoute || pathname === '/orders' || isDeliveryRoute) {
                    router.replace('/salesman');
                    return;
                }
            } else if (user.role === 'delivery_boy') {
                if (isAdminRoute || pathname === '/orders' || isSalesmanRoute) {
                    router.replace('/delivery');
                    return;
                }
            } else if (user.role === 'customer') {
                if (isAdminRoute || isSalesmanRoute || isDeliveryRoute) {
                    router.replace('/menu');
                    return;
                }
            } else if (user.role === 'admin') {
                if (isSalesmanRoute) {
                    // Admin can view salesman if needed
                }
            }
        }
    }, [user, loading, pathname, router]);

    return (
        <AuthContext.Provider value={{
            user,
            token,
            loading,
            login,
            logout,
            isAuthenticated: !!user,
            isAdmin: user?.role === 'admin',
            isSalesman: user?.role === 'salesman',
            isDeliveryBoy: user?.role === 'delivery_boy'
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
