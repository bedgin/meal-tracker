import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getDailyTotals } from "@/app/actions/meals";
import { getEffectiveGoalForDate } from "@/app/actions/goals";
import DateNav from "@/app/components/date-nav";
import GoalEditor from "@/app/components/goal-editor";

function MacroBar({
  consumed,
  goal,
  color,
}: {
  consumed: number;
  goal: number | null;
  color: string;
}) {
  if (!goal) return null;
  const pct = Math.min(100, (consumed / goal) * 100);
  const over = consumed > goal;
  return (
    <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${over ? "bg-red-400" : color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { date: dateParam } = await searchParams;
  const today = new Date().toISOString().split("T")[0];
  const date = dateParam || today;

  const [{ totalCalories, totalProtein }, goal] = await Promise.all([
    getDailyTotals(date),
    getEffectiveGoalForDate(date),
  ]);

  const calorieGoal = goal?.calorieGoal ?? null;
  const proteinGoal = goal?.proteinGoal ?? null;
  const caloriesRemaining =
    calorieGoal !== null ? calorieGoal - totalCalories : null;
  const proteinRemaining =
    proteinGoal !== null ? proteinGoal - totalProtein : null;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <main className="min-h-screen flex flex-col bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <form action={handleSignOut}>
          <button
            type="submit"
            className="text-sm text-gray-400 hover:text-gray-600 px-1 py-1"
          >
            Sign out
          </button>
        </form>
        <DateNav date={date} today={today} />
        {/* spacer to balance sign-out button */}
        <div className="w-16" />
      </header>

      {/* Macro cards */}
      <div className="flex-1 px-4 py-5 space-y-4">
        {/* Calories */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Calories
              </p>
              <p className="text-5xl font-bold text-gray-900 mt-1 tabular-nums">
                {Math.round(totalCalories).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">consumed</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Goal
              </p>
              <GoalEditor date={date} type="calorie" currentGoal={calorieGoal} />
            </div>
          </div>

          <MacroBar
            consumed={totalCalories}
            goal={calorieGoal}
            color="bg-blue-500"
          />

          {caloriesRemaining !== null && (
            <p
              className={`text-sm mt-2 font-medium ${
                caloriesRemaining < 0 ? "text-red-500" : "text-gray-500"
              }`}
            >
              {caloriesRemaining < 0
                ? `${Math.abs(Math.round(caloriesRemaining)).toLocaleString()} over goal`
                : `${Math.round(caloriesRemaining).toLocaleString()} remaining`}
            </p>
          )}
        </div>

        {/* Protein */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                Protein
              </p>
              <p className="text-5xl font-bold text-gray-900 mt-1 tabular-nums">
                {Math.round(totalProtein)}
                <span className="text-2xl font-medium text-gray-400">g</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">consumed</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">
                Goal
              </p>
              <GoalEditor date={date} type="protein" currentGoal={proteinGoal} />
            </div>
          </div>

          <MacroBar
            consumed={totalProtein}
            goal={proteinGoal}
            color="bg-green-500"
          />

          {proteinRemaining !== null && (
            <p
              className={`text-sm mt-2 font-medium ${
                proteinRemaining < 0 ? "text-red-500" : "text-gray-500"
              }`}
            >
              {proteinRemaining < 0
                ? `${Math.abs(Math.round(proteinRemaining))}g over goal`
                : `${Math.round(proteinRemaining)}g remaining`}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-10 space-y-3">
        <Link href={`/details?date=${date}`} className="block">
          <button className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm bg-white hover:bg-gray-50 active:bg-gray-100">
            See Details
          </button>
        </Link>

        <Link href={`/meal/new?date=${date}`} className="block">
          <button className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-xl shadow-sm hover:bg-blue-700 active:bg-blue-800">
            + Add Meal
          </button>
        </Link>

        <div className="grid grid-cols-3 gap-2">
          <Link href="/recipe/new" className="block">
            <button className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm bg-white hover:bg-gray-50 active:bg-gray-100">
              + Recipe
            </button>
          </Link>
          <Link href="/food/new" className="block">
            <button className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm bg-white hover:bg-gray-50 active:bg-gray-100">
              + Food
            </button>
          </Link>
          <Link href="/ingredient/new" className="block">
            <button className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm bg-white hover:bg-gray-50 active:bg-gray-100">
              + Ingredient
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
