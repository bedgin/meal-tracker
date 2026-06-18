import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getIngredients } from "@/app/actions/ingredients";
import IngredientForm from "@/app/components/ingredient-form";

export default async function NewIngredientPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { returnTo } = await searchParams;
  const ingredients = await getIngredients();

  return (
    <IngredientForm existingIngredients={ingredients} returnTo={returnTo || "/"} />
  );
}
