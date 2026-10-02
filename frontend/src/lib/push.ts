import { api } from "./api";

export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64ToUint8(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getPushState(needsInstall: boolean): Promise<PushState> {
  if (!pushSupported()) return needsInstall ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  return subscription ? "on" : "off";
}

export async function enablePush(): Promise<PushState> {
  const config = await api<{ enabled: boolean; public_key: string | null }>("/push/config");
  if (!config.enabled || !config.public_key) throw new Error("Push belum diaktifkan di server.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const registration = await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8(config.public_key),
    }));
  const json = subscription.toJSON();
  await api("/push/subscriptions", {
    method: "POST",
    json: { endpoint: json.endpoint, keys: json.keys },
  });
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api("/push/unsubscribe", { method: "POST", json: { endpoint: subscription.endpoint } }).catch(
      () => undefined,
    );
    await subscription.unsubscribe();
  }
  return "off";
}
