import { useState, useCallback, useEffect } from 'react'
import { 
  validateForm, 
  isFormValid, 
  FieldValidation, 
  ValidationResult,
  debounce,
  sanitizeInput
} from '@/lib/validation'

export interface UseValidationOptions {
  schema: FieldValidation
  validateOnChange?: boolean
  validateOnBlur?: boolean
  debounceMs?: number
  sanitizeInputs?: boolean
}

export interface ValidationState {
  values: Record<string, any>
  errors: Record<string, string[]>
  touched: Record<string, boolean>
  isValid: boolean
  isSubmitting: boolean
}

export interface ValidationActions {
  setValue: (field: string, value: any) => void
  setValues: (values: Record<string, any>) => void
  setError: (field: string, error: string) => void
  clearError: (field: string) => void
  clearAllErrors: () => void
  markTouched: (field: string) => void
  markAllTouched: () => void
  validateField: (field: string) => boolean
  validateAll: () => boolean
  reset: (initialValues?: Record<string, any>) => void
  setSubmitting: (isSubmitting: boolean) => void
  handleChange: (field: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
  handleBlur: (field: string) => (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void
}

export const useValidation = (
  initialValues: Record<string, any> = {},
  options: UseValidationOptions
): [ValidationState, ValidationActions] => {
  const {
    schema,
    validateOnChange = true,
    validateOnBlur = true,
    debounceMs = 300,
    sanitizeInputs = true
  } = options

  const [state, setState] = useState<ValidationState>({
    values: initialValues,
    errors: {},
    touched: {},
    isValid: true,
    isSubmitting: false
  })

  // Debounced validation function
  const debouncedValidate = useCallback(
    debounce((field: string, value: any) => {
      const validationResults = validateForm({ [field]: value }, { [field]: schema[field] })
      const result = validationResults[field]
      
      setState(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [field]: result ? result.errors : []
        }
      }))
    }, debounceMs),
    [schema, debounceMs]
  )

  // Update overall form validity when errors change
  useEffect(() => {
    const hasErrors = Object.values(state.errors).some(errors => errors.length > 0)
    const hasAllRequiredFields = Object.keys(schema).every(field => {
      const rules = schema[field]
      const isRequired = rules.some(rule => rule.required)
      return !isRequired || (state.values[field] && String(state.values[field]).trim() !== '')
    })

    setState(prev => ({
      ...prev,
      isValid: !hasErrors && hasAllRequiredFields
    }))
  }, [state.errors, state.values, schema])

  const setValue = useCallback((field: string, value: any) => {
    const processedValue = sanitizeInputs && typeof value === 'string' ? sanitizeInput(value) : value

    setState(prev => ({
      ...prev,
      values: {
        ...prev.values,
        [field]: processedValue
      }
    }))

    if (validateOnChange && state.touched[field]) {
      debouncedValidate(field, processedValue)
    }
  }, [validateOnChange, state.touched, debouncedValidate, sanitizeInputs])

  const setValues = useCallback((values: Record<string, any>) => {
    const processedValues = sanitizeInputs 
      ? Object.entries(values).reduce((acc, [key, value]) => ({
          ...acc,
          [key]: typeof value === 'string' ? sanitizeInput(value) : value
        }), {})
      : values

    setState(prev => ({
      ...prev,
      values: {
        ...prev.values,
        ...processedValues
      }
    }))
  }, [sanitizeInputs])

  const setError = useCallback((field: string, error: string) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: [error]
      }
    }))
  }, [])

  const clearError = useCallback((field: string) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: []
      }
    }))
  }, [])

  const clearAllErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: {}
    }))
  }, [])

  const markTouched = useCallback((field: string) => {
    setState(prev => ({
      ...prev,
      touched: {
        ...prev.touched,
        [field]: true
      }
    }))
  }, [])

  const markAllTouched = useCallback(() => {
    const allFields = Object.keys(schema)
    const touchedState = allFields.reduce((acc, field) => ({
      ...acc,
      [field]: true
    }), {})

    setState(prev => ({
      ...prev,
      touched: touchedState
    }))
  }, [schema])

  const validateField = useCallback((field: string): boolean => {
    if (!schema[field]) return true

    const validationResults = validateForm(
      { [field]: state.values[field] }, 
      { [field]: schema[field] }
    )
    const result = validationResults[field]

    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [field]: result ? result.errors : []
      }
    }))

    return result ? result.isValid : true
  }, [schema, state.values])

  const validateAll = useCallback((): boolean => {
    const validationResults = validateForm(state.values, schema)
    const errors = Object.entries(validationResults).reduce((acc, [field, result]) => ({
      ...acc,
      [field]: result.errors
    }), {})

    setState(prev => ({
      ...prev,
      errors,
      isValid: isFormValid(validationResults)
    }))

    return isFormValid(validationResults)
  }, [state.values, schema])

  const reset = useCallback((newInitialValues?: Record<string, any>) => {
    setState({
      values: newInitialValues || initialValues,
      errors: {},
      touched: {},
      isValid: true,
      isSubmitting: false
    })
  }, [initialValues])

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    setState(prev => ({
      ...prev,
      isSubmitting
    }))
  }, [])

  const handleChange = useCallback((field: string) => {
    return (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value
      setValue(field, value)
    }
  }, [setValue])

  const handleBlur = useCallback((field: string) => {
    return (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      markTouched(field)
      
      if (validateOnBlur) {
        validateField(field)
      }
    }
  }, [markTouched, validateOnBlur, validateField])

  const actions: ValidationActions = {
    setValue,
    setValues,
    setError,
    clearError,
    clearAllErrors,
    markTouched,
    markAllTouched,
    validateField,
    validateAll,
    reset,
    setSubmitting,
    handleChange,
    handleBlur
  }

  return [state, actions]
}

// Helper hook for simple field validation
export const useFieldValidation = (
  initialValue: any = '',
  rules: any[] = [],
  options: { validateOnChange?: boolean; debounceMs?: number } = {}
) => {
  const { validateOnChange = true, debounceMs = 300 } = options
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  const debouncedValidate = useCallback(
    debounce((val: any) => {
      const validationResults = validateForm({ field: val }, { field: rules })
      const result = validationResults.field
      setError(result && result.errors.length > 0 ? result.errors[0] : null)
    }, debounceMs),
    [rules, debounceMs]
  )

  const handleChange = useCallback((newValue: any) => {
    setValue(newValue)
    if (validateOnChange && touched) {
      debouncedValidate(newValue)
    }
  }, [validateOnChange, touched, debouncedValidate])

  const handleBlur = useCallback(() => {
    setTouched(true)
    debouncedValidate(value)
  }, [value, debouncedValidate])

  const validate = useCallback(() => {
    const validationResults = validateForm({ field: value }, { field: rules })
    const result = validationResults.field
    const errorMessage = result && result.errors.length > 0 ? result.errors[0] : null
    setError(errorMessage)
    return !errorMessage
  }, [value, rules])

  const reset = useCallback((newValue: any = initialValue) => {
    setValue(newValue)
    setError(null)
    setTouched(false)
  }, [initialValue])

  return {
    value,
    error,
    touched,
    isValid: !error,
    setValue: handleChange,
    onBlur: handleBlur,
    validate,
    reset
  }
}