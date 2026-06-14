import React, { useEffect, useRef, useState } from 'react'

function SmartInput(
  {
    label,
    value,
    onChange,
    onCommit,
    onDebouncedChange,
    placeholder,
    type = 'text',
    onBlur,
    onFocus,
    debounceMs = 300,
    commitOn = 'blur',
  },
  ref
) {
  const localRef = useRef(null)
  const timeoutRef = useRef(null)
  const focusedRef = useRef(false)
  const [buffer, setBuffer] = useState(() => String(value ?? ''))

  useEffect(() => {
    if (!focusedRef.current) {
      setBuffer(String(value ?? ''))
    }
  }, [value])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (ref) {
      if (typeof ref === 'function') ref(localRef.current)
      else if (ref) ref.current = localRef.current
    }
  }, [ref])

  const fireCommit = (nextValue) => {
    if (onCommit) {
      onCommit(nextValue)
      return
    }
    onDebouncedChange?.(nextValue)
  }

  const handleChange = (e) => {
    const next = e.target.value
    setBuffer(next)
    onChange?.(next)

    if (commitOn === 'debounce' || commitOn === 'both') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        fireCommit(next)
      }, debounceMs)
    }
  }

  const handleFocus = (e) => {
    focusedRef.current = true
    e.target.select()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    onFocus?.(e)
  }

  const handleBlur = (e) => {
    focusedRef.current = false
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    if (commitOn === 'blur' || commitOn === 'both') {
      fireCommit(buffer)
    }
    onBlur?.(e)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      fireCommit(buffer)
      e.currentTarget.blur()
    }
  }

  const inputClassName =
    'h-9 w-full rounded-lg border border-white/10 bg-[#1a1625] px-3 text-sm text-white/90 outline-none placeholder:text-white/30 focus:border-[#7c3aed]'

  const inputEl =
    type === 'number' ? (
      <input
        ref={localRef}
        type="text"
        inputMode="numeric"
        value={buffer}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
        style={{ MozAppearance: 'textfield' }}
      />
    ) : (
      <input
        ref={localRef}
        type={type}
        value={buffer}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={inputClassName}
      />
    )

  if (label) {
    return (
      <label className="block">
        <span className="text-[11px] font-semibold text-white/60">{label}</span>
        <div className="mt-1">{inputEl}</div>
      </label>
    )
  }

  return inputEl
}

export default React.forwardRef(SmartInput)
