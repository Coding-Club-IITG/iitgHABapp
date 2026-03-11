import React from "react";

export default function Button({
  children,
  variant = "default",
  size = "md",
  className = "",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  const sizes = {
    sm: "px-2 py-1 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    ghost: "bg-transparent text-gray-700 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50",
  };

  const variantClass = variants[variant] ?? variants.default;

  return (
    <button
      className={`${base} ${sizes[size]} ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
