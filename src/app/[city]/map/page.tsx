import { redirect } from "next/navigation";
import { cityPath } from "@/lib/seo";

export default function MapPage() {
  redirect(cityPath("/crime"));
}
