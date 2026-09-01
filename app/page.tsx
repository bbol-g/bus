import Dashboard from "./dashboard";
import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <Dashboard user={{ name: user.displayName, signOut: chatGPTSignOutPath("/") }} />;
}
