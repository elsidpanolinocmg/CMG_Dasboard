import type { MetadataRoute } from "next";

// Crawling stays allowed on purpose: the X-Robots-Tag noindex header set in
// next.config.ts is only honoured by a crawler that is permitted to fetch the
// page. Disallowing here would hide the header and leave bare URLs indexable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
