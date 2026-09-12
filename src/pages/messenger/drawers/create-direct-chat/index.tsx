import { NoticeLine } from '@/assets/icons';
import CustomSelect from '@/components/custom/custom-select';
import CustomTooltip from '@/components/custom/custom-tooltip';
import { Button } from '@/components/ui/button';
import { yupResolver } from '@hookform/resolvers/yup';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { Info, Loader2, Send, Users2 } from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import moment from 'moment';
import { Label } from '@/components/ui/label';
import { ExtensionListView } from '@/pages/admin-settings/people/update-forwarding/call-rules/add-coworker';
import { useSocketEvents } from '@/hooks/use-socket-events';
import { generateUniqueId } from '@/lib/utils';
import { chatEvents } from '@/context/socket-events';
// import { toast } from 'react-toastify';
import { createPrivateChatId } from '@/context/socket-events-context';
import useDebounce from '@/hooks/use-debounce';
import { useMessengerUsers } from '../../hooks/use-messenger-users';

const validationSchema = yup.object().shape({
  message: yup.string().required('Message is required'),
  member: yup
    .object({
      uuid: yup.string(),
    })
    .nullable()
    .test('required', 'Recipient is required', (val) => !!val?.uuid),
  attachments: yup.array(),
});

const CreateDirectChat = ({
  handleClose = () => null,
  onChatSelect,
}: {
  handleClose: any;
  onChatSelect?: (chat: any) => void;
}) => {
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const { socketEventsManager, allChats } = useSocketEvents();
  const { user } = useUser();

  const {
    setValue,
    watch,
    reset,
    formState: { errors },
    handleSubmit,
  } = useForm({
    mode: 'all',
    defaultValues: {
      member: null,
      message: '',
      attachments: [],
    },
    resolver: yupResolver(validationSchema),
  });

  const debouncedUserSearch = useDebounce(userSearch, 300);
  const {
    users: userListing,
    fetchNextPage,
    hasNextPage = false,
    isFetchingNextPage,
    isLoading: isLoadingUsers,
  } = useMessengerUsers({
    search: debouncedUserSearch,
  });

  const [member] = watch(['member']);
  const memberErrorMessage =
    (errors?.member as any)?.message || (errors?.member as any)?.uuid?.message || '';
  const messageErrorMessage = (errors?.message as any)?.message || '';

  async function handleSendMessage(values: any) {
    const trimmedMessage = values?.message?.trim();
    if (!trimmedMessage) return;
    setIsSendingMessage(true);
    const selectedUser = values?.member;

    try {
      const chatId = createPrivateChatId([user.uuid, selectedUser?.uuid]);

      // Check if this chat already exists in allChats
      const chatExists = Array.isArray(allChats)
        ? allChats.find((chat: any) => chat?.chatId === chatId)
        : null;

      if (!chatExists) {
        // Chat doesn't exist yet — create it first via socket
        socketEventsManager?.emit(
          chatEvents.CREATE_NEW_CHAT,
          {
            chatId,
            company_uuid: user?.company_info?.uuid,
            users: [
              {
                uuid: user?.uuid,
                name: `${user?.first_name || user?.user_info?.first_name || ''} ${user?.last_name || user?.user_info?.last_name || ''}`.trim(),
                email: user?.email || user?.user_info?.email,
                extension: user?.extension || user?.user_info?.extension,
              },
              {
                uuid: selectedUser?.uuid,
                name: `${selectedUser?.first_name || ''} ${selectedUser?.last_name || ''}`.trim(),
                email: selectedUser?.email,
                extension: selectedUser?.extension || selectedUser?.value,
              },
            ],
          },
          (response: any) => {
            console.info('Server ack: handleSendMessage', response);
            if (trimmedMessage && response?.status === 200) {
              const defaultEditorValue = [
                {
                  type: 'paragraph',
                  children: [{ text: trimmedMessage }],
                },
              ] as any;
              // ✅ send message only after chat is created
              socketEventsManager?.emit(chatEvents.SEND_MESSAGE, {
                chatId,
                message: defaultEditorValue,
                attachments: [],
                senderId: user?.uuid,
                messageId: generateUniqueId(),
                receiverId: [selectedUser?.uuid],
                createdAt: moment().format('YYYY-MM-DD[T]HH:mm:ss.SSSZZ'),
              });
              // toast.success('Chat created successfully!');
              if (onChatSelect) {
                onChatSelect({ chatId });
              }
              reset();
              handleClose();
            }
          },
        );
      } else {
        console.info('Server ack: handleSendMessage', chatExists);
        if (trimmedMessage && chatExists) {
          const defaultEditorValue = [
            {
              type: 'paragraph',
              children: [{ text: trimmedMessage }],
            },
          ] as any;
          // ✅ send message only after chat is created
          socketEventsManager?.emit(chatEvents.SEND_MESSAGE, {
            chatId,
            message: defaultEditorValue,
            attachments: [],
            senderId: user?.uuid,
            messageId: generateUniqueId(),
            receiverId: [selectedUser?.uuid],
            createdAt: moment().format('YYYY-MM-DD[T]HH:mm:ss.SSSZZ'),
          });

          if (onChatSelect) {
            onChatSelect({ chatId });
          }
          reset();
          handleClose();
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  }

  const messageLength = (watch('message') || '').length;

  return (
    <>
      <div className="flex flex-col gap-0.5 border-b border-gray-100 pb-3 text-gray-900">
        <div className="min-h-9 truncate text-base font-semibold">New Message</div>
        <p className="text-xs font-normal text-gray-500">
          Start a one-to-one conversation with a teammate.
        </p>
      </div>

      <div className="w-full flex flex-col gap-2 justify-between h-full min-h-0">
        <div className="flex flex-col min-h-0 overflow-auto gap-5 pt-3">
          <CustomSelect
            label={'Recipient'}
            options={userListing
              ?.filter((item: any) => item?.uuid !== user?.uuid)
              ?.map((u: any) => ({
                ...u,
                label: `${u?.first_name} ${u?.last_name}`,
                value: u?.extension,
                uuid: u?.uuid,
              }))}
            value={member}
            handleChange={(e) => setValue('member', e, { shouldValidate: true })}
            placeholder="Search by name..."
            error={memberErrorMessage}
            FormatOptionLabel={ExtensionListView}
            isLoading={isLoadingUsers || isFetchingNextPage}
            onInputChange={setUserSearch}
            onMenuScrollToBottom={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
          />

          <div className="flex flex-col gap-2.5 w-full">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Label>{'Message'}</Label>
                  <CustomTooltip
                    side="bottom"
                    align="start"
                    className="max-w-64"
                    text={
                      <span className="text-xs leading-5">
                        Conversation with one or more specific people is great for informal chat.
                        For projects, team, or topic-based discussion, consider{' '}
                        <span className="inline-flex items-center gap-1 cursor-pointer font-medium text-primary hover:underline">
                          <Users2 className="h-3 w-3" />
                          sending message to team.
                        </span>
                      </span>
                    }
                  >
                    <span className="inline-flex items-center cursor-pointer text-gray-400 hover:text-primary">
                      <Info className="h-3.5 w-3.5" />
                    </span>
                  </CustomTooltip>
                </div>
                <div className="flex items-center gap-1.5">
                  {messageErrorMessage ? (
                    <CustomTooltip text={messageErrorMessage}>
                      <span className="inline-flex items-center cursor-pointer">
                        <NoticeLine className="w-3.5 h-3.5 text-red-500" />
                      </span>
                    </CustomTooltip>
                  ) : null}
                  <span className="text-[11px] font-medium text-gray-400">
                    {messageLength > 0 ? `${messageLength} characters` : ''}
                  </span>
                </div>
              </div>
              <div
                className={`flex items-center w-full rounded-xl bg-white transition-colors focus-within:border-[var(--mcm-accent-edge)] focus-within:shadow-[0_0_0_3px_rgba(254,202,202,0.35)] ${
                  messageErrorMessage ? 'border border-red-400' : 'border border-gray-200'
                }`}
              >
                <div className="flex min-h-[126px] justify-between w-full p-3 flex-col gap-2">
                  <textarea
                    rows={4}
                    className="border-none outline-0 text-sm resize-none placeholder:text-gray-400"
                    style={{ outline: 'none' }}
                    placeholder="Write a message..."
                    value={watch('message')}
                    onChange={(e) =>
                      setValue('message', e.target.value, {
                        shouldValidate: true,
                        shouldTouch: true,
                      })
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.shiftKey) {
                        e.preventDefault();
                        setValue('message', `${watch('message')}\n`, {
                          shouldValidate: true,
                          shouldTouch: true,
                        });
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
          <Button variant={'transparent'} type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant={'primary'}
            type="button"
            onClick={handleSubmit(handleSendMessage)}
            disabled={isSendingMessage}
          >
            {isSendingMessage ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Message
          </Button>
        </div>
      </div>
    </>
  );
};

export default CreateDirectChat;
