/**
 * src/components/Header.tsx
 * Component Header chính
 */

import React from "react";
import { APP_NAME } from "../config/config";

interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = APP_NAME }) => {
  return (
    <header className="bg-blue-600 text-white p-4 shadow-lg">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-blue-100">Hệ thống quản lý POS</p>
      </div>
    </header>
  );
};
