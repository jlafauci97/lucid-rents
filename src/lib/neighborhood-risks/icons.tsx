import type { ComponentType } from "react";
import type { ConcernSubCategory } from "./types";
import {
  Home,
  Pill,
  ShieldAlert,
  Building2,
  Siren,
  Construction,
  Train,
  Car,
  CarFront,
  Factory,
  Trash2,
  Rat,
  Megaphone,
  Bug,
  Users,
  Heart,
} from "lucide-react";

const ICON_MAP: Record<ConcernSubCategory, ComponentType<{ className?: string }>> = {
  homeless_shelter_adult: Home,
  youth_shelter: Users,
  supportive_housing: Heart,
  migrant_reception: Users,
  methadone_clinic: Pill,
  halfway_house: Building2,
  sirens: Siren,
  active_construction: Construction,
  elevated_rail: Train,
  highway: Car,
  avenue_traffic: CarFront,
  dsny_garage: Trash2,
  brownfield: Factory,
  industrial_zone: Factory,
  rat_failures: Rat,
  noise_311: Megaphone,
  bedbug_history: Bug,
  sex_offender: ShieldAlert,
};

/**
 * Returns the lucide icon component to render for a given sub-category.
 */
export function iconForSubCategory(sub: ConcernSubCategory): ComponentType<{ className?: string }> {
  return ICON_MAP[sub];
}
