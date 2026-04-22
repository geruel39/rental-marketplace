import type { ReactNode } from "react";
import Link from "next/link";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "how-bookings-work", label: "How Bookings Work" },
  { id: "cancellation-policy", label: "Cancellation Policy" },
  { id: "double-booking-policy", label: "Double Booking Policy" },
  { id: "listing-requirements", label: "Listing Requirements" },
  { id: "refund-policy", label: "Refund Policy" },
  { id: "dispute-resolution", label: "Dispute Resolution" },
  { id: "platform-fees", label: "Platform Fees" },
  { id: "user-conduct", label: "User Conduct" },
  { id: "contact-us", label: "Contact Us" },
] as const;

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <h2 className="scroll-mt-24 text-2xl font-semibold tracking-tight" id={id}>
      {children}
    </h2>
  );
}

export default function PoliciesPage() {
  return (
    <main className="bg-[linear-gradient(180deg,#f4f8fb_0%,#ffffff_18%)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[260px,minmax(0,1fr)] lg:px-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-white/90 p-5 shadow-sm backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-navy">
              On This Page
            </p>
            <nav className="mt-4 space-y-2">
              {sections.map((section) => (
                <Link
                  className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-brand-light hover:text-brand-navy"
                  href={`/policies#${section.id}`}
                  key={section.id}
                >
                  {section.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <article className="min-w-0 rounded-[2rem] border border-border/70 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <header className="border-b border-border/70 pb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-steel">
              Marketplace Policy
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-brand-dark">
              RentHub Marketplace Policies
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Effective Date: April 22, 2026 | Version 1.0
            </p>
          </header>

          <div className="mt-8 space-y-10 text-[15px] leading-7 text-slate-700">
            <section className="space-y-4" id="overview">
              <SectionHeading id="overview">1. Overview</SectionHeading>
              <p>
                RentHub is a peer-to-peer rental marketplace connecting people who want to
                rent items with people who own items. These policies govern all
                transactions and apply to every user.
              </p>
            </section>

            <section className="space-y-5" id="how-bookings-work">
              <SectionHeading id="how-bookings-work">2. How Bookings Work</SectionHeading>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-brand-dark">2.1 Instant Booking</h3>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Renters book and pay immediately - no waiting for approval</li>
                  <li>Payment is held securely by our payment processor (HitPay)</li>
                  <li>The lister must confirm within 24 hours that they can fulfill the booking</li>
                  <li>Both parties arrange item handover via the platform&apos;s messaging system</li>
                  <li>
                    The official rental period begins when the lister confirms handover and
                    uploads proof photos
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-brand-dark">
                  2.2 Availability &amp; Conflict Prevention
                </h3>
                <ul className="list-disc space-y-2 pl-5">
                  <li>The platform checks item availability at the time of booking</li>
                  <li>Bookings are processed on a first-paid, first-served basis</li>
                  <li>You cannot book an item that is currently out of stock or fully reserved</li>
                  <li>
                    If a conflict exists due to inaccurate stock information:
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>The earliest confirmed and paid booking is honored</li>
                      <li>The lister must cancel conflicting bookings from most recent to oldest</li>
                      <li>Each cancelled renter receives a full refund automatically</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>

            <section className="space-y-5" id="cancellation-policy">
              <SectionHeading id="cancellation-policy">3. Cancellation Policy</SectionHeading>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-brand-dark">3.1 Renter Cancellation</h3>
                <div className="overflow-hidden rounded-2xl border border-border/70">
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-brand-light text-left text-brand-dark">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Time Since Payment</th>
                        <th className="px-4 py-3 font-semibold">Refund Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border/70">
                        <td className="px-4 py-3">Within 12 hours</td>
                        <td className="px-4 py-3">100% full refund</td>
                      </tr>
                      <tr className="border-t border-border/70">
                        <td className="px-4 py-3">12 to 24 hours</td>
                        <td className="px-4 py-3">50% refund</td>
                      </tr>
                      <tr className="border-t border-border/70">
                        <td className="px-4 py-3">After 24 hours</td>
                        <td className="px-4 py-3">No refund</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ul className="list-disc space-y-2 pl-5">
                  <li>Security deposits are always returned in full regardless of timing</li>
                  <li>
                    Refunds are processed within 5-10 business days via the original payment
                    method
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-brand-dark">3.2 Lister Cancellation</h3>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    Listers may cancel bookings in &quot;Awaiting Confirmation&quot; or
                    &quot;Confirmed&quot; status
                  </li>
                  <li>
                    Cancellation by lister always results in a 100% full refund to the renter
                  </li>
                  <li>The listing is automatically paused after a lister cancellation</li>
                  <li>Listers must manually reactivate their listing after resolving the issue</li>
                  <li>
                    Repeated cancellations may result in account restrictions or suspension
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-brand-dark">
                  3.3 Lister Confirmation Deadline
                </h3>
                <ul className="list-disc space-y-2 pl-5">
                  <li>
                    Listers have 24 hours from the time of renter payment to confirm a booking
                  </li>
                  <li>Reminder notifications are sent 12 hours and 2 hours before the deadline</li>
                  <li>
                    If no confirmation is received by the deadline:
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>The booking is automatically cancelled</li>
                      <li>The renter receives a 100% full refund</li>
                      <li>The listing is automatically paused</li>
                    </ul>
                  </li>
                </ul>
              </div>
            </section>

            <section className="space-y-4" id="double-booking-policy">
              <SectionHeading id="double-booking-policy">4. Double Booking Policy</SectionHeading>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  If a lister&apos;s stock information is inaccurate and causes multiple bookings
                  to be accepted beyond available stock:
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>The earliest paid booking takes full priority and must be honored</li>
                    <li>The lister is required to cancel subsequent conflicting bookings</li>
                    <li>Cancellations must proceed in order from most recent to oldest</li>
                    <li>Each affected renter receives a full refund</li>
                    <li>
                      The listing is paused until the lister updates their stock information
                    </li>
                  </ul>
                </li>
              </ul>
            </section>

            <section className="space-y-5" id="listing-requirements">
              <SectionHeading id="listing-requirements">5. Listing Requirements</SectionHeading>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-brand-dark">5.1 Individual Accounts</h3>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Payout method setup (GCash, Maya, or Bank Transfer)</li>
                  <li>Email address verification</li>
                  <li>Phone number verification</li>
                  <li>Government-issued ID (front and back photo)</li>
                  <li>Current selfie photo</li>
                  <li>Admin review and approval (1-3 business days)</li>
                </ol>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-brand-dark">5.2 Business Accounts</h3>
                <ol className="list-decimal space-y-2 pl-5">
                  <li>Payout method setup</li>
                  <li>Business phone number</li>
                  <li>Business address</li>
                  <li>TIN (Tax Identification Number)</li>
                  <li>Business registration document (DTI, SEC, etc.)</li>
                  <li>Representative government-issued ID (front and back)</li>
                  <li>Representative selfie photo</li>
                  <li>Admin review and approval (1-3 business days)</li>
                </ol>
              </div>
            </section>

            <section className="space-y-4" id="refund-policy">
              <SectionHeading id="refund-policy">6. Refund Policy</SectionHeading>
              <ul className="list-disc space-y-2 pl-5">
                <li>All refunds are processed via the original HitPay payment</li>
                <li>Refunds typically appear within 5-10 business days</li>
                <li>
                  Platform service fees: refunded only when the lister cancels or fails to
                  confirm
                </li>
                <li>Security deposits: refunded in full unless damage is confirmed</li>
                <li>HitPay processing fees are non-refundable in all cases</li>
              </ul>
            </section>

            <section className="space-y-4" id="dispute-resolution">
              <SectionHeading id="dispute-resolution">7. Dispute Resolution</SectionHeading>
              <ul className="list-disc space-y-2 pl-5">
                <li>Either party may raise a dispute during the Active or Returned phases</li>
                <li>The payment is held securely while the dispute is under review</li>
                <li>
                  Evidence considered: handover photos, return photos, messages, and timeline
                </li>
                <li>Admin decisions on how payment is distributed are final</li>
                <li>We aim to resolve all disputes within 3-5 business days</li>
                <li>Abusing the dispute system may result in account suspension</li>
              </ul>
            </section>

            <section className="space-y-4" id="platform-fees">
              <SectionHeading id="platform-fees">8. Platform Fees</SectionHeading>
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-brand-light text-left text-brand-dark">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fee</th>
                      <th className="px-4 py-3 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border/70">
                      <td className="px-4 py-3">Renter service fee</td>
                      <td className="px-4 py-3">5% of rental subtotal</td>
                    </tr>
                    <tr className="border-t border-border/70">
                      <td className="px-4 py-3">Lister service fee</td>
                      <td className="px-4 py-3">5% of rental subtotal</td>
                    </tr>
                    <tr className="border-t border-border/70">
                      <td className="px-4 py-3">Payment processing (HitPay)</td>
                      <td className="px-4 py-3">3.4% + SGD 0.50 per transaction</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul className="list-disc space-y-2 pl-5">
                <li>All fees are displayed transparently before payment confirmation</li>
                <li>No hidden charges</li>
              </ul>
            </section>

            <section className="space-y-4" id="user-conduct">
              <SectionHeading id="user-conduct">9. User Conduct</SectionHeading>
              <ul className="list-disc space-y-2 pl-5">
                <li>Item descriptions and photos must be accurate and up to date</li>
                <li>Stock quantities must reflect actual availability</li>
                <li>All communication must remain respectful and on-platform</li>
                <li>Photos submitted for verification must be genuine and unedited</li>
                <li>
                  Fraudulent listings or identity information results in immediate suspension
                </li>
              </ul>
            </section>

            <section className="space-y-4" id="contact-us">
              <SectionHeading id="contact-us">10. Contact Us</SectionHeading>
              <p>Questions about these policies? Contact us:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Email: support@renthub.com</li>
                <li>Help Center: renthub.com/help</li>
                <li>Response time: within 2 business days</li>
              </ul>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
