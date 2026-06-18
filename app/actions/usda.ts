"use server";

import { auth } from "@/auth";

async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
}

export type UsdaResult = {
  fdcId: number;
  description: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  caloriesPerServing: number | null;
  proteinPerServing: number | null;
};

const NUTRIENT_ENERGY = 1008; // kcal
const NUTRIENT_PROTEIN = 1003; // g

function getNutrientValue(
  nutrients: Array<{ nutrientId: number; value: number }>,
  id: number
): number | null {
  const found = nutrients.find((n) => n.nutrientId === id);
  return found?.value ?? null;
}

export async function searchUsdaFoods(query: string): Promise<{
  results: UsdaResult[];
  error?: string;
}> {
  await requireAuth();

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return { results: [], error: "USDA API key not configured." };
  }

  if (!query.trim()) return { results: [] };

  try {
    const params = new URLSearchParams({
      query,
      api_key: apiKey,
      pageSize: "15",
      dataType: "Branded,SR Legacy,Foundation",
    });

    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?${params}`,
      { next: { revalidate: 3600 } } // cache results for 1 hour
    );

    if (!res.ok) {
      return { results: [], error: "Nutrition lookup failed. Try again." };
    }

    const data = await res.json();
    const foods = data.foods ?? [];

    const results: UsdaResult[] = foods.map(
      (food: {
        fdcId: number;
        description: string;
        brandOwner?: string;
        servingSize?: number;
        servingSizeUnit?: string;
        foodNutrients: Array<{ nutrientId: number; value: number }>;
      }) => {
        const caloriesPer100g = getNutrientValue(
          food.foodNutrients,
          NUTRIENT_ENERGY
        );
        const proteinPer100g = getNutrientValue(
          food.foodNutrients,
          NUTRIENT_PROTEIN
        );

        // Compute per-serving values if serving size is available and in grams
        let caloriesPerServing: number | null = null;
        let proteinPerServing: number | null = null;

        if (
          food.servingSize &&
          food.servingSizeUnit?.toLowerCase() === "g" &&
          caloriesPer100g !== null &&
          proteinPer100g !== null
        ) {
          const ratio = food.servingSize / 100;
          caloriesPerServing = Math.round(caloriesPer100g * ratio);
          proteinPerServing = Math.round(proteinPer100g * ratio * 10) / 10;
        }

        return {
          fdcId: food.fdcId,
          description: food.description,
          brandOwner: food.brandOwner,
          servingSize: food.servingSize,
          servingSizeUnit: food.servingSizeUnit,
          caloriesPer100g,
          proteinPer100g,
          caloriesPerServing,
          proteinPerServing,
        };
      }
    );

    return { results };
  } catch {
    return { results: [], error: "Nutrition lookup failed. Try again." };
  }
}
