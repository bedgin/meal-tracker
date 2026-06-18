import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getIngredients } from "@/app/actions/ingredients";
import { getFoods } from "@/app/actions/foods";
import { getRecipes } from "@/app/actions/recipes";
import LibraryClient from "./LibraryClient";

export default async function LibraryPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const [ingredients, foods, recipes] = await Promise.all([
    getIngredients(),
    getFoods(),
    getRecipes(),
  ]);

  return (
    <LibraryClient
      ingredients={ingredients}
      foods={foods}
      recipes={recipes}
    />
  );
}
