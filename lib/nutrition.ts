// Unit conversion utilities for recipe nutrition calculations

const VOL_TO_ML: Record<string, number> = {
  cup: 236.588,
  tbsp: 14.787,
  tsp: 4.929,
};

const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  oz: 28.3495,
  lb: 453.592,
};

// Common ingredient density approximations (g/mL). Defaults to water (1).
const DENSITY_G_PER_ML: Record<string, number> = {
  flour: 0.57,
  "all-purpose flour": 0.57,
  sugar: 0.85,
  "brown sugar": 0.82,
  butter: 0.91,
  oil: 0.92,
  "olive oil": 0.91,
  milk: 1.03,
  honey: 1.42,
  salt: 1.22,
  oats: 0.41,
  rice: 0.75,
};

function getDensity(ingredientName: string): number {
  const name = ingredientName.toLowerCase();
  for (const [key, density] of Object.entries(DENSITY_G_PER_ML)) {
    if (name.includes(key)) return density;
  }
  return 1; // default: water
}

function toMl(amount: number, unit: string): number {
  return amount * (VOL_TO_ML[unit] ?? 1);
}

function toGrams(amount: number, unit: string): number {
  return amount * (WEIGHT_TO_G[unit] ?? 1);
}

const VOL_UNITS = new Set(["cup", "tbsp", "tsp"]);
const WEIGHT_UNITS = new Set(["g", "oz", "lb"]);

/**
 * Convert a recipe ingredient amount into the number of "servings" of that
 * ingredient, based on the ingredient's defined serving size.
 */
export function convertToServings(
  recipeAmount: number,
  recipeUnit: string,
  servingAmount: number,
  servingUnit: string,
  ingredientName = ""
): number {
  if (!recipeAmount || !servingAmount) return 0;

  const recipeIsVol = VOL_UNITS.has(recipeUnit);
  const servingIsVol = VOL_UNITS.has(servingUnit);
  const recipeIsWeight = WEIGHT_UNITS.has(recipeUnit);
  const servingIsWeight = WEIGHT_UNITS.has(servingUnit);

  // Same dimension — direct ratio via base units
  if (recipeIsVol && servingIsVol) {
    return toMl(recipeAmount, recipeUnit) / toMl(servingAmount, servingUnit);
  }
  if (recipeIsWeight && servingIsWeight) {
    return (
      toGrams(recipeAmount, recipeUnit) / toGrams(servingAmount, servingUnit)
    );
  }

  // Cross-dimension — use density approximation
  const density = getDensity(ingredientName);
  const recipeInGrams = recipeIsVol
    ? toMl(recipeAmount, recipeUnit) * density
    : toGrams(recipeAmount, recipeUnit);
  const servingInGrams = servingIsVol
    ? toMl(servingAmount, servingUnit) * density
    : toGrams(servingAmount, servingUnit);

  if (!servingInGrams) return 0;
  return recipeInGrams / servingInGrams;
}

export type RecipeIngredientWithIngredient = {
  amountMeasure: number | null;
  measureUnit: string | null;
  amountWeight: number | null;
  weightUnit: string | null;
  ingredient: {
    name: string;
    caloriesPerServing: number;
    proteinPerServing: number;
    servingMeasureAmount: number | null;
    servingMeasureUnit: string | null;
    servingWeightAmount: number | null;
    servingWeightUnit: string | null;
  };
};

export function calcRecipeNutrition(
  recipeIngredients: RecipeIngredientWithIngredient[],
  servings: number
): { caloriesPerServing: number; proteinPerServing: number } {
  let totalCalories = 0;
  let totalProtein = 0;

  for (const ri of recipeIngredients) {
    const ing = ri.ingredient;
    let numServings = 0;

    // Prefer measure-based conversion, fall back to weight-based
    if (
      ri.amountMeasure &&
      ri.measureUnit &&
      ing.servingMeasureAmount &&
      ing.servingMeasureUnit
    ) {
      numServings = convertToServings(
        ri.amountMeasure,
        ri.measureUnit,
        ing.servingMeasureAmount,
        ing.servingMeasureUnit,
        ing.name
      );
    } else if (
      ri.amountWeight &&
      ri.weightUnit &&
      ing.servingWeightAmount &&
      ing.servingWeightUnit
    ) {
      numServings = convertToServings(
        ri.amountWeight,
        ri.weightUnit,
        ing.servingWeightAmount,
        ing.servingWeightUnit,
        ing.name
      );
    }

    totalCalories += numServings * ing.caloriesPerServing;
    totalProtein += numServings * ing.proteinPerServing;
  }

  const s = servings || 1;
  return {
    caloriesPerServing: totalCalories / s,
    proteinPerServing: totalProtein / s,
  };
}
