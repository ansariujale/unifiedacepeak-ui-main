import { FC, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FormProvider, useForm } from 'react-hook-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import Loader from '@/components/custom/loader';
import { useUser } from '@/hooks/use-user';
import ChooseFile from './choose-file';
import Record from './record';
import TextToSpeech from './text-to-speech';
import { options, TAB_CONSTANT } from '../constant';
import {
  capitalizeFirstLetter,
  convertBase64ToBlob,
  handleAlert,
  isAudioFile,
  loadAudioFileAsync,
  sanitizePlainTextInput,
} from '@/lib/utils';
import { createGreeting, mediaUploadUrl, textToSpeech } from '@/services/api';
import { AddGreetingProps, GreetingForm } from '@/interfaces/audio-interface';
import { Input } from '@/components/ui/input';
import CustomSelect from '@/components/custom/custom-select';

interface IAddgreetings extends AddGreetingProps {
  refetch?: () => void;
  isRefetchable?: boolean;
}

const AddGreeting: FC<IAddgreetings> = ({
  setDrawerState,
  greetingType,
  refetch = () => {},
  isRefetchable = true,
  selectMenuPortalTarget,
}) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>(TAB_CONSTANT.CHOOSE_FILE);
  const [showLoader, setShowLoader] = useState(false);
  const formInstance = useForm<GreetingForm>({
    defaultValues: {
      greeting: '',
      greeting_type: greetingType,
      greetingFile: null,
      textToSpeech: '',
      textFile: null,
      textToSpeechLocale: null,
      textToSpeechVoice: null,
    },
  });
  const { watch, reset, setValue, register } = formInstance;
  const [WatchUploadFile, WatchTextFile] = watch(['greetingFile', 'textFile']);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const { mutateAsync: uploadMediaMutate, isPending } = useMutation({
    mutationFn: mediaUploadUrl,
  });

  const {
    mutate: mutateTextToSpeech,
    mutateAsync: mutateTextToSpeechAsync,
    isPending: isPendingTextToSpeech,
  } = useMutation({
    mutationFn: textToSpeech,
    onSuccess: (data) => {
      const base64Data = data?.data?.data?.result;
      if (base64Data) {
        const file = createFileFromBase64(base64Data);
        setValue('textFile', file);
      }
    },
  });

  const { mutate: upsertGreetingsMutate, isPending: isPendingCreateGreeting } = useMutation({
    mutationFn: createGreeting,
    onSuccess: async (data) => {
      setActiveTab(TAB_CONSTANT.CHOOSE_FILE);
      if (isRefetchable) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['greetings'] }),
          queryClient.invalidateQueries({ queryKey: ['greetingList'] }),
        ]);
      }
      setShowLoader(false);
      setDrawerState(false);
      handleAlert({
        text: data?.data?.message || 'Greeting Created Successfully',
        type: 'success',
      });
      refetch();
      // reset();
    },
    onError: () => {
      setShowLoader(false);
    },
  });

  const createFileFromBase64 = (base64String: string): File => {
    const blob = convertBase64ToBlob(base64String);
    return new File([blob], 'audio.mp3', { type: 'audio/mpeg' });
  };

  const handleCreateGreeting = async () => {
    if (showLoader) return;
    try {
      setShowLoader(true);
      const greetingFile = WatchUploadFile;
      /* The Type picker only exists for the "all types" caller (Media
         Files), and it's hidden on the Text to Speech tab along with Name
         — so there's nothing for the person to have chosen there. Falls
         back to "greeting", the common case for a spoken clip, rather
         than sending an empty type. Choose File / Record are unaffected:
         they still read whatever was actually picked in that dropdown. */
      const greetType =
        greetingType === 'all'
          ? (watch('greeting_type')?.value?.toLowerCase() ??
            (activeTab === TAB_CONSTANT.TEXT_TO_SPEECH ? 'greeting' : undefined))
          : greetingType?.toLowerCase();

      let fileToUpload: File | null = null;

      if (activeTab === TAB_CONSTANT.TEXT_TO_SPEECH) {
        fileToUpload = WatchTextFile;
        /* Text to Speech no longer has its own "generate" button — Upload
           now does both steps for this tab in one click: convert the text
           to audio first (same request the old button made), then upload
           that result exactly as before. */
        if (!fileToUpload) {
          const ttsResponse = await mutateTextToSpeechAsync({
            text: watch('textToSpeech'),
            locale: watch('textToSpeechLocale')?.value,
            short_name: watch('textToSpeechVoice')?.value || '',
          });
          const base64Data = ttsResponse?.data?.data?.result;
          if (base64Data) {
            fileToUpload = createFileFromBase64(base64Data);
            setValue('textFile', fileToUpload);
          }
        }
      } else if (greetingFile) {
        fileToUpload = greetingFile;
      }

      if (!fileToUpload) {
        setShowLoader(false);
        return;
      }

      if (!isAudioFile(fileToUpload)) {
        handleAlert({ text: 'Please upload an audio file.', type: 'error' });
        setShowLoader(false);
        return;
      }

      const uploadMediaResponse = await uploadMediaMutate({
        uuid: user?.company_info?.uuid,
        type: 'greeting',
        file_name: fileToUpload?.name || 'audio.mp3',
      });

      const successResponse = uploadMediaResponse?.data?.data?.result;

      if (successResponse?.file_name && successResponse?.url) {
        const { url, file_name } = successResponse;

        const fileUrl = URL.createObjectURL(fileToUpload);
        const audioContext = new AudioContext();
        let duration = 0;

        try {
          const arrayBuffer: any = await loadAudioFileAsync(fileUrl);
          const decodedAudioData = await audioContext.decodeAudioData(arrayBuffer);
          duration = Math.ceil(decodedAudioData.duration);
        } finally {
          URL.revokeObjectURL(fileUrl);
          await audioContext.close().catch(() => undefined);
        }

        /* Name isn't shown on the Text to Speech tab (it never needed a
           file/name up front the way Choose File does), so it falls back
           to the text that was actually converted — still a real,
           readable name, just not one the user had to type twice. */
        const fallbackName =
          activeTab === TAB_CONSTANT.TEXT_TO_SPEECH ? watch('textToSpeech') : '';
        const greetingPayload = {
          name: sanitizePlainTextInput(watch('greeting') || fallbackName, 50),
          filename: file_name,
          size: fileToUpload.size || 0,
          duration: duration,
          type: greetType,
          is_default: false,
        };

        const uploadFileResponse = await fetch(url, {
          method: 'PUT',
          body: fileToUpload,
        });

        if (uploadFileResponse.status === 200) {
          upsertGreetingsMutate(greetingPayload);
        }
      }
    } catch (error) {
      setShowLoader(false);
      console.error(error);
    }
  };

  const handleTextToSpeech = () => {
    const payload: any = {
      text: watch('textToSpeech'),
      locale: watch('textToSpeechLocale')?.value,
      short_name: watch('textToSpeechVoice')?.value || '',
    };

    mutateTextToSpeech(payload);
  };

  return (
    <div className="w-full flex flex-col gap-2 justify-between h-full">
      <FormProvider {...formInstance}>
        <div
          className={`flex flex-col gap-4 pr-1 flex-1 ${
            activeTab === TAB_CONSTANT.TEXT_TO_SPEECH ? 'max-h-[65vh] overflow-y-auto' : ''
          }`}
        >
          <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col w-full">
            <div className="border-b border-gray-200 w-full mb-4">
              <TabsList className="flex text-sm font-semibold text-center p-0 rounded-none h-auto justify-start bg-transparent gap-6">
                {Object.entries(TAB_CONSTANT).map(([key, value]) => (
                  <TabsTrigger
                    key={key}
                    value={value}
                    type="button"
                    onClick={(event) => event.stopPropagation()}
                    className="data-[state=active]:border-b-2 data-[state=active]:border-b-primary data-[state=active]:text-primary border-b-2 border-transparent px-1 pb-3 pt-2 text-gray-600 cursor-pointer rounded-none relative flex gap-1 bg-transparent font-semibold data-[state=active]:shadow-none hover:text-gray-900 transition-colors"
                  >
                    {value}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            <TabsContent value={TAB_CONSTANT.CHOOSE_FILE}>
              <ChooseFile />
            </TabsContent>

            <TabsContent value={TAB_CONSTANT.RECORD}>
              <Record />
            </TabsContent>

            <TabsContent value={TAB_CONSTANT.TEXT_TO_SPEECH}>
              <TextToSpeech
                handleTextToSpeech={handleTextToSpeech}
                isPendingTextToSpeech={isPendingTextToSpeech}
                selectMenuPortalTarget={selectMenuPortalTarget}
              />
            </TabsContent>
          </Tabs>

          {/* Name/Type only matter once there's something to actually save —
              for Choose File and Record that's true from the moment the tab
              opens. Text to Speech never shows them at all, even once
              audio has been generated — Upload treats that result as a
              complete greeting on its own (name comes from the text that
              was converted, type from this row's own context), the same
              way it already treats a chosen file on Choose File without
              asking for anything extra there either. */}
          {activeTab !== TAB_CONSTANT.TEXT_TO_SPEECH && (
            <>
              <Input
                {...register('greeting')}
                label={'Name'}
                placeholder={'Enter Name'}
                maxLength={50}
              />
              {greetingType === 'all' ? (
                <CustomSelect
                  label={'Type'}
                  options={options}
                  handleChange={(value) => {
                    setValue('greeting_type', value, { shouldValidate: true });
                  }}
                  value={watch(`greeting_type`)}
                  placeholder="Select Type"
                />
              ) : (
                <Input label="Type" value={capitalizeFirstLetter(greetingType)} disabled={true} />
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4 mt-auto">
          <Button
            variant="transparent"
            type="button"
            className="rounded-full"
            onClick={() => {
              reset();
              setDrawerState(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant={'dark'}
            type="button"
            className="rounded-full"
            onClick={handleCreateGreeting}
            disabled={
              showLoader ||
              (activeTab === TAB_CONSTANT.TEXT_TO_SPEECH
                ? !watch('textToSpeech') ||
                  !watch('textToSpeechLocale') ||
                  !watch('textToSpeechVoice')
                : !watch('greeting') || !WatchUploadFile)
            }
          >
            {isPending || isPendingCreateGreeting || showLoader ? (
              <div className="flex items-center justify-center p-5">
                <Loader variant="blue" size="sm" />
              </div>
            ) : (
              'Upload'
            )}
          </Button>
        </div>
      </FormProvider>
    </div>
  );
};

export default AddGreeting;
