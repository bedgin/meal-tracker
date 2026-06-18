"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { calcRecipeNutrition } from "@/lib/nutrition";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type RecipeIngredientInput = {
  ingredientId: string;
  amountMeasure?: number | null;
  measureUnit?: string | null;
  amountWeight?: number | null;
  weightUnit?: string | null;
};

export type RecipeInput = {
  name: string;
  servings: number;
  instructions?: string | null;
  isFavorite?: boolean;
  ingredients: RecipeIngredientInput[];
};

const recipeWithIngredients = {
  ingredients: {
    include: { ingredient: true },
  },
} as const;

export async function getRecipes() {
  const userId = await requireUserId();
  return prisma.recipe.findMany({
    where: { userId },
    include: recipeWithIngredients,
    orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
  });
}

export async function getRecipe(id: string) {
  const userId = await requireUserId();
  return prisma.recipe.findFirst({
    where: { id, userId },
    include: recipeWithIngredients,
  });
}

export async function createRecipe(data: RecipeInput) {
  const userId = await requireUserId();

  const recipe = await prisma.recipe.create({
    data: {
      name: data.name,
      servings: data.servings,
      instructions: data.instructions ?? null,
      isFavorite: data.isFavorite ?? false,
      userId,
      ingredients: {
        create: data.ingredients.map((ing) => ({
          ingredientId: ing.ingredientId,
          amountMeasure: ing.amountMeasure ?? null,
          measureUnit: ing.measureUnit ?? null,
          amountWeight: ing.amountWeight ?? null,
          weightUnit: ing.weightUnit ?? null,
        })),
      },
    },
    include: recipeWithIngredients,
  });

  revalidatePath("/");
  return recipe;
}

export async function updateRecipe(id: string, data: RecipeInput) {
  const userId = await requireUserId();

  // Verify ownership
  const existing = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Not found");

  // Replace all ingredients (simplest correct approach)
  await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });

  const recipe = await prisma.recipe.update({
    where: { id },
    data: {
      name: data.name,
      servings: data.servings,
      instructions: data.instructions ?? null,
      isFavorite: data.isFavorite ?? false,
      ingredients: {
        create: data.ingredients.map((ing) => ({
          ingredientId: ing.ingredientId,
          amountMeasure: ing.amountMeasure ?? null,
          measureUnit: ing.measureUnit ?? null,
          amountWeight: ing.amountWeight ?? null,
          weightUnit: ing.weightUnit ?? null,
        })),
      },
    },
    include: recipeWithIngredients,
  });

  revalidatePath("/");
  return recipe;
}

export async function deleteRecipe(id: string) {
  const userId = await requireUserId();

  const referenced = await prisma.mealItem.findFirst({
    where: { recipeId: id },
  });
  if (referenced) {
    return {
      error:
        "This recipe has been logged in one or more meals and cannot be deleted.",
    };
  }

  await prisma.recipe.deleteMany({ where: { id, userId } });
  revalidatePath("/");
  return { success: true };
}

export async function toggleRecipeFavorite(id: string) {
  const userId = await requireUserId();
  const recipe = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!recipe) throw new Error("Not found");

  await prisma.recipe.update({
    where: { id },
    data: { isFavorite: !recipe.isFavorite },
  });
  revalidatePath("/");
}

/** Returns estimated calories/protein per serving for a recipe. */
export async function getRecipeNutrition(
  id: string
): Promise<{ caloriesPerServing: number; proteinPerServing: number }> {
  const userId = await requireUserId();
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId },
    include: recipeWithIngredients,
  });
  if (!recipe) throw new Error("Not found");
  return calcRecipeNutrition(recipe.ingredients, recipe.servings);
}
