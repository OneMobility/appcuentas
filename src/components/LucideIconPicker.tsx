"use client";

import React, { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

// Create a map of all Lucide icons that are actual React components
const lucideIconMap: { [key: string]: React.ElementType } = {};
for (const key in LucideIcons) {
  // Check if the property is a function (React component) and starts with an uppercase letter
  if (typeof (LucideIcons as any)[key] === 'function' && key[0] === key[0].toUpperCase()) {
    lucideIconMap[key] = (LucideIcons as any)[key];
  }
}

// Curated list of relevant icon names based on user request
const curatedIconNames = [
  "Tag",          // Etiqueta
  "Banknote",     // Billete
  "CreditCard",   // Tarjeta
  "Gift",         // Regalo
  "PiggyBank",    // Cochinito
  "Car",          // Transporte (coche)
  "Plane",        // Transporte (avión)
  "Utensils",     // Comida
  "Coffee",       // Café (para comida/bebidas)
  "ShoppingBag",  // Ropa / Compras
  "Lightbulb",    // Servicio / Utilidades
  "Wrench",       // Mantenimiento
  "Home",         // Casa / Alquiler
  "Heart",        // Corazón (para pagos a tarjetas de crédito)
  "ThumbsUp",     // Te Deben
  "ThumbsDown",   // Le Debes
  "Wallet",       // Billetera
  "Receipt",      // Recibo
  "Landmark",     // Banco
  "Briefcase",    // Trabajo
  "GraduationCap",// Educación
  "Hospital",     // Salud
  "Gamepad",      // Entretenimiento
  "Book",         // Libros
  "Phone",        // Comunicación
  "Cloud",        // Servicios en la nube
  "Wifi",         // Internet
  "Droplet",      // Agua
  "Zap",          // Electricidad
  "Gas",          // Gasolina
  "Bus",          // Transporte público
  "Train",        // Tren
  "Bike",         // Bicicleta
  "Sailboat",     // Barco
  "Building",     // Edificio
  "TreeDeciduous",// Naturaleza
  "PawPrint",     // Mascotas
  "Baby",         // Bebé
  "Dumbbell",     // Gimnasio
  "Palette",      // Arte
  "Camera",       // Fotografía
  "Music",        // Música
  "Film",         // Películas
  "Pizza",        // Comida rápida
  "Martini",      // Bebidas
  "ShoppingCart", // Compras
  "Shirt",        // Ropa
  "Watch",        // Accesorios
  "Gem",          // Joyería
  "Gift",         // Regalos
  "Package",      // Envíos
  "Shield",       // Seguros
  "LifeBuoy",     // Emergencias
  "Handshake",    // Donaciones
  "DollarSign",   // Dinero
  "Euro",         // Euro
  "IndianRupee",  // Rupia India
  "Yen",          // Yen Japonés
  "Bitcoin",      // Criptomonedas
  "BarChart",     // Gráficos
  "Settings",     // Configuración
  "User",         // Usuario
  "Users",        // Usuarios
  "Calendar",     // Calendario
  "Clock",        // Reloj
  "MapPin",       // Ubicación
  "Mail",         // Correo
  "Phone",        // Teléfono
  "MessageSquare",// Mensajes
  "Bell",         // Notificaciones
  "Search",       // Buscar
  "Filter",       // Filtrar
  "Plus",         // Añadir
  "Minus",        // Restar
  "X",            // Cerrar
  "Check",        // Confirmar
  "AlertCircle",  // Alerta
  "Info",         // Información
  "HelpCircle",   // Ayuda
  "Lock",         // Bloquear
  "Unlock",       // Desbloquear
  "Key",          // Llave
  "Link",         // Enlace
  "ExternalLink", // Enlace externo
  "Upload",       // Subir
  "Download",     // Descargar
  "Printer",      // Imprimir
  "Share2",       // Compartir
  "Copy",         // Copiar
  "Clipboard",    // Portapapeles
  "Trash2",       // Eliminar
  "Edit",         // Editar
  "Save",         // Guardar
  "Eye",          // Ver
  "EyeOff",       // Ocultar
  "Star",         // Favorito
  "StarOff",      // Quitar favorito
  "Sun",          // Modo claro
  "Moon",         // Modo oscuro
  "Laptop",       // Dispositivo
  "Monitor",      // Monitor
  "Smartphone",   // Smartphone
  "Tablet",       // Tablet
  "Speaker",      // Altavoz
  "Mic",          // Micrófono
  "Camera",       // Cámara
  "Video",        // Video
  "Image",        // Imagen
  "File",         // Archivo
  "FileText",     // Archivo de texto
  "Folder",       // Carpeta
  "FolderOpen",   // Carpeta abierta
  "Database",     // Base de datos
  "Server",       // Servidor
  "Cloud",        // Nube
  "CloudRain",    // Lluvia
  "CloudSnow",    // Nieve
  "CloudSun",     // Sol y Nube
  "Wind",         // Viento
  "Droplets",     // Gotas
  "Thermometer",  // Termómetro
  "Gauge",        // Medidor
  "Activity",     // Actividad
  "Zap",          // Energía
  "BatteryCharging", // Batería cargando
  "BatteryFull",  // Batería llena
  "WifiOff",      // Wifi apagado
  "Bluetooth",    // Bluetooth
  "Globe",        // Globo
  "Map",          // Mapa
  "Navigation",   // Navegación
  "Compass",      // Brújula
  "Target",       // Objetivo
  "Crosshair",    // Mira
  "Anchor",       // Ancla
  "Feather",      // Pluma
  "PenTool",      // Herramienta de pluma
  "Brush",        // Pincel
  "Palette",      // Paleta
  "Crop",         // Recortar
  "Scissors",     // Tijeras
  "Ruler",        // Regla
  "Square",       // Cuadrado
  "Circle",       // Círculo
  "Triangle",     // Triángulo
  "Hexagon",      // Hexágono
  "Octagon",      // Octágono
  "Diamond",      // Diamante
  "Heart",        // Corazón
  "Star",         // Estrella
  "Zap",          // Rayo
  "Gift",         // Regalo
  "Award",        // Premio
  "Trophy",       // Trofeo
  "Medal",        // Medalla
  "Crown",        // Corona
  "Shield",       // Escudo
  "ShieldOff",    // Escudo apagado
  "Key",          // Llave
  "Lock",         // Candado
  "Unlock",       // Candado abierto
  "Fingerprint",  // Huella dactilar
  "Eye",          // Ojo
  "EyeOff",       // Ojo tachado
  "Bell",         // Campana
  "BellOff",      // Campana tachada
  "Volume2",      // Volumen alto
  "VolumeX",      // Volumen silenciado
  "Mic",          // Micrófono
  "MicOff",       // Micrófono tachado
  "Headphones",   // Auriculares
  "Speaker",      // Altavoz
  "Monitor",      // Monitor
  "Laptop",       // Laptop
  "Smartphone",   // Smartphone
  "Tablet",       // Tablet
  "Watch",        // Reloj
  "Tv",           // Televisión
  "Camera",       // Cámara
  "Video",        // Video
  "Film",         // Película
  "Image",        // Imagen
  "Book",         // Libro
  "Bookmark",     // Marcador
  "Paperclip",    // Clip
  "Link",         // Enlace
  "ExternalLink", // Enlace externo
  "Share2",       // Compartir
  "Download",     // Descargar
  "Upload",       // Subir
  "Printer",      // Impresora
  "Trash2",       // Papelera
  "Edit",         // Editar
  "Copy",         // Copiar
  "Clipboard",    // Portapapeles
  "Save",         // Guardar
  "Plus",         // Más
  "Minus",        // Menos
  "X",            // Cruz
  "Check",        // Check
  "RefreshCw",    // Recargar
  "RotateCw",     // Rotar
  "Repeat",       // Repetir
  "Shuffle",      // Aleatorio
  "Play",         // Reproducir
  "Pause",        // Pausar
  "Stop",         // Detener
  "SkipForward",  // Adelantar
  "SkipBack",     // Retroceder
  "FastForward",  // Avance rápido
  "Rewind",       // Rebobinar
  "Volume1",      // Volumen medio
  "VolumeX",      // Volumen silenciado
  "Maximize",     // Maximizar
  "Minimize",     // Minimizar
  "ZoomIn",       // Acercar
  "ZoomOut",      // Alejar
  "Search",       // Buscar
  "Filter",       // Filtrar
  "Sliders",      // Controles
  "Settings",     // Ajustes
  "Gear",         // Engranaje
  "Tool",         // Herramienta
  "Wrench",       // Llave inglesa
  "Hammer",       // Martillo
  "Brush",        // Brocha
  "Palette",      // Paleta
  "Feather",      // Pluma
  "PenTool",      // Pluma
  "Crop",         // Recortar
  "Scissors",     // Tijeras
  "Ruler",        // Regla
  "Compass",      // Brújula
  "Map",          // Mapa
  "MapPin",       // Marcador de mapa
  "Globe",        // Globo
  "Navigation",   // Navegación
  "Anchor",       // Ancla
  "Cloud",        // Nube
  "CloudRain",    // Nube de lluvia
  "CloudSnow",    // Nube de nieve
  "CloudSun",     // Nube de sol
  "Wind",         // Viento
  "Droplets",     // Gotas
  "Thermometer",  // Termómetro
  "Gauge",        // Medidor
  "Activity",     // Actividad
  "Zap",          // Rayo
  "BatteryCharging", // Batería cargando
  "BatteryFull",  // Batería llena
  "WifiOff",      // Wifi apagado
  "Bluetooth",    // Bluetooth
  "Usb",          // USB
  "Cpu",          // CPU
  "HardDrive",    // Disco duro
  "Server",       // Servidor
  "Database",     // Base de datos
  "Key",          // Llave
  "Lock",         // Candado
  "Unlock",       // Candado abierto
  "Shield",       // Escudo
  "ShieldOff",    // Escudo apagado
  "User",         // Usuario
  "Users",        // Usuarios
  "UserPlus",     // Añadir usuario
  "UserMinus",    // Eliminar usuario
  "UserCheck",    // Usuario verificado
  "UserX",        // Usuario bloqueado
  "Award",        // Premio
  "Trophy",       // Trofeo
  "Medal",        // Medalla
  "Crown",        // Corona
  "Gift",         // Regalo
  "Heart",        // Corazón
  "Star",         // Estrella
  "Smile",        // Sonrisa
  "Frown",        // Ceño fruncido
  "Meh",          // Indiferente
  "Zap",          // Rayo
  "Fire",         // Fuego
  "Droplet",      // Gota
  "Leaf",         // Hoja
  "Tree",         // Árbol
  "Mountain",     // Montaña
  "Sun",          // Sol
  "Moon",         // Luna
  "Cloud",        // Nube
  "CloudRain",    // Nube de lluvia
  "CloudSnow",    // Nube de nieve
  "CloudSun",     // Nube de sol
  "Wind",         // Viento
  "Sunrise",      // Amanecer
  "Sunset",       // Atardecer
  "Thermometer",  // Termómetro
  "Umbrella",     // Paraguas
  "CloudLightning", // Nube con rayo
  "CloudOff",     // Nube apagada
  "CloudDrizzle", // Llovizna
  "CloudFog",     // Niebla
  "CloudHail",    // Granizo
  "CloudMoon",    // Nube de luna
  "CloudRainWind",// Lluvia y viento
  "CloudSnow",    // Nieve
  "CloudSun",     // Sol y nube
  "Cloudy",       // Nublado
  "MoonStar",     // Luna y estrella
  "SunMedium",    // Sol medio
  "Sunrise",      // Amanecer
  "Sunset",       // Atardecer
  "ThermometerSnowflake", // Termómetro de nieve
  "ThermometerSun", // Termómetro de sol
  "Tornado",      // Tornado
  "Umbrella",     // Paraguas
  "Wind",         // Viento
  "Zap",          // Rayo
  "ZapOff",       // Rayo apagado
  "Activity",     // Actividad
  "Airplay",      // Airplay
  "AlarmClock",   // Reloj de alarma
  "Album",        // Álbum
  "AlignCenter",  // Alinear centro
  "AlignJustify", // Alinear justificar
  "AlignLeft",    // Alinear izquierda
  "AlignRight",   // Alinear derecha
  "Anchor",       // Ancla
  "Aperture",     // Apertura
  "Archive",      // Archivo
  "ArrowDown",    // Flecha abajo
  "ArrowDownCircle", // Flecha abajo círculo
  "ArrowDownLeft", // Flecha abajo izquierda
  "ArrowDownRight", // Flecha abajo derecha
  "ArrowLeft",    // Flecha izquierda
  "ArrowLeftCircle", // Flecha izquierda círculo
  "ArrowRight",   // Flecha derecha
  "ArrowRightCircle", // Flecha derecha círculo
  "ArrowUp",      // Flecha arriba
  "ArrowUpCircle", // Flecha arriba círculo
  "ArrowUpLeft",  // Flecha arriba izquierda
  "ArrowUpRight", // Flecha arriba derecha
  "AtSign",       // Arroba
  "Award",        // Premio
  "Baby",         // Bebé
  "Backpack",     // Mochila
  "Badge",        // Insignia
  "BaggageClaim", // Reclamación de equipaje
  "Ban",          // Prohibir
  "Banknote",     // Billete
  "BarChart",     // Gráfico de barras
  "BarChart2",    // Gráfico de barras 2
  "Battery",      // Batería
  "BatteryCharging", // Batería cargando
  "Bell",         // Campana
  "BellOff",      // Campana apagada
  "BellRing",     // Campana sonando
  "Bike",         // Bicicleta
  "Binary",       // Binario
  "Bitcoin",      // Bitcoin
  "Blinds",       // Persianas
  "Bluetooth",    // Bluetooth
  "Bold",         // Negrita
  "Book",         // Libro
  "BookOpen",     // Libro abierto
  "Bookmark",     // Marcador
  "Bot",          // Bot
  "Box",          // Caja
  "Briefcase",    // Maletín
  "Brush",        // Brocha
  "Bug",          // Error
  "Building",     // Edificio
  "Bus",          // Autobús
  "Cable",        // Cable
  "Calculator",   // Calculadora
  "Calendar",     // Calendario
  "Camera",       // Cámara
  "CameraOff",    // Cámara apagada
  "Car",          // Coche
  "Carrot",       // Zanahoria
  "Cast",         // Transmitir
  "Check",        // Check
  "CheckCircle",  // Check círculo
  "CheckSquare",  // Check cuadrado
  "ChefHat",      // Gorro de chef
  "Cherry",       // Cereza
  "ChevronDown",  // Chevron abajo
  "ChevronLeft",  // Chevron izquierda
  "ChevronRight", // Chevron derecha
  "ChevronUp",    // Chevron arriba
  "ChevronsDown", // Chevrons abajo
  "ChevronsLeft", // Chevrons izquierda
  "ChevronsRight", // Chevrons derecha
  "ChevronsUp",   // Chevrons arriba
  "Chrome",       // Chrome
  "Circle",       // Círculo
  "CircleDot",    // Círculo con punto
  "Clipboard",    // Portapapeles
  "Clock",        // Reloj
  "Cloud",        // Nube
  "CloudDrizzle", // Llovizna
  "CloudFog",     // Niebla
  "CloudHail",    // Granizo
  "CloudLightning", // Nube con rayo
  "CloudOff",     // Nube apagada
  "CloudRain",    // Lluvia
  "CloudRainWind",// Lluvia y viento
  "CloudSnow",    // Nieve
  "CloudSun",     // Sol y nube
  "Cloudy",       // Nublado
  "Code",         // Código
  "Code2",        // Código 2
  "Codepen",      // Codepen
  "Codesandbox",  // Codesandbox
  "Coffee",       // Café
  "Coins",        // Monedas
  "Columns",      // Columnas
  "Command",      // Comando
  "Compass",      // Brújula
  "Component",    // Componente
  "ConciergeBell",// Campana de conserje
  "Construction", // Construcción
  "Contact",      // Contacto
  "Contrast",     // Contraste
  "Copy",         // Copiar
  "Copyleft",     // Copyleft
  "Copyright",    // Copyright
  "CornerDownLeft", // Esquina abajo izquierda
  "CornerDownRight", // Esquina abajo derecha
  "CornerLeftDown", // Esquina izquierda abajo
  "CornerLeftUp", // Esquina izquierda arriba
  "CornerRightDown", // Esquina derecha abajo
  "CornerRightUp", // Esquina derecha arriba
  "CornerUpLeft", // Esquina arriba izquierda
  "CornerUpRight", // Esquina arriba derecha
  "Cpu",          // CPU
  "CreditCard",   // Tarjeta de crédito
  "Crop",         // Recortar
  "Cross",        // Cruz
  "Crosshair",    // Mira
  "Crown",        // Corona
  "CupSoda",      // Vaso de refresco
  "Currency",     // Moneda
  "Database",     // Base de datos
  "Delete",       // Eliminar
  "Diamond",      // Diamante
  "Dice1",        // Dado 1
  "Dice2",        // Dado 2
  "Dice3",        // Dado 3
  "Dice4",        // Dado 4
  "Dice5",        // Dado 5
  "Dice6",        // Dado 6
  "Dices",        // Dados
  "Diff",         // Diferencia
  "Disc",         // Disco
  "Divide",       // Dividir
  "DivideCircle", // Dividir círculo
  "DivideSquare", // Dividir cuadrado
  "DollarSign",   // Signo de dólar
  "Download",     // Descargar
  "DownloadCloud",// Descargar nube
  "Dribbble",     // Dribbble
  "Droplet",      // Gota
  "Droplets",     // Gotas
  "Drumstick",    // Muslo de pollo
  "Dumbbell",     // Mancuerna
  "Ear",          // Oreja
  "Edit",         // Editar
  "Edit2",        // Editar 2
  "Edit3",        // Editar 3
  "Egg",          // Huevo
  "Equal",        // Igual
  "EqualNot",     // No igual
  "Eraser",       // Borrador
  "Euro",         // Euro
  "Expand",       // Expandir
  "ExternalLink", // Enlace externo
  "Eye",          // Ojo
  "EyeOff",       // Ojo tachado
  "Facebook",     // Facebook
  "Factory",      // Fábrica
  "Fan",          // Ventilador
  "FastForward",  // Avance rápido
  "Feather",      // Pluma
  "Figma",        // Figma
  "File",         // Archivo
  "FileArchive",  // Archivo comprimido
  "FileAudio",    // Archivo de audio
  "FileBadge",    // Archivo de insignia
  "FileBadge2",   // Archivo de insignia 2
  "FileBarChart", // Archivo de gráfico de barras
  "FileBarChart2", // Archivo de gráfico de barras 2
  "FileBox",      // Caja de archivo
  "FileCheck",    // Archivo con check
  "FileCheck2",   // Archivo con check 2
  "FileClock",    // Archivo de reloj
  "FileCode",     // Archivo de código
  "FileCog",      // Archivo de engranaje
  "FileCog2",     // Archivo de engranaje 2
  "FileDiff",     // Archivo de diferencia
  "FileDigit",    // Archivo de dígito
  "FileEdit",     // Archivo de edición
  "FileHeart",    // Archivo de corazón
  "FileImage",    // Archivo de imagen
  "FileInput",    // Entrada de archivo
  "FileJson",     // Archivo JSON
  "FileJson2",    // Archivo JSON 2
  "FileKey",      // Archivo de llave
  "FileKey2",     // Archivo de llave 2
  "FileLock",     // Archivo bloqueado
  "FileLock2",    // Archivo bloqueado 2
  "FileMinus",    // Archivo menos
  "FileMinus2",   // Archivo menos 2
  "FileOutput",   // Salida de archivo
  "FilePen",      // Archivo de pluma
  "FilePenLine",  // Archivo de línea de pluma
  "FilePlus",     // Archivo más
  "FilePlus2",    // Archivo más 2
  "FileQuestion", // Archivo de pregunta
  "FileScan",     // Archivo de escaneo
  "FileSearch",   // Archivo de búsqueda
  "FileSearch2",  // Archivo de búsqueda 2
  "FileSliders",  // Archivo de controles deslizantes
  "FileStack",    // Pila de archivos
  "FileSymlink",  // Archivo de enlace simbólico
  "FileTerminal", // Archivo de terminal
  "FileText",     // Archivo de texto
  "FileType",     // Tipo de archivo
  "FileType2",    // Tipo de archivo 2
  "FileUp",       // Archivo arriba
  "FileUp2",      // Archivo arriba 2
  "FileVideo",    // Archivo de video
  "FileVolume",   // Archivo de volumen
  "FileVolume2",  // Archivo de volumen 2
  "FileWarning",  // Archivo de advertencia
  "FileX",        // Archivo X
  "FileX2",       // Archivo X 2
  "Files",        // Archivos
  "Film",         // Película
  "Filter",       // Filtro
  "FilterX",      // Filtro X
  "Fingerprint",  // Huella dactilar
  "Flag",         // Bandera
  "FlagOff",      // Bandera apagada
  "FlagTriangleLeft", // Bandera triángulo izquierda
  "FlagTriangleRight", // Bandera triángulo derecha
  "Flame",        // Llama
  "Flashlight",   // Linterna
  "FlashlightOff",// Linterna apagada
  "FlaskConical", // Matraz cónico
  "FlaskConicalOff", // Matraz cónico apagado
  "FlaskRound",   // Matraz redondo
  "FlipHorizontal", // Voltear horizontal
  "FlipHorizontal2", // Voltear horizontal 2
  "FlipVertical", // Voltear vertical
  "FlipVertical2", // Voltear vertical 2
  "Flower",       // Flor
  "Folder",       // Carpeta
  "FolderArchive",// Carpeta de archivo
  "FolderCheck",  // Carpeta con check
  "FolderClock",  // Carpeta de reloj
  "FolderClosed", // Carpeta cerrada
  "FolderCog",    // Carpeta de engranaje
  "FolderCog2",   // Carpeta de engranaje 2
  "FolderDot",    // Carpeta con punto
  "FolderEdit",   // Carpeta de edición
  "FolderGit2",   // Carpeta Git 2
  "FolderHeart",  // Carpeta de corazón
  "FolderInput",  // Entrada de carpeta
  "FolderKanban", // Carpeta Kanban
  "FolderKey",    // Carpeta de llave
  "FolderLock",   // Carpeta bloqueada
  "FolderMinus",  // Carpeta menos
  "FolderOpen",   // Carpeta abierta
  "FolderOutput", // Salida de carpeta
  "FolderPen",    // Carpeta de pluma
  "FolderPlus",   // Carpeta más
  "FolderRoot",   // Carpeta raíz
  "FolderSearch", // Carpeta de búsqueda
  "FolderSearch2", // Carpeta de búsqueda 2
  "FolderShared", // Carpeta compartida
  "FolderSymlink",// Carpeta de enlace simbólico
  "FolderSync",   // Carpeta de sincronización
  "FolderTree",   // Árbol de carpetas
  "FolderUp",     // Carpeta arriba
  "FolderX",      // Carpeta X
  "Folders",      // Carpetas
  "Footprints",   // Huellas
  "Forklift",     // Carretilla elevadora
  "FormInput",    // Entrada de formulario
  "Forward",      // Adelante
  "Frame",        // Marco
  "Framer",       // Framer
  "Frown",        // Ceño fruncido
  "Fuel",         // Combustible
  "FunctionSquare", // Cuadrado de función
  "Gamepad",      // Gamepad
  "Gamepad2",     // Gamepad 2
  "GanttChart",   // Diagrama de Gantt
  "Gauge",        // Medidor
  "Gavel",        // Mazo
  "Gem",          // Gema
  "Ghost",        // Fantasma
  "Gift",         // Regalo
  "GitBranch",    // Rama Git
  "GitBranchPlus",// Rama Git más
  "GitCommit",    // Commit Git
  "GitCompare",   // Comparar Git
  "GitFork",      // Fork Git
  "GitGraph",     // Gráfico Git
  "GitMerge",     // Merge Git
  "GitPullRequest", // Pull Request Git
  "GitPullRequestClosed", // Pull Request Git cerrado
  "GitPullRequestDraft", // Pull Request Git borrador
  "Github",       // Github
  "Gitlab",       // Gitlab
  "GlassWater",   // Vaso de agua
  "Glasses",      // Gafas
  "Globe",        // Globo
  "Globe2",       // Globo 2
  "Grab",         // Agarrar
  "GraduationCap",// Gorro de graduación
  "Grape",        // Uva
  "Grid",         // Cuadrícula
  "Grip",         // Agarre
  "GripHorizontal", // Agarre horizontal
  "GripVertical", // Agarre vertical
  "Hammer",       // Martillo
  "Hand",         // Mano
  "HardDrive",    // Disco duro
  "HardDriveDownload", // Descarga de disco duro
  "HardDriveUpload", // Carga de disco duro
  "Haze",         // Neblina
  "HdmiPort",     // Puerto HDMI
  "Headphones",   // Auriculares
  "Heart",        // Corazón
  "HeartCrack",   // Corazón roto
  "HeartHandshake", // Corazón y apretón de manos
  "HeartOff",     // Corazón apagado
  "HelpCircle",   // Círculo de ayuda
  "HelpingHand",  // Mano de ayuda
  "Hexagon",      // Hexágono
  "Highlighter",  // Resaltador
  "History",      // Historial
  "Home",         // Casa
  "HopOff",       // Hop apagado
  "HopOn",        // Hop encendido
  "Hospital",     // Hospital
  "Hotel",        // Hotel
  "Hourglass",    // Reloj de arena
  "IceCream",     // Helado
  "Image",        // Imagen
  "ImageOff",     // Imagen apagada
  "Images",       // Imágenes
  "Inbox",        // Bandeja de entrada
  "Indent",       // Sangría
  "IndianRupee",  // Rupia india
  "Info",         // Información
  "Inspect",      // Inspeccionar
  "Instagram",    // Instagram
  "Italic",       // Cursiva
  "IterationCcw", // Iteración en sentido contrario a las agujas del reloj
  "IterationCw",  // Iteración en sentido de las agujas del reloj
  "JapaneseYen",  // Yen japonés
  "Joystick",     // Joystick
  "Kanban",       // Kanban
  "Key",          // Llave
  "KeyRound",     // Llave redonda
  "Keyboard",     // Teclado
  "Lamp",         // Lámpara
  "LampCeiling",  // Lámpara de techo
  "LampDesk",     // Lámpara de escritorio
  "LampFloor",    // Lámpara de pie
  "LampWall",     // Lámpara de pared
  "Landmark",     // Hito
  "Laptop",       // Laptop
  "Laptop2",      // Laptop 2
  "Lasso",        // Lazo
  "LassoSelect",  // Selección de lazo
  "Laugh",        // Reír
  "Layers",       // Capas
  "Layout",       // Diseño
  "LayoutDashboard", // Diseño de panel
  "LayoutGrid",   // Diseño de cuadrícula
  "LayoutList",   // Diseño de lista
  "LayoutPanel",  // Panel de diseño
  "LayoutTemplate", // Plantilla de diseño
  "Leaf",         // Hoja
  "Library",      // Biblioteca
  "LifeBuoy",     // Salvavidas
  "Lightbulb",    // Bombilla
  "LightbulbOff", // Bombilla apagada
  "LineChart",    // Gráfico de líneas
  "Link",         // Enlace
  "Link2",        // Enlace 2
  "Link2Off",     // Enlace 2 apagado
  "Linkedin",     // Linkedin
  "List",         // Lista
  "ListChecks",   // Lista de checks
  "ListEnd",      // Fin de lista
  "ListMinus",    // Lista menos
  "ListMusic",    // Lista de música
  "ListOrdered",  // Lista ordenada
  "ListPlus",     // Lista más
  "ListRestart",  // Reiniciar lista
  "ListStart",    // Inicio de lista
  "ListTodo",     // Lista de tareas
  "ListTree",     // Árbol de lista
  "ListVideo",    // Lista de video
  "ListX",        // Lista X
  "Loader",       // Cargador
  "Loader2",      // Cargador 2
  "Locate",       // Localizar
  "LocateFixed",  // Localizar fijo
  "LocateOff",    // Localizar apagado
  "Lock",         // Candado
  "LockKeyhole",  // Ojo de cerradura
  "LockKeyholeOpen", // Ojo de cerradura abierto
  "LockOpen",     // Candado abierto
  "LogIn",        // Iniciar sesión
  "LogOut",       // Cerrar sesión
  "Lollipop",     // Piruleta
  "Luggage",      // Equipaje
  "Mails",        // Correos
  "Map",          // Mapa
  "MapPin",       // Marcador de mapa
  "MapPinOff",    // Marcador de mapa apagado
  "Maximize",     // Maximizar
  "Maximize2",    // Maximizar 2
  "Medal",        // Medalla
  "Megaphone",    // Megáfono
  "Meh",          // Indiferente
  "Menu",         // Menú
  "MenuSquare",   // Cuadrado de menú
  "Merge",        // Fusionar
  "MessageCircle",// Círculo de mensaje
  "MessageSquare",// Cuadrado de mensaje
  "Mic",          // Micrófono
  "Mic2",         // Micrófono 2
  "MicOff",       // Micrófono apagado
  "Minimize",     // Minimizar
  "Minimize2",    // Minimizar 2
  "Minus",        // Menos
  "MinusCircle",  // Menos círculo
  "MinusSquare",  // Menos cuadrado
  "Monitor",      // Monitor
  "MonitorOff",   // Monitor apagado
  "MonitorSmartphone", // Monitor smartphone
  "MonitorSpeaker", // Monitor altavoz
  "Moon",         // Luna
  "MoonStar",     // Luna y estrella
  "MoreHorizontal", // Más horizontal
  "MoreVertical", // Más vertical
  "Mountain",     // Montaña
  "MountainSnow", // Montaña de nieve
  "Mouse",        // Ratón
  "MousePointer", // Puntero del ratón
  "MousePointer2",// Puntero del ratón 2
  "MousePointerClick", // Clic del puntero del ratón
  "Move",         // Mover
  "MoveDiagonal", // Mover diagonal
  "MoveDiagonal2",// Mover diagonal 2
  "MoveHorizontal", // Mover horizontal
  "MoveVertical", // Mover vertical
  "Music",        // Música
  "Navigation",   // Navegación
  "Navigation2",  // Navegación 2
  "Navigation2Off", // Navegación 2 apagada
  "NavigationOff",// Navegación apagada
  "Network",      // Red
  "Newspaper",    // Periódico
  "Nfc",          // NFC
  "Nut",          // Tuerca
  "Octagon",      // Octágono
  "Option",       // Opción
  "Outdent",      // Anular sangría
  "Package",      // Paquete
  "Package2",     // Paquete 2
  "PackageCheck", // Paquete con check
  "PackageMinus", // Paquete menos
  "PackagePlus",  // Paquete más
  "PackageSearch",// Paquete de búsqueda
  "PackageX",     // Paquete X
  "PaintBucket",  // Cubo de pintura
  "Paintbrush",   // Pincel
  "Paintbrush2",  // Pincel 2
  "Palette",      // Paleta
  "PanelBottom",  // Panel inferior
  "PanelBottomClose", // Panel inferior cerrar
  "PanelBottomOpen", // Panel inferior abrir
  "PanelLeft",    // Panel izquierdo
  "PanelLeftClose", // Panel izquierdo cerrar
  "PanelLeftOpen", // Panel izquierdo abrir
  "PanelRight",   // Panel derecho
  "PanelRightClose", // Panel derecho cerrar
  "PanelRightOpen", // Panel derecho abrir
  "PanelTop",     // Panel superior
  "PanelTopClose",// Panel superior cerrar
  "PanelTopOpen", // Panel superior abrir
  "Paperclip",    // Clip
  "Parentheses",  // Paréntesis
  "ParkingMeter", // Parquímetro
  "PartyPopper",  // Cañón de confeti
  "Pause",        // Pausar
  "PauseCircle",  // Pausar círculo
  "PauseOctagon", // Pausar octágono
  "PawPrint",     // Huella de pata
  "PcCase",       // Caja de PC
  "Pen",          // Pluma
  "PenLine",      // Línea de pluma
  "PenTool",      // Herramienta de pluma
  "Pencil",       // Lápiz
  "Percent",      // Porcentaje
  "PersonStanding", // Persona de pie
  "Phone",        // Teléfono
  "PhoneCall",    // Llamada telefónica
  "PhoneForwarded", // Teléfono reenviado
  "PhoneIncoming",// Teléfono entrante
  "PhoneMissed",  // Llamada perdida
  "PhoneOff",     // Teléfono apagado
  "PhoneOutgoing",// Teléfono saliente
  "PictureInPicture", // Imagen en imagen
  "PictureInPicture2", // Imagen en imagen 2
  "PieChart",     // Gráfico circular
  "PiggyBank",    // Hucha
  "Pin",          // Pin
  "PinOff",       // Pin apagado
  "Pipette",      // Pipeta
  "Plane",        // Avión
  "PlaneLanding", // Avión aterrizando
  "PlaneTakeoff", // Avión despegando
  "Play",         // Reproducir
  "PlayCircle",   // Reproducir círculo
  "Plug",         // Enchufe
  "Plug2",        // Enchufe 2
  "PlugZap",      // Enchufe con rayo
  "Plus",         // Más
  "PlusCircle",   // Más círculo
  "PlusSquare",   // Más cuadrado
  "Pocket",       // Bolsillo
  "PocketKnife",  // Navaja
  "Podcast",      // Podcast
  "Pointer",      // Puntero
  "Popcorn",      // Palomitas de maíz
  "Popsicle",     // Polo
  "Power",        // Encendido
  "PowerOff",     // Apagado
  "Printer",      // Impresora
  "Projector",    // Proyector
  "Puzzle",       // Rompecabezas
  "QrCode",       // Código QR
  "Quote",        // Cita
  "Radiation",    // Radiación
  "Radio",        // Radio
  "RadioReceiver",// Receptor de radio
  "RadioTower",   // Torre de radio
  "Rat",          // Rata
  "Receipt",      // Recibo
  "RectangleHorizontal", // Rectángulo horizontal
  "RectangleVertical", // Rectángulo vertical
  "Recycle",      // Reciclar
  "Redo",         // Rehacer
  "RefreshCcw",   // Refrescar en sentido contrario a las agujas del reloj
  "RefreshCw",    // Refrescar en sentido de las agujas del reloj
  "Regex",        // Regex
  "RemoveFormatting", // Eliminar formato
  "Repeat",       // Repetir
  "Repeat1",      // Repetir 1
  "Repeat2",      // Repetir 2
  "Replace",      // Reemplazar
  "ReplaceAll",   // Reemplazar todo
  "Reply",        // Responder
  "ReplyAll",     // Responder a todos
  "Rewind",       // Rebobinar
  "Ribbon",       // Cinta
  "Rocket",       // Cohete
  "RotateCcw",    // Rotar en sentido contrario a las agujas del reloj
  "RotateCw",     // Rotar en sentido de las agujas del reloj
  "Route",        // Ruta
  "RouteOff",     // Ruta apagada
  "Router",       // Router
  "Rows",         // Filas
  "Rss",          // RSS
  "Ruler",        // Regla
  "RussianRuble", // Rublo ruso
  "Sailboat",     // Velero
  "Salad",        // Ensalada
  "Sandwich",     // Sándwich
  "Satellite",    // Satélite
  "SatelliteDish",// Antena parabólica
  "Save",         // Guardar
  "SaveAll",      // Guardar todo
  "Scale",        // Escala
  "Scale3d",      // Escala 3D
  "Scaling",      // Escalado
  "Scan",         // Escanear
  "ScanBarcode",  // Escanear código de barras
  "ScanEye",      // Escanear ojo
  "ScanFace",     // Escanear cara
  "ScanLine",     // Escanear línea
  "ScanQr",       // Escanear QR
  "ScanText",     // Escanear texto
  "ScatterChart", // Gráfico de dispersión
  "School",       // Escuela
  "School2",      // Escuela 2
  "Scissors",     // Tijeras
  "ScreenShare",  // Compartir pantalla
  "ScreenShareOff", // Compartir pantalla apagado
  "Scroll",       // Desplazarse
  "Search",       // Buscar
  "SearchCode",   // Buscar código
  "SearchX",      // Buscar X
  "Send",         // Enviar
  "SendToBack",   // Enviar al fondo
  "SeparatorHorizontal", // Separador horizontal
  "SeparatorVertical", // Separador vertical
  "Server",       // Servidor
  "ServerCog",    // Servidor de engranaje
  "ServerCrash",  // Servidor caído
  "ServerOff",    // Servidor apagado
  "Settings",     // Ajustes
  "Settings2",    // Ajustes 2
  "Share",        // Compartir
  "Share2",       // Compartir 2
  "Sheet",        // Hoja
  "Shield",       // Escudo
  "ShieldAlert",  // Escudo de alerta
  "ShieldCheck",  // Escudo de check
  "ShieldClose",  // Escudo cerrado
  "ShieldOff",    // Escudo apagado
  "ShieldQuestion", // Escudo de pregunta
  "ShieldX",      // Escudo X
  "Ship",         // Barco
  "Shirt",        // Camisa
  "ShoppingBag",  // Bolsa de compras
  "ShoppingBasket", // Cesta de compras
  "ShoppingCart", // Carrito de compras
  "Shovel",       // Pala
  "ShowerHead",   // Cabezal de ducha
  "Shrink",       // Encoger
  "ShrinkAll",    // Encoger todo
  "Shuffle",      // Aleatorio
  "Sidebar",      // Barra lateral
  "SidebarClose", // Barra lateral cerrar
  "SidebarOpen",  // Barra lateral abrir
  "Sigma",        // Sigma
  "Signal",       // Señal
  "SignalHigh",   // Señal alta
  "SignalLow",    // Señal baja
  "SignalMedium", // Señal media
  "SignalZero",   // Señal cero
  "Siren",        // Sirena
  "SkipBack",     // Retroceder
  "SkipForward",  // Adelantar
  "Skull",        // Calavera
  "Slack",        // Slack
  "Slice",        // Rebanada
  "Sliders",      // Controles deslizantes
  "SlidersHorizontal", // Controles deslizantes horizontal
  "Smartphone",   // Smartphone
  "SmartphoneCharging", // Smartphone cargando
  "SmartphoneNfc",// Smartphone NFC
  "Smile",        // Sonrisa
  "Snowflake",    // Copo de nieve
  "Soup",         // Sopa
  "Space",        // Espacio
  "Sparkles",     // Destellos
  "Speaker",      // Altavoz
  "Speech",       // Discurso
  "Split",        // Dividir
  "SplitSquareHorizontal", // Dividir cuadrado horizontal
  "SplitSquareVertical", // Dividir cuadrado vertical
  "Square",       // Cuadrado
  "SquareDot",    // Cuadrado con punto
  "SquareStack",  // Pila de cuadrados
  "Squirrel",     // Ardilla
  "Star",         // Estrella
  "StarHalf",     // Media estrella
  "StarOff",      // Estrella apagada
  "Stars",        // Estrellas
  "Sticker",      // Pegatina
  "StickyNote",   // Nota adhesiva
  "StopCircle",   // Detener círculo
  "Store",        // Tienda
  "StretchHorizontal", // Estirar horizontal
  "StretchHorizontalSquare", // Estirar cuadrado horizontal
  "StretchVertical", // Estirar vertical
  "StretchVerticalSquare", // Estirar cuadrado vertical
  "Strikethrough",// Tachado
  "Subscript",    // Subíndice
  "Sun",          // Sol
  "SunDim",       // Sol tenue
  "SunMedium",    // Sol medio
  "Sunrise",      // Amanecer
  "Sunset",       // Atardecer
  "Superscript",  // Superíndice
  "SwatchBook",   // Libro de muestras
  "SwissFranc",   // Franco suizo
  "SwitchCamera", // Cambiar cámara
  "Sword",        // Espada
  "Swords",       // Espadas
  "Syringe",      // Jeringa
  "Table",        // Tabla
  "Table2",       // Tabla 2
  "TableProperties", // Propiedades de tabla
  "Tablet",       // Tablet
  "TabletSmartphone", // Tablet smartphone
  "Tag",          // Etiqueta
  "Tags",         // Etiquetas
  "Target",       // Objetivo
  "Tent",         // Tienda de campaña
  "Terminal",     // Terminal
  "TerminalSquare", // Terminal cuadrado
  "TestTube",     // Tubo de ensayo
  "TestTube2",    // Tubo de ensayo 2
  "TestTubes",    // Tubos de ensayo
  "Text",         // Texto
  "TextAlignCenter", // Alinear texto centro
  "TextAlignJustify", // Alinear texto justificar
  "TextAlignLeft", // Alinear texto izquierda
  "TextAlignRight", // Alinear texto derecha
  "TextCursor",   // Cursor de texto
  "TextCursorInput", // Entrada de cursor de texto
  "TextQuote",    // Cita de texto
  "TextSelect",   // Seleccionar texto
  "Thermometer",  // Termómetro
  "ThermometerSnowflake", // Termómetro de nieve
  "ThermometerSun", // Termómetro de sol
  "ThumbsDown",   // Pulgar abajo
  "ThumbsUp",     // Pulgar arriba
  "Ticket",       // Boleto
  "Timer",        // Temporizador
  "TimerOff",     // Temporizador apagado
  "TimerReset",   // Reiniciar temporizador
  "ToggleLeft",   // Alternar izquierda
  "ToggleRight",  // Alternar derecha
  "Tornado",      // Tornado
  "ToyBrick",     // Ladrillo de juguete
  "Train",        // Tren
  "TrainFront",   // Parte delantera del tren
  "TrainFrontTunnel", // Túnel de la parte delantera del tren
  "TrainTrack",   // Vía de tren
  "Tram",         // Tranvía
  "Trash",        // Papelera
  "Trash2",       // Papelera 2
  "TreeDeciduous",// Árbol de hoja caduca
  "TreePine",     // Pino
  "Trees",        // Árboles
  "Trello",       // Trello
  "TrendingDown", // Tendencia a la baja
  "TrendingUp",   // Tendencia al alza
  "Triangle",     // Triángulo
  "TriangleRight",// Triángulo derecho
  "Truck",        // Camión
  "Tvm",          // TVM
  "Twitch",       // Twitch
  "Twitter",      // Twitter
  "Type",         // Tipo
  "TypeOff",      // Tipo apagado
  "Underline",    // Subrayar
  "Undo",         // Deshacer
  "Undo2",        // Deshacer 2
  "Unlink",       // Desenlazar
  "Unlink2",      // Desenlazar 2
  "Unlock",       // Desbloquear
  "Upload",       // Subir
  "UploadCloud",  // Subir nube
  "Usb",          // USB
  "User",         // Usuario
  "UserCheck",    // Usuario con check
  "UserCog",      // Usuario con engranaje
  "UserMinus",    // Usuario menos
  "UserPlus",     // Usuario más
  "UserX",        // Usuario X
  "Users",        // Usuarios
  "Utensils",     // Utensilios
  "UtensilsCrossed", // Utensilios cruzados
  "Vegan",        // Vegano
  "VenetianMask", // Máscara veneciana
  "Verified",     // Verificado
  "Vibrate",      // Vibrar
  "Video",        // Video
  "VideoOff",     // Video apagado
  "View",         // Vista
  "Voicemail",    // Buzón de voz
  "Volume",       // Volumen
  "Volume1",      // Volumen 1
  "Volume2",      // Volumen 2
  "VolumeX",      // Volumen X
  "Wallet",       // Billetera
  "Wallet2",      // Billetera 2
  "WalletCards",  // Tarjetas de billetera
  "Wallpaper",    // Fondo de pantalla
  "Wand",         // Varita
  "Wand2",        // Varita 2
  "Warehouse",    // Almacén
  "Watch",        // Reloj
  "Waves",        // Olas
  "Webcam",       // Cámara web
  "Webhook",      // Webhook
  "Weight",       // Peso
  "Wheat",        // Trigo
  "Wifi",         // Wifi
  "WifiOff",      // Wifi apagado
  "Wind",         // Viento
  "Wine",         // Vino
  "Workflow",     // Flujo de trabajo
  "Wrench",       // Llave inglesa
  "X",            // X
  "XCircle",      // X círculo
  "XOctagon",     // X octágono
  "XSquare",      // X cuadrado
  "Youtube",      // Youtube
  "Zap",          // Rayo
  "ZapOff",       // Rayo apagado
  "ZoomIn",       // Acercar
  "ZoomOut",      // Alejar
];

// Filter the curated list to only include icons that actually exist in lucideIconMap
const availableLucideIcons = curatedIconNames.filter(iconName => lucideIconMap[iconName]);

interface LucideIconPickerProps {
  selectedIcon: string;
  onSelectIcon: (iconName: string) => void;
}

const LucideIconPicker: React.FC<LucideIconPickerProps> = ({ selectedIcon, onSelectIcon }) => {
  const [search, setSearch] = useState("");

  const CurrentIcon = selectedIcon ? lucideIconMap[selectedIcon] : null;

  const filteredIcons = useMemo(() => {
    return availableLucideIcons.filter(iconName =>
      iconName.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, availableLucideIcons]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start">
          {CurrentIcon ? <CurrentIcon className="mr-2 h-4 w-4" /> : null}
          {selectedIcon || "Seleccionar Icono"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Input
          placeholder="Buscar icono..."
          className="mb-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ScrollArea className="h-[200px]">
          <div className="grid grid-cols-4 gap-2 p-2">
            {filteredIcons.map((iconName) => {
              const IconComponent = lucideIconMap[iconName];
              if (!IconComponent) return null;

              return (
                <Button
                  key={iconName}
                  variant="ghost"
                  size="icon"
                  onClick={() => onSelectIcon(iconName)}
                  className={cn(selectedIcon === iconName && "bg-accent")}
                >
                  <IconComponent className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default LucideIconPicker;