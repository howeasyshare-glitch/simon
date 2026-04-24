"use client";

import OutfitCard, { type OutfitItem } from "./OutfitCard";

type Props = {
  items: OutfitItem[];
  generatedItems?: OutfitItem[];
  stage: "featured" | "generated" | string;
  setStage: (v: any) => void;
  generatedImageUrl?: string;
  generatedSummary?: string;
  generatedShareUrl?: string;
  onOpen?: (src: string) => void;
  onLike?: (item: OutfitItem) => void;
  onShare?: (item: OutfitItem) => void;
  onApply?: (item: OutfitItem) => void;
  isLiked?: (id: string) => boolean;
  isShared?: (id: string) => boolean;
  mode?: "home" | "simple" | string;
  profileSnapshot?: {
    gender?: string;
    audience?: string;
    age?: string | number;
    height?: string | number;
    weight?: string | number;
    temp?: string | number;
    summary?: string;
  };
};

export default function HeroCarousel({
  items = [],
  generatedItems = [],
  stage,
  onApply,
  profileSnapshot,
}: Props) {
  const list =
    stage === "generated" && generatedItems.length > 0
      ? generatedItems
      : items;

  if (!list.length) return null;

  const userProfile = {
    gender: profileSnapshot?.gender,
    age: profileSnapshot?.age,
    height: profileSnapshot?.height,
    weight: profileSnapshot?.weight,
    temperature: profileSnapshot?.temp,
    styleSummary: profileSnapshot?.summary,
  };

  return (
    <section className="w-full mt-6">
      <div className="grid gap-6">
        {list.map((item, idx) => (
          <OutfitCard
            key={item?.id || idx}
            item={item}
            userProfile={userProfile}
            onSelect={onApply}
          />
        ))}
      </div>
    </section>
  );
}
