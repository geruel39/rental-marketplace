import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async redirects() {
    return [
      { source: "/dashboard", destination: "/listings", permanent: false },
      {
        source: "/dashboard/my-listings",
        destination: "/lister/listings",
        permanent: false,
      },
      {
        source: "/dashboard/my-listings/:path*",
        destination: "/lister/listings/:path*",
        permanent: false,
      },
      {
        source: "/dashboard/requests",
        destination: "/lister/bookings",
        permanent: false,
      },
      {
        source: "/dashboard/my-rentals",
        destination: "/renter/rentals",
        permanent: false,
      },
      {
        source: "/dashboard/earnings",
        destination: "/lister/earnings",
        permanent: false,
      },
      {
        source: "/dashboard/inventory",
        destination: "/lister/inventory",
        permanent: false,
      },
      {
        source: "/dashboard/inventory/:path*",
        destination: "/lister/inventory/:path*",
        permanent: false,
      },
      {
        source: "/dashboard/favorites",
        destination: "/renter/favorites",
        permanent: false,
      },
      {
        source: "/dashboard/messages/:path*",
        destination: "/account/messages/:path*",
        permanent: false,
      },
      {
        source: "/dashboard/notifications",
        destination: "/account/notifications",
        permanent: false,
      },
      {
        source: "/dashboard/reviews",
        destination: "/account/profile",
        permanent: false,
      },
      {
        source: "/dashboard/settings",
        destination: "/account/profile",
        permanent: false,
      },
      {
        source: "/dashboard/settings/payments",
        destination: "/lister/settings/payments",
        permanent: false,
      },
      {
        source: "/dashboard/settings/verification",
        destination: "/account/verify",
        permanent: false,
      },
      {
        source: "/listings/new",
        destination: "/lister/listings/new",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
