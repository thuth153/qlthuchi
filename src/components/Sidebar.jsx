
import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { LayoutDashboard, List, LogOut, Menu, X, BarChart3, Fuel, Wallet, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Tổng quan', path: '/dashboard' },
        { icon: List, label: 'Giao dịch CK', path: '/transactions' },
        { icon: BarChart3, label: 'Báo cáo CK', path: '/report' },
        { icon: Fuel, label: 'Nhiên liệu', path: '/fuel' },
        { icon: Wallet, label: 'Thu Chi', path: '/expenses' },
    ];

    return (
        <>
            <button
                className="mobile-menu-btn"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                style={{
                    position: 'fixed', top: '1rem', left: '1rem', zIndex: 50,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    padding: '0.5rem', borderRadius: 'var(--radius)',
                    display: 'none' // Hidden on desktop via CSS media query usually, but inline here for simplicity
                }}
            >
                {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}
                style={{
                    width: '280px', height: '100vh',
                    background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)',
                    padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column',
                    position: 'fixed', left: 0, top: 0, zIndex: 40,
                    transition: 'transform 0.3s ease'
                }}
            >
                <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: '12px' }}></div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>StockManager</span>
                </div>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsMobileMenuOpen(false)}
                            style={({ isActive }) => ({
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                padding: '0.875rem 1rem', borderRadius: 'var(--radius)',
                                color: isActive ? '#fff' : 'var(--text-secondary)',
                                background: isActive ? 'var(--primary)' : 'transparent',
                                fontWeight: isActive ? 600 : 400,
                                textDecoration: 'none', transition: 'all 0.2s ease'
                            })}
                        >
                            <item.icon size={20} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Theme Toggle Button */}
                <button
                    onClick={toggleTheme}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.875rem 1rem', background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)', border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius)', cursor: 'pointer', fontWeight: 600,
                        width: '100%', marginBottom: '0.5rem', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    {theme === 'dark' ? 'Chế độ Sáng' : 'Chế độ Tối'}
                </button>

                <button
                    onClick={handleLogout}
                    style={{
                        marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.875rem 1rem', background: 'rgba(239, 68, 68, 0.1)',
                        color: 'var(--danger)', border: 'none', borderRadius: 'var(--radius)',
                        cursor: 'pointer', fontWeight: 600, width: '100%'
                    }}
                >
                    <LogOut size={20} />
                    Đăng xuất
                </button>
            </div>

            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30 }}
                ></div>
            )}
        </>
    );
}
