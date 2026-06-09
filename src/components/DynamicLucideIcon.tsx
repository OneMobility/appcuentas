"use client";

import React, { lazy, Suspense, ComponentType } from 'react';
import { IconProps } from 'lucide-react';

// Usamos Object.create(null) para evitar colisiones con propiedades del prototipo como 'constructor'
const LucideIconComponents: { [key: string]: React.LazyExoticComponent<ComponentType<any>> } = Object.create(null);

interface DynamicLucideIconProps extends IconProps {
  iconName: string;
}

const DynamicLucideIcon: React.FC<DynamicLucideIconProps> = ({ iconName, ...props }) => {
  // Sanitizar iconName para evitar propiedades del prototipo de Object
  const safeIconName = (iconName && iconName !== 'constructor' && iconName !== 'toString' && iconName !== 'valueOf') 
    ? iconName 
    : 'Tag';

  if (!LucideIconComponents[safeIconName]) {
    LucideIconComponents[safeIconName] = lazy(() =>
      import('lucide-react').then(module => {
        const IconComponent = module[safeIconName as keyof typeof module];
        if (IconComponent && typeof IconComponent === 'function' && IconComponent.name !== 'Object') {
          return { default: IconComponent as ComponentType<any> };
        } else {
          console.warn(`Icono "${safeIconName}" no encontrado en lucide-react. Usando 'Tag' como fallback.`);
          return { default: module.Tag };
        }
      }).catch(error => {
        console.error(`Error al cargar el icono "${safeIconName}":`, error);
        return import('lucide-react').then(module => ({ default: module.Tag }));
      })
    );
  }

  const Icon = LucideIconComponents[safeIconName];

  return (
    <Suspense fallback={<div className="h-4 w-4" />}>
      <Icon {...props} />
    </Suspense>
  );
};

export default DynamicLucideIcon;