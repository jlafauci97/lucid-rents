/**
 * NYC Rent Guidelines Board (RGB) historical rate increases for rent-stabilized apartments.
 * Source: https://rentguidelinesboard.cityofnewyork.us/
 */

export interface RGBRate {
  year: number;
  /** Percentage increase for 1-year lease renewal */
  oneYear: number;
  /** Percentage increase for 2-year lease renewal */
  twoYear: number;
}

export const RGB_RATES: RGBRate[] = [
  { year: 2025, oneYear: 2.75, twoYear: 5.25 },
  { year: 2024, oneYear: 3.0, twoYear: 2.75 },
  { year: 2023, oneYear: 3.25, twoYear: 2.75 },
  { year: 2022, oneYear: 3.25, twoYear: 5.0 },
  { year: 2021, oneYear: 0, twoYear: 0 },
  { year: 2020, oneYear: 1.5, twoYear: 2.5 },
  { year: 2019, oneYear: 1.5, twoYear: 2.5 },
  { year: 2018, oneYear: 1.5, twoYear: 2.5 },
  { year: 2017, oneYear: 0, twoYear: 2.0 },
  { year: 2016, oneYear: 0, twoYear: 2.0 },
  { year: 2015, oneYear: 1.0, twoYear: 2.75 },
  { year: 2014, oneYear: 1.0, twoYear: 2.75 },
  { year: 2013, oneYear: 2.0, twoYear: 4.0 },
  { year: 2012, oneYear: 2.0, twoYear: 4.0 },
  { year: 2011, oneYear: 3.75, twoYear: 7.25 },
  { year: 2010, oneYear: 2.25, twoYear: 4.5 },
  { year: 2009, oneYear: 3.0, twoYear: 5.0 },
  { year: 2008, oneYear: 4.5, twoYear: 8.5 },
  { year: 2007, oneYear: 3.0, twoYear: 5.75 },
  { year: 2006, oneYear: 2.75, twoYear: 5.5 },
  { year: 2005, oneYear: 3.5, twoYear: 7.5 },
  { year: 2004, oneYear: 3.0, twoYear: 5.5 },
  { year: 2003, oneYear: 2.0, twoYear: 4.0 },
  { year: 2002, oneYear: 2.0, twoYear: 4.0 },
  { year: 2001, oneYear: 4.0, twoYear: 6.0 },
  { year: 2000, oneYear: 2.0, twoYear: 4.0 },
];
