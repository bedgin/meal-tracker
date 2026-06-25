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
import { ArrowLeft, Search, Star } from "lucide-react";

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
      className="p-1.5 rounded-lg transition-colors"
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        size={20}
        fill={active ? "#FF9E1B" : "none"}
        color={active ? "#FF9E1B" : "#D4C4B8"}
        strokeWidth={1.5}
      />
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
      className="px-2.5 py-1 rounded-lg font-jakarta font-semibold text-xs transition-colors"
      style={armed ? { background: "#FF5A4E", color: "#fff" } : { background: "#FBF1E9", color: "#9A897B" }}
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
  const [tab, setTab] = useState<Tab>("recipes");
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
    { key: "recipes", label: "Recipes", count: recipes.length },
    { key: "foods", label: "Foods", count: foods.length },
    { key: "ingredients", label: "Ingredients", count: ingredients.length },
  ];

  return (
    <main className="min-h-screen flex flex-col max-w-lg mx-auto" style={{ background: "#FFF7F0" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 px-5 py-3 flex items-center" style={{ background: "#FFF7F0", borderBottom: "1px solid rgba(80,40,10,0.08)" }}>
        <Link href="/" className="flex items-center gap-1 shrink-0" style={{ color: "#FF7A1A" }}>
          <ArrowLeft size={18} strokeWidth={2.5} />
          <span className="font-jakarta font-medium text-base">Back</span>
        </Link>
        <h1 className="font-fredoka font-medium absolute left-0 right-0 text-center pointer-events-none" style={{ color: "#2B2018", fontSize: 22 }}>
          Library
        </h1>
      </header>

      {/* Tab bar */}
      <div className="flex gap-2 px-5 pt-4 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleTabChange(t.key)}
            className="flex-1 py-2 font-jakarta font-semibold text-sm transition-colors"
            style={
              tab === t.key
                ? { background: "linear-gradient(135deg, #FF9446, #FF6A12)", color: "#fff", borderRadius: 12, border: "none" }
                : { background: "#fff", color: "#9A897B", borderRadius: 12, border: "1.5px solid rgba(255,122,26,0.22)" }
            }
          >
            {t.label}
            <span
              className="ml-1 text-xs"
              style={{ color: tab === t.key ? "rgba(255,255,255,0.7)" : "#B7A597" }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-5 pb-2">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3 pointer-events-none" style={{ color: "#B7A597" }} />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setDeleteError(null);
            }}
            placeholder={`Search ${tab}…`}
            className="w-full pl-9 pr-4 py-2.5 font-jakarta text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A1A]"
            style={{ border: "1.5px solid rgba(255,122,26,0.25)", borderRadius: 14, background: "#FFFCF9", color: "#2B2018" }}
          />
        </div>
      </div>

      {/* Error banner */}
      {deleteError && (
        <div className="mx-5 mb-2 px-4 py-3 font-jakarta text-sm" style={{ background: "#FFF1EA", color: "#FF5A4E", borderRadius: 16 }}>
          {deleteError}
        </div>
      )}

      {/* List */}
      <div className="flex-1 px-5 pb-6 space-y-2">
        {tab === "ingredients" && (
          <>
            {filteredIngredients.length === 0 && (
              <p className="text-center font-jakarta text-sm mt-10" style={{ color: "#B7A597" }}>
                {search ? "No results." : "No ingredients yet."}
              </p>
            )}
            {filteredIngredients.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-3"
                style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 12px rgba(80,40,10,0.06)" }}
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
                  <p className="font-jakarta font-semibold truncate" style={{ fontSize: 15, color: "#2B2018" }}>
                    {item.name}
                  </p>
                  <p className="font-jakarta" style={{ fontSize: 13, color: "#9A897B" }}>
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
              <button className="w-full py-3 font-jakarta font-medium text-sm transition-colors" style={{ border: "1.5px dashed rgba(255,122,26,0.35)", borderRadius: 14, background: "transparent", color: "#FF7A1A" }}>
                + New Ingredient
              </button>
            </Link>
          </>
        )}

        {tab === "foods" && (
          <>
            {filteredFoods.length === 0 && (
              <p className="text-center font-jakarta text-sm mt-10" style={{ color: "#B7A597" }}>
                {search ? "No results." : "No foods yet."}
              </p>
            )}
            {filteredFoods.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-3 py-3"
                style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 12px rgba(80,40,10,0.06)" }}
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
                  <p className="font-jakarta font-semibold truncate" style={{ fontSize: 15, color: "#2B2018" }}>
                    {item.name}
                  </p>
                  <p className="font-jakarta" style={{ fontSize: 13, color: "#9A897B" }}>
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
              <button className="w-full py-3 font-jakarta font-medium text-sm transition-colors" style={{ border: "1.5px dashed rgba(255,122,26,0.35)", borderRadius: 14, background: "transparent", color: "#FF7A1A" }}>
                + New Food
              </button>
            </Link>
          </>
        )}

        {tab === "recipes" && (
          <>
            {filteredRecipes.length === 0 && (
              <p className="text-center font-jakarta text-sm mt-10" style={{ color: "#B7A597" }}>
                {search ? "No results." : "No recipes yet."}
              </p>
            )}
            {filteredRecipes.map((item) => {
              const { caloriesPerServing, proteinPerServing } =
                calcRecipeNutrition(item.ingredients, item.servings);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-3"
                  style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 12px rgba(80,40,10,0.06)" }}
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
                    <p className="font-jakarta font-semibold truncate" style={{ fontSize: 15, color: "#2B2018" }}>
                      {item.name}
                    </p>
                    <p className="font-jakarta" style={{ fontSize: 13, color: "#9A897B" }}>
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
              <button className="w-full py-3 font-jakarta font-medium text-sm transition-colors" style={{ border: "1.5px dashed rgba(255,122,26,0.35)", borderRadius: 14, background: "transparent", color: "#FF7A1A" }}>
                + New Recipe
              </button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
