import { cn } from "@/lib/utils";

export function LogoSesi({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-xl bg-white px-2.5 py-1.5 shadow-sm", className)}>
      <img
        src={`${import.meta.env.BASE_URL}logo-almoco-sesi.png`}
        alt="SESI Almoço"
        width={900}
        height={144}
        className="h-7 w-auto"
      />
    </span>
  );
}
