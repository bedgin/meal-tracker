"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type FoodInput = {
  name: string;
  servingMeasureAmount?: number | null;
  servingMeasureUnit?: string | null; // cups, tbsp, tsp, items
  servingWeightAmount?: number | null;
  servingWeightUnit?: string | null; // lb, oz, g
  caloriesPerServing: number;
  proteinPerServing: number;
  isFavorite?: boolean;
};

export async function getFoods() {
  const userId = await requireUserId();
  return prisma.food.findMany({
    where: { userId },
    orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
  });
}

export async function getFood(id: string) {
  const userId = await requireUserId();
  return prisma.food.findFirst({ where: { id, userId } });
}

export async function createFood(data: FoodInput) {
  const userId = await requireUserId();
  const food = await prisma.food.create({ data: { ...data, userId } });
  revalidatePath("/");
  return food;
}

export async function updateFood(id: string, data: FoodInput) {
  const userId = await requireUserId();
  await prisma.food.updateMany({ where: { id, userId }, data });
  revalidatePath("/");
}

export async function deleteFood(id: string) {
  const userId = await requireUserId();

  const referenced = await prisma.mealItem.findFirst({
    where: { foodId: id },
  });
  if (referenced) {
    return {
      error:
        "This food has been logged in one or more meals and cannot be deleted.",
    };
  }

  await prisma.food.deleteMany({ where: { id, userId } });
  revalidatePath("/");
  return { success: true };
}

// Upsert a food by name (used when syncing from an Ingredient record)
export async function upsertFoodByName(data: FoodInput) {
  const userId = await requireUserId();
  const existing = await prisma.food.findFirst({
    where: { userId, name: data.name },
  });
  if (existing) {
    await prisma.food.update({ where: { id: existing.id }, data });
  } else {
    await prisma.food.create({ data: { ...data, userId } });
  }
  revalidatePath("/");
}

export async function toggleFoodFavorite(id: string) {
  const userId = await requireUserId();
  const food = await prisma.food.findFirst({ where: { id, userId } });
  if (!food) throw new Error("Not found");

  await prisma.food.update({
    where: { id },
    data: { isFavorite: !food.isFavorite },
  });
  revalidatePath("/");
}
