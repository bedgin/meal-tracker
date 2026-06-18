import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getFood, getFoods } from "@/app/actions/foods";
import FoodForm from "@/app/components/food-form";

export default async function EditFoodPage({
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

  const [food, foods] = await Promise.all([getFood(id), getFoods()]);

  if (!food) notFound();

  return (
    <FoodForm food={food} existingFoods={foods} returnTo={returnTo || "/"} />
  );
}
