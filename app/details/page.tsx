import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDailyTotals } from "@/app/actions/meals";
import DeleteMealButton from "./DeleteMealButton";

const MEAL_ORDER = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
type MealType = (typeof MEAL_ORDER)[number];

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function DayDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { date: dateParam } = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date = dateParam || today;

  const { totalCalories, totalProtein, meals } = await getDailyTotals(date);

  // Group meals by type, preserving chrono order within each group
  const grouped = MEAL_ORDER.reduce(
    (acc, type) => {
      acc[type] = meals.filter((m) => m.mealType === type);
      return acc;
    },
    {} as Record<MealType, typeof meals>
  );

  const hasMeals = meals.length > 0;
  const returnTo = `/details?date=${date}`;

  return (
    <main className="min-h-screen flex flex-col bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <Link
          href={`/?date=${date}`}
          className="text-blue-600 font-medium text-sm px-1 py-1"
        >
          ← Back
        </Link>
        <h1 className="text-sm font-semibold text-gray-700">
          {formatDate(date)}
        </h1>
        <div className="w-14" />
      </header>

      {/* Daily totals bar */}
      <div className="mx-4 mt-4 bg-white rounded-2xl px-5 py-4 shadow-sm flex justify-around">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {Math.round(totalCalories).toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">calories</p>
        </div>
        <div className="w-px bg-gray-100" />
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {Math.round(totalProtein)}
            <span className="text-base font-medium text-gray-400">g</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">protein</p>
        </div>
      </div>

      {/* Meal groups */}
      <div className="flex-1 px-4 py-4 space-y-5">
        {!hasMeals && (
          <p className="text-center text-gray-400 text-sm mt-10">
            No meals logged for this day.
          </p>
        )}

        {MEAL_ORDER.map((type) => {
          const group = grouped[type];
          if (group.length === 0) return null;

          return (
            <section key={type}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
                {type}
              </h2>
              <div className="space-y-2">
                {group.map((meal) => {
                  const mealCals = meal.mealItems.reduce(
                    (s, i) => s + i.caloriesSnapshot,
                    0
                  );
                  const mealProtein = meal.mealItems.reduce(
                    (s, i) => s + i.proteinSnapshot,
                    0
                  );

                  return (
                    <div
                      key={meal.id}
                      className="bg-white rounded-2xl shadow-sm overflow-hidden"
                    >
                      {/* Meal header — tappable to edit */}
                      <Link
                        href={`/meal/${meal.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 active:bg-gray-100"
                      >
                        <span className="text-xs text-gray-400">
                          {formatTime(meal.time)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-700 tabular-nums">
                            {Math.round(mealCals).toLocaleString()} cal
                          </span>
                          <span className="text-sm text-gray-400 tabular-nums">
                            {Math.round(mealProtein)}g protein
                          </span>
                          <svg
                            className="w-4 h-4 text-gray-300"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </Link>

                      {/* Items list */}
                      <div className="border-t border-gray-50">
                        {meal.mealItems.map((item) => {
                          const name =
                            item.food?.name ?? item.recipe?.name ?? "Unknown";
                          const label =
                            item.servingsMultiplier === 1
                              ? "1 serving"
                              : `${item.servingsMultiplier}× servings`;
                          return (
                            <div
                              key={item.id}
                              className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-800 truncate">
                                  {name}
                                </p>
                                <p className="text-xs text-gray-400">{label}</p>
                              </div>
                              <div className="text-right ml-3 shrink-0">
                                <p className="text-sm font-medium text-gray-700 tabular-nums">
                                  {Math.round(item.caloriesSnapshot)} cal
                                </p>
                                <p className="text-xs text-gray-400 tabular-nums">
                                  {Math.round(item.proteinSnapshot)}g
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Delete footer */}
                      <div className="flex justify-end px-4 py-2 border-t border-gray-50">
                        <DeleteMealButton mealId={meal.id} date={date} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Add meal button */}
      <div className="px-4 pb-10">
        <Link href={`/meal/new?date=${date}&returnTo=${encodeURIComponent(returnTo)}`}>
          <button className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-xl shadow-sm hover:bg-blue-700 active:bg-blue-800">
            + Add Meal
          </button>
        </Link>
      </div>
    </main>
  );
}
