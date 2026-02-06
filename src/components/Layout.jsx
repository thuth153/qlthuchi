
import Sidebar from './Sidebar';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

export default function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="layout-container">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="menu-btn">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
        <span className="logo-text">StockManager</span>
        <button onClick={toggleTheme} className="theme-toggle-btn" title="Chuyển theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>

      {/* Sidebar Wrapper */}
      <div className={`sidebar-wrapper ${isSidebarOpen ? 'open' : ''}`}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
        {/* Overlay for mobile */}
        {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      </div>

      <main className="main-content">
        {children || <Outlet />}
      </main>

      <style>{`
        .layout-container {
          display: flex;
          min-height: 100vh;
          position: relative;
        }
        
        .sidebar-wrapper {
          width: 260px;
          flex-shrink: 0;
          height: 100vh;
          position: sticky;
          top: 0;
          z-index: 40;
        }

        .main-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
          width: 100%;
        }

        .mobile-header {
          display: none;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 50;
        }

        .menu-btn {
          background: none;
          border: none;
          color: var(--text-primary);
          padding: 0.5rem;
        }

        .logo-text {
            font-weight: 700; 
            font-size: 1.25rem;
            flex: 1;
        }

        .theme-toggle-btn {
            background: none;
            border: none;
            color: var(--text-primary);
            padding: 0.5rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--radius);
            transition: background 0.2s;
        }

        .theme-toggle-btn:hover {
            background: var(--bg-primary);
        }

        @media (max-width: 768px) {
          .layout-container {
            display: block; /* Stack */
            padding-top: 60px; /* Space for mobile header */
          }

          .mobile-header {
            display: flex;
          }

          .sidebar-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out;
            width: 260px;
            background: var(--bg-secondary);
          }

          .sidebar-wrapper.open {
            transform: translateX(0);
          }

          .sidebar-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.5);
            z-index: -1;
          }

          .main-content {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
