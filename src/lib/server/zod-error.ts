import { z } from 'zod'

export function formatZodError(error: z.ZodError) {
  const flattened = error.flatten()
  const fieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>
  const formErrors = flattened.formErrors

  const messages: string[] = []

  for (const [field, errs] of Object.entries(fieldErrors)) {
    if (Array.isArray(errs) && errs.length > 0) {
      const fieldName = field.replace(/_/g, ' ')
      messages.push(`${fieldName}: ${errs.join(', ')}`)
    }
  }

  if (Array.isArray(formErrors) && formErrors.length > 0) {
    messages.push(formErrors.join(', '))
  }

  const detailedMessage = messages.join('; ')
  return {
    error: detailedMessage ? `Validation failed: ${detailedMessage}` : 'Validation failed',
    fieldErrors,
    formErrors,
  }
}
