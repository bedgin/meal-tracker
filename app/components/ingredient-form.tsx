"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Ingredient } from "@prisma/client";
import {
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from "@/app/actions/ingredients";
import { searchUsdaFoods, type UsdaResult } from "@/app/actions/usda";

type Props = {
  ingredient?: Ingredient;
  existingIngredients: Ingredient[];
  returnTo: string;
};

export default function IngredientForm({
  ingredient,
  existingIngredients,
  returnTo,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = !!ingredient;

  // Form fields
  const [name, setName] = useState(ingredient?.name ?? "");
  const [measureAmount, setMeasureAmount] = useState(
    ingredient?.servingMeasureAmount?.toString() ?? ""
  );
  const [measureUnit, setMeasureUnit] = useState(
    ingredient?.servingMeasureUnit ?? "cups"
  );
  const [weightAmount, setWeightAmount] = useState(
    ingredient?.servingWeightAmount?.toString() ?? ""
  );
  const [weightUnit, setWeightUnit] = useState(
    ingredient?.servingWeightUnit ?? "g"
  );
  const [calories, setCalories] = useState(
    ingredient?.caloriesPerServing?.toString() ?? ""
  );
  const [protein, setProtein] = useState(
    ingredient?.proteinPerServing?.toString() ?? ""
  );
  const [isFavorite, setIsFavorite] = useState(ingredient?.isFavorite ?? false);

  // Autocomplete
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [filtered, setFiltered] = useState<Ingredient[]>([]);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // USDA lookup
  const [usdaResults, setUsdaResults] = useState<UsdaResult[]>([]);
  const [usdaError, setUsdaError] = useState<string | null>(null);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [showUsda, setShowUsda] = useState(false);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Filter autocomplete list when name changes
  useEffect(() => {
    const q = name.toLowerCase().trim();
    setFiltered(
      existingIngredients
        .filter((i) => !q || i.name.toLowerCase().includes(q))
        .slice(0, 8)
    );
  }, [name, existingIngredients]);

  // Close autocomplete on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        !autocompleteRef.current?.contains(e.target as Node) &&
        !nameInputRef.current?.contains(e.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  function fillFromIngredient(ing: Ingredient) {
    setName(ing.name);
    setMeasureAmount(ing.servingMeasureAmount?.toString() ?? "");
    setMeasureUnit(ing.servingMeasureUnit ?? "cups");
    setWeightAmount(ing.servingWeightAmount?.toString() ?? "");
    setWeightUnit(ing.servingWeightUnit ?? "g");
    setCalories(ing.caloriesPerServing.toString());
    setProtein(ing.proteinPerServing.toString());
    setIsFavorite(ing.isFavorite);
    setShowAutocomplete(false);
  }

  async function handleUsdaLookup() {
    if (!name.trim()) return;
    setUsdaLoading(true);
    setUsdaError(null);
    setShowUsda(false);

    const { results, error: err } = await searchUsdaFoods(name.trim());
    setUsdaLoading(false);

    if (err) {
      setUsdaError(err);
    } else if (results.length === 0) {
      setUsdaError("No results found. Try a different name.");
    } else {
      setUsdaResults(results);
      setShowUsda(true);
    }
  }

  function fillFromUsda(result: UsdaResult) {
    setName(result.description);
    if (result.caloriesPerServing !== null) {
      setCalories(Math.round(result.caloriesPerServing).toString());
      setProtein((result.proteinPerServing ?? 0).toString());
      if (result.servingSize && result.servingSizeUnit?.toLowerCase() === "g") {
        setWeightAmount(result.servingSize.toString());
        setWeightUnit("g");
      }
    } else if (result.caloriesPer100g !== null) {
      setCalories(Math.round(result.caloriesPer100g).toString());
      setProtein((result.proteinPer100g ?? 0).toString());
      setWeightAmount("100");
      setWeightUnit("g");
    }
    setShowUsda(false);
  }

  function buildData() {
    return {
      name: name.trim(),
      servingMeasureAmount: measureAmount ? parseFloat(measureAmount) : null,
      servingMeasureUnit: measureAmount ? measureUnit : null,
      servingWeightAmount: weightAmount ? parseFloat(weightAmount) : null,
      servingWeightUnit: weightAmount ? weightUnit : null,
      caloriesPerServing: parseFloat(calories) || 0,
      proteinPerServing: parseFloat(protein) || 0,
      isFavorite,
    };
  }

  function validate() {
    if (!name.trim()) return "Name is required.";
    if (calories === "") return "Calories per serving is required.";
    if (protein === "") return "Protein per serving is required.";
    return null;
  }

  function handleSave() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);

    startTransition(async () => {
      const data = buildData();
      if (isEditing) {
        await updateIngredient(ingredient.id, data);
      } else {
        await createIngredient(data);
      }
      router.push(returnTo);
    });
  }

  function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteIngredient(ingredient!.id);
      if (result?.error) {
        setError(result.error);
        setDeleteConfirm(false);
      } else {
        router.push(returnTo);
      }
    });
  }

  return (
    <main className="min-h-screen bg-gray-50 max-w-lg mx-auto flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link href={returnTo} className="text-blue-600 font-medium text-sm shrink-0">
          ← Back
        </Link>
        <h1 className="text-base font-semibold text-gray-900 flex-1 truncate">
          {isEditing ? "Edit Ingredient" : "Add Ingredient"}
        </h1>
        <button
          onClick={() => setIsFavorite((f) => !f)}
          className="text-2xl shrink-0 leading-none"
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </header>

      <div className="flex-1 px-4 py-5 space-y-5 pb-4">
        {/* Name + Autocomplete */}
        <div className="relative">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Ingredient Name
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setShowAutocomplete(true)}
            placeholder="e.g. Chicken breast"
            className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {showAutocomplete && filtered.length > 0 && (
            <div
              ref={autocompleteRef}
              className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-52 overflow-y-auto"
            >
              {filtered.map((ing) => (
                <button
                  key={ing.id}
                  type="button"
                  onMouseDown={() => fillFromIngredient(ing)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {ing.name}
                  </span>
                  {ing.isFavorite && (
                    <span className="ml-1 text-yellow-400 text-xs">★</span>
                  )}
                  <span className="block text-xs text-gray-400 mt-0.5">
                    {ing.caloriesPerServing} cal · {ing.proteinPerServing}g
                    protein
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* USDA Lookup */}
        <div>
          <button
            type="button"
            onClick={handleUsdaLookup}
            disabled={usdaLoading || !name.trim()}
            className="w-full py-3 rounded-xl border border-blue-200 text-blue-600 font-medium text-sm bg-blue-50 hover:bg-blue-100 active:bg-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {usdaLoading ? "Looking up…" : "🔍  Lookup Based on Name"}
          </button>

          {usdaError && (
            <p className="text-sm text-red-500 mt-2 text-center">{usdaError}</p>
          )}

          {showUsda && (
            <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  USDA Results — tap to use
                </p>
                <button
                  onClick={() => setShowUsda(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                {usdaResults.map((result) => (
                  <button
                    key={result.fdcId}
                    type="button"
                    onClick={() => fillFromUsda(result)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100"
                  >
                    <p className="text-sm font-medium text-gray-900 leading-snug">
                      {result.description}
                    </p>
                    {result.brandOwner && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {result.brandOwner}
                      </p>
                    )}
                    <p className="text-xs text-blue-600 mt-1">
                      {result.caloriesPerServing !== null
                        ? `${Math.round(result.caloriesPerServing)} cal · ${result.proteinPerServing ?? 0}g protein / serving`
                        : result.caloriesPer100g !== null
                          ? `${Math.round(result.caloriesPer100g)} cal · ${result.proteinPer100g ?? 0}g protein / 100g`
                          : "Nutrition info unavailable"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Serving size — measurement */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Serving Size — Measurement{" "}
            <span className="text-gray-300 normal-case font-normal">
              (optional)
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={measureAmount}
              onChange={(e) => setMeasureAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <select
              value={measureUnit}
              onChange={(e) => setMeasureUnit(e.target.value)}
              className="px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="items">Items</option>
              <option value="cups">Cups</option>
              <option value="tbsp">Tablespoons</option>
              <option value="tsp">Teaspoons</option>
              <option value="scoop">Scoops</option>
            </select>
          </div>
        </div>

        {/* Serving size — weight */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Serving Size — Weight{" "}
            <span className="text-gray-300 normal-case font-normal">
              (optional)
            </span>
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={weightAmount}
              onChange={(e) => setWeightAmount(e.target.value)}
              placeholder="Amount"
              className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <select
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value)}
              className="px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="g">Grams</option>
              <option value="oz">Oz</option>
              <option value="lb">Lbs</option>
            </select>
          </div>
        </div>

        {/* Calories */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Calories Per Serving
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Protein */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Protein Per Serving (g)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </p>
        )}
      </div>

      {/* Footer buttons */}
      <div className="px-4 pb-10 pt-2 space-y-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg shadow-sm hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60"
        >
          {isPending ? "Saving…" : isEditing ? "Save Changes" : "Save Ingredient"}
        </button>

        {isEditing && (
          <button
            onClick={handleDelete}
            disabled={isPending}
            className={`w-full py-3 rounded-xl font-medium text-sm border transition-colors ${
              deleteConfirm
                ? "bg-red-600 text-white border-red-600"
                : "border-red-200 text-red-500 bg-white hover:bg-red-50"
            }`}
          >
            {deleteConfirm ? "Tap again to confirm delete" : "Delete Ingredient"}
          </button>
        )}
      </div>
    </main>
  );
}
