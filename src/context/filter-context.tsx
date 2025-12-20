// src/context/filter-context.tsx
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { YEARS, COMPANIES } from '@/lib/constants';

type Year = number | 'Tutti';
type Company = 'LNC' | 'STG' | 'Tutte';

interface FilterContextType {
  selectedYear: Year;
  setSelectedYear: (year: Year) => void;
  selectedCompany: Company;
  setSelectedCompany: (company: Company) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [selectedYear, setSelectedYear] = useState<Year>(YEARS[1]); // Default to the first actual year
  const [selectedCompany, setSelectedCompany] = useState<Company>('Tutte');


  return (
    <FilterContext.Provider value={{ selectedYear, setSelectedYear, selectedCompany, setSelectedCompany }}>
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
