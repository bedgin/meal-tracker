import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFoods } from "@/app/actions/foods";
import { getRecipes } from "@/app/actions/recipes";
import { getMealTypesForDate } from "@/app/actions/meals";
import MealForm from "@/app/components/meal-form";

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

const SEQUENCE = ["Breakfast", "Lunch", "Dinner"] as const;

/**
 * Pick the next meal type based on what's already been logged.
 * Snacks are ignored — we step through Breakfast → Lunch → Dinner in order.
 * "Next" means the one after the highest-sequence meal that exists.
 * - Nothing logged → Breakfast
 * - Dinner (or all three) logged → Snack
 * - e.g. only Lunch logged → Dinner (next after the highest = Lunch)
 */
function defaultMealType(
  loggedTypes: string[]
): "Breakfast" | "Lunch" | "Dinner" | "Snack" {
  const nonSnack = loggedTypes.filter((t) => t !== "Snack");
  let highestIdx = -1;
  for (const t of nonSnack) {
    const idx = SEQUENCE.indexOf(t as (typeof SEQUENCE)[number]);
    if (idx > highestIdx) highestIdx = idx;
  }
  if (highestIdx === -1) return "Breakfast";
  if (highestIdx >= SEQUENCE.length - 1) return "Snack";
  return SEQUENCE[highestIdx + 1];
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

  const [foods, recipes, mealTypes] = await Promise.all([
    getFoods(),
    getRecipes(),
    getMealTypesForDate(date),
  ]);

  return (
    <MealForm
      foods={foods}
      recipes={recipes}
      defaultDate={date}
      defaultMealType={defaultMealType(mealTypes)}
      returnTo={returnTo || "/"}
    />
  );
}
