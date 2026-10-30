import { cn } from "@/lib/utils";

export function LogoSesi({ className }: { className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo-sesi.png`}
      alt="SESI"
      width={365}
      height={118}
      className={cn("h-9 w-auto shrink-0", className)}
    />
  );
}
