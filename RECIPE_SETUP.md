# Recipe Setup Guide

This guide documents the workflow used to add a recipe to Dinner Planner and the paired Safeway Planner grocery files. It is based on the Lomo Saltado setup and the quantity style already used by the Gluten-Free Cinnamon Rolls recipe.

## Recipe JSON Shape

Dinner Planner recipe files live in `public/recipes/` and are arrays of timed steps:

```json
{
  "id": "mix_sauce",
  "parent": "Lomo Saltado",
  "title": "Mix aji amarillo sauce",
  "start_min": 40,
  "duration_min": 5,
  "description": "Whisk aji amarillo paste (1 tbsp), soy sauce (2 tbsp), red wine vinegar (1.5 tbsp), and oyster sauce (1 tsp, optional) in a small bowl and keep it near the stove."
}
```

Use these fields:

- `id`: A stable lowercase identifier using underscores.
- `parent`: The component or workstream shown in the planner, such as `Dough`, `Lomo Saltado`, or `Sweet Potato Wedges`.
- `title`: A short action label.
- `start_min`: When the task begins, in minutes from the start of the plan.
- `duration_min`: How long the task takes, in minutes.
- `description`: Human-readable instructions. This is where ingredient quantities live.

## Quantity Style

Quantities are not a separate structured field. They are embedded directly in `description` text, immediately after the ingredient name in parentheses.

Good examples:

- `Combine King Arthur gluten-free bread flour (680 g), sugar (65 g), instant yeast (2.25 tsp), salt (2 tsp), and baking powder (1 tsp).`
- `Whisk aji amarillo paste (1 tbsp), soy sauce (2 tbsp), red wine vinegar (1.5 tbsp), and oyster sauce (1 tsp, optional).`
- `Pat beef tenderloin (12 oz) very dry, toss with ground cumin (0.5 tsp), kosher salt (0.5 tsp), and black pepper to taste.`

Use quantities when an ingredient is measured, added, mixed, seasoned, or otherwise directly used. Later references to already-prepped components can use the component name without repeating every quantity, such as `sweet potato wedges`, `the aji amarillo sauce`, or `the cinnamon-sugar`.

Keep the recipe's original units when they are useful in the kitchen. Prefer concise parentheticals like `(12 oz)`, `(1.5 tbsp)`, `(2 tomatoes)`, `(1 tsp, optional)`, or `(1.3 lb, about 2 medium)`.

## Full Workflow

1. Start from the base recipe.
   - Identify servings, ingredients, optional ingredients, and any substitutions.
   - Decide whether any ingredient should be omitted before adding it. For example, cilantro was removed from the Lomo Saltado recipe after the initial add.
   - Preserve important cooking details such as oven temperature, resting time, batch cooking, and doneness cues.

2. Add the grocery recipe to `Safeway_Planner/recipes.txt`.
   - Place the recipe under the appropriate section, usually `! Regular Meals`.
   - Use the existing grocery format: recipe title, then one ingredient per line as `<amount> <unit> <item>`.
   - Keep ingredient names stable and shopping-oriented because these names are matched exactly against map files.
   - Example:

```text
Lomo Saltado with Large Roasted Sweet Potato Wedges
12 oz beef tenderloin
0.5 tsp ground cumin
1.3 lb sweet potato
1.5 tbsp olive oil
0.5 tsp smoked paprika
1 tsp kosher salt
2 tbsp neutral oil
1 cup red onion
2 -- Roma tomato
1 tbsp aji amarillo paste
3 cloves garlic
2 tbsp soy sauce
1.5 tbsp red wine vinegar
1 tsp oyster sauce
1 -- black pepper
1 -- lime
```

3. Add or update store map entries in `Safeway_Planner/irvine.map`.
   - The Safeway Planner map lookup is exact, so `cumin` does not cover `ground cumin`, and `tomato` does not cover `Roma tomato`.
   - Add missing exact item names near similar existing items.
   - Put pantry sauces with pantry sauces, spices and oils with spices and oils, meats with meat, and produce with produce.
   - For the Lomo Saltado recipe, exact entries were added for items such as `beef tenderloin`, `ground cumin`, `sweet potato`, `kosher salt`, `neutral oil`, `Roma tomato`, `aji amarillo paste`, `red wine vinegar`, and `oyster sauce`.

4. Create the Dinner Planner recipe JSON file.
   - Add a new file in `Dinner_Planner/public/recipes/`.
   - Use a lowercase hyphenated filename, such as `lomo-saltado-sweet-potato-wedges.json`.
   - Break the recipe into timed, parallelizable tasks rather than copying every prose step verbatim.
   - Assign `parent` values to group related workstreams, such as `Sweet Potato Wedges`, `Lomo Saltado`, and `Serving`.
   - Set `start_min` values so the full meal finishes together.

5. Write descriptions with quantities.
   - For each step, include ingredient quantities at the point where the ingredient is used.
   - Follow the parenthetical style from `gluten-free-cinnamon-rolls.json`.
   - Mention optional ingredients in the same parenthetical, such as `oyster sauce (1 tsp, optional)`.
   - If a later step uses a prepared component, use its component name instead of restating all of its ingredients.

6. Register the recipe in `Dinner_Planner/public/recipes/manifest.json`.
   - Add an object with `name`, `path`, and `description`.
   - `path` must point to the JSON file under `/recipes/`.
   - Keep the description short enough for the recipe picker.

```json
{
  "name": "Lomo Saltado with Roasted Sweet Potato Wedges",
  "path": "/recipes/lomo-saltado-sweet-potato-wedges.json",
  "description": "Beef tenderloin stir-fried with aji amarillo, soy, and vinegar, served with roasted sweet potato wedges."
}
```

7. Validate the result.
   - Parse the new JSON file and `manifest.json`.
   - Check that every manifest `path` has a matching file.
   - Check linter diagnostics for edited files.
   - For Safeway Planner, verify every grocery item from the new recipe has an exact entry in the relevant `.map` file.

## Practical Notes

- The Dinner Planner app does not calculate grocery quantities from the recipe JSON. The quantities in descriptions are for cooking clarity.
- The Safeway Planner grocery list comes from `recipes.txt`, not from Dinner Planner JSON.
- Keep ingredient names consistent between `recipes.txt` and `.map` files when possible.
- Do not keep ingredients in either system if the recipe has been changed to omit them.
- If a recipe has a long idle period, represent it as a timed step so the planner can show it on the timeline.
