import * as LucideIcons from "lucide-react";

export interface ChallengeTemplate {
  id: string;
  name: string;
  description: string;
  type: "no_spend_category" | "saving_goal";
  icon: keyof typeof LucideIcons;
  default_categories?: string[]; // Para retos de no gasto (nombres de categorías)
  default_target_amount?: number; // Para retos de ahorro
}

export const challengeTemplates: ChallengeTemplate[] = [
  {
    id: "no-netflix-more-books",
    name: "Reto: Menos Netflix y más libros",
    description: "No realices compras en la categoría 'Streaming' por 7 días.",
    type: "no_spend_category",
    icon: "Tv",
    default_categories: ["Streaming"],
  },
  {
    id: "no-more-blouses",
    name: "Reto: ¿Segur@ que necesitas esa blusa?",
    description: "Menos compras en la categoría 'Ropa' por 7 días.",
    type: "no_spend_category",
    icon: "Shirt",
    default_categories: ["Ropa"],
  },
  {
    id: "no-entertainment",
    name: "Reto: Cero gastos en entretenimiento",
    description: "El cine tendrá que esperar, no hagas compras en la categoría 'Cine' por 7 días.",
    type: "no_spend_category",
    icon: "Film",
    default_categories: ["Cine"],
  },
  {
    id: "no-apps",
    name: "Reto: Cero Apps",
    description: "Evita hacer compras en aplicaciones y registrar una compra en la categoría 'Apps' por 7 días.",
    type: "no_spend_category",
    icon: "Smartphone",
    default_categories: ["Apps"],
  },
  {
    id: "saving-goal-150",
    name: "Reto: Ahorra $150 en 7 días",
    description: "Vamos a crear un ahorro de $150 pesos, ¡complétalo!",
    type: "saving_goal",
    icon: "PiggyBank",
    default_target_amount: 150,
  },
  {
    id: "saving-goal-300",
    name: "Reto: Ahorra $300 en 7 días",
    description: "Vamos a crear un ahorro de $300 pesos, ¡complétalo!",
    type: "saving_goal",
    icon: "PiggyBank",
    default_target_amount: 300,
  },
  {
    id: "saving-goal-200",
    name: "Reto: Ahorra $200 en 7 días",
    description: "Vamos a crear un ahorro de $200 pesos, ¡complétalo!",
    type: "saving_goal",
    icon: "PiggyBank",
    default_target_amount: 200,
  },
  {
    id: "saving-goal-500",
    name: "Reto: Ahorra $500 en 7 días",
    description: "Vamos a crear un ahorro de $500 pesos, ¡complétalo!",
    type: "saving_goal",
    icon: "PiggyBank",
    default_target_amount: 500,
  },
];