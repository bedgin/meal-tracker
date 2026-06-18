"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Ingredient, Food, Recipe, RecipeIngredient } from "@prisma/client";
import { calcRecipeNutrition } from "@/lib/nutrition";
import {
  deleteIngredient,
  toggleIngredientFavorite,
} from "@/app/actions/ingredients";
import { deleteFood, toggleFoodFavorite } from "@/app/actions/foods";
import { deleteRecipe, toggleRecipeFavorite } from "@/app/actions/recipes";

type Tab = "ingredients" | "foods" | "recipes";

type FullIngredient = Ingredient & { ingredient: Ingredient };
type FullRecipe = Recipe & {
  ingredients: (RecipeIngredient & { ingredient: Ingredient })[];
};

function servingLabel(
  item: Pick<
    Ingredient,
    | "servingMeasureAmount"
    | "servingMeasureUnit"
    | "servingWeightAmount"
    | "servingWeightUnit"
  >
): string {
  const parts: string[] = [];
  if (item.servingMeasureAmount && item.servingMeasureUnit) {
    parts.push(`${item.servingMeasureAmount} ${item.servingMeasureUnit}`);
  }
  if (item.servingWeightAmount && item.servingWeightUnit) {
    parts.push(`${item.servingWeightAmount}${item.servingWeightUnit}`);
  }
  return parts.join(" / ") || "1 serving";
}

function StarButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors"
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
    >
      <svg
        className={`w-5 h-5 ${active ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
        />
      </svg>
    </button>
  );
}

function DeleteButton({
  onDelete,
}: {
  onDelete: () => Promise<{ error?: string } | void>;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    setArmed(false);
    startTransition(async () => {
      await onDelete();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
        armed
          ? "bg-red-500 text-white"
          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      }`}
    >
      {pending ? "…" : armed ? "Confirm" : "Delete"}
    </button>
  );
}

export default function LibraryClient({
  ingredients,
  foods,
  recipes,
}: {
  ingredients: Ingredient[];
  foods: Food[];
  recipes: FullRecipe[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ingredients");
  const [search, setSearch] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function refresh() {
    router.refresh();
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    setSearch("");
    setDeleteError(null);
  }

  const q = search.toLowerCase();

  const filteredIngredients = useMemo(
    () => ingredients.filter((i) => i.name.toLowerCase().includes(q)),
    [ingredients, q]
  );
  const filteredFoods = useMemo(
    () => foods.filter((f) => f.name.toLowerCase().includes(q)),
    [foods, q]
  );
  const filteredRecipes = useMemo(
    () => recipes.filter((r) => r.name.toLowerCase().includes(q)),
    [recipes, q]
  );

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "ingredients", label: "Ingredients", count: ingredients.length },
    { key: "foods", label: "Foods", count: foods.length },
    { key: "recipes", label: "Recipes", count: recipes.length },
  ];

  return (
    <main className="min-h-screen flex flex-col bg-gray-50 max-w-lg mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
        <Link href="/" className="text-blue-600 font-medium text-sm px-1 py-1">
          ← Back
        </Link>
        <h1 className="text-sm font-semibold text-gray-700">Library</h1>
        <div className="w-14" />
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 pt-4 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t.key
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-200"
            }`}
          >
            {t.label}
            <span
              className={`ml-1 text-xs ${tab === t.key ? "text-blue-200" : "text-gray-400"}`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 pb-2">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setDeleteError(null);
          }}
          placeholder={`Search ${tab}…`}
          className="w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error banner */}
      {deleteError && (
        <div className="mx-4 mb-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {deleteError}
        </div>
      )}

      {/* List */}
      <div className="flex-1 px-4 pb-6 space-y-2">
        {tab === "ingredients" && (
          <>
            {filteredIngredients.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-10">
                {search ? "No results." : "No ingredients yet."}
              </p>
            )}
            {filteredIngredients.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl shadow-sm flex items-center gap-2 px-3 py-3"
              >
                <StarButton
                  active={item.isFavorite}
                  onClick={() =>
                    startTransition(async () => {
                      await toggleIngredientFavorite(item.id);
                      refresh();
                    })
                  }
                />
                <Link
                  href={`/ingredient/${item.id}/edit`}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {servingLabel(item)} · {Math.round(item.caloriesPerServing)} cal · {Math.round(item.proteinPerServing)}g protein
                  </p>
                </Link>
                <DeleteButton
                  onDelete={async () => {
                    const result = await deleteIngredient(item.id);
                    if (result?.error) {
                      setDeleteError(result.error);
                    } else {
                      setDeleteError(null);
                      refresh();
                    }
                  }}
                />
              </div>
            ))}
            <Link href="/ingredient/new" className="block pt-2">
              <button className="w-full py-3 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:border-blue-400 hover:text-blue-500 transition-colors">
                + New Ingredient
              </button>
            </Link>
          </>
        )}

        {tab === "foods" && (
          <>
            {filteredFoods.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-10">
                {search ? "No results." : "No foods yet."}
              </p>
            )}
            {filteredFoods.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl shadow-sm flex items-center gap-2 px-3 py-3"
              >
                <StarButton
                  active={item.isFavorite}
                  onClick={() =>
                    startTransition(async () => {
                      await toggleFoodFavorite(item.id);
                      refresh();
                    })
                  }
                />
                <Link
                  href={`/food/${item.id}/edit`}
                  className="flex-1 min-w-0"
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {servingLabel(item)} · {Math.round(item.caloriesPerServing)} cal · {Math.round(item.proteinPerServing)}g protein
                  </p>
                </Link>
                <DeleteButton
                  onDelete={async () => {
                    const result = await deleteFood(item.id);
                    if (result?.error) {
                      setDeleteError(result.error);
                    } else {
                      setDeleteError(null);
                      refresh();
                    }
                  }}
                />
              </div>
            ))}
            <Link href="/food/new" className="block pt-2">
              <button className="w-full py-3 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:border-blue-400 hover:text-blue-500 transition-colors">
                + New Food
              </button>
            </Link>
          </>
        )}

        {tab === "recipes" && (
          <>
            {filteredRecipes.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-10">
                {search ? "No results." : "No recipes yet."}
              </p>
            )}
            {filteredRecipes.map((item) => {
              const { caloriesPerServing, proteinPerServing } =
                calcRecipeNutrition(item.ingredients, item.servings);
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl shadow-sm flex items-center gap-2 px-3 py-3"
                >
                  <StarButton
                    active={item.isFavorite}
                    onClick={() =>
                      startTransition(async () => {
                        await toggleRecipeFavorite(item.id);
                        refresh();
                      })
                    }
                  />
                  <Link
                    href={`/recipe/${item.id}/edit`}
                    className="flex-1 min-w-0"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {item.ingredients.length} ingredient{item.ingredients.length !== 1 ? "s" : ""} · {item.servings} serving{item.servings !== 1 ? "s" : ""} · {Math.round(caloriesPerServing)} cal · {Math.round(proteinPerServing)}g protein ea.
                    </p>
                  </Link>
                  <DeleteButton
                    onDelete={async () => {
                      const result = await deleteRecipe(item.id);
                      if (result?.error) {
                        setDeleteError(result.error);
                      } else {
                        setDeleteError(null);
                        refresh();
                      }
                    }}
                  />
                </div>
              );
            })}
            <Link href="/recipe/new" className="block pt-2">
              <button className="w-full py-3 rounded-xl border border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:border-blue-400 hover:text-blue-500 transition-colors">
                + New Recipe
              </button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
