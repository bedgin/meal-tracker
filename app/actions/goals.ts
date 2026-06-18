"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

export async function getGoalForDate(date: string) {
  const userId = await requireUserId();
  return prisma.goal.findUnique({
    where: { userId_date: { userId, date: new Date(date) } },
  });
}

export async function setGoalForDate(
  date: string,
  calorieGoal: number | null,
  proteinGoal: number | null
) {
  const userId = await requireUserId();

  const goal = await prisma.goal.upsert({
    where: { userId_date: { userId, date: new Date(date) } },
    update: { calorieGoal, proteinGoal },
    create: { userId, date: new Date(date), calorieGoal, proteinGoal },
  });

  revalidatePath("/");
  return goal;
}

/**
 * Gets the most recent goal on or before the given date.
 * Used to carry forward a goal when none is explicitly set for a day.
 */
export async function getEffectiveGoalForDate(date: string) {
  const userId = await requireUserId();

  return prisma.goal.findFirst({
    where: {
      userId,
      date: { lte: new Date(date) },
    },
    orderBy: { date: "desc" },
  });
}
