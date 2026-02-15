import React from 'react';
import Navbar from '../layouts/navbar/Navbar';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;