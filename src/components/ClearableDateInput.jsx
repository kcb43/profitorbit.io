/**
 * ClearableDateInput — thin wrapper kept for backwards compatibility.
 * Delegates entirely to DatePickerInput so all date fields share the same
 * modern popover calendar instead of the browser's native date picker.
 */
import React from "react";
import DatePickerInput from "./DatePickerInput";

export default function ClearableDateInput({
  id,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  className,
}) {
  return (
    <DatePickerInput
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      className={className}
    />
  );
}
