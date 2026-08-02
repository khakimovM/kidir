import type { MetadataRoute } from "next";

// The admin panel must never be indexed: it is deployed on its own
// subdomain (admin.kidir.net) and only reachable by MODERATOR/SUPERADMIN.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
