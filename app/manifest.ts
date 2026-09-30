import type { MetadataRoute } from "next";
import { BASE_PATH } from "@/lib/base-path";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Krypto",
    short_name: "Krypto",
    description: "Inteligência de mercado cripto: estratégias, trades, sinais e desempenho em um só lugar.",
    start_url: `${BASE_PATH}/`,
    display: "standalone",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    icons: [{ src: `${BASE_PATH}/icon.png`, sizes: "256x256", type: "image/png" }],
  };
}
