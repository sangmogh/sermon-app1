export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-md bg-gray-50">
      {children}
    </div>
  );
}
