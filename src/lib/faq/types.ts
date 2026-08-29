export type FAQGroup =
  | "Rent"
  | "Landlord"
  | "Safety"
  | "Amenities"
  | "Location"
  | "Building";

export interface FAQItem {
  question: string;
  answer: string;
  group?: FAQGroup;
}
