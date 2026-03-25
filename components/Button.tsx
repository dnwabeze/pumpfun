import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export default function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-colors duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-background hover:bg-primary/90 active:bg-primary/80 disabled:hover:bg-primary/90",
    secondary: "bg-secondary text-foreground hover:bg-secondary/80 active:bg-secondary/70 border border-secondary/50 disabled:hover:bg-secondary",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
