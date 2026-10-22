'use client';

import { useState, useEffect } from 'react';
import { MenuItem } from '@/types';
import { useCart } from '@/contexts/CartContext';

export default function MenuPage() {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const { addToCart } = useCart();
    const [addedItems, setAddedItems] = useState<Set<number>>(new Set());

    useEffect(() => {
        fetchMenuItems();
    }, []);

    const fetchMenuItems = async () => {
        try {
            const response = await fetch('/api/menu?available=true');
            const data = await response.json();
            if (data.success) {
                setMenuItems(data.data);
            }
        } catch (error) {
            console.error('Error fetching menu:', error);
        } finally {
            setLoading(false);
        }
    };

    const categories: string[] = ['all', ...Array.from(new Set(menuItems.map(item => item.category_name).filter((c): c is string => Boolean(c))))];

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = selectedCategory === 'all' || item.category_name === selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description?.toLowerCase() ?? '').includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });



    const handleAddToCart = (item: MenuItem) => {
        addToCart(item);
        setAddedItems(prev => new Set(prev).add(item.id));
        setTimeout(() => {
            setAddedItems(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
            });
        }, 1500);
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
                <h1 className="text-center mb-3">Our Menu</h1>
                <p className="text-center text-muted mb-5" style={{ fontSize: '1.125rem' }}>
                    Discover our delicious selection of authentic dishes
                </p>

                {/* Search and Filter */}
                <div style={{ marginBottom: '2rem' }}>
                    <input
                        type="text"
                        placeholder="Search menu items..."
                        className="input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ marginBottom: '1.5rem' }}
                    />

                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {categories.map(category => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={selectedCategory === category ? 'btn btn-primary' : 'btn btn-ghost'}
                                style={{ padding: '0.625rem 1.25rem', textTransform: 'capitalize' }}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Menu Grid */}
                <div key={selectedCategory} className="grid grid-3">
                    {filteredItems.map((item, index) => (
                        <div
                            key={item.id}
                            className="glass-card slide-up"
                            style={{
                                animationDelay: `${index * 0.05}s`,
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            <div style={{
                                width: '100%',
                                height: '200px',
                                background: item.image_url ? 'transparent' : 'linear-gradient(135deg, rgba(255,100,50,0.2) 0%, rgba(150,50,255,0.2) 100%)',
                                borderRadius: 'var(--radius-md)',
                                marginBottom: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '4rem',
                                overflow: 'hidden',
                            }}>
                                {item.image_url ? (
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        loading="lazy"
                                        decoding="async"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    '🍽️'
                                )}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{item.name}</h3>
                                    <span className="badge badge-primary">₹{item.price}</span>
                                </div>

                                <p className="text-muted" style={{ fontSize: '0.9375rem', marginBottom: '1rem' }}>
                                    {item.description}
                                </p>

                                <span className="badge badge-success" style={{ marginBottom: '1rem' }}>
                                    {item.category_name || 'Unknown'}
                                </span>
                            </div>

                            <button
                                onClick={() => handleAddToCart(item)}
                                className={addedItems.has(item.id) ? 'btn btn-secondary' : 'btn btn-primary'}
                                style={{ width: '100%', marginTop: 'auto' }}
                            >
                                {addedItems.has(item.id) ? '✓ Added!' : '+ Add to Cart'}
                            </button>
                        </div>
                    ))}
                </div>

                {filteredItems.length === 0 && (
                    <div className="text-center" style={{ padding: '4rem 0' }}>
                        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>
                            No items found. Try a different search or category.
                        </p>
                    </div>
                )}
            </div>
        </main>
    );
}
