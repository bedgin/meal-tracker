import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFoods } from "@/app/actions/foods";
import FoodForm from "@/app/components/food-form";

export default async function NewFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const { returnTo } = await searchParams;
  const foods = await getFoods();

  return <FoodForm existingFoods={foods} returnTo={returnTo || "/"} />;
}
