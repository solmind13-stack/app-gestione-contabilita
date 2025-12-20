// src/context/filter-context.tsx
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { YEARS, COMPANIES } from '@/lib/constants';

type Year = number | 'Tutti';
type Company = 'LNC' | 'STG' | 'Tutte';

interface FilterContextType {
  // This context is now empty as filters are handled locally in each page.
  // It's kept for potential future use of global filters.
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  // State for global filters can be added here if needed in the future.
  
  const value = {}; // Empty value for now

  return (
    <FilterContext.Provider value={value}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
};
