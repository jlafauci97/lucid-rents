import Link from "next/link";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

interface Props {
  city: City;
  displayName: string;
}

export function Crumbs({ city, displayName }: Props) {
  const prefix = CITY_META[city]?.urlPrefix ?? "nyc";
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <Link href="/">home</Link><span className="sep">/</span>
      <Link href={`/${prefix}`}>{prefix.toLowerCase()}</Link><span className="sep">/</span>
      <Link href={`/${prefix}/landlords`}>landlords</Link><span className="sep">/</span>
      <span className="now">{displayName.toLowerCase()}</span>
    </nav>
  );
}
