import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getFoods } from "@/app/actions/foods";
import { getRecipes } from "@/app/actions/recipes";
import { getMeal } from "@/app/actions/meals";
import MealForm from "@/app/components/meal-form";

export default async function EditMealPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { id } = await params;
  const { returnTo } = await searchParams;

  const [meal, foods, recipes] = await Promise.all([
    getMeal(id),
    getFoods(),
    getRecipes(),
  ]);

  if (!meal) notFound();

  const dateStr = new Date(meal.date).toISOString().split("T")[0];
  const timeStr = meal.time.toISOString(); // pass UTC ISO string; client converts to local time

  return (
    <MealForm
      meal={meal}
      foods={foods}
      recipes={recipes}
      defaultDate={dateStr}
      defaultTime={timeStr}
      defaultMealType={meal.mealType as "Breakfast" | "Lunch" | "Dinner" | "Snack"}
      returnTo={returnTo || "/"}
    />
  );
}
