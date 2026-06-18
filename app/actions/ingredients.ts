"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export type IngredientInput = {
  name: string;
  servingMeasureAmount?: number | null;
  servingMeasureUnit?: string | null;
  servingWeightAmount?: number | null;
  servingWeightUnit?: string | null;
  caloriesPerServing: number;
  proteinPerServing: number;
};

export async function getIngredients() {
  const userId = await requireUserId();
  return prisma.ingredient.findMany({
    where: { userId },
    orderBy: [{ isFavorite: "desc" }, { name: "asc" }],
  });
}

export async function getIngredient(id: string) {
  const userId = await requireUserId();
  return prisma.ingredient.findFirst({ where: { id, userId } });
}

export async function createIngredient(data: IngredientInput) {
  const userId = await requireUserId();
  const ingredient = await prisma.ingredient.create({
    data: { ...data, userId },
  });
  revalidatePath("/");
  return ingredient;
}

export async function updateIngredient(id: string, data: IngredientInput) {
  const userId = await requireUserId();
  const ingredient = await prisma.ingredient.updateMany({
    where: { id, userId },
    data,
  });
  revalidatePath("/");
  return ingredient;
}

export async function deleteIngredient(id: string) {
  const userId = await requireUserId();

  const referenced = await prisma.recipeIngredient.findFirst({
    where: { ingredientId: id },
  });
  if (referenced) {
    return {
      error:
        "This ingredient is used in one or more recipes and cannot be deleted. Remove it from those recipes first.",
    };
  }

  await prisma.ingredient.deleteMany({ where: { id, userId } });
  revalidatePath("/");
  return { success: true };
}

export async function toggleIngredientFavorite(id: string) {
  const userId = await requireUserId();
  const ingredient = await prisma.ingredient.findFirst({
    where: { id, userId },
  });
  if (!ingredient) throw new Error("Not found");

  await prisma.ingredient.update({
    where: { id },
    data: { isFavorite: !ingredient.isFavorite },
  });
  revalidatePath("/");
}
