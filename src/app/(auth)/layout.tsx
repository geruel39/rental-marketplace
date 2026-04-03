export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-brand-light px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-5xl items-center justify-center">
        {children}
      </div>
    </main>
  );
}
