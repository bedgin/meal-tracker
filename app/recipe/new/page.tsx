import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getIngredients } from "@/app/actions/ingredients";
import RecipeForm from "@/app/components/recipe-form";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { returnTo } = await searchParams;
  const allIngredients = await getIngredients();

  return (
    <RecipeForm allIngredients={allIngredients} returnTo={returnTo || "/"} />
  );
}
