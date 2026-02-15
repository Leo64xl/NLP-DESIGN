import React from 'react'
import Navbar from '../navbar/Navbar'

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <React.Fragment>
      <Navbar />
        <div>
            <main>{children}</main>
        </div>
    </React.Fragment>
    
  )
}

export default Layout