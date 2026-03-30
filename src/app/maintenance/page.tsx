export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.14),_transparent_45%),linear-gradient(180deg,_#fff7ed_0%,_#ffffff_100%)] px-6">
      <div className="w-full max-w-xl rounded-3xl border border-orange-200/70 bg-white/95 p-10 text-center shadow-xl shadow-orange-100/60">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-600 text-lg font-semibold text-white">
          RH
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.28em] text-orange-700">
          RentHub
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
          We&apos;re performing scheduled maintenance.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Please check back shortly.
        </p>
      </div>
    </main>
  );
}
