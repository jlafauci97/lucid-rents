import { Composition } from "remotion";
import type { ComponentType } from "react";
import { ViolationTimeline } from "./compositions/ViolationTimeline";
import { RentTrend } from "./compositions/RentTrend";
import { LandlordPortfolio } from "./compositions/LandlordPortfolio";
import { NeighborhoodCompare } from "./compositions/NeighborhoodCompare";
import { StatCounter } from "./compositions/StatCounter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ViolationTimeline"
        component={ViolationTimeline as AnyComponent}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          buildingAddress: "123 Main St, Brooklyn, NY",
          violations: [],
        }}
      />
      <Composition
        id="RentTrend"
        component={RentTrend as AnyComponent}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          neighborhood: "Bushwick",
          city: "NYC",
          dataPoints: [],
        }}
      />
      <Composition
        id="LandlordPortfolio"
        component={LandlordPortfolio as AnyComponent}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          landlordName: "Example LLC",
          buildings: [],
          totalViolations: 0,
        }}
      />
      <Composition
        id="NeighborhoodCompare"
        component={NeighborhoodCompare as AnyComponent}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          neighborhood1: { name: "Bushwick", stats: {} },
          neighborhood2: { name: "Williamsburg", stats: {} },
        }}
      />
      <Composition
        id="StatCounter"
        component={StatCounter as AnyComponent}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          label: "Violations Found",
          value: 0,
          context: "",
        }}
      />
    </>
  );
};
