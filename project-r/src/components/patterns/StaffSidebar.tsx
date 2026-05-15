interface StaffSidebarProps {
  role: "coach" | "analyst";
}

export function StaffSidebar({ role }: StaffSidebarProps) {
  return (
    <aside
      className="hidden w-64 border-r border-gray-200 bg-gray-50 p-6 lg:block"
      role="navigation"
      aria-label="Navegação principal"
    >
      <nav className="space-y-2">
        {/* Placeholder for future navigation items */}
        <div className="text-sm text-gray-600">
          Navegação será adicionada em histórias futuras
        </div>
      </nav>
    </aside>
  );
}
