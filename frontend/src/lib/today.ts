/** Copy untuk Today hero di Beranda. */

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function todayHeadline({
  minutes,
  target,
  name,
  weekly = false,
}: {
  minutes: number;
  target: number;
  name: string;
  weekly?: boolean;
}): string {
  const who = firstName(name);
  const suffix = who ? `, ${who}` : "";
  const period = weekly ? "minggu ini" : "hari ini";
  if (minutes >= target) return `Target ${period} tercapai${suffix}`;
  if (minutes <= 0 && !weekly) return `Mulai ${target} menit pertamamu hari ini${suffix}`;
  return `${target - minutes} menit lagi untuk target ${period}${suffix}`;
}
