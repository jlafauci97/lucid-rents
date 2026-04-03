import { notFound } from "next/navigation";
import { isValidCity } from "@/lib/cities";
import { CityProvider } from "@/lib/city-context";

export default async function CityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;

  if (!isValidCity(city)) {
    notFound();
  }

  return <CityProvider city={city}>{children}</CityProvider>;
}
