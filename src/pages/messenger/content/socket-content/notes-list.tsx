import { useEffect, useState } from 'react';
import { ArrowLeft, NotebookPenIcon, PlusIcon } from 'lucide-react';
import moment from 'moment';
import TextEditor from '@/components/custom/text-editor';
import { Button } from '@/components/ui/button';
import { EditStrokIcon, TrashBin } from '@/assets/icons';
import AlertConfirm from '@/components/custom/alert-confirm';
import { useUser } from '@/hooks/use-user';
import { useSearchParamManager } from '@/hooks/use-search-params';
import { useSocketEvents } from '@/hooks/use-socket-events';
import { useCompanyFeatures } from '@/hooks/rbac';
import CustomTooltip from '@/components/custom/custom-tooltip';

const defaultEditorValue = [
  {
    type: 'paragraph',
    children: [{ text: '' }],
  },
];

// The note body is stored as a Slate document (same shape the rich-text
// editor produces) so existing notes still render via the read-only
// `TextEditor` in the list — a plain textarea here just round-trips through
// that shape instead of adopting it as the storage format.
const slateToPlainText = (nodes: any): string => {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node: any) =>
      Array.isArray(node?.children) ? node.children.map((c: any) => c?.text || '').join('') : '',
    )
    .join('\n');
};

const plainTextToSlate = (text: string) =>
  text.split('\n').map((line) => ({ type: 'paragraph', children: [{ text: line }] }));

const NotesList = ({ selectedChat, setActiveState }: any) => {
  const [addNotes, setAddNotes] = useState(false);
  const [currentNote, setCurrentNote] = useState<any>({ title: '', content: [] });
  const isEdit = currentNote?._id ? true : false;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [deleteAlertModal, setDeleteAlertModal] = useState<any>(null);
  const { features } = useCompanyFeatures();
  const chatAccess = features?.plan_features?.chat?.action || {};
  const { getParam } = useSearchParamManager();
  const noteId: any = getParam('noteId');

  const { handleCreateNote, notesList, getNotesByChatId, handleDeleteNote, handleUpdateNote } =
    useSocketEvents();

  const currentChatNotes =
    notesList?.filter((item) => item?.chatId === selectedChat?.chatId)?.[0]?.notes || [];

  const { user } = useUser();

  const otherUserData = selectedChat?.users?.find((item: any) => item?.uuid !== user?.uuid);

  const handleSave = () => {
    if (!currentNote?.title && !currentNote?.content) return;

    if (isEdit) {
      handleUpdateNote({
        noteId: currentNote?._id,
        senderId: user?.uuid,
        receiverId: selectedChat?.isGroupChat
          ? selectedChat?.users
              ?.map((item: any) => item?.uuid)
              ?.filter((item: any) => item !== user?.uuid)
          : [otherUserData?.uuid],
        title: currentNote?.title,
        noteData: currentNote?.content,
      });
      setCurrentNote(null);
      setAddNotes(false);
    } else {
      handleCreateNote({
        chatId: selectedChat?.chatId,
        creatorId: user?.uuid,
        receiverId: selectedChat?.isGroupChat
          ? selectedChat?.users
              ?.map((item: any) => item?.uuid)
              ?.filter((item: any) => item !== user?.uuid)
          : [otherUserData?.uuid],
        title: currentNote?.title,
        noteData: currentNote?.content,
      });
      setCurrentNote(null);
      setAddNotes(false);
    }
  };

  const handleEdit = (note: any) => {
    setCurrentNote({ content: note?.noteData, ...note });
    setAddNotes(true);
  };

  useEffect(() => {
    if (selectedChat?.chatId && user?.uuid) {
      if (!notesList?.map((v: any) => v?.chatId).includes(selectedChat?.chatId)) {
        getNotesByChatId({ chatId: selectedChat?.chatId, senderId: user?.uuid });
      }
    }
  }, [selectedChat?.chatId, user?.uuid]);

  return (
    <div className="w-full flex flex-col h-full bg-[var(--color-bg-gray-50)] overflow-hidden">
      <div className="w-full shrink-0 px-4 bg-white flex items-center justify-between border-b min-h-[56px] lg:min-h-[65px] border-b-gray-200">
        <div className="cursor-pointer" onClick={() => setActiveState('message')}>
          <div className="flex gap-2 items-center">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
            <h3 className="text-sm lg:text-base font-semibold text-gray-900">Notes</h3>
          </div>
        </div>
        {chatAccess?.create_note && (
          <div
            className="mcm-chat-iconbtn"
            onClick={() => {
              setAddNotes(true);
              setCurrentNote({ title: 'Untitled Note', content: defaultEditorValue });
            }}
          >
            <CustomTooltip text="Add Note">
              <PlusIcon className="w-5 h-5" />
            </CustomTooltip>
          </div>
        )}
      </div>

      {addNotes && (
        <div className="flex-1 w-full bg-white lg:bg-[var(--color-bg-gray-50)] p-4 flex flex-col min-h-0 overflow-hidden">
          <div className="mcm-notes-card flex h-full w-full flex-col justify-between rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(17,17,17,0.06)]">
            <div className="flex w-full flex-col">
              {isEditingTitle ? (
                <div className="relative flex flex-col border-b border-slate-200">
                  <input
                    autoFocus
                    placeholder="Note title"
                    className="h-11 w-full border-0 bg-transparent pl-4 pr-16 text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400"
                    value={currentNote?.title}
                    maxLength={100}
                    onChange={(e) =>
                      setCurrentNote((prev: any) => ({ ...prev, title: e.target.value }))
                    }
                    onBlur={() => setIsEditingTitle(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setIsEditingTitle(false);
                      }
                    }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-slate-400">
                    {currentNote?.title?.length ?? 0}/100
                  </span>
                </div>
              ) : (
                <h2
                  className="flex h-11 min-h-11 cursor-text items-center overflow-hidden text-ellipsis whitespace-nowrap border-b border-slate-200 px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                  onClick={() => setIsEditingTitle(true)}
                  title="Click to rename"
                >
                  {currentNote?.title || 'Untitled Note'}
                </h2>
              )}
              <div className="mcm-notes-editor w-full px-4 pt-3">
                <textarea
                  className="min-h-[220px] w-full resize-none border-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  placeholder="Type something..."
                  value={slateToPlainText(currentNote?.content || defaultEditorValue)}
                  onChange={(e) =>
                    setCurrentNote((prev: any) => ({
                      ...prev,
                      content: plainTextToSlate(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div className="mcm-notes-foot flex justify-end gap-2 border-t border-slate-100 px-3 py-3">
              <Button
                variant="transparent"
                className="mcm-notes-btn"
                onClick={() => {
                  setAddNotes(false);
                  setCurrentNote(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="mcm-notes-btn is-primary"
                onClick={() => handleSave()}
              >
                {isEdit ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!addNotes ? (
        currentChatNotes?.length > 0 ? (
          <div className="flex-1 w-full bg-white lg:bg-[var(--color-bg-gray-50)] p-4 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2 pb-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
                {currentChatNotes?.map((note: any) => {
                  return (
                    <div
                      key={JSON.stringify(note)}
                      className={`flex flex-col gap-2 rounded-xl border p-3 transition-colors ${
                        noteId === note?._id
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex gap-2 justify-between items-center">
                        <div className="flex gap-2 items-start w-[calc(100%-70px)]">
                          <div className="mt-0.5">
                            <NotebookPenIcon className="w-5 min-w-5 h-5 text-gray-500" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {note?.title}
                            </h3>
                          </div>
                        </div>
                        {note?.creatorId === user?.uuid ? (
                          <div className="flex gap-2">
                            <div
                              onClick={() => handleEdit(note)}
                              className="cursor-pointer w-7 h-7 rounded-full flex items-center justify-center bg-ucass-primary-200 text-primary hover:bg-primary hover:text-white"
                            >
                              <EditStrokIcon className="w-4 h-4" />
                            </div>
                            <div
                              onClick={() => setDeleteAlertModal(note)}
                              className="cursor-pointer w-7 h-7 rounded-full flex items-center justify-center bg-red-100 text-red-500 hover:bg-red-500 hover:text-white"
                            >
                              <TrashBin className="w-4 h-4" />
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <div className="text-sm">
                        {note?.noteData && <TextEditor initialValue={note?.noteData} readOnly />}
                      </div>
                      <span className="text-[11px] text-gray-500 truncate mt-0.5 justify-end w-full">
                        By{' '}
                        {(() => {
                          const creator = selectedChat?.users?.find(
                            (u: any) => u.uuid === note?.creatorId,
                          );
                          if (creator) {
                            return (
                              `${creator.first_name || ''} ${creator.last_name || ''}`.trim() ||
                              creator.name ||
                              'Unknown'
                            );
                          }
                          return 'Unknown';
                        })()}{' '}
                        • {moment(note?.createdAt).format('DD MMM YYYY')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 w-full bg-[var(--color-bg-gray-50)] p-3 flex items-center justify-center min-h-0 overflow-hidden">
            <div className="flex flex-col justify-center items-center gap-2 py-5 h-full w-full mx-auto">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                <NotebookPenIcon className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-base font-semibold text-gray-900">No notes yet</p>
              <p className="text-sm text-center text-gray-500 max-w-xs">
                Create your first note to share with the team.
              </p>
            </div>
          </div>
        )
      ) : null}

      <AlertConfirm
        {...{
          onConfirm: () => {
            handleDeleteNote({
              noteId: deleteAlertModal?._id,
              senderId: user?.uuid,
              receiverId: deleteAlertModal?.receiverId,
              chatId: selectedChat?.chatId,
            });
            setDeleteAlertModal(null);
          },
          open: deleteAlertModal,
          setOpen: setDeleteAlertModal,
          descriptionTextComp: (
            <div className=" text-md">Are you sure, you want to delete this note?</div>
          ),
        }}
      />
    </div>
  );
};

export default NotesList;
