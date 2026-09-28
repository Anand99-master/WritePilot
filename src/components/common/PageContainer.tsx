import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
  maxWidth = 'max-w-5xl',
}) => {
  return (
    <div className="w-full flex-1 overflow-y-auto px-8 py-6">
      <div className={`mx-auto w-full ${maxWidth} flex flex-col gap-6 ${className}`}>
        {children}
      </div>
    </div>
  );
};
