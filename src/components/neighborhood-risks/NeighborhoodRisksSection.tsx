import type { ReactNode } from "react";
import type {
  ConcernCategory,
  ConcernSubCategory,
  NeighborhoodRisksResult,
} from "@/lib/neighborhood-risks/types";
import { CATEGORY_COLORS } from "@/lib/neighborhood-risks/colors";
import {
  SUB_CATEGORIES_BY_CATEGORY,
  SUB_CATEGORY_SOURCES,
  SUB_CATEGORY_TITLES,
  SUB_CATEGORY_UNITS,
} from "@/lib/neighborhood-risks/sub-categories";
import { NeighborhoodRisksBlock } from "./NeighborhoodRisksBlock";
import { NeighborhoodRisksEmptyBlock } from "./NeighborhoodRisksEmptyBlock";
import { NeighborhoodRisksSensitiveBlock } from "./NeighborhoodRisksSensitiveBlock";

interface NeighborhoodRisksSectionProps {
  category: ConcernCategory;
  result: NeighborhoodRisksResult;
}

export function NeighborhoodRisksSection({
  category,
  result,
}: NeighborhoodRisksSectionProps) {
  const color = CATEGORY_COLORS[category];
  const subCats = SUB_CATEGORIES_BY_CATEGORY[category];

  let totalCount = 0;
  let nonEmptySubCats = 0;
  const blocks: ReactNode[] = [];

  if (category === "block_level") {
    const bl = result.block_level;

    const renderBlockLevel = (
      sub: ConcernSubCategory,
      count: number,
      extraItems: Array<{ name: string; distance_mi: number }>,
      pillOverride?: string,
    ) => {
      if (count > 0) {
        totalCount += count;
        nonEmptySubCats++;
        blocks.push(
          <NeighborhoodRisksBlock
            key={sub}
            sub_category={sub}
            category={category}
            title={SUB_CATEGORY_TITLES[sub]}
            source={SUB_CATEGORY_SOURCES[sub]}
            count={count}
            unit={SUB_CATEGORY_UNITS[sub]}
            items={extraItems}
            pillLabel={pillOverride}
          />,
        );
      } else {
        blocks.push(
          <NeighborhoodRisksEmptyBlock
            key={sub}
            sub_category={sub}
            category={category}
            title={SUB_CATEGORY_TITLES[sub]}
            source={SUB_CATEGORY_SOURCES[sub]}
          />,
        );
      }
    };

    renderBlockLevel("rat_failures", bl.rat_failures, []);
    const onBlock = bl.noise_311_on_block;
    renderBlockLevel(
      "noise_311",
      bl.noise_311,
      onBlock > 0 ? [{ name: "On this block", distance_mi: 0.05 }] : [],
      onBlock > 0 ? `${onBlock} on block` : undefined,
    );
    renderBlockLevel("bedbug_history", bl.bedbug_history, []);
  } else {
    for (const sub of subCats) {
      const group = result.groups.find((g) => g.sub_category === sub);
      if (group && group.total_count > 0) {
        totalCount += group.total_count;
        nonEmptySubCats++;
        blocks.push(
          <NeighborhoodRisksBlock
            key={sub}
            sub_category={sub}
            category={category}
            title={SUB_CATEGORY_TITLES[sub]}
            source={SUB_CATEGORY_SOURCES[sub]}
            count={group.total_count}
            unit={SUB_CATEGORY_UNITS[sub]}
            items={group.items.map((item) => ({
              name: item.name,
              distance_mi: item.distance_mi,
            }))}
          />,
        );
      } else {
        blocks.push(
          <NeighborhoodRisksEmptyBlock
            key={sub}
            sub_category={sub}
            category={category}
            title={SUB_CATEGORY_TITLES[sub]}
            source={SUB_CATEGORY_SOURCES[sub]}
          />,
        );
      }
    }

    if (category === "public_safety") {
      totalCount += result.sex_offender_count;
      if (result.sex_offender_count > 0) nonEmptySubCats++;
      blocks.push(
        <NeighborhoodRisksSensitiveBlock
          key="sex_offender"
          count={result.sex_offender_count}
        />,
      );
    }
  }

  return (
    <section id={`section-${category}`} className="mb-8 scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-1 h-6 rounded-sm"
          style={{ backgroundColor: color.hex }}
          aria-hidden="true"
        />
        <h2 className="text-lg font-bold text-[#0F1D2E] m-0 leading-none">
          {color.label}
        </h2>
        <span className="text-xs text-[#64748B] ml-auto">
          {totalCount} within 0.75 mi · {nonEmptySubCats} sub-categories
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {blocks}
      </div>
    </section>
  );
}
