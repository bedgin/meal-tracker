import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getRecipe } from "@/app/actions/recipes";
import { getIngredients } from "@/app/actions/ingredients";
import RecipeForm from "@/app/components/recipe-form";

export default async function EditRecipePage({
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

  const [recipe, allIngredients] = await Promise.all([
    getRecipe(id),
    getIngredients(),
  ]);

  if (!recipe) notFound();

  return (
    <RecipeForm
      recipe={recipe}
      allIngredients={allIngredients}
      returnTo={returnTo || "/"}
    />
  );
}
