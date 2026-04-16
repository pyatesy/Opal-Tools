# CMP Field Choices

Opal tool for managing field choices on the Optimizely Content Marketing Platform (CMP).

## Tools

### cmp_update_field_choice
Update an existing choice on a CMP field (label, dropdown, checkbox, or radio button).

**Parameters:**
- `field_id` (required) — GUID of the field
- `choice_id` (required) — GUID of the choice to update
- `name` — New name for the choice
- `color` — New hex color (label fields only)

### cmp_add_field_choices
Add one or more new choices to a CMP field.

**Parameters:**
- `field_id` (required) — GUID of the field
- `choices` (required) — Array of `{ name, color? }` objects

## Authentication

Uses OptiID authentication (automatic via Opal). No API keys or manual credentials required.

## Allowed Label Colors

| Color          | Hex       |
|----------------|-----------|
| Electric Blue  | `#4ECFD5` |
| Golden Rod     | `#FFC700` |
| Salmon Pink    | `#FF98A7` |
| Blue Violet    | `#702BD5` |
| Spring Green   | `#5FEEAD` |
| Lavender Blue  | `#D6C4F2` |
| Sky            | `#5F9FF6` |
| Persian Blue   | `#CB5DEB` |
| Cool Gray      | `#9694B3` |
