import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Template {
  id: string;
  name: string;
  category: string;
  area: string;
  rooms: number;
  style: string;
  thumbnail: string;
  description: string;
  popularity: number;
  downloads: number;
  trending?: boolean;
}

interface AppContextType {
  selectedTemplate: Template | null;
  setSelectedTemplate: (template: Template | null) => void;
  navbarMessage: string | null;
  setNavbarMessage: (message: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [navbarMessage, setNavbarMessage] = useState<string | null>(null);

  return (
    <AppContext.Provider 
      value={{
        selectedTemplate,
        setSelectedTemplate,
        navbarMessage,
        setNavbarMessage
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;