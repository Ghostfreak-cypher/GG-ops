import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/task-ui";

const avatarVariants = cva(
  "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-medium text-secondary-foreground select-none uppercase",
  {
    variants: {
      size: {
        xs: "size-5 text-[0.5rem]",
        sm: "size-6 text-[0.625rem]",
        md: "size-8 text-xs",
        lg: "size-10 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  name?: string | null;
  image?: string | null;
  className?: string;
}

export function Avatar({ name, image, size, className }: AvatarProps) {
  return (
    <span
      className={cn(avatarVariants({ size }), className)}
      title={name ?? undefined}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={name ?? ""} className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

type Person = { name?: string | null; image?: string | null };

export function AvatarStack({
  people,
  max = 3,
  size = "sm",
  className,
}: {
  people: Person[];
  max?: number;
  size?: AvatarProps["size"];
  className?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {shown.map((p, i) => (
        <Avatar
          key={i}
          name={p.name}
          image={p.image}
          size={size}
          className="ring-2 ring-card"
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            avatarVariants({ size }),
            "ring-2 ring-card text-muted-foreground",
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
