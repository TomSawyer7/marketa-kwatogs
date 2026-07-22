import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ChatPane } from "@/components/inbox/ChatPane";

const ChatThread = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto flex flex-col h-[calc(100dvh-var(--header-h)-1px)]">
        <ChatPane threadId={id ?? null} showBack onBack={() => navigate("/inbox")} />
      </div>
    </AppShell>
  );
};

export default ChatThread;
