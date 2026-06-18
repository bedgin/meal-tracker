import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getIngredient, getIngredients } from "@/app/actions/ingredients";
import IngredientForm from "@/app/components/ingredient-form";

export default async function EditIngredientPage({
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

  const [ingredient, ingredients] = await Promise.all([
    getIngredient(id),
    getIngredients(),
  ]);

  if (!ingredient) notFound();

  return (
    <IngredientForm
      ingredient={ingredient}
      existingIngredients={ingredients}
      returnTo={returnTo || "/"}
    />
  );
}
