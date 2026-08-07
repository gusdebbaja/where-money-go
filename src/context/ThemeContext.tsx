import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'amoled';
export type Style = 'smooth' | 'angular';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  style: Style;
  setStyle: (style: Style) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [style, setStyle] = useState<Style>('smooth');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) setTheme(savedTheme);
    const savedStyle = localStorage.getItem('ui-style') as Style;
    if (savedStyle) setStyle(savedStyle);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.remove('light', 'dark', 'amoled');
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('ui-style', style);
    document.documentElement.classList.remove('style-smooth', 'style-angular');
    document.documentElement.classList.add(`style-${style}`);
  }, [style]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, style, setStyle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
