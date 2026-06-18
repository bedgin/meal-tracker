# Meal Tracker Web App
## Overview
This app will allow a user to efficiently track the food they eat with a focus on Calories and Protein. It is built on the idea that most people eat the same things most of the time, so adding meals should only take a few taps. It will allow users to add three categories of things: ingredients (only gets used as a part of a recipe), foods (anything that can be eaten without preparation as a part of a recipe: frozen meals, fruit, prepackaged foods, etc.) recipes (collections of ingredients and prep instructions). The tracker should show a running total of Calories and Protein throughout the day, and allow users to go back and see historical data of previous days.
## Environment
This will be a web app hosted on Vercel.com written using Next.js and React. Its needs to be responsive, but optimized for use via mobile device. 
## Screens
### Main Screen
The main screen should contain the following:
- Current Date - Tap on date to see previous days
- Calories consumed so far today
- Protein consumed so far today
- Calorie goal - Tap on goal to edit
- Protein goal - Tap on goal to edit
- Calories remaining
- Protein remaining
- Secondary button to see details
- Large button to add meal
- Secondary button to add recipe
- Secondary button to add food
- Secondary button to add ingredients
### Day Details Screen
This screen should show all meals eaten today in chronological order, grouped by breakfast, lunch, and dinner. Snack items should be shown around those meals per the time they were consumed. Users can tap on a meal to launch the Add Meal Screen with the associated meal info prefilled for edit. 
### Add Meal Screen
This screen will show the following form:
- Back (Takes the user back to the home screen)
- Date (Defaulted to today) - Tap to change
- Time (Defaulted to current time rounded to the previous quarter hour) - Tap to change
- Meal Type (Drop-list containing: Breakfast, Lunch, Dinner, Snack) For first meal of the day it should default to Breakfast, Second meal Lunch, Third meal Dinner, subsequent meals default to Snack)
- Find Food/Recipe (Open text field)
- Create New (Appears to the right of the Find Food field. Tapping this will take the user to the Add Food screen.)
- Food & Recipe List (Selection Required) (list box of all recipes and foods in the system, showing favorited items in alpha order, followed by a separator and then all remaining items in alpha order. Items listed here will narrow as the user types in the Meal text field above. Users can tap any item in this list to directly populate the Food text field. 
- Add to Meal (Button adds the selected item to the meal list.
- Meal List (A list of food & recipes that have been added. Each row has an X icon to remove it.)
- Finish Adding Meal (Primary submit button for the form.) On submit the user will be taken back to the main screen with updated data. 
### Add Recipe Screen
When this screen is completed, the user will return to the screen they were one when this one was invoked. If that originating screen was one where the user was trying to add a recipe to a list, then the newly entered recipe will automatically be added. This screen will show the following form:
- Recipe Name
- Add ingredient button (this will spawn a popup list of ingredients with a text box that will narrow the list as the user types. User will then need to select an ingredient in the list and then enter the amount by measurement (cups, tablespoons, teaspoons, etc.) and/or by weight, and hit Done to close the dialog and add the selected ingredient to the list. An add new ingredient button will need to also be displayed which will take the user to the Add Ingredient screen. 
- Ingredient list (Will show ingredient name and amount by measurement & weight if available.)
- Number of servings (drop list of 1 through 12)(Defaults to 1)
- A display of calculated calories and protein per serving. 
- Instructions text box
- Submit button
### Add Ingredient Screen
When this screen is completed, the user will return to the screen they were one when this one was invoked. If that originating screen was one where the user was trying to add an ingredient to a list, then the newly entered ingredient will automatically be added. This screen will show the following form:
- Ingredient (Open Text. When this field has focus, a drop list of ingredients is displayed showing all ingredients that might match what the user is typing in. If they select or enter anything that is already in the list, then all fields will fill and the user can edit the information.) 
- Button: Lookup Based on Name (This button will attempt to lookup the serving size, calories, and protein via web search and populate the information for the user.)
- Serving Size by measurement (open text requiring a number) with a drop list to its right containing Cups, Tablespoons, Teaspoons)
- Serving Size by weight (Open text requiring a number) with a drop list to its right containing lbs, oz, grams) 
- Calories Per Serving
- Protein Per Serving
- Save / Edit / Delete (existing ingredients can be edited or deleted; see Item Management)
- Favorite toggle
### Add Food Screen
When this screen is completed, the user will return to the screen they were one when this one was invoked. If that originating screen was one where the user was trying to add a food to a list, then the newly entered food will automatically be added. This screen will show the following form:
- Food Name (Open Text. When this field has focus, a drop list of foods is displayed showing all foods that might match what the user is typing in. If they select or enter anything that is already in the list, then all fields will fill and the user can edit the information.) 
- Button: Lookup Based on Name (This button will attempt to lookup the serving size, calories, and protein via web search and populate the information for the user.)
- Serving Size by measurement (open text requiring a number) with a drop list to its right containing Cups, Tablespoons, Teaspoons, Items)(Items would allow documentation of things like 1 banana, 24 chips, etc.)
- Serving Size by weight (Open text requiring a number) with a drop list to its right containing lbs, oz, grams) 
- Calories Per Serving
- Protein Per Serving
- Save / Edit / Delete (existing foods can be edited or deleted; see Item Management)
- Favorite toggle

---

# Technical Decisions & Clarifications
_The following section resolves gaps in the original spec above. Where this section conflicts with anything above, this section wins._

## Tech Stack & Hosting
- Next.js (App Router) + React, deployed on Vercel.
- Responsive, mobile-first layout.
- Database: a hosted Postgres (e.g. Vercel Postgres / Neon / Supabase) accessed via an ORM (Prisma recommended).
- Use Vercel environment variables for all secrets (DB URL, USDA API key, auth secrets).

## Authentication & Users
- Multi-user. Every user signs in (NextAuth/Auth.js recommended; email or OAuth provider acceptable).
- All data is scoped per user. A user only ever sees and edits their own ingredients, foods, recipes, meals, and goals.
- Unauthenticated users are redirected to a sign-in page.

## Data Library Scope
- Private per user: each user has their own library of ingredients, foods, and recipes. Nothing is shared between users.

## Daily Goals
- No preset defaults. On first use, calorie and protein goals are blank/zero until the user sets them.
- Goals are edited inline from the Main Screen (tap the goal value). Persist per user. Historical days should reflect the goal that was in effect on that day (store the goal on the day record, or keep a goal-history table).

## Nutrition Lookup ("Lookup Based on Name")
- Source: USDA FoodData Central API (requires an API key in env vars).
- Behavior: on tapping the button, query FDC by the entered name, return the top matches, and let the user pick one. On selection, populate serving size, calories, and protein. All fields remain editable afterward.
- Handle the no-result / API-error case gracefully (show a message, fall back to manual entry).

## Adding Items to a Meal — Quantity
- Each item added to a meal has a **servings multiplier** field (numeric, allows decimals, defaults to 1).
- The item's calories and protein are multiplied by this value when totaled.
- Meal List rows show: item name, servings multiplier, and resulting calories/protein. The X icon removes the row.

## Recipe Calorie/Protein Calculation (unit handling)
- Ingredients store nutrition per serving, with serving size by measurement and/or by weight.
- Recipes reference ingredients by an entered amount (measurement and/or weight).
- Conversion is **best-effort**: convert the recipe amount into a number of the ingredient's servings, using:
  - direct ratio when the recipe amount and the ingredient serving size use the same dimension (both weight, or both volume);
  - generic density approximations when crossing volume↔weight (maintain a small lookup table of common densities; default to water density ~1 g/mL when unknown).
- Recipe total = sum of (ingredient servings × ingredient calories/protein). Per-serving display = recipe total ÷ number of servings.
- Because conversions are approximate, results should be surfaced as estimates. Acceptable for v1.

## Item Management (Edit / Delete / Favorites)
- Full CRUD for ingredients, foods, and recipes:
  - The Add screens double as Edit screens when an existing item is opened (fields prefilled).
  - Each item can be deleted. On delete, prevent or warn if the item is referenced by an existing recipe or logged meal — do not silently corrupt history; either block deletion or soft-delete so historical meals still render.
- Favorites: foods and recipes can be toggled as favorites. Favorited items sort to the top of the Food & Recipe List on the Add Meal Screen (alpha within the favorites group, separator, then the rest alpha).
- Provide a management/list view to browse the full library of ingredients, foods, and recipes so items can be found, edited, favorited, or deleted outside the add-meal flow.

## Suggested Data Model (minimum)
- **User**: id, auth fields.
- **Ingredient**: id, userId, name, servingMeasureAmount, servingMeasureUnit (cups/tbsp/tsp), servingWeightAmount, servingWeightUnit (lb/oz/g), caloriesPerServing, proteinPerServing, isFavorite.
- **Food**: id, userId, name, servingMeasureAmount, servingMeasureUnit (cups/tbsp/tsp/items), servingWeightAmount, servingWeightUnit (lb/oz/g), caloriesPerServing, proteinPerServing, isFavorite.
- **Recipe**: id, userId, name, servings (1–12), instructions, isFavorite.
- **RecipeIngredient**: id, recipeId, ingredientId, amountMeasure, measureUnit, amountWeight, weightUnit.
- **Meal**: id, userId, date, time, mealType (Breakfast/Lunch/Dinner/Snack).
- **MealItem**: id, mealId, itemType (food|recipe), foodId|recipeId, servingsMultiplier, plus a snapshot of calories/protein at log time so later edits to a food don't rewrite history.
- **Goal**: id, userId, date (or effective range), calorieGoal, proteinGoal.

## Open / Lower-Priority Items (not blocking; sensible defaults assumed)
- Visual design/branding unspecified — assume a clean mobile-first UI (developer's choice unless provided).
- Meal-type auto-default logic (1st=Breakfast, 2nd=Lunch, 3rd=Dinner, rest=Snack) is based on the count of that day's meals.
- "Time rounded to previous quarter hour" applies to the Add Meal Screen default.
