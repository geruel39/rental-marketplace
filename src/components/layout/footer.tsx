import Link from "next/link";

const footerColumns = [
  {
    title: "Company",
    links: [
      { label: "About", href: "/" },
      { label: "How It Works", href: "/" },
    ],
  },
  {
    title: "Categories",
    links: [
      { label: "Electronics", href: "/" },
      { label: "Tools", href: "/" },
      { label: "Vehicles", href: "/" },
      { label: "Photography", href: "/" },
      { label: "Home & Garden", href: "/" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help", href: "/" },
      { label: "Contact", href: "/" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "/" },
      { label: "Privacy", href: "/" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-brand-dark text-brand-light">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {footerColumns.map((column) => (
            <div key={column.title} className="space-y-4">
              <h3 className="text-brand-sky text-sm font-semibold uppercase tracking-wide">
                {column.title}
              </h3>
              <div className="space-y-2">
                {column.links.map((link) => (
                  <Link
                    key={link.label}
                    className="block rounded-sm text-sm text-brand-light/75 transition-colors hover:text-brand-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-sm text-brand-light/70">
          Copyright {new Date().getFullYear()} RentHub. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
