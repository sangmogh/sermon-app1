export function AppShell({
  children,
  wide = false,
}: {
  children: React.ReactNode;
  /** 설교 보관함(연도 선택) 등 일부 화면만 가로를 넓게 */
  wide?: boolean;
}) {
  return (
    <div
      className={`mx-auto min-h-[100dvh] w-full bg-gray-50 ${wide ? "max-w-lg" : "max-w-md"}`}
    >
      {children}
    </div>
  );
}
