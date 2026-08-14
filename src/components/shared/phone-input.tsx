"use client";

import { Input } from "@/components/ui/input";
import { PhoneDialCombobox } from "@/components/shared/phone-dial-combobox";
import { composePhoneE164, splitPhoneE164 } from "@/lib/phone/e164";

interface PhoneInputProps {
  value?: string | null;
  onChange: (e164: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PhoneInput({
  value,
  onChange,
  disabled,
  placeholder = "300 123 4567",
}: PhoneInputProps) {
  const parts = splitPhoneE164(value);

  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2">
      <PhoneDialCombobox
        value={parts.phoneCountryCode}
        disabled={disabled}
        onChange={(dial) => {
          onChange(composePhoneE164(dial, parts.phoneNumber) ?? "");
        }}
      />
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        disabled={disabled}
        placeholder={placeholder}
        value={parts.phoneNumber}
        onChange={(event) => {
          onChange(
            composePhoneE164(parts.phoneCountryCode, event.target.value) ?? ""
          );
        }}
      />
    </div>
  );
}
