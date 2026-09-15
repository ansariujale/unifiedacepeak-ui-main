import Chat from '@/pages/messenger/chat';
import CaptainContent from './captain-content';
import FacebookDemoContent from './facebook-demo-content';
import InstagramDemoContent from './instagram-demo-content';
import WhatsappDemoContent from './whatsapp-demo-content';
import TelegramDemoContent from './telegram-demo-content';

// Routes to whichever real content renderer matches the selected row's
// origin — the actual internal Chat system for internal conversations, the
// Captain content view for website ones, and the Messenger-styled demo view
// for a sample Facebook row (no real chat id behind it, so `Chat` has
// nothing to load).
const AllChannelsContent = ({ selectedChat, onBackToList }: { selectedChat: any; onBackToList?: () => void }) => {
  if (!selectedChat) return null;

  if (selectedChat.__channelKind === 'captain') {
    return <CaptainContent selectedChat={selectedChat} onBackToList={onBackToList} />;
  }

  if (selectedChat.__channelKind === 'facebook' && selectedChat.isDemo) {
    return <FacebookDemoContent selectedChat={selectedChat} onBackToList={onBackToList} />;
  }

  if (selectedChat.__channelKind === 'instagram' && selectedChat.isDemo) {
    return <InstagramDemoContent selectedChat={selectedChat} onBackToList={onBackToList} />;
  }

  if (selectedChat.__channelKind === 'whatsapp' && selectedChat.isDemo) {
    return <WhatsappDemoContent selectedChat={selectedChat} onBackToList={onBackToList} />;
  }

  if (selectedChat.__channelKind === 'telegram' && selectedChat.isDemo) {
    return <TelegramDemoContent selectedChat={selectedChat} onBackToList={onBackToList} />;
  }

  return <Chat chatId={selectedChat.chatId} onBackToList={onBackToList} />;
};

export default AllChannelsContent;
