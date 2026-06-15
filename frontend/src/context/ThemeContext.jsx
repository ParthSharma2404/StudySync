import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('studysync-theme') || 'theme-dark';
  });

  useEffect(() => {
    // Remove any existing theme classes
    document.body.classList.remove('theme-dark', 'theme-light');
    // Apply the current theme class
    document.body.classList.add(theme);
    // Persist to localStorage
    localStorage.setItem('studysync-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
