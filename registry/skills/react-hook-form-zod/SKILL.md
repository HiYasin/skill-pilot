---
name: react-hook-form-zod
description: Build typed forms with React Hook Form and Zod. Use when creating or validating forms that use react-hook-form together with zod schemas.
metadata:
  stack-all: react-hook-form, zod
---

# React Hook Form + Zod

## Schema first
- Define the schema once and infer the type from it:
  ```ts
  const schema = z.object({
    email: z.string().email("Enter a valid email"),
    age: z.coerce.number().int().min(18, "Must be 18 or older"),
  });
  type FormValues = z.infer<typeof schema>;
  ```
- Share the same schema with the server (Server Action, API handler) and validate again there.

## Wiring
- `useForm<FormValues>({ resolver: zodResolver(schema), defaultValues })`. Always provide `defaultValues` for every field to keep inputs controlled-safe.
- Use `register` for native inputs; use `Controller` (or `useController`) for custom components such as selects and date pickers.
- Use `z.coerce` (or `valueAsNumber`) for number and date inputs, since HTML inputs return strings.

## Errors and UX
- Render `formState.errors.<field>?.message` next to each field and link it with `aria-describedby`.
- Choose a validation mode on purpose: `onSubmit` (default) for short forms, `onTouched` for long ones.
- Disable the submit button with `formState.isSubmitting` and show progress.
- Map server errors back to fields with `setError("email", { message })`.

## Advanced
- Dynamic lists: `useFieldArray` with stable `field.id` keys.
- Cross-field rules: `.refine()` / `.superRefine()` with a `path` so the error lands on the right field.
- Watch sparingly; `useWatch` on a single field avoids re-rendering the whole form.
