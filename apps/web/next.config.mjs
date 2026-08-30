import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // next dev를 LAN IP로 열 때만 쓰인다. 다른 기기/사내망에서는 그 기기의 IP를
  // NEXT_DEV_ORIGINS에 넣는다(쉼표 구분). 기본값은 GB10의 사내 IP.
  allowedDevOrigins: (process.env.NEXT_DEV_ORIGINS ?? "172.16.4.228")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export default nextConfig;
