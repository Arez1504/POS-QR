// frontend/src/components/Icon.tsx
// Material Symbols Outlined wrapper component
// Xem danh sách icon tại: https://fonts.google.com/icons

interface IconProps {
  name: string;          // tên icon, ví dụ: 'dashboard', 'point_of_sale'
  size?: number;         // px, mặc định 24
  fill?: boolean;        // true = filled (solid), false = outlined
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  className?: string;
}

export default function Icon({ name, size = 24, fill = false, weight = 400, className = '' }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined select-none ${className}`}
      style={{
        fontSize: size,
        lineHeight: 1,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}
