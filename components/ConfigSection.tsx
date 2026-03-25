"use client";

import { ChevronDown } from "lucide-react";
import FormField from "./FormField";

interface Field {
  name: string;
  label: string;
  type: string;
  placeholder?: string;
}

interface Section {
  id: string;
  title: string;
  description: string;
  fields: Field[];
}

interface ConfigSectionProps {
  section: Section;
  formData: Record<string, string>;
  onFieldChange: (name: string, value: string | boolean) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function ConfigSection({
  section,
  formData,
  onFieldChange,
  isExpanded,
  onToggle,
}: ConfigSectionProps) {
  return (
    <div className="border border-secondary rounded-lg overflow-hidden bg-secondary/30 hover:bg-secondary/50 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="text-left flex-1">
          <h3 className="text-lg font-semibold text-foreground">{section.title}</h3>
          <p className="text-sm text-muted mt-1">{section.description}</p>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-muted transition-transform duration-300 ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-secondary/50 px-4 py-4 space-y-4 bg-background/30">
          {section.fields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={formData[field.name] || ""}
              onChange={(value) => onFieldChange(field.name, value)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
