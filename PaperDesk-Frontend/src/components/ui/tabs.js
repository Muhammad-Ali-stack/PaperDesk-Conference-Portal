import React, { createContext, useContext, useState, useEffect } from "react";

const TabsContext = createContext(null);

export const Tabs = ({ defaultValue, value, onValueChange, children, className = "" }) => {
  const [activeTab, setActiveTab] = useState(value || defaultValue);

  useEffect(() => {
    if (value !== undefined) {
      setActiveTab(value);
    }
  }, [value]);

  const handleValueChange = (newValue) => {
    if (value === undefined) {
      setActiveTab(newValue);
    }
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ children, className = "" }) => {
  return (
    <div className={`inline-flex items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground ${className}`}>
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, children, className = "", disabled = false, ...props }) => {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? "active" : "inactive"}
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(value)}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium
        ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring focus-visible:ring-offset-2
        disabled:pointer-events-none disabled:opacity-50
        ${isActive 
          ? "bg-background text-foreground shadow-sm" 
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, children, className = "", ...props }) => {
  const { activeTab } = useContext(TabsContext);
  const isActive = activeTab === value;

  if (!isActive) return null;

  return (
    <div
      role="tabpanel"
      data-state={isActive ? "active" : "inactive"}
      className={`mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};