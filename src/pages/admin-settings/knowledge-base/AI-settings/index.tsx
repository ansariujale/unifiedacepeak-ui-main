import { Icon } from '@/assets/icons/icon';
import { IconType } from '@/assets/icons/type';
import CustomSelect from '@/components/custom/custom-select';
// import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
import { AISettingConfig, getAISettingConfig, getChatAgentList } from '@/services/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { handleAlert } from '@/lib/utils';
import { Info } from 'lucide-react';
import CustomTooltip from '@/components/custom/custom-tooltip';
import '@/components/mcm/mcm-page.css';

const socialMediaList = [
  { key: 'facebook', apiName: 'FACEBOOK', name: 'Facebook', icon: 'Messanger' },
  { key: 'whatsapp', apiName: 'WHATSAPP', name: 'WhatsApp', icon: 'WhatsappIcon' },
  { key: 'telegram', apiName: 'TELEGRAM', name: 'Telegram', icon: 'TelegramIcon' },
  { key: 'instagram', apiName: 'INSTAGRAM', name: 'Instagram', icon: 'Instagram' },
  { key: 'on_call', apiName: 'ON_CALL', name: 'On call', icon: 'PhoneCallingLine' },
  { key: 'chat_assistant', apiName: 'CHAT_ASSISTANT', name: 'Chat Assistant', icon: 'Chat2' },
];

/* Which channels can run unattended. This was an inline
   `filter(key !== 'on_call' && key !== 'chat_assistant')` buried in the
   markup, so the rule was invisible unless you read the JSX. */
const BOT_CHANNELS = new Set(['facebook', 'whatsapp', 'telegram', 'instagram']);

function AISettings() {
  const [initialized, setInitialized] = useState(false);

  const {
    control,
    reset,
    formState: { errors },
  } = useForm<any>({
    mode: 'onSubmit',
    defaultValues: {
      aiBot: {},
      aiAssistance: {},
    },
  });

  // const [customModel, setCustomModel] = useState<any>(null);
  // const [secretKey, setSecretKey] = useState('');

  const { data: typeListData = [] } = useQuery({
    queryKey: ['getChatAgentList'],
    queryFn: () => getChatAgentList(),
    select: (data) => data?.data?.data?.result?.rows || [],
  });

  const allAgents = useMemo(() => {
    return (
      (typeListData || []).map((agent: any) => ({
        label: agent?.agentName,
        value: agent?._id,
      })) || []
    );
  }, [typeListData]);

  // const modelOptions = useMemo(() => {
  //   return [{ label: 'Open AI', value: 'openai' }];
  // }, [chatAgents]);
  // const modelOptions = useMemo(() => {
  //   return [{ label: 'Open AI', value: 'openai' }, ...(chatAgents || [])];
  // }, [chatAgents]);

  const { data: savedSettings = [], isLoading } = useQuery({
    queryKey: ['getAISettingConfig'],
    queryFn: () => getAISettingConfig(),
    select: (data) => data?.data?.data || [],
  });
  const { mutate } = useMutation({
    mutationFn: AISettingConfig,
    mutationKey: ['AISettingConfig'],
    onSuccess: (data) => {
      handleAlert({
        text:
          data?.data?.data?.message ||
          data?.data?.message ||
          'AI agent setting updated successfully',
        type: 'success',
      });
    },
  });

  useEffect(() => {
    if (initialized) return;

    if (savedSettings?.length && allAgents?.length) {
      const values = mapSavedValues(savedSettings, allAgents);
      reset(values);
      setInitialized(true);
    }
  }, [savedSettings, allAgents, initialized, reset]);
  useEffect(() => {
    if (savedSettings?.length && allAgents?.length) {
      const values = mapSavedValues(savedSettings, allAgents);
      reset(values);
    }
  }, [savedSettings, allAgents]);

  const mapSavedValues = (settings: any[], agents: any[]) => {
    const defaults: any = {
      aiBot: {},
      aiAssistance: {},
    };

    settings?.forEach((item) => {
      const media = socialMediaList?.find((m) => m?.apiName === item?.name);
      if (!media) return;

      const agent = agents?.find((a) => a?.value === item?.agentId);
      if (!agent) return;

      if (item.type === 'AI_BOT') {
        defaults.aiBot[media.key] = agent;
      } else {
        defaults.aiAssistance[media.key] = agent;
      }
    });

    return defaults;
  };

  const handleAgentUpdate = (type: 'AI_BOT' | 'AI_ASSISTANT', media: any, selectedAgent: any) => {
    const payload = {
      type,
      name: media?.apiName,
      agentId: selectedAgent?.value || '',
    };
    mutate(payload);
  };

  return (
    <form className="mcm-intpage w-full min-w-0 bg-gray-200/15 flex flex-col overflow-hidden">
      {/* The console's page head: a red mono eyebrow naming the area, then
          the title. It was a breadcrumb with both halves at the same weight
          and the description crammed against the far right edge, where it
          read as an unrelated caption rather than as this page's own
          subtitle. The description now rides the info tip beside the title,
          as on the compliance pages. The eyebrow is a label, not a link --
          the sidebar is the way back. */}
      <div className="mcm-intpage-head">
        <div className="mcm-intpage-eyebrow">AI Tools</div>

        <div className="mcm-intpage-headrow">
          <div className="mcm-intpage-headleft">
            <div className="flex min-w-0 items-center gap-2">
              <h1>Settings</h1>
              <CustomTooltip
                side="bottom"
                sideOffset={10}
                className="mcm-tooltip-info"
                text="Which agent answers on each channel. AI Bot replies on its own; AI Assistance suggests replies to a human."
              >
                <Info className="mcm-intpage-info" />
              </CustomTooltip>
            </div>
          </div>
        </div>
      </div>

      <div className="mcm-intbody w-full p-3 overflow-y-auto">
        {/* One row per channel, one column per mode.

            It was two cards side by side, each listing the same six channels
            -- so every channel name was printed twice, the two cards could
            never be the same height, and the question you actually come here
            with ("what happens on WhatsApp?") needed you to find WhatsApp in
            one card, remember it, then find it again in the other. Turned on
            its side, that question is one row. */}
        <div className="mcm-aitable">
          <div className="mcm-aitable-head">
            <span>Channel</span>
            <span className="mcm-aitable-col">
              AI Bot
              <CustomTooltip
                side="top"
                sideOffset={8}
                className="mcm-tooltip-info"
                text="Answers the customer directly, with no one in the loop."
              >
                <Info className="mcm-intpage-info" />
              </CustomTooltip>
            </span>
            <span className="mcm-aitable-col">
              AI Assistance
              <CustomTooltip
                side="top"
                sideOffset={8}
                className="mcm-tooltip-info"
                text="Drafts a reply for an agent to review before it is sent."
              >
                <Info className="mcm-intpage-info" />
              </CustomTooltip>
            </span>
          </div>

          {socialMediaList?.map((media) => {
            const botSupported = BOT_CHANNELS.has(media.key);

            return (
              <div key={media.key} className="mcm-aitable-row">
                <span className="mcm-airow-name">
                  <Icon name={media.icon as IconType} className="mcm-aiicon" />
                  {media.name}
                </span>

                {/* On call and Chat Assistant have no unattended mode. The
                    old layout expressed that by leaving them out of the left
                    card entirely, which reads as an oversight; saying so is
                    clearer than a gap. */}
                <div className="mcm-aitable-cell" data-label="AI Bot">
                  {botSupported ? (
                    <Controller
                      control={control}
                      name={`aiBot.${media.key}`}
                      render={({ field }) => (
                        <CustomSelect
                          {...field}
                          isClearable
                          inputClass="mcm-select"
                          isLoading={isLoading}
                          placeholder="Select agent"
                          className="mcm-aiselect"
                          handleChange={(value) => {
                            field.onChange(value);
                            handleAgentUpdate('AI_BOT', media, value);
                          }}
                          options={allAgents || []}
                          error={(errors?.aiBot as any)?.[media.key]?.message}
                        />
                      )}
                    />
                  ) : (
                    <span className="mcm-aitable-na">Not available</span>
                  )}
                </div>

                <div className="mcm-aitable-cell" data-label="AI Assistance">
                  <Controller
                    control={control}
                    name={`aiAssistance.${media.key}`}
                    render={({ field }) => (
                      <CustomSelect
                        {...field}
                        isClearable
                        inputClass="mcm-select"
                        isLoading={isLoading}
                        placeholder="Select agent"
                        className="mcm-aiselect"
                        handleChange={(value) => {
                          field.onChange(value);
                          handleAgentUpdate('AI_ASSISTANT', media, value);
                        }}
                        options={allAgents || []}
                        error={(errors?.aiAssistance as any)?.[media.key]?.message}
                      />
                    )}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mcm-aifoot">Changes save as soon as you pick an agent.</p>
      </div>
    </form>
  );
}

export default AISettings;
