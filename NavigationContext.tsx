import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NavigationContextType {
  navigationData: {
    textCenter?: {
      contactId?: string;
      contactName?: string;
      contactPhone?: string;
    };
  };
  navigateToTextCenter: (contactId: string, contactName: string, contactPhone: string) => void;
  clearNavigationData: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [navigationData, setNavigationData] = useState<NavigationContextType['navigationData']>({});

  const navigateToTextCenter = (contactId: string, contactName: string, contactPhone: string) => {
    setNavigationData({
      textCenter: {
        contactId,
        contactName,
        contactPhone
      }
    });
  };

  const clearNavigationData = () => {
    setNavigationData({});
  };

  return (
    <NavigationContext.Provider value={{ navigationData, navigateToTextCenter, clearNavigationData }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}
