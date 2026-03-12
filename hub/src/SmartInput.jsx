import React, { useEffect, useRef } from 'react'

function SmartInput(
  { value, onChange, onDebouncedChange, placeholder, type = 'text', onBlur, onFocus, debounceMs = 300 },
  ref
) {
  const localRef = useRef(null)
  const timeoutRef = useRef(null)

  const handleChange = (e) => {
    const next = e.target.value
    onChange(next)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      onDebouncedChange?.(next)
    }, debounceMs)
  }

  const handleFocus = (e) => {
    e.target.select()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    onFocus?.(e)
  }

  const handleBlur = (e) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    onBlur?.(e)
  }

  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') ref(localRef.current)
      else if (ref) ref.current = localRef.current
    }
  }, [ref])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const props = {
    ref: localRef,
    value,
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur: handleBlur,
    placeholder,
    className: 'h-9 w-full rounded-lg border border-white/10 bg-[#1a1625] px-3 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-[#7c3aed]'
  }

  if (type === 'number') {
    return (
      <input
        {...props}
        type="number"
        inputMode="numeric"
        style={{ MozAppearance: 'textfield' }}
      />
    )
  }

  return <input {...props} type={type} />
}

export default React.forwardRef(SmartInput)
