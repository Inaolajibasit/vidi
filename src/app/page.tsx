import { HomeExperience } from "@/features/games/components/home-experience";
import { getHomeData } from "@/features/games/home-data";

export default async function Home() {
  const homeData = await getHomeData();

  return <HomeExperience {...homeData} />;
}
