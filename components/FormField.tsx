"use client";

interface FormFieldProps {
  field: {
    name: string;
    label: string;
    type: string;
    placeholder?: string;
  };
  value: string;
  onChange: (value: string | boolean) => void;
}

export default function FormField({ field, value, onChange }: FormFieldProps) {
  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id={field.name}
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 rounded border-secondary bg-background cursor-pointer accent-primary"
        />
        <label htmlFor={field.name} className="text-sm font-medium text-foreground cursor-pointer">
          {field.label}
        </label>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-2">
        <label htmlFor={field.name} className="block text-sm font-medium text-foreground">
          {field.label}
        </label>
        <textarea
          id={field.name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="w-full px-3 py-2 bg-background border border-secondary/50 rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-primary transition-colors resize-none"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={field.name} className="block text-sm font-medium text-foreground">
        {field.label}
      </label>
      <input
        type={field.type}
        id={field.name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className="w-full px-3 py-2 bg-background border border-secondary/50 rounded-lg text-foreground placeholder-muted focus:outline-none focus:border-primary transition-colors"
      />
    </div>
  );
}
