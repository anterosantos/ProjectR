import { getPlayerPhotoUrl } from "@/lib/storage";
import { User } from "lucide-react";
import Image from "next/image";

interface PlayerPhotoProps {
  photoPath: string | null | undefined;
  fullName: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 96,
};

export async function PlayerPhoto({
  photoPath,
  fullName,
  size = "md",
}: PlayerPhotoProps) {
  const photoUrl = await getPlayerPhotoUrl(photoPath);
  const sizePixels = sizeMap[size];

  if (!photoUrl) {
    return (
      <div
        className="flex items-center justify-center rounded-full bg-neutral-100"
        style={{ width: sizePixels, height: sizePixels }}
      >
        <User
          className="text-neutral-400"
          size={size === "sm" ? 16 : size === "md" ? 24 : 48}
        />
      </div>
    );
  }

  return (
    <Image
      src={photoUrl}
      alt={fullName}
      width={sizePixels}
      height={sizePixels}
      className="rounded-full object-cover"
      loading="lazy"
      sizes={`${sizePixels}px`}
    />
  );
}
