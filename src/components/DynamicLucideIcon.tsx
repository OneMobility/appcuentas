"use client";

import React, { lazy, Suspense, ComponentType } from 'react';
import { IconProps } from 'lucide-react'; // Importar IconProps para tipado

// Un mapa para almacenar los componentes de iconos cargados dinámicamente
const LucideIconComponents: { [key: string]: React.LazyExoticComponent<ComponentType<IconProps>> } = {};

interface DynamicLucideIconProps extends IconProps {
  iconName: string;
}

const DynamicLucideIcon: React.FC<DynamicLucideIconProps> = ({ iconName, ...props }) => {
  // Si el componente ya está en el mapa, lo usamos.
  // Si no, lo cargamos dinámicamente y lo guardamos para futuras referencias.
  if (!LucideIconComponents[iconName]) {
    LucideIconComponents[iconName] = lazy(() =>
      import('lucide-react').then(module => {
        const IconComponent = module[iconName as keyof typeof module];
        if (IconComponent) {
          return { default: IconComponent };
        } else {
          // Fallback a un icono por defecto si el solicitado no existe
          console.warn(`Icono "${iconName}" no encontrado en lucide-react. Usando 'Tag' como fallback.`);
          return { default: module.Tag };
        }
      }).catch(error => {
        console.error(`Error al cargar el icono "${iconName}":`, error);
        // Fallback a un icono por defecto en caso de error de carga
        return import('lucide-react').then(module => ({ default: module.Tag }));
      })
    );
  }

  const Icon = LucideIconComponents[iconName];

  return (
    <Suspense fallback={<div className="h-4 w-4" />}> {/* Un placeholder mientras carga */}
      <Icon {...props} />
    </Suspense>
  );
};

export default DynamicLucideIcon;