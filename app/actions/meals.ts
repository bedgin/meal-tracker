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

export type MealItemInput = {
  itemType: "food" | "recipe" | "custom";
  foodId?: string;
  recipeId?: string;
  customName?: string;
  customCalories?: number;
  customProtein?: number;
  servingsMultiplier: number;
};

export type MealInput = {
  date: string; // "YYYY-MM-DD"
  time: string; // ISO datetime string
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack";
  items: MealItemInput[];
};

async function snapshotCalories(item: MealItemInput) {
  if (item.itemType === "food" && item.foodId) {
    const food = await prisma.food.findUnique({ where: { id: item.foodId } });
    if (!food) throw new Error(`Food ${item.foodId} not found`);
    return {
      caloriesSnapshot: food.caloriesPerServing * item.servingsMultiplier,
      proteinSnapshot: food.proteinPerServing * item.servingsMultiplier,
    };
  }

  if (item.itemType === "recipe" && item.recipeId) {
    const recipe = await prisma.recipe.findUnique({
      where: { id: item.recipeId },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!recipe) throw new Error(`Recipe ${item.recipeId} not found`);
    const { caloriesPerServing, proteinPerServing } = calcRecipeNutrition(
      recipe.ingredients,
      recipe.servings
    );
    return {
      caloriesSnapshot: caloriesPerServing * item.servingsMultiplier,
      proteinSnapshot: proteinPerServing * item.servingsMultiplier,
    };
  }

  if (item.itemType === "custom") {
    return {
      caloriesSnapshot: item.customCalories ?? 0,
      proteinSnapshot: item.customProtein ?? 0,
    };
  }

  throw new Error("Invalid meal item");
}

export async function logMeal(data: MealInput) {
  const userId = await requireUserId();

  // Build snapshots for all items (preserves nutrition at time of logging)
  const itemsWithSnapshots = await Promise.all(
    data.items.map(async (item) => {
      const snapshot = await snapshotCalories(item);
      return { ...item, ...snapshot };
    })
  );

  const meal = await prisma.meal.create({
    data: {
      userId,
      date: new Date(data.date),
      time: new Date(data.time),
      mealType: data.mealType,
      mealItems: {
        create: itemsWithSnapshots.map((item) => ({
          itemType: item.itemType,
          foodId: item.foodId ?? null,
          recipeId: item.recipeId ?? null,
          customName: item.customName ?? null,
          servingsMultiplier: item.servingsMultiplier,
          caloriesSnapshot: item.caloriesSnapshot,
          proteinSnapshot: item.proteinSnapshot,
        })),
      },
    },
    include: {
      mealItems: {
        include: { food: true, recipe: true },
      },
    },
  });

  revalidatePath("/");
  return meal;
}

export async function updateMeal(id: string, data: MealInput) {
  const userId = await requireUserId();

  const existing = await prisma.meal.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Not found");

  const itemsWithSnapshots = await Promise.all(
    data.items.map(async (item) => {
      const snapshot = await snapshotCalories(item);
      return { ...item, ...snapshot };
    })
  );

  // Replace all items
  await prisma.mealItem.deleteMany({ where: { mealId: id } });

  const meal = await prisma.meal.update({
    where: { id },
    data: {
      date: new Date(data.date),
      time: new Date(data.time),
      mealType: data.mealType,
      mealItems: {
        create: itemsWithSnapshots.map((item) => ({
          itemType: item.itemType,
          foodId: item.foodId ?? null,
          recipeId: item.recipeId ?? null,
          customName: item.customName ?? null,
          servingsMultiplier: item.servingsMultiplier,
          caloriesSnapshot: item.caloriesSnapshot,
          proteinSnapshot: item.proteinSnapshot,
        })),
      },
    },
    include: {
      mealItems: {
        include: { food: true, recipe: true },
      },
    },
  });

  revalidatePath("/");
  return meal;
}

export async function deleteMeal(id: string) {
  const userId = await requireUserId();
  await prisma.meal.deleteMany({ where: { id, userId } });
  revalidatePath("/");
}

export async function getMeal(id: string) {
  const userId = await requireUserId();
  return prisma.meal.findFirst({
    where: { id, userId },
    include: {
      mealItems: {
        include: {
          food: true,
          recipe: { include: { ingredients: true } },
        },
      },
    },
  });
}

export async function getMealsByDate(date: string) {
  const userId = await requireUserId();
  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  return prisma.meal.findMany({
    where: {
      userId,
      date: { gte: start, lt: end },
    },
    include: {
      mealItems: {
        include: { food: true, recipe: true },
      },
    },
    orderBy: { time: "asc" },
  });
}

export async function getDailyTotals(date: string) {
  const meals = await getMealsByDate(date);

  let totalCalories = 0;
  let totalProtein = 0;

  for (const meal of meals) {
    for (const item of meal.mealItems) {
      totalCalories += item.caloriesSnapshot;
      totalProtein += item.proteinSnapshot;
    }
  }

  return { totalCalories, totalProtein, meals };
}

/** Returns the meal types logged for a date — used for mealType default. */
export async function getMealTypesForDate(date: string): Promise<string[]> {
  const userId = await requireUserId();
  const start = new Date(date);
  const end = new Date(date);
  end.setDate(end.getDate() + 1);

  const meals = await prisma.meal.findMany({
    where: { userId, date: { gte: start, lt: end } },
    select: { mealType: true },
  });
  return meals.map((m) => m.mealType);
}
