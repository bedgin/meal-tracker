import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFoods } from "@/app/actions/foods";
import { getRecipes } from "@/app/actions/recipes";
import { getMealCountForDate } from "@/app/actions/meals";
import MealForm from "@/app/components/meal-form";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function defaultMealType(count: number): "Breakfast" | "Lunch" | "Dinner" | "Snack" {
  if (count === 0) return "Breakfast";
  if (count === 1) return "Lunch";
  if (count === 2) return "Dinner";
  return "Snack";
}

function roundedTime(): string {
  const now = new Date();
  const ms = now.getTime();
  const quarter = 15 * 60 * 1000;
  const rounded = new Date(Math.floor(ms / quarter) * quarter);
  return rounded.toTimeString().slice(0, 5); // "HH:MM"
}

export default async function NewMealPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; returnTo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { date: dateParam, returnTo } = await searchParams;
  const date = dateParam || todayStr();

  const [foods, recipes, mealCount] = await Promise.all([
    getFoods(),
    getRecipes(),
    getMealCountForDate(date),
  ]);

  return (
    <MealForm
      foods={foods}
      recipes={recipes}
      defaultDate={date}
      defaultTime={roundedTime()}
      defaultMealType={defaultMealType(mealCount)}
      returnTo={returnTo || "/"}
    />
  );
}
