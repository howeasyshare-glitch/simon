"use client";

import { useMemo } from "react";
import OutfitCard from "./OutfitCard";

type Props = {
  outfits: any[];
  onSelect?: (item: any) => void;
  userProfile?: {
    gender?: string;
    age?: string | number;
    height?: string | number;
    weight?: string | number;
    temperature?: string | number;
    styleSummary?: string;
  };
};

export default function HeroCarousel({
  outfits = [],
  onSelect,
  userProfile,
}: Props) {
  const list = useMemo(() => Array.isArray(outfits) ? outfits : [], [outfits]);

  if (!list.length) return null;

  return (
    <section className="w-full mt-6">
      <div className="grid gap-6">
        {list.map((item, idx) => (
          <OutfitCard
            key={item?.id || idx}
            item={item}
            userProfile={userProfile}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
